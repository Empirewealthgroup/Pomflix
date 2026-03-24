"use client";
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
} from "react-native";
import { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "@/lib/store/authStore";
import { authenticateUser } from "@/lib/jellyfin/auth";
import { Colors, Typography, Spacing, Radii } from "@/constants/theme";

export default function LoginScreen() {
  const { setAuth } = useAuthStore();
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!serverUrl.trim() || !username.trim()) {
      Alert.alert("Missing Info", "Please enter your server URL and username.");
      return;
    }

    setLoading(true);
    try {
      const cleanUrl = serverUrl.trim().replace(/\/$/, "");
      const res = await authenticateUser(cleanUrl, username.trim(), password);
      await setAuth({
        token: res.AccessToken,
        userId: res.User.Id,
        userName: res.User.Name,
        serverUrl: cleanUrl,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed.";
      Alert.alert("Could Not Connect", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#0A0A0C", "#111114", "#0A0A0C"]}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo mark */}
          <View style={styles.logoArea}>
            <View style={styles.pomDot} />
            <Text style={styles.wordmark}>Pomflix</Text>
            <Text style={styles.tagline}>Press play on a state, not a show.</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Server URL</Text>
              <TextInput
                style={styles.input}
                placeholder="https://your.server.com"
                placeholderTextColor={Colors.textMuted}
                value={serverUrl}
                onChangeText={setServerUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                keyboardAppearance="dark"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                placeholder="Your Jellyfin username"
                placeholderTextColor={Colors.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardAppearance="dark"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                keyboardAppearance="dark"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={Colors.textPrimary} />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.footnote}>
            Pomflix connects to your private Jellyfin media server.
            {"\n"}Your credentials are stored securely on this device.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.xxl,
    gap: Spacing.xxl,
  },

  logoArea: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  pomDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.brand,
    marginBottom: Spacing.xs,
  },
  wordmark: {
    fontFamily: Typography.display,
    fontSize: 36,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: Typography.sans,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
  },

  form: { gap: Spacing.md },
  fieldGroup: { gap: Spacing.xs },
  label: {
    fontFamily: Typography.sansMedium,
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontFamily: Typography.sans,
    fontSize: 16,
  },

  button: {
    backgroundColor: Colors.brand,
    borderRadius: Radii.md,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 16,
    color: Colors.textPrimary,
  },

  footnote: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
});
