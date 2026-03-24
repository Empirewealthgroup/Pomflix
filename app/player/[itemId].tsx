import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { VideoView, useVideoPlayer } from "expo-video";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "@/lib/store/authStore";
import {
  getPlaybackInfo,
  getStreamUrl,
  reportPlaybackStart,
  reportPlaybackProgress,
  reportPlaybackStopped,
} from "@/lib/jellyfin/media";
import { Colors, Typography } from "@/constants/theme";

const { width, height } = Dimensions.get("window");

const PROGRESS_INTERVAL_MS = 10_000;

export default function PlayerScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const router = useRouter();
  const { serverUrl, token, userId } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Playback reporting refs
  const mediaSourceId = useRef<string>("");
  const playSessionId = useRef<string>("");
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPositionTicks = useRef<number>(0);
  const playSessionIdRef = useRef<string>("");

  // Animations
  const controlsAnim = useRef(new Animated.Value(1)).current;
  const videoAnim = useRef(new Animated.Value(0)).current;

  // Resolve stream URL
  useEffect(() => {
    if (!serverUrl || !token || !userId || !itemId) return;
    (async () => {
      try {
        const info = await getPlaybackInfo(serverUrl, token, userId, itemId);
        const source = info.MediaSources?.[0];
        if (!source) throw new Error("No media source found.");
        mediaSourceId.current = source.Id;
        playSessionIdRef.current = info.PlaySessionId ?? "";
        playSessionId.current = info.PlaySessionId ?? "";
        const url = getStreamUrl(serverUrl, itemId, token, source.Id);
        setStreamUrl(url);
        reportPlaybackStart(serverUrl, token, itemId, source.Id, playSessionIdRef.current);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Playback error.");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, [itemId, serverUrl, token, userId]);

  // Fade video in when stream is ready
  useEffect(() => {
    if (streamUrl) {
      Animated.timing(videoAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [streamUrl]);

  const player = useVideoPlayer(
    streamUrl ? { uri: streamUrl } : null,
    (p) => {
      p.loop = false;
      if (streamUrl) p.play();
    }
  );

  // Progress reporting
  useEffect(() => {
    if (!streamUrl || !serverUrl || !token) return;
    progressTimer.current = setInterval(() => {
      const ticks = (player.currentTime ?? 0) * 10_000_000;
      lastPositionTicks.current = ticks;
      reportPlaybackProgress(
        serverUrl, token, itemId!,
        mediaSourceId.current, playSessionId.current,
        ticks, !player.playing
      );
    }, PROGRESS_INTERVAL_MS);
    return () => { if (progressTimer.current) clearInterval(progressTimer.current); };
  }, [streamUrl]);

  const stopAndReport = () => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    if (serverUrl && token && itemId) {
      const ticks = (player.currentTime ?? 0) * 10_000_000;
      reportPlaybackStopped(
        serverUrl, token, itemId,
        mediaSourceId.current, playSessionId.current, ticks
      );
    }
  };

  // Animated controls show/hide
  const showControlsAnimated = () => {
    Animated.timing(controlsAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    setShowControls(true);
    scheduleHide();
  };

  const hideControlsAnimated = () => {
    Animated.timing(controlsAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start(() =>
      setShowControls(false)
    );
  };

  const toggleControls = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (showControls) {
      hideControlsAnimated();
    } else {
      showControlsAnimated();
    }
  };

  const scheduleHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(hideControlsAnimated, 3500);
  };

  useEffect(() => {
    if (showControls) scheduleHide();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [showControls]);

  const handleClose = () => {
    stopAndReport();
    player.pause();
    router.back();
  };

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      {/* ── Loading ────────────────────────────────────────────────── */}
      {loading && (
        <View style={styles.center}>
          <View style={styles.glowOrb} />
          <Text style={styles.pomIcon}>◈</Text>
          <Text style={styles.loadingText}>Preparing your session…</Text>
          <Text style={styles.loadingSubtext}>Connecting to Pomflix</Text>
        </View>
      )}

      {/* ── Error ──────────────────────────────────────────────────── */}
      {error && (
        <View style={styles.center}>
          <Text style={styles.errorIcon}>⚠</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={handleClose} style={styles.goBackBtn}>
            <Text style={styles.goBackText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Video ──────────────────────────────────────────────────── */}
      {streamUrl && (
        <>
          <Animated.View style={[styles.videoWrapper, { opacity: videoAnim }]}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={toggleControls}
              activeOpacity={1}
            >
              <VideoView
                player={player}
                style={styles.video}
                contentFit="contain"
                nativeControls
              />
            </TouchableOpacity>
          </Animated.View>

          {/* Controls overlay */}
          {showControls && (
            <Animated.View
              style={[styles.controls, { opacity: controlsAnim }]}
              pointerEvents="box-none"
            >
              {/* Top scrim */}
              <LinearGradient
                colors={["rgba(0,0,0,0.55)", "transparent"]}
                style={styles.topScrim}
                pointerEvents="none"
              />

              {/* Close pill */}
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={handleClose}
                hitSlop={12}
              >
                <Text style={styles.closeIcon}>✕</Text>
                <Text style={styles.closeLabel}>Close</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },

  // ── Loading ──────────────────────────────────────────────────────
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#0A0A0C",
  },
  glowOrb: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#8B1A2E",
    opacity: 0.12,
  },
  pomIcon: {
    fontSize: 36,
    color: "#8B1A2E",
    marginBottom: 6,
  },
  loadingText: {
    fontFamily: Typography.display,
    fontSize: 20,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  loadingSubtext: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // ── Error ────────────────────────────────────────────────────────
  errorIcon: {
    fontSize: 28,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  errorText: {
    fontFamily: Typography.sans,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 36,
    lineHeight: 20,
  },
  goBackBtn: {
    marginTop: 12,
    paddingHorizontal: 28,
    paddingVertical: 11,
    borderRadius: 24,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
  },
  goBackText: {
    fontFamily: Typography.sansMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },

  // ── Video ────────────────────────────────────────────────────────
  videoWrapper: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  video: {
    width,
    height,
  },

  // ── Controls overlay ─────────────────────────────────────────────
  controls: {
    ...StyleSheet.absoluteFillObject,
  },
  topScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 110,
  },
  closeBtn: {
    position: "absolute",
    top: 52,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.52)",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.12)",
  },
  closeIcon: {
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 16,
  },
  closeLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 13,
    color: Colors.textPrimary,
  },
});
