import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { VideoView, useVideoPlayer } from "expo-video";
import * as Haptics from "expo-haptics";
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

const PROGRESS_INTERVAL_MS = 10_000; // report every 10s

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

  // Resolve stream URL from Jellyfin
  useEffect(() => {
    if (!serverUrl || !token || !userId || !itemId) return;
    (async () => {
      try {
        const info = await getPlaybackInfo(serverUrl, token, userId, itemId);
        const source = info.MediaSources?.[0];
        if (!source) throw new Error("No media source found.");
        mediaSourceId.current = source.Id;
        playSessionId.current = info.PlaySessionId ?? "";
        const url = getStreamUrl(serverUrl, itemId, token, source.Id);
        setStreamUrl(url);
        // Report start
        if (serverUrl && token) {
          reportPlaybackStart(serverUrl, token, itemId, source.Id, info.PlaySessionId ?? "");
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Playback error.");
      } finally {
        setLoading(false);
      }
    })();

    // Cleanup on unmount
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, [itemId, serverUrl, token, userId]);

  const player = useVideoPlayer(
    streamUrl ? { uri: streamUrl } : null,
    (p) => {
      p.loop = false;
      if (streamUrl) p.play();
    }
  );

  // Start progress reporting interval once player has a stream
  useEffect(() => {
    if (!streamUrl || !serverUrl || !token) return;
    progressTimer.current = setInterval(() => {
      const ticks = (player.currentTime ?? 0) * 10_000_000;
      lastPositionTicks.current = ticks;
      reportPlaybackProgress(
        serverUrl,
        token,
        itemId!,
        mediaSourceId.current,
        playSessionId.current,
        ticks,
        !player.playing
      );
    }, PROGRESS_INTERVAL_MS);
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, [streamUrl]);

  const stopAndReport = () => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    if (serverUrl && token && itemId) {
      const ticks = (player.currentTime ?? 0) * 10_000_000;
      reportPlaybackStopped(
        serverUrl,
        token,
        itemId,
        mediaSourceId.current,
        playSessionId.current,
        ticks
      );
    }
  };

  const toggleControls = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowControls((v) => {
      if (!v) scheduleHide();
      return !v;
    });
  };

  const scheduleHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3500);
  };

  useEffect(() => {
    if (showControls) scheduleHide();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [showControls]);

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.textSecondary} size="large" />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      )}

      {error && (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {streamUrl && (
        <>
          <TouchableOpacity
            style={styles.videoWrapper}
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

          {/* Controls overlay */}
          {showControls && (
            <View style={styles.controls} pointerEvents="box-none">
              {/* Close */}
              <TouchableOpacity
                style={styles.closeOverlay}
                onPress={() => {
                  stopAndReport();
                  player.pause();
                  router.back();
                }}
              >
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: Typography.sans,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorText: {
    fontFamily: Typography.sans,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  closeBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.surfaceRaised,
  },
  closeBtnText: {
    fontFamily: Typography.sansMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },

  videoWrapper: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  video: {
    width,
    height,
  },

  controls: {
    ...StyleSheet.absoluteFillObject,
  },
  closeOverlay: {
    position: "absolute",
    top: 52,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeIcon: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
});
