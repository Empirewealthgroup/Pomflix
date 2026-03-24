import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Animated,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "@/lib/store/authStore";
import { authenticateUser } from "@/lib/jellyfin/auth";
import { SERVER_URL, SIGNUP_API_URL } from "@/constants/config";

const { width } = Dimensions.get("window");
const TOGGLE_PADDING = 4;
const PILL_WIDTH = (width - 48 - TOGGLE_PADDING * 2) / 2;

export default function LoginScreen() {
  const { setAuth } = useAuthStore();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [fieldHasError, setFieldHasError] = useState(false);

  // Entrance
  const logoOpacity   = useRef(new Animated.Value(0)).current;
  const dotOpacity    = useRef(new Animated.Value(0)).current;
  const formTranslate = useRef(new Animated.Value(24)).current;
  const formOpacity   = useRef(new Animated.Value(0)).current;
  const dotPulse      = useRef(new Animated.Value(1)).current;

  // Interactions
  const buttonScale   = useRef(new Animated.Value(1)).current;
  const buttonOpacity = useRef(new Animated.Value(1)).current;
  const screenFade    = useRef(new Animated.Value(0)).current;
  const shakeAnim     = useRef(new Animated.Value(0)).current;

  // Toggle pill — useNativeDriver: true (transform only)
  const toggleAnim = useRef(new Animated.Value(0)).current;

  // Signup fields expand — useNativeDriver: false (maxHeight)
  const signupHeight  = useRef(new Animated.Value(0)).current;
  const signupOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(dotOpacity,  { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    Animated.parallel([
      Animated.timing(formTranslate, { toValue: 0, duration: 500, delay: 300, useNativeDriver: true }),
      Animated.timing(formOpacity,   { toValue: 1, duration: 500, delay: 300, useNativeDriver: true }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, { toValue: 1.3, duration: 3000, useNativeDriver: true }),
        Animated.timing(dotPulse, { toValue: 1,   duration: 3000, useNativeDriver: true }),
      ])
    );
    const t = setTimeout(() => pulse.start(), 500);
    return () => { clearTimeout(t); pulse.stop(); };
  }, []);

  const switchMode = (next: "signin" | "signup") => {
    if (next === mode) return;
    setMode(next);
    setLoginError(null);
    setFieldHasError(false);

    Animated.spring(toggleAnim, {
      toValue: next === "signup" ? 1 : 0,
      tension: 300,
      friction: 30,
      useNativeDriver: true,
    }).start();

    const expand = next === "signup";
    Animated.parallel([
      Animated.spring(signupHeight, {
        toValue: expand ? 212 : 0,
        tension: 180,
        friction: 26,
        useNativeDriver: false,
      }),
      Animated.timing(signupOpacity, {
        toValue: expand ? 1 : 0,
        duration: expand ? 220 : 150,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const shake = () =>
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,   duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 40, useNativeDriver: true }),
    ]).start();

  const handlePressIn = () =>
    Animated.parallel([
      Animated.timing(buttonScale,   { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(buttonOpacity, { toValue: 0.9,  duration: 80, useNativeDriver: true }),
    ]).start();

  const handlePressOut = () =>
    Animated.parallel([
      Animated.timing(buttonScale,   { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(buttonOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();

  const handleSubmit = async () => {
    if (!username.trim()) {
      setLoginError("Please enter your username.");
      setFieldHasError(true);
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoginError(null);
    setLoading(true);

    if (mode === "signup") {
      // ─── Create account flow ───────────────────────────────────────────────
      try {
        const res = await fetch(`${SIGNUP_API_URL}/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fullName.trim(),
            email: email.trim(),
            username: username.trim(),
            password,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setLoginError(data.error || "Signup failed. Please try again.");
          setFieldHasError(true);
          shake();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setLoading(false);
          return;
        }

        // Signup succeeded — auto-login
        const authRes = await authenticateUser(SERVER_URL, username.trim(), password);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Animated.timing(screenFade, { toValue: 1, duration: 380, useNativeDriver: true }).start(async () => {
          await setAuth({
            token: authRes.AccessToken,
            userId: authRes.User.Id,
            userName: authRes.User.Name,
            serverUrl: SERVER_URL,
          });
        });
      } catch {
        setLoginError("Could not reach the server. Check your connection.");
        setFieldHasError(true);
        shake();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setLoading(false);
      }
      return;
    }

    // ─── Sign in flow ──────────────────────────────────────────────────────
    try {
      const res = await authenticateUser(SERVER_URL, username.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.timing(screenFade, { toValue: 1, duration: 380, useNativeDriver: true }).start(async () => {
        await setAuth({
          token: res.AccessToken,
          userId: res.User.Id,
          userName: res.User.Name,
          serverUrl: SERVER_URL,
        });
      });
    } catch {
      setLoginError("That didn't work. Check your credentials and try again.");
      setFieldHasError(true);
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLoading(false);
    }
  };

  const pillTranslateX = toggleAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, PILL_WIDTH],
  });

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#0A0A0C", "#050507"]} style={StyleSheet.absoluteFill} />

      {/* Radial pomegranate glow */}
      <View style={styles.radialGlow} pointerEvents="none" />

      {/* Arc ambient — wide soft bleed */}
      <LinearGradient
        colors={["rgba(139,26,46,0.45)", "rgba(100,18,32,0.08)", "transparent"]}
        style={styles.arc}
        pointerEvents="none"
      />

      {/* Arc hot core — tight bright centre */}
      <LinearGradient
        colors={["rgba(210,50,75,0.95)", "rgba(175,35,58,0.35)", "transparent"]}
        style={styles.arcCore}
        pointerEvents="none"
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Branding */}
          <Animated.View style={[styles.logoArea, { opacity: logoOpacity }]}>
            {/* P●mflix — dot replaces the "o" */}
            <View style={styles.logoRow}>
              <Text style={styles.logoText}>P</Text>

              <View style={styles.logoDotWrapper}>
                {/* Outermost feather ring — wide, very faint */}
                <Animated.View
                  style={[
                    styles.logoDotGlowOuter,
                    { transform: [{ scale: dotPulse }], opacity: dotOpacity },
                  ]}
                />
                {/* Outer pulse ring */}
                <Animated.View
                  style={[
                    styles.logoDotGlow,
                    { transform: [{ scale: dotPulse }], opacity: dotOpacity },
                  ]}
                />
                {/* Inner solid dot */}
                <Animated.View style={[styles.logoDot, { opacity: dotOpacity }]} />
              </View>

              <Text style={styles.logoText}>mflix</Text>
            </View>

            <Text style={styles.tagline}>Press play on a state, not a show.</Text>
          </Animated.View>

          {/* Toggle */}
          <Animated.View style={{ opacity: formOpacity }}>
            <View style={styles.toggleContainer}>
              <Animated.View
                style={[styles.togglePill, { transform: [{ translateX: pillTranslateX }] }]}
              />
              <TouchableOpacity style={styles.toggleBtn} onPress={() => switchMode("signin")} activeOpacity={0.8}>
                <Text style={[styles.toggleText, mode === "signin" && styles.toggleTextActive]}>
                  Sign In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toggleBtn} onPress={() => switchMode("signup")} activeOpacity={0.8}>
                <Text style={[styles.toggleText, mode === "signup" && styles.toggleTextActive]}>
                  Create Account
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Form */}
          <Animated.View
            style={[
              styles.form,
              {
                opacity: formOpacity,
                transform: [{ translateY: formTranslate }, { translateX: shakeAnim }],
              },
            ]}
          >
            {/* Signup-only fields — animated expand */}
            <Animated.View
              style={{
                maxHeight: signupHeight,
                opacity: signupOpacity,
                overflow: "hidden",
              }}
            >
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>FULL NAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your full name"
                  placeholderTextColor="#6F6C66"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  keyboardAppearance="dark"
                />
              </View>
              <View style={[styles.fieldGroup, { marginTop: 14 }]}>
                <Text style={styles.label}>EMAIL</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="#6F6C66"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  keyboardAppearance="dark"
                />
              </View>
              <View style={{ height: 14 }} />
            </Animated.View>

            {/* Username */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>USERNAME</Text>
              <TextInput
                style={[styles.input, fieldHasError && styles.inputError]}
                placeholder="Enter your username"
                placeholderTextColor="#6F6C66"
                value={username}
                onChangeText={(v) => { setUsername(v); setFieldHasError(false); }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardAppearance="dark"
              />
            </View>

            {/* Password */}
            <View style={[styles.fieldGroup, { marginTop: 14 }]}>
              <Text style={styles.label}>PASSWORD</Text>
              <View>
                <TextInput
                  style={[styles.input, fieldHasError && styles.inputError, { paddingRight: 52 }]}
                  placeholder="Enter your password"
                  placeholderTextColor="#6F6C66"
                  value={password}
                  onChangeText={(v) => { setPassword(v); setFieldHasError(false); }}
                  secureTextEntry={!showPassword}
                  keyboardAppearance="dark"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? "◉" : "◎"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Inline error */}
            {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}

            {/* CTA Button */}
            <Animated.View
              style={[
                styles.buttonGlowWrapper,
                { transform: [{ scale: buttonScale }], opacity: buttonOpacity },
              ]}
            >
              <LinearGradient
                colors={["rgba(200,45,70,0.7)", "rgba(163,32,53,0.2)", "transparent"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.buttonGlow}
              />
              <TouchableOpacity
                onPress={handleSubmit}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={loading}
                activeOpacity={1}
                style={{ width: "100%" }}
              >
                <LinearGradient
                  colors={["#7A1826", "#C03350", "#A32035"]}
                  locations={[0, 0.48, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.button}
                >
                  {/* Top-centre sheen — simulates overhead light */}
                  <LinearGradient
                    colors={["rgba(255,190,170,0.16)", "transparent"]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
                    pointerEvents="none"
                  />
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>
                      {mode === "signin" ? "Sign In" : "Create Account"}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Footer switch link */}
            <TouchableOpacity
              onPress={() => switchMode(mode === "signin" ? "signup" : "signin")}
              style={styles.footerLink}
              activeOpacity={0.7}
            >
              <Text style={styles.footerText}>
                {mode === "signin" ? "New to Pomflix? " : "Already have an account? "}
                <Text style={styles.footerAccent}>
                  {mode === "signin" ? "Create Account" : "Sign In"}
                </Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Footnote */}
          <Animated.Text style={[styles.footnote, { opacity: formOpacity }]}>
            Pomflix connects to your private Jellyfin media server.{"\n"}
            Your credentials are stored securely on this device.
          </Animated.Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Post-login fade overlay */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: "#0A0A0C", opacity: screenFade }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0A0A0C",
  },
  flex: { flex: 1 },

  radialGlow: {
    position: "absolute",
    top: -180,
    alignSelf: "center",
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: "#8B1A2E",
    opacity: 0.09,
  },

  arc: {
    position: "absolute",
    top: -100,
    alignSelf: "center",
    width: width * 1.6,
    height: 300,
    borderRadius: 300,
    opacity: 1,
  },

  arcCore: {
    position: "absolute",
    top: -130,
    alignSelf: "center",
    width: width * 0.85,
    height: 260,
    borderRadius: 260,
    opacity: 1,
  },

  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 88,
    gap: 28,
  },

  // Branding
  logoArea: {
    alignItems: "center",
  },

  // Hybrid wordmark: P●mflix
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 44,
    letterSpacing: -0.5,
    color: "#F2EDE8",
    includeFontPadding: false,
    zIndex: 1,
  },
  logoDotWrapper: {
    width: 10,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
    marginTop: 5,
    overflow: "visible",
    zIndex: 0,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
    backgroundColor: "#8B1A2E",
    shadowColor: "#E04060",
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  logoDotGlow: {
    position: "absolute",
    width: 15,
    height: 15,
    borderRadius: 15,
    backgroundColor: "#A32035",
    opacity: 0.17,
  },
  logoDotGlowOuter: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 22,
    backgroundColor: "#7A1020",
    opacity: 0.10,
  },
  tagline: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#8A8780",
    textAlign: "center",
    marginTop: 8,
  },

  // Toggle
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 30,
    padding: TOGGLE_PADDING,
    position: "relative",
    overflow: "visible",
  },
  togglePill: {
    position: "absolute",
    top: TOGGLE_PADDING,
    left: TOGGLE_PADDING,
    width: PILL_WIDTH,
    bottom: TOGGLE_PADDING,
    borderRadius: 26,
    backgroundColor: "rgba(139,26,46,0.30)",
    borderWidth: 1,
    borderColor: "rgba(220,60,85,0.55)",
    shadowColor: "#E04060",
    shadowOpacity: 0.95,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 18,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    zIndex: 1,
  },
  toggleText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#6F6C66",
  },
  toggleTextActive: {
    fontFamily: "Inter_500Medium",
    color: "#F2EDE8",
  },

  // Form
  form: {},
  fieldGroup: {},
  label: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "#8A8780",
    letterSpacing: 1.2,
    marginBottom: 7,
  },
  input: {
    backgroundColor: "#141416",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 16,
    paddingVertical: 18,
    color: "#F2EDE8",
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  inputError: {
    borderColor: "#E05A6A",
  },
  eyeButton: {
    position: "absolute",
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  eyeIcon: {
    color: "#6F6C66",
    fontSize: 16,
  },

  // Button
  buttonGlowWrapper: {
    width: "100%",
    alignItems: "center",
    marginTop: 10,
  },
  buttonGlow: {
    position: "absolute",
    width: "70%",
    height: 50,
    borderRadius: 50,
    bottom: -18,
  },
  button: {
    width: "100%",
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: "#FFFFFF",
  },

  // Footer
  footerLink: {
    alignItems: "center",
    marginTop: 18,
  },
  footerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#6F6C66",
  },
  footerAccent: {
    fontFamily: "Inter_500Medium",
    color: "#C04060",
  },

  // Footnote
  footnote: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#6F6C66",
    lineHeight: 18,
    textAlign: "center",
    opacity: 0.7,
  },

  // Error
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#E05A6A",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 10,
  },
});