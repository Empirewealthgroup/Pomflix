import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import {
  useFonts,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_600SemiBold_Italic,
} from "@expo-google-fonts/playfair-display";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import { useAuthStore } from "@/lib/store/authStore";
import { useFeedbackStore } from "@/lib/store/feedbackStore";
import { useRouter, useSegments } from "expo-router";
import ErrorBoundary from "@/components/ErrorBoundary";

SplashScreen.preventAutoHideAsync();

function AuthGuard() {
  const { token, isLoading, loadStoredAuth } = useAuthStore();
  const { loadFeedback } = useFeedbackStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    loadStoredAuth();
    loadFeedback();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === "(auth)";
    if (!token && !inAuth) {
      router.replace("/(auth)/login");
    } else if (token && inAuth) {
      router.replace("/(app)");
    }
  }, [token, isLoading, segments]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_600SemiBold_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // Default all screens to portrait; player overrides this on mount
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0A0A0C" } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" options={{ animation: "fade" }} />
        <Stack.Screen
          name="mode/[id]"
          options={{ animation: "none" }}
        />
        <Stack.Screen
          name="item/[itemId]"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="series/[seriesId]"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="player/[itemId]"
          options={{ animation: "fade", presentation: "fullScreenModal" }}
        />
        <Stack.Screen
          name="moods/index"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="settings/index"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="settings/moods"
          options={{ animation: "slide_from_right" }}
        />
      </Stack>
    </ErrorBoundary>
  );
}
