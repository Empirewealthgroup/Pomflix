import { Tabs, useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Animated,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Typography } from "@/constants/theme";
import { useNowPlayingStore, type NowPlayingItem } from "@/lib/store/nowPlayingStore";

// ─── Ambient Now Playing Bar ──────────────────────────────────────────────────
function NowPlayingBar() {
  const { nowPlaying } = useNowPlayingStore();
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const [display, setDisplay] = useState<NowPlayingItem | null>(null);

  useEffect(() => {
    if (nowPlaying) {
      setDisplay(nowPlaying);
      setVisible(true);
      Animated.spring(fadeAnim, {
        toValue: 1,
        friction: 10,
        tension: 140,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
        setDisplay(null);
      });
    }
  }, [nowPlaying]);

  if (!visible || !display) return null;

  const resumePlayer = () => {
    router.push({
      pathname: "/player/[itemId]",
      params: { itemId: display.itemId, itemName: display.itemName },
    });
  };

  return (
    <Animated.View
      style={[
        npStyles.wrapper,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        activeOpacity={0.86}
        onPress={resumePlayer}
        style={npStyles.bar}
      >
        {/* Mode color glow */}
        <LinearGradient
          colors={[`${display.modeColor}3A`, "rgba(14,14,18,0.94)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Progress line — top edge */}
        <View style={npStyles.progressTrack} pointerEvents="none">
          <View
            style={[
              npStyles.progressFill,
              {
                width: `${Math.min(display.progress, 100)}%` as any,
                backgroundColor: display.modeColor,
              },
            ]}
          />
        </View>

        {/* Content row */}
        <View style={npStyles.row}>
          {/* Pulsing live dot */}
          <View style={[npStyles.liveDot, { backgroundColor: display.modeColor }]} />
          <Text style={npStyles.title} numberOfLines={1}>
            {display.itemName}
          </Text>
          <Text style={npStyles.resumeLabel}>▶ Return</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function HomeIcon({ focused }: { focused: boolean }) {
  return (
    <View style={[styles.icon, focused && { opacity: 1 }]}>
      <View style={[styles.iconInner, focused && { backgroundColor: Colors.textPrimary }]} />
    </View>
  );
}

export default function AppLayout() {
  return (
    <View style={{ flex: 1 }}>
      <NowPlayingBar />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor:
            Platform.OS === "ios"
              ? "rgba(10,10,12,0.82)"
              : "rgba(10,10,12,0.96)",
          borderTopColor: "rgba(255,255,255,0.07)",
          borderTopWidth: 0.5,
          paddingBottom: 24,
          paddingTop: 10,
          height: 72,
        },
        tabBarActiveTintColor: Colors.textPrimary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: Typography.sansMedium,
          fontSize: 10,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabIcon}>
              {focused && <View style={styles.activeGlow} />}
              <View style={[styles.dot, focused && styles.dotActive]} />
              <View style={[styles.dot, styles.dotSmall, focused && styles.dotActive]} />
              <View style={[styles.dot, focused && styles.dotActive]} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Browse",
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabIcon}>
              {focused && <View style={styles.activeGlow} />}
              <View style={[styles.shelf, focused && styles.shelfActive]} />
              <View style={[styles.shelf, styles.shelfThin, focused && styles.shelfActive]} />
              <View style={[styles.shelf, focused && styles.shelfActive]} />
            </View>
          ),
        }}
      />
    </Tabs>
    </View>
  );
}

const npStyles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 80,
    zIndex: 99,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 12,
  },
  bar: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 0.6,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(14,14,18,0.94)",
  },
  progressTrack: {
    height: 2,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  progressFill: {
    height: 2,
    borderRadius: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.88,
  },
  title: {
    flex: 1,
    fontFamily: Typography.sansMedium,
    fontSize: 13,
    color: Colors.textPrimary,
    letterSpacing: -0.1,
  },
  resumeLabel: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
});

const styles = StyleSheet.create({
  icon: { opacity: 0.4 },
  iconInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textSecondary,
  },
  tabIcon: {
    width: 22,
    height: 18,
    justifyContent: "space-between",
    alignItems: "center",
    flexDirection: "column",
  },
  tabIconActive: {},
  activeGlow: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.textPrimary,
    opacity: 0.07,
    alignSelf: "center",
    top: -6,
  },
  dot: {
    width: 18,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
  },
  dotSmall: { width: 12 },
  dotActive: { backgroundColor: Colors.textPrimary },
  shelf: {
    width: 20,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
  },
  shelfThin: { width: 14 },
  shelfActive: { backgroundColor: Colors.textPrimary },
});
