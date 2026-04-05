import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Animated,
  PanResponder,
  Image,
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
  getItem,
  getNextEpisode,
  reportPlaybackStart,
  reportPlaybackProgress,
  reportPlaybackStopped,
  formatRuntime,
  setFavorite,
} from "@/lib/jellyfin/media";
import type { JellyfinItem } from "@/lib/jellyfin/types";
import { Colors, Typography } from "@/constants/theme";
import { useNowPlayingStore } from "@/lib/store/nowPlayingStore";
import { useFeedbackStore, type FeedbackRating } from "@/lib/store/feedbackStore";
import { useSettingsStore } from "@/lib/store/settingsStore";

const { width, height } = Dimensions.get("window");

const PROGRESS_INTERVAL_MS = 10_000;

// One-time swipe hint — module level so it survives re-renders, not re-navigations
let _swipeHintSeen = false;

export default function PlayerScreen() {
  const { itemId, itemName, startPositionTicks } = useLocalSearchParams<{ itemId: string; itemName?: string; startPositionTicks?: string }>();
  const router = useRouter();
  const { serverUrl, token, userId } = useAuthStore();
  const { updateSessionItem, currentSession } = useSessionStore();
  const { setNowPlaying, updateNowPlayingProgress, clearNowPlaying } = useNowPlayingStore();
  const { setFeedback } = useFeedbackStore();
  const { prefs, loadPrefs } = useSettingsStore();

  useEffect(() => { if (userId) loadPrefs(userId); }, [userId]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [showMoodCheck, setShowMoodCheck] = useState(false);
  const [itemMeta, setItemMeta] = useState<JellyfinItem | null>(null);
  const [playedPct, setPlayedPct] = useState(0);
  const [skipLabel, setSkipLabel] = useState<"Skip Intro" | "Skip Credits" | null>(null);

  // Next episode
  const [nextEpisode, setNextEpisode] = useState<JellyfinItem | null>(null);
  const nextEpisodeRef = useRef<JellyfinItem | null>(null);
  const [showNextEpisode, setShowNextEpisode] = useState(false);
  const showNextEpisodeRef = useRef(false);
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState(10);
  const nextEpisodeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track picker
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<AudioTrack | null>(null);
  const [currentSubtitleTrack, setCurrentSubtitleTrack] = useState<SubtitleTrack | null>(null);
  const [trackSheet, setTrackSheet] = useState<"audio" | "subtitle" | null>(null);
  const [showOptionsSheet, setShowOptionsSheet] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [heartFavorite, setHeartFavorite] = useState(false);
  const togglingHeartRef = useRef(false);
  // For episodes the favorite target is the parent series, not the episode itself
  const heartTargetId = useRef<string | null>(null);
  const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mood check animations
  const moodSlideAnim = useRef(new Animated.Value(200)).current;
  const moodFadeAnim = useRef(new Animated.Value(0)).current;

  // Options sheet animations
  const optionsSheetSlide = useRef(new Animated.Value(400)).current;
  const optionsSheetFade = useRef(new Animated.Value(0)).current;

  // Sync heart state when itemMeta loads; for episodes, target + seed from parent series
  useEffect(() => {
    if (!itemMeta) return;
    if (itemMeta.Type === "Episode" && itemMeta.SeriesId) {
      heartTargetId.current = itemMeta.SeriesId;
      if (serverUrl && token && userId) {
        getItem(serverUrl, token, userId, itemMeta.SeriesId)
          .then((series) => setHeartFavorite(series.UserData?.IsFavorite ?? false))
          .catch(() => {});
      }
    } else {
      heartTargetId.current = itemId ?? null;
      setHeartFavorite(itemMeta?.UserData?.IsFavorite ?? false);
    }
  }, [itemMeta?.Id]);

  const handleToggleHeart = async () => {
    const target = heartTargetId.current ?? itemId;
    if (!serverUrl || !token || !userId || !target || togglingHeartRef.current) return;
    togglingHeartRef.current = true;
    const next = !heartFavorite;
    setHeartFavorite(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await setFavorite(serverUrl, token, userId, target, next);
    } catch {
      setHeartFavorite(!next);
    } finally {
      togglingHeartRef.current = false;
    }
  };

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

  // Sheet swipe-down pan responder
  const sheetPanRef = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 10 && gs.dy > Math.abs(gs.dx) * 1.5,
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) optionsSheetSlide.setValue(gs.dy); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 60 || gs.vy > 0.4) {
          Animated.parallel([
            Animated.timing(optionsSheetSlide, { toValue: 400, duration: 280, useNativeDriver: true }),
            Animated.timing(optionsSheetFade, { toValue: 0, duration: 220, useNativeDriver: true }),
          ]).start(() => { setShowOptionsSheet(false); setTrackSheet(null); });
        } else {
          Animated.spring(optionsSheetSlide, { toValue: 0, useNativeDriver: true, tension: 200, friction: 16 }).start();
        }
      },
    })
  ).current;

  // Resolve stream URL + fetch item metadata in parallel
  useEffect(() => {
    if (!serverUrl || !token || !userId || !itemId) return;
    (async () => {
      try {
        const [info, meta] = await Promise.all([
          getPlaybackInfo(serverUrl, token, userId, itemId),
          getItem(serverUrl, token, userId, itemId).catch(() => null),
        ]);
        if (meta) {
          setItemMeta(meta);
          if (meta.Type === "Episode" && meta.SeriesId) {
            getNextEpisode(serverUrl, token, userId, meta.SeriesId, itemId!)
              .then((ep) => { nextEpisodeRef.current = ep; setNextEpisode(ep); })
              .catch(() => {});
          }
        }
        const source = info.MediaSources?.[0];
        if (!source) throw new Error("No media source found.");
        mediaSourceId.current = source.Id;
        playSessionIdRef.current = info.PlaySessionId ?? "";
        playSessionId.current = info.PlaySessionId ?? "";
        // Use TranscodingUrl when Jellyfin says the format needs transcoding,
        // otherwise fall back to the static direct-stream URL.
        const url = source.TranscodingUrl
          ? `${serverUrl}${source.TranscodingUrl}`
          : getStreamUrl(serverUrl, itemId, token, source.Id);
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
      setPlayedPct(pct);
      updateSessionItem(itemId!, itemName || itemId!, pct);
      updateNowPlayingProgress(pct);
      // Skip intro / credits detection
      if (duration > 120) {
        if (currentTime >= 60 && currentTime <= 210) {
          setSkipLabel("Skip Intro");
        } else if (duration - currentTime <= 300 && duration - currentTime > 5) {
          setSkipLabel("Skip Credits");
        } else {
          setSkipLabel(null);
        }
      }
      // Next episode countdown at 95%
      if (pct >= 95 && nextEpisodeRef.current && !showNextEpisodeRef.current) {
        showNextEpisodeRef.current = true;
        setShowNextEpisode(true);
        setNextEpisodeCountdown(10);
        if (nextEpisodeTimerRef.current) clearInterval(nextEpisodeTimerRef.current);
        nextEpisodeTimerRef.current = setInterval(() => {
          setNextEpisodeCountdown((c) => {
            if (c <= 1) {
              clearInterval(nextEpisodeTimerRef.current!);
              return 0;
            }
            return c - 1;
          });
        }, 1000);
      }
    }, PROGRESS_INTERVAL_MS);
    return () => { if (progressTimer.current) clearInterval(progressTimer.current); };
  }, [streamUrl]);

  // Auto-navigate to next episode when countdown hits 0 (only if autoplay is on)
  useEffect(() => {
    if (nextEpisodeCountdown === 0 && nextEpisode && showNextEpisode && prefs.autoplayNextEpisode) {
      stopAndReport();
      router.replace(`/player/${nextEpisode.Id}?name=${encodeURIComponent(nextEpisode.Name ?? "")}`);
    }
  }, [nextEpisodeCountdown]);

  // Lock to landscape on mount, restore portrait on unmount
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
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
        const resumeSecs = startPositionTicks ? Number(startPositionTicks) / 10_000_000 : 0;
        if (resumeSecs > 5) player.currentTime = resumeSecs;
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
    if (nextEpisodeTimerRef.current) clearInterval(nextEpisodeTimerRef.current);
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

  const openOptionsSheet = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    optionsSheetSlide.setValue(400);
    optionsSheetFade.setValue(0);
    setShowOptionsSheet(true);
    Animated.parallel([
      Animated.spring(optionsSheetSlide, { toValue: 0, friction: 14, tension: 120, useNativeDriver: true }),
      Animated.timing(optionsSheetFade, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  };

  const closeOptionsSheet = () => {
    Animated.parallel([
      Animated.timing(optionsSheetSlide, { toValue: 400, duration: 280, useNativeDriver: true }),
      Animated.timing(optionsSheetFade, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => { setShowOptionsSheet(false); setTrackSheet(null); });
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

              {/* Bottom scrim */}
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.72)"]}
                style={styles.bottomScrim}
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
                onPress={openOptionsSheet}
                hitSlop={12}
              >
                <Text style={styles.optionsBtnText}>⋯</Text>
              </TouchableOpacity>

              {/* Heart / favorite button */}
              <TouchableOpacity
                style={styles.heartBtn}
                onPress={handleToggleHeart}
                hitSlop={12}
              >
                <Text style={styles.heartBtnText}>{heartFavorite ? "♥" : "♡"}</Text>
              </TouchableOpacity>

              {/* Skip Intro / Skip Credits */}
              {skipLabel && (
                <TouchableOpacity
                  style={styles.skipBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    if (skipLabel === "Skip Intro") {
                      try { player.currentTime = 210; } catch {}
                    } else {
                      try { player.currentTime = (player.duration ?? 0) - 2; } catch {}
                    }
                    setSkipLabel(null);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.skipBtnText}>{skipLabel}  →</Text>
                </TouchableOpacity>
              )}

              {/* Next Episode card */}
              {showNextEpisode && nextEpisode && (
                <View style={styles.nextEpCard}>
                  {nextEpisode.ImageTags?.Primary && (
                    <Image
                      source={{ uri: `${serverUrl}/Items/${nextEpisode.Id}/Images/Primary?maxWidth=160&quality=80&api_key=${token}` }}
                      style={styles.nextEpThumb}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.nextEpInfo}>
                    <Text style={styles.nextEpLabel}>Up Next</Text>
                    <Text style={styles.nextEpTitle} numberOfLines={1}>{nextEpisode.Name}</Text>
                    {!!nextEpisode.ParentIndexNumber && !!nextEpisode.IndexNumber && (
                      <Text style={styles.nextEpSE}>
                        S{nextEpisode.ParentIndexNumber} E{nextEpisode.IndexNumber}
                      </Text>
                    )}
                  </View>
                  <View style={styles.nextEpActions}>
                    <TouchableOpacity
                      style={styles.nextEpPlayBtn}
                      onPress={() => {
                        if (nextEpisodeTimerRef.current) clearInterval(nextEpisodeTimerRef.current);
                        stopAndReport();
                        router.replace(`/player/${nextEpisode.Id}?name=${encodeURIComponent(nextEpisode.Name ?? "")}`);
                      }}
                    >
                      <Text style={styles.nextEpPlayText}>
                        {prefs.autoplayNextEpisode && nextEpisodeCountdown > 0 ? `Play (${nextEpisodeCountdown})` : "Play Now"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        if (nextEpisodeTimerRef.current) clearInterval(nextEpisodeTimerRef.current);
                        showNextEpisodeRef.current = false;
                        setShowNextEpisode(false);
                      }}
                    >
                      <Text style={styles.nextEpDismiss}>Not now</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ── Now Playing info bar (bottom) ── */}
              <View style={styles.infoBar} pointerEvents="none">
                {/* Mode badge */}
                {currentSession?.modeLabel ? (
                  <View style={[styles.modeBadge, { backgroundColor: `${currentSession.modeColor}33`, borderColor: `${currentSession.modeColor}66` }]}>
                    <Text style={[styles.modeBadgeText, { color: currentSession.modeColor }]}>
                      {currentSession.modeIcon}  {currentSession.modeLabel}
                    </Text>
                  </View>
                ) : null}

                {/* Title */}
                <Text style={styles.infoTitle} numberOfLines={1}>
                  {itemMeta?.Name ?? itemName}
                </Text>

                {/* Meta row */}
                <View style={styles.infoMeta}>
                  {!!itemMeta?.ProductionYear && (
                    <Text style={styles.infoMetaText}>{itemMeta.ProductionYear}</Text>
                  )}
                  {!!itemMeta?.RunTimeTicks && (
                    <Text style={styles.infoMetaText}>{formatRuntime(itemMeta.RunTimeTicks)}</Text>
                  )}
                  {itemMeta?.OfficialRating ? (
                    <View style={styles.ratingBadge}>
                      <Text style={styles.ratingText}>{itemMeta.OfficialRating}</Text>
                    </View>
                  ) : null}
                  {!!itemMeta?.CommunityRating && (
                    <Text style={styles.infoMetaText}>★ {itemMeta.CommunityRating.toFixed(1)}</Text>
                  )}
                </View>

                {/* Progress bar */}
                {playedPct > 0 ? (
                  <View style={styles.infoProgress}>
                    <View style={[styles.infoProgressFill, { width: `${Math.min(playedPct, 100)}%` as any }]} />
                  </View>
                ) : null}
              </View>
            </Animated.View>
          )}
        </>
      )}

      {/* ── Playback Options Sheet (speed + audio + subtitles) ────── */}
      {showOptionsSheet && (
        <View style={styles.trackBackdrop}>
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.55)", opacity: optionsSheetFade }]}
            pointerEvents="none"
          />
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeOptionsSheet}
          />
          <Animated.View
            style={{ transform: [{ translateY: optionsSheetSlide }] }}
            {...sheetPanRef.panHandlers}
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
          </Animated.View>
        </View>
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
  bottomScrim: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
  },

  // ── Now Playing info bar ──────────────────────────────────────
  infoBar: {
    position: "absolute",
    bottom: 24,
    left: 24,
    right: 120, // leave room for options pill on right
    gap: 5,
  },
  modeBadge: {
    alignSelf: "flex-start",
    borderRadius: 20,
    borderWidth: 0.6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 2,
  },
  modeBadgeText: {
    fontFamily: Typography.sansMedium,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  infoTitle: {
    fontFamily: Typography.display,
    fontSize: 22,
    color: "#fff",
    letterSpacing: -0.3,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  infoMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  infoMetaText: {
    fontFamily: Typography.sansMedium,
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
  },
  ratingBadge: {
    borderRadius: 3,
    borderWidth: 0.8,
    borderColor: "rgba(255,255,255,0.45)",
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  ratingText: {
    fontFamily: Typography.sansMedium,
    fontSize: 10,
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 0.3,
  },
  infoProgress: {
    height: 2.5,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 4,
  },
  infoProgressFill: {
    height: 2.5,
    backgroundColor: Colors.brandLight,
    borderRadius: 2,
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

  // ── Skip Intro / Credits button ───────────────────────────────
  skipBtn: {
    position: "absolute",
    bottom: 80,
    right: 24,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 0.8,
    borderColor: "rgba(255,255,255,0.3)",
  },
  skipBtnText: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 14,
    color: "#fff",
    letterSpacing: 0.2,
  },

  // ── Next episode card ─────────────────────────────────────────
  nextEpCard: {
    position: "absolute",
    bottom: 100,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(12,12,18,0.88)",
    borderRadius: 14,
    borderWidth: 0.8,
    borderColor: "rgba(255,255,255,0.15)",
    padding: 10,
    gap: 10,
    maxWidth: 360,
  },
  nextEpThumb: {
    width: 80,
    height: 54,
    borderRadius: 8,
    backgroundColor: "#111",
  },
  nextEpInfo: {
    flex: 1,
  },
  nextEpLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 10,
    color: Colors.brandLight,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  nextEpTitle: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 13,
    color: "#fff",
  },
  nextEpSE: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
  },
  nextEpActions: {
    alignItems: "center",
    gap: 6,
  },
  nextEpPlayBtn: {
    backgroundColor: Colors.brandLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  nextEpPlayText: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 12,
    color: "#000",
  },
  nextEpDismiss: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
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

  // ── Heart button (top-right, left of options) ──────────────────
  heartBtn: {
    position: "absolute",
    top: 52,
    right: 78,
    backgroundColor: "rgba(0,0,0,0.52)",
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.12)",
    zIndex: 10,
  },
  heartBtnText: {
    fontSize: 17,
    color: Colors.textPrimary,
    lineHeight: 18,
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
    justifyContent: "flex-end",
  },
  trackSheetContainer: {
    backgroundColor: "rgba(14,14,18,0.92)",
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

