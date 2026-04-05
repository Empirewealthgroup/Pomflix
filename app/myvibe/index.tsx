import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Animated,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "@/lib/store/authStore";
import { getFavorites, getPrimaryImageUrl } from "@/lib/jellyfin/media";
import type { JellyfinItem } from "@/lib/jellyfin/types";
import { Colors, Typography, Spacing, Radii } from "@/constants/theme";
import CardContextSheet from "@/components/CardContextSheet";

const { width } = Dimensions.get("window");
const COLS = 3;
const GAP = 10;
const PAD = Spacing.screen;
const ITEM_W = Math.floor((width - PAD * 2 - GAP * (COLS - 1)) / COLS);
const ITEM_H = Math.round(ITEM_W * 1.5);

// ─── Poster cell ─────────────────────────────────────────────────────────────
function PosterCell({
  item,
  onLongPress,
}: {
  item: JellyfinItem;
  onLongPress: (item: JellyfinItem) => void;
}) {
  const { serverUrl } = useAuthStore();
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;

  const imgUrl =
    serverUrl && item.ImageTags?.Primary
      ? getPrimaryImageUrl(serverUrl, item.Id, item.ImageTags.Primary, ITEM_W * 2)
      : null;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.Type === "Series") {
      router.push({ pathname: "/series/[seriesId]", params: { seriesId: item.Id } });
    } else {
      router.push({
        pathname: "/player/[itemId]",
        params: { itemId: item.Id, itemName: item.Name ?? "" },
      });
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      onPressIn={() =>
        Animated.spring(scale, {
          toValue: 0.95,
          friction: 10,
          tension: 240,
          useNativeDriver: true,
        }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, {
          toValue: 1,
          friction: 8,
          tension: 180,
          useNativeDriver: true,
        }).start()
      }
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onLongPress(item);
      }}
      delayLongPress={380}
      activeOpacity={1}
      style={cellStyles.wrap}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={cellStyles.poster}>
          {imgUrl ? (
            <Image
              source={{ uri: imgUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={180}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, cellStyles.noImg]}>
              <Text style={cellStyles.noImgChar}>{item.Name?.[0] ?? "?"}</Text>
            </View>
          )}
          <LinearGradient
            colors={["transparent", "rgba(5,5,7,0.72)"]}
            style={cellStyles.grad}
            pointerEvents="none"
          />
          {item.UserData?.IsFavorite && (
            <View style={cellStyles.heartBadge}>
              <Text style={cellStyles.heartBadgeText}>♥</Text>
            </View>
          )}
        </View>
        <Text style={cellStyles.title} numberOfLines={2}>
          {item.Name}
        </Text>
        {item.ProductionYear ? (
          <Text style={cellStyles.year}>{item.ProductionYear}</Text>
        ) : null}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function MyVibeScreen() {
  const router = useRouter();
  const { serverUrl, token, userId } = useAuthStore();
  const [items, setItems] = useState<JellyfinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contextItem, setContextItem] = useState<JellyfinItem | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    if (!serverUrl || !token || !userId) return;
    try {
      const data = await getFavorites(serverUrl, token, userId);
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }).start();
    }
  }, [serverUrl, token, userId]);

  useFocusEffect(
    useCallback(() => {
      fadeAnim.setValue(0);
      setLoading(true);
      load();
    }, [load])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleShuffle = () => {
    if (items.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const pick = items[Math.floor(Math.random() * items.length)];
    if (pick.Type === "Series") {
      router.push({ pathname: "/series/[seriesId]", params: { seriesId: pick.Id } });
    } else {
      router.push({
        pathname: "/player/[itemId]",
        params: { itemId: pick.Id, itemName: pick.Name ?? "" },
      });
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" />

      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>♥  My Vibe</Text>
          {items.length > 0 && (
            <Text style={styles.headerCount}>{items.length} saved</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.shuffleBtn, items.length === 0 && { opacity: 0.35 }]}
          onPress={handleShuffle}
          disabled={items.length === 0}
          activeOpacity={0.75}
        >
          <Text style={styles.shuffleBtnText}>⇀ Shuffle</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Grid ─── */}
      <Animated.View style={[styles.listWrap, { opacity: fadeAnim }]}>
        <FlatList
          data={items}
          keyExtractor={(item) => item.Id}
          numColumns={COLS}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.brandLight}
              colors={[Colors.brand]}
            />
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>♡</Text>
                <Text style={styles.emptyTitle}>Nothing saved yet</Text>
                <Text style={styles.emptyBody}>
                  Long-press any title and tap ♥ Save to add it to your vibe.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <PosterCell item={item} onLongPress={(i) => setContextItem(i)} />
          )}
        />
      </Animated.View>

      <CardContextSheet
        item={contextItem}
        onClose={() => setContextItem(null)}
        onFavoriteChange={(itemId, isFav) => {
          if (!isFav) {
            setItems((prev) => prev.filter((i) => i.Id !== itemId));
          }
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  backBtn: { padding: 4 },
  backIcon: {
    fontSize: 20,
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  headerCenter: { flex: 1, gap: 1 },
  headerTitle: {
    fontFamily: Typography.display,
    fontSize: 21,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerCount: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  shuffleBtn: {
    backgroundColor: Colors.brand,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  shuffleBtnText: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 13,
    color: "#fff",
    letterSpacing: 0.1,
  },

  listWrap: { flex: 1 },
  grid: {
    paddingHorizontal: PAD,
    paddingTop: GAP,
    paddingBottom: 110,
  },
  gridRow: {
    gap: GAP,
    marginBottom: GAP,
  },

  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 52,
    color: "rgba(255,255,255,0.12)",
  },
  emptyTitle: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 18,
    color: Colors.textPrimary,
  },
  emptyBody: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 19,
  },
});

const cellStyles = StyleSheet.create({
  wrap: { width: ITEM_W },
  poster: {
    width: ITEM_W,
    height: ITEM_H,
    borderRadius: Radii.sm,
    overflow: "hidden",
    backgroundColor: Colors.surfaceRaised,
  },
  noImg: {
    backgroundColor: Colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  noImgChar: {
    fontFamily: Typography.display,
    fontSize: 22,
    color: Colors.textMuted,
  },
  grad: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_H * 0.42,
  },
  heartBadge: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: "rgba(139,26,46,0.82)",
    borderRadius: 9,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  heartBadgeText: {
    fontSize: 9,
    color: "#FF7090",
    lineHeight: 13,
  },
  title: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
    marginTop: 5,
  },
  year: {
    fontFamily: Typography.sans,
    fontSize: 10,
    color: Colors.textMuted,
  },
});
