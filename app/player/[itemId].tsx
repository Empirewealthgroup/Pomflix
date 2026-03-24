import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Animated,
  PanResponder,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { VideoView, useVideoPlayer } from "expo-video";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "@/lib/store/authStore";
import { useSessionStore } from "@/lib/store/sessionStore";
import {
  getPlaybackInfo,
  getStreamUrl,
  reportPlaybackStart,
  reportPlaybackProgress,
  reportPlaybackStopped,
} from "@/lib/jellyfin/media";
import { Colors, Typography } from "@/constants/theme";
import { useNowPlayingStore } from "@/lib/store/nowPlayingStore";
import { useFeedbackStore, type FeedbackRating } from "@/lib/store/feedbackStore";

const { width, height } = Dimensions.get("window");

const PROGRESS_INTERVAL_MS = 10_000;

// One-time swipe hint — module level so it survives re-renders, not re-navigations
let _swipeHintSeen = false;

export default function PlayerScreen() {
  const { itemId, itemName } = useLocalSearchParams<{ itemId: string; itemName?: string }>();
  const router = useRouter();
  const { serverUrl, token, userId } = useAuthStore();
  const { updateSessionItem, currentSession } = useSessionStore();
  const { setNowPlaying, updateNowPlayingProgress, clearNowPlaying } = useNowPlayingStore();
  const { setFeedback } = useFeedbackStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [showMoodCheck, setShowMoodCheck] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mood check animations
  const moodSlideAnim = useRef(new Animated.Value(200)).current;
  const moodFadeAnim = useRef(new Animated.Value(0)).current;

  // Track actual watch duration
  const watchStartTime = useRef<number>(0);

  // Playback reporting refs
  const mediaSourceId = useRef<string>("");
  const playSessionId = useRef<string>("");
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPositionTicks = useRef<number>(0);
  const playSessionIdRef = useRef<string>("");

  // Animations
  const controlsAnim = useRef(new Animated.Value(1)).current;
  const videoAnim = useRef(new Animated.Value(0)).current;

  // Swipe-down to dismiss
  const swipeY = useRef(new Animated.Value(0)).current;
  const swipeHintOpacity = useRef(new Animated.Value(_swipeHintSeen ? 0 : 1)).current;

  useEffect(() => {
    if (_swipeHintSeen) return;
    const t = setTimeout(() => {
      Animated.timing(swipeHintOpacity, {
        toValue: 0, duration: 700, useNativeDriver: true,
      }).start(() => { _swipeHintSeen = true; });
    }, 2200);
    return () => clearTimeout(t);
  }, []);

  const swipePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 12 && gs.dy > Math.abs(gs.dx) * 1.5,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) swipeY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.5) {
          Animated.timing(swipeY, {
            toValue: height + 60,
            duration: 260,
            useNativeDriver: true,
          }).start(() => {
            swipeY.setValue(0);
            handleClose();
          });
        } else {
          Animated.spring(swipeY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 200,
            friction: 16,
          }).start();
        }
      },
    })
  ).current;

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

  // Fade video in + register now playing when stream is ready
  useEffect(() => {
    if (streamUrl) {
      Animated.timing(videoAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
      watchStartTime.current = Date.now();
      setNowPlaying({
        itemId: itemId!,
        itemName: itemName || itemId!,
        modeColor: currentSession?.modeColor ?? "#8B1A2E",
        progress: 0,
      });
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
      let ticks = lastPositionTicks.current;
      let currentTime = 0;
      let duration = 0;
      let isPlaying = false;
      try {
        currentTime = player.currentTime ?? 0;
        duration = player.duration ?? 0;
        isPlaying = player.playing;
        ticks = currentTime * 10_000_000;
        lastPositionTicks.current = ticks;
      } catch {
        // native player released mid-interval — use cached value
      }
      reportPlaybackProgress(
        serverUrl, token, itemId!,
        mediaSourceId.current, playSessionId.current,
        ticks, !isPlaying
      );
      // Update session with current item + progress
      const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
      updateSessionItem(itemId!, itemName || itemId!, pct);
      updateNowPlayingProgress(pct);
    }, PROGRESS_INTERVAL_MS);
    return () => { if (progressTimer.current) clearInterval(progressTimer.current); };
  }, [streamUrl]);

  const stopAndReport = () => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    if (serverUrl && token && itemId) {
      // player.currentTime can throw if the native object has already been
      // released (e.g. after the swipe-down animation completes). Fall back
      // to the last value cached by the progress interval.
      let ticks = lastPositionTicks.current;
      try {
        ticks = (player.currentTime ?? 0) * 10_000_000;
      } catch {
        // native player already released — use cached value
      }
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
    try { player.pause(); } catch { /* native object already released */ }
    const elapsedMs = Date.now() - watchStartTime.current;
    const MIN_10 = 10 * 60 * 1000;
    if (elapsedMs >= MIN_10) {
      setShowMoodCheck(true);
      Animated.parallel([
        Animated.spring(moodSlideAnim, {
          toValue: 0, friction: 10, tension: 120, useNativeDriver: true,
        }),
        Animated.timing(moodFadeAnim, {
          toValue: 1, duration: 260, useNativeDriver: true,
        }),
      ]).start();
    } else {
      clearNowPlaying();
      router.back();
    }
  };

  const dismissMoodCheck = (rating?: FeedbackRating) => {
    if (rating && itemId) setFeedback(itemId, rating);
    Animated.parallel([
      Animated.timing(moodSlideAnim, { toValue: 200, duration: 200, useNativeDriver: true }),
      Animated.timing(moodFadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      clearNowPlaying();
      router.back();
    });
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
          <Animated.View
            {...swipePan.panHandlers}
            style={[
              styles.videoWrapper,
              {
                opacity: videoAnim,
                transform: [
                  { translateY: swipeY },
                  {
                    scale: swipeY.interpolate({
                      inputRange: [0, 320],
                      outputRange: [1, 0.88],
                      extrapolate: "clamp",
                    }),
                  },
                ],
              },
            ]}
          >
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

            {/* One-time swipe hint */}
            <Animated.View
              pointerEvents="none"
              style={[styles.swipeHintOverlay, { opacity: Animated.multiply(videoAnim, swipeHintOpacity) as any }]}
            >
              <View style={styles.swipeHintPill}>
                <Text style={styles.swipeHintText}>↓  Swipe to close</Text>
              </View>
            </Animated.View>
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
      {/* ── Mood Check-In ───────────────────────────────────────── */}
      {showMoodCheck && (
        <Animated.View
          style={[
            styles.moodBackdrop,
            { opacity: moodFadeAnim },
          ]}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              styles.moodSheet,
              { transform: [{ translateY: moodSlideAnim }] },
            ]}
          >
            <Text style={styles.moodTitle}>How was that?</Text>
            <Text style={styles.moodSub}>Your taste shapes what we pick next.</Text>
            <View style={styles.moodOptions}>
              <TouchableOpacity
                style={styles.moodBtn}
                onPress={() => dismissMoodCheck("perfect")}
                activeOpacity={0.78}
              >
                <Text style={styles.moodEmoji}>😌</Text>
                <Text style={styles.moodBtnLabel}>Perfect</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.moodBtn}
                onPress={() => dismissMoodCheck("okay")}
                activeOpacity={0.78}
              >
                <Text style={styles.moodEmoji}>😐</Text>
                <Text style={styles.moodBtnLabel}>Okay</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.moodBtn}
                onPress={() => dismissMoodCheck("skip")}
                activeOpacity={0.78}
              >
                <Text style={styles.moodEmoji}>❌</Text>
                <Text style={styles.moodBtnLabel}>Not for me</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => dismissMoodCheck()} hitSlop={10}>
              <Text style={styles.moodSkip}>Skip</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
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

  swipeHintOverlay: {
    position: "absolute",
    bottom: 90,
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "none",
  },
  swipeHintPill: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.14)",
  },
  swipeHintText: {
    fontFamily: Typography.sansMedium,
    fontSize: 13,
    color: "rgba(255,255,255,0.82)",
    letterSpacing: 0.2,
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

  // ── Mood Check-In ────────────────────────────────────────────────
  moodBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.62)",
    justifyContent: "flex-end",
  },
  moodSheet: {
    backgroundColor: "#141418",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 0.6,
    borderBottomWidth: 0,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 46,
    alignItems: "center",
    gap: 10,
  },
  moodTitle: {
    fontFamily: Typography.display,
    fontSize: 24,
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  moodSub: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 8,
    textAlign: "center",
  },
  moodOptions: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 10,
  },
  moodBtn: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 0.6,
    borderColor: "rgba(255,255,255,0.1)",
  },
  moodEmoji: {
    fontSize: 28,
  },
  moodBtnLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  moodSkip: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
});

