import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Animated,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "@/lib/store/authStore";
import { authenticateUser } from "@/lib/jellyfin/auth";
import { SERVER_URL } from "@/constants/config";

export default function LoginScreen() {
  const { setAuth } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Load animations
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;
  const formTranslate = useRef(new Animated.Value(24)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;

  // Dot pulse
  const dotPulse = useRef(new Animated.Value(1)).current;

  // Button press
  const buttonScale = useRef(new Animated.Value(1)).current;
  const buttonOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance sequence
    Animated.sequence([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(dotOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.parallel([
      Animated.timing(formTranslate, {
        toValue: 0,
        duration: 500,
        delay: 300,
        useNativeDriver: true,
      }),
      Animated.timing(formOpacity, {
        toValue: 1,
        duration: 500,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Dot pulse loop â€” starts after dot fades in
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, {
          toValue: 1.5,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(dotPulse, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    const t = setTimeout(() => pulse.start(), 500);
    return () => {
      clearTimeout(t);
      pulse.stop();
    };
  }, []);

  const handlePressIn = () => {
    Animated.parallel([
      Animated.timing(buttonScale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(buttonOpacity, { toValue: 0.9, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.timing(buttonScale, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(buttonOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    if (!username.trim()) {
      Alert.alert("Missing Info", "Please enter your username.");
      return;
    }
    setLoading(true);
    try {
      const res = await authenticateUser(SERVER_URL, username.trim(), password);
      await setAuth({
        token: res.AccessToken,
        userId: res.User.Id,
        userName: res.User.Name,
        serverUrl: SERVER_URL,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed.";
      Alert.alert("Could Not Connect", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Dark gradient background */}
      <LinearGradient
        colors={["#0A0A0C", "#050507"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Radial pomegranate glow â€” top center */}
      <View style={styles.radialGlow} pointerEvents="none" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* â”€â”€ Branding â”€â”€ */}
          <Animated.View style={[styles.logoArea, { opacity: logoOpacity }]}>
            {/* Pulsing accent dot */}
            <Animated.View style={[styles.dotWrapper, { opacity: dotOpacity }]}>
              <Animated.View
                style={[styles.dotGlow, { transform: [{ scale: dotPulse }] }]}
              />
              <View style={styles.dot} />
            </Animated.View>

            <Text style={styles.wordmark}>Pomflix</Text>
            <Text style={styles.tagline}>Press play on a state, not a show.</Text>
          </Animated.View>

          {/* â”€â”€ Form â”€â”€ */}
          <Animated.View
            style={[
              styles.form,
              { opacity: formOpacity, transform: [{ translateY: formTranslate }] },
            ]}
          >
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>USERNAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your username"
                placeholderTextColor="#6F6C66"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardAppearance="dark"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#6F6C66"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                keyboardAppearance="dark"
              />
            </View>

            {/* Sign In */}
            <Animated.View
              style={[
                styles.buttonShadow,
                { transform: [{ scale: buttonScale }], opacity: buttonOpacity },
              ]}
            >
              <TouchableOpacity
                onPress={handleLogin}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={loading}
                activeOpacity={1}
              >
                <LinearGradient
                  colors={["#8B1A2E", "#A32035"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.button}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Sign In</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>

          {/* â”€â”€ Footer â”€â”€ */}
          <Animated.Text style={[styles.footnote, { opacity: formOpacity }]}>
            Pomflix connects to your private Jellyfin media server.{"\n"}Your
            credentials are stored securely on this device.
          </Animated.Text>
        </ScrollView>
      </KeyboardAvoidingView>
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

  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 88,
    gap: 40,
  },

  // Branding
  logoArea: {
    alignItems: "center",
  },
  dotWrapper: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  dotGlow: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#8B1A2E",
    opacity: 0.6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#8B1A2E",
  },
  wordmark: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 42,
    letterSpacing: -0.5,
    color: "#F2EDE8",
  },
  tagline: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#8A8780",
    opacity: 0.9,
    textAlign: "center",
    marginTop: 8,
  },

  // Form
  form: {
    gap: 18,
  },
  fieldGroup: {
    gap: 0,
  },
  label: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#8A8780",
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#1C1C21",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 16,
    paddingVertical: 18,
    color: "#F2EDE8",
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  // Button
  buttonShadow: {
    marginTop: 10,
    borderRadius: 16,
    shadowColor: "#8B1A2E",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  button: {
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
  footnote: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#6F6C66",
    lineHeight: 18,
    textAlign: "center",
    opacity: 0.7,
  },
});
