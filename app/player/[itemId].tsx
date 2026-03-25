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
import { VideoView, useVideoPlayer, type AudioTrack, type SubtitleTrack } from "expo-video";
import * as ScreenOrientation from "expo-screen-orientation";
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

  // Track picker
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<AudioTrack | null>(null);
  const [currentSubtitleTrack, setCurrentSubtitleTrack] = useState<SubtitleTrack | null>(null);
  const [trackSheet, setTrackSheet] = useState<"audio" | "subtitle" | null>(null);
  const [showOptionsSheet, setShowOptionsSheet] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];
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

  // Lock to landscape on mount, restore portrait on unmount
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  // Subscribe to audio/subtitle track events
  useEffect(() => {
    const subs = [
      // Seed initial values when source loads (player props are readable synchronously)
      player.addListener("sourceLoad", () => {
        setAudioTracks(player.availableAudioTracks ?? []);
        setSubtitleTracks(player.availableSubtitleTracks ?? []);
        setCurrentAudioTrack(player.audioTrack ?? null);
        setCurrentSubtitleTrack(player.subtitleTrack ?? null);
      }),
      player.addListener("availableAudioTracksChange", ({ availableAudioTracks }) => {
        setAudioTracks(availableAudioTracks);
      }),
      player.addListener("audioTrackChange", ({ audioTrack }) => {
        setCurrentAudioTrack(audioTrack);
      }),
      player.addListener("availableSubtitleTracksChange", ({ availableSubtitleTracks }) => {
        setSubtitleTracks(availableSubtitleTracks);
      }),
      player.addListener("subtitleTrackChange", ({ subtitleTrack }) => {
        setCurrentSubtitleTrack(subtitleTrack);
      }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [player]);

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

              {/* Options pill — speed, audio, subtitles */}
              <TouchableOpacity
                style={styles.optionsBtn}
                onPress={() => {
                  if (hideTimer.current) clearTimeout(hideTimer.current);
                  setShowOptionsSheet(true);
                }}
                hitSlop={12}
              >
                <Text style={styles.optionsBtnText}>⋯</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </>
      )}

      {/* ── Playback Options Sheet (speed + audio + subtitles) ────── */}
      {showOptionsSheet && (
        <TouchableOpacity
          style={styles.trackBackdrop}
          activeOpacity={1}
          onPress={() => { setShowOptionsSheet(false); setTrackSheet(null); }}
        >
          <TouchableOpacity style={styles.trackSheetContainer} activeOpacity={1} onPress={() => {}}>
            <View style={styles.trackSheetHandle} />

            {/* ─ Speed ─ */}
            {trackSheet === null && (
              <>
                <Text style={styles.trackSheetTitle}>Playback Options</Text>

                <Text style={styles.optionSectionLabel}>Speed</Text>
                <View style={styles.speedRow}>
                  {SPEED_OPTIONS.map((s) => (
                    <TouchableOpacity
                      key={`speed-${s}`}
                      style={[styles.speedChip, playbackSpeed === s && styles.speedChipActive]}
                      onPress={() => {
                        player.playbackRate = s;
                        setPlaybackSpeed(s);
                      }}
                    >
                      <Text style={[styles.speedChipText, playbackSpeed === s && styles.speedChipTextActive]}>
                        {s === 1 ? "1×" : `${s}×`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.optionSectionLabel}>Audio</Text>
                {audioTracks.length === 0 ? (
                  <Text style={styles.trackEmpty}>No audio tracks detected.</Text>
                ) : audioTracks.map((track, i) => {
                  const isActive = currentAudioTrack?.id === track.id;
                  return (
                    <TouchableOpacity
                      key={track.id ? `audio-${track.id}` : `audio-${i}`}
                      style={[styles.trackRow, isActive && styles.trackRowActive]}
                      onPress={() => { player.audioTrack = track as AudioTrack; setCurrentAudioTrack(track); }}
                    >
                      <Text style={styles.trackRowLabel}>{track.label || track.language || `Track ${i + 1}`}</Text>
                      {isActive && <Text style={styles.trackCheck}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}

                <Text style={styles.optionSectionLabel}>Subtitles</Text>
                <TouchableOpacity
                  style={[styles.trackRow, currentSubtitleTrack === null && styles.trackRowActive]}
                  onPress={() => { player.subtitleTrack = null; setCurrentSubtitleTrack(null); }}
                >
                  <Text style={styles.trackRowLabel}>Off</Text>
                  {currentSubtitleTrack === null && <Text style={styles.trackCheck}>✓</Text>}
                </TouchableOpacity>
                {subtitleTracks.length === 0 ? (
                  <Text style={styles.trackEmpty}>No subtitle tracks detected.</Text>
                ) : subtitleTracks.map((track, i) => {
                  const isActive = currentSubtitleTrack?.id === track.id;
                  return (
                    <TouchableOpacity
                      key={track.id ? `sub-${track.id}` : `sub-${i}`}
                      style={[styles.trackRow, isActive && styles.trackRowActive]}
                      onPress={() => { player.subtitleTrack = track as SubtitleTrack; setCurrentSubtitleTrack(track); }}
                    >
                      <Text style={styles.trackRowLabel}>{track.label || track.language || `Track ${i + 1}`}</Text>
                      {isActive && <Text style={styles.trackCheck}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
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
    ...StyleSheet.absoluteFillObject,
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

  // ── Options pill (top-right) ──────────────────────────────────
  optionsBtn: {
    position: "absolute",
    top: 52,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.52)",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.12)",
    zIndex: 10,
  },
  optionsBtnText: {
    fontSize: 18,
    color: Colors.textPrimary,
    lineHeight: 18,
    letterSpacing: 2,
  },

  // ── Options sheet sections ─────────────────────────────────
  optionSectionLabel: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 10,
    marginTop: 12,
    marginBottom: 2,
  },
  speedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  speedChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
  },
  speedChipActive: {
    backgroundColor: Colors.brand,
    borderColor: Colors.brand,
  },
  speedChipText: {
    fontFamily: Typography.sansMedium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  speedChipTextActive: {
    color: "#fff",
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

  // ── Track Picker Sheet ───────────────────────────────────────────
  trackBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  trackSheetContainer: {
    backgroundColor: "#141418",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 0.6,
    borderBottomWidth: 0,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 46,
  },
  trackSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: 16,
  },
  trackSheetTitle: {
    fontFamily: Typography.display,
    fontSize: 20,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  trackRowActive: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  trackRowLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  trackCheck: {
    fontFamily: Typography.sansMedium,
    fontSize: 15,
    color: Colors.brand,
  },
  trackEmpty: {
    fontFamily: Typography.sans,
    fontSize: 14,
    color: Colors.textMuted,
    paddingVertical: 14,
    paddingHorizontal: 10,
    textAlign: "center",
  },
});

