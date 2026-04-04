import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "@/lib/store/authStore";
import { getLibraryItems, getPrimaryImageUrl } from "@/lib/jellyfin/media";
import type { JellyfinItem } from "@/lib/jellyfin/types";
import { Colors, Typography, Spacing, Radii } from "@/constants/theme";

const { width } = Dimensions.get("window");

const COLS = 3;
const GAP = Spacing.sm;
const CARD_W = Math.floor((width - Spacing.screen * 2 - GAP * (COLS - 1)) / COLS);
const CARD_H = Math.round(CARD_W * 1.5);
const PAGE_SIZE = 30;

export default function GenreScreen() {
  const { genreId, genreName, type } = useLocalSearchParams<{
    genreId: string;
    genreName: string;
    type?: string;
  }>();
  const router = useRouter();
  const { serverUrl, token, userId } = useAuthStore();

  const [items, setItems] = useState<JellyfinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const nextIndexRef = useRef(0);

  const itemType =
    type === "Movie" ? "Movie" : type === "Series" ? "Series" : undefined;

  const load = useCallback(
    async (startIndex: number, append: boolean) => {
      if (!serverUrl || !token || !userId) return;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await getLibraryItems(serverUrl, token, userId, {
          type: itemType as "Movie" | "Series" | undefined,
          genreIds: genreId,
          sortBy: "SortName",
          sortOrder: "Ascending",
          startIndex,
          limit: PAGE_SIZE,
        });
        const batch = res.Items ?? [];
        setTotal(res.TotalRecordCount ?? 0);
        nextIndexRef.current = startIndex + batch.length;
        if (append) setItems((prev) => [...prev, ...batch]);
        else setItems(batch);
      } catch {
        // silent
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [serverUrl, token, userId, genreId, itemType]
  );

  useEffect(() => {
    nextIndexRef.current = 0;
    load(0, false);
  }, [genreId]);

  const loadMore = () => {
    if (loadingMore || items.length >= total) return;
    load(nextIndexRef.current, true);
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {genreName}
        </Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={Colors.textMuted} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.Id}
          numColumns={COLS}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={Colors.textMuted} style={styles.footerSpinner} />
            ) : null
          }
          renderItem={({ item }) => <GridCard item={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function GridCard({ item }: { item: JellyfinItem }) {
  const { serverUrl } = useAuthStore();
  const router = useRouter();

  const imageUrl =
    serverUrl && item.ImageTags?.Primary
      ? getPrimaryImageUrl(serverUrl, item.Id, item.ImageTags.Primary, CARD_W * 2)
      : undefined;

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
      activeOpacity={0.84}
      style={{ width: CARD_W }}
    >
      <View style={styles.poster}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.noImage]}>
            <Text style={styles.noImageText}>{item.Name?.[0] ?? "?"}</Text>
          </View>
        )}
        <LinearGradient
          colors={["transparent", "rgba(10,10,12,0.75)"]}
          style={styles.posterGrad}
          pointerEvents="none"
        />
        {!!item.UserData?.PlayedPercentage &&
        item.UserData.PlayedPercentage > 2 &&
        item.UserData.PlayedPercentage < 98 ? (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${item.UserData.PlayedPercentage}%` as any },
              ]}
            />
          </View>
        ) : null}
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.Name}
      </Text>
      {!!item.ProductionYear && (
        <Text style={styles.cardYear}>{item.ProductionYear}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.surfaceBorder,
  },
  backBtn: { width: 64 },
  backText: {
    fontFamily: Typography.sansMedium,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  title: {
    fontFamily: Typography.display,
    fontSize: 20,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    flex: 1,
    textAlign: "center",
  },

  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footerSpinner: { marginVertical: Spacing.xl },

  grid: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.md,
    paddingBottom: 100,
    gap: GAP,
  },
  gridRow: { gap: GAP },

  poster: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: Radii.sm,
    overflow: "hidden",
    backgroundColor: Colors.surfaceRaised,
  },
  noImage: {
    backgroundColor: Colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  noImageText: {
    fontFamily: Typography.display,
    fontSize: 22,
    color: Colors.textMuted,
  },
  posterGrad: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: CARD_H * 0.38,
  },
  progressTrack: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  progressFill: {
    height: 3,
    backgroundColor: Colors.brandLight,
  },
  cardTitle: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
    marginTop: 5,
  },
  cardYear: {
    fontFamily: Typography.sans,
    fontSize: 10,
    color: Colors.textMuted,
  },
});
