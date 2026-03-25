import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Keyboard,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "@/lib/store/authStore";
import {
  getLibraryItems,
  getRecentlyAdded,
  getSuggestionsForMode,
  getPrimaryImageUrl,
  formatRuntime,
} from "@/lib/jellyfin/media";
import { MODES } from "@/constants/modes";
import type { Mode } from "@/constants/modes";
import type { JellyfinItem } from "@/lib/jellyfin/types";
import { Colors, Typography, Spacing, Radii } from "@/constants/theme";
import SkeletonCard from "@/components/SkeletonCard";

const { width } = Dimensions.get("window");

const SHELF_CARD_W = 112;
const SHELF_CARD_H = 162;
const RESULT_COLS = 3;
const RESULT_CARD_W =
  (width - Spacing.screen * 2 - Spacing.sm * (RESULT_COLS - 1)) / RESULT_COLS;

// ─── Shelf poster card ────────────────────────────────────────────────────────
function ShelfCard({
  item,
  accentColor,
}: {
  item: JellyfinItem;
  accentColor: string;
}) {
  const router = useRouter();
  const { serverUrl } = useAuthStore();

  const imageUrl =
    serverUrl && item.ImageTags?.Primary
      ? getPrimaryImageUrl(serverUrl, item.Id, item.ImageTags.Primary, SHELF_CARD_W * 2)
      : undefined;

  const progress = item.UserData?.PlayedPercentage ?? 0;

  return (
    <TouchableOpacity
      style={shelfStyles.card}
      activeOpacity={0.84}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
          pathname: "/player/[itemId]",
          params: { itemId: item.Id, itemName: item.Name ?? "" },
        });
      }}
    >
      <View style={shelfStyles.poster}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, shelfStyles.noImage]}>
            <Text style={shelfStyles.noImageText}>{item.Name?.[0] ?? "?"}</Text>
          </View>
        )}
        <LinearGradient
          colors={["transparent", "rgba(10,10,12,0.88)"]}
          style={shelfStyles.grad}
          pointerEvents="none"
        />
        {progress > 2 && (
          <View style={shelfStyles.progressTrack}>
            <View
              style={[
                shelfStyles.progressFill,
                { width: `${progress}%` as any, backgroundColor: accentColor },
              ]}
            />
          </View>
        )}
      </View>
      <Text style={shelfStyles.title} numberOfLines={2}>
        {item.Name}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Single mode shelf row ────────────────────────────────────────────────────
function ShelfRow({
  mode,
  items,
  loading,
}: {
  mode: Mode;
  items: JellyfinItem[];
  loading: boolean;
}) {
  return (
    <View style={shelfStyles.shelfSection}>
      <View style={shelfStyles.shelfHeader}>
        <Text style={[shelfStyles.shelfModeIcon, { color: mode.colors.accent }]}>
          {mode.icon}
        </Text>
        <Text style={shelfStyles.shelfLabel}>For {mode.label}</Text>
        <Text
          style={[shelfStyles.shelfTagline, { color: mode.colors.textAccent }]}
          numberOfLines={1}
        >
          {mode.tagline}
        </Text>
      </View>
      {loading ? (
        <View style={shelfStyles.skeletonRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} size="small" />
          ))}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.Id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={shelfStyles.shelfRow}
          renderItem={({ item }) => (
            <ShelfCard item={item} accentColor={mode.colors.accent} />
          )}
        />
      )}
    </View>
  );
}

// ─── Search result card ───────────────────────────────────────────────────────
function ResultCard({ item }: { item: JellyfinItem }) {
  const router = useRouter();
  const { serverUrl } = useAuthStore();

  const imageUrl =
    serverUrl && item.ImageTags?.Primary
      ? getPrimaryImageUrl(serverUrl, item.Id, item.ImageTags.Primary, RESULT_CARD_W * 2)
      : undefined;

  const meta = [
    item.ProductionYear,
    item.Type === "Series" ? "Series" : "Film",
    item.RunTimeTicks ? formatRuntime(item.RunTimeTicks) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <TouchableOpacity
      style={[resultStyles.card, { width: RESULT_CARD_W }]}
      activeOpacity={0.84}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
          pathname: "/player/[itemId]",
          params: { itemId: item.Id, itemName: item.Name ?? "" },
        });
      }}
    >
      <View style={[resultStyles.poster, { height: RESULT_CARD_W * 1.46 }]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, resultStyles.noImage]}>
            <Text style={resultStyles.noImageText}>{item.Name?.[0] ?? "?"}</Text>
          </View>
        )}
      </View>
      <Text style={resultStyles.title} numberOfLines={2}>
        {item.Name}
      </Text>
      {meta ? <Text style={resultStyles.meta}>{meta}</Text> : null}
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function LibraryScreen() {
  const { serverUrl, token, userId } = useAuthStore();

  // Search state
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<JellyfinItem[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);

  // Shelves state
  const [recentItems, setRecentItems] = useState<JellyfinItem[]>([]);
  const [shelves, setShelves] = useState<{ mode: Mode; items: JellyfinItem[] }[]>([]);
  const [shelvesLoading, setShelvesLoading] = useState(true);
  const [shelvesError, setShelvesError] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSearching = searchText.length > 0;

  // Load all shelves once on mount
  const loadShelves = () => {
    if (!serverUrl || !token || !userId) return;
    setShelvesLoading(true);
    setShelvesError(false);
    Promise.all([
      getRecentlyAdded(serverUrl, token, userId, 14),
      ...MODES.map((m) => getSuggestionsForMode(serverUrl, token, userId, m, 10)),
    ])
      .then(([recent, ...modeItems]) => {
        setRecentItems(recent as JellyfinItem[]);
        setShelves(
          MODES.map((m, i) => ({ mode: m, items: modeItems[i] as JellyfinItem[] }))
        );
      })
      .catch(() => setShelvesError(true))
      .finally(() => setShelvesLoading(false));
  };

  // Load all shelves once on mount
  useEffect(() => { loadShelves(); }, [serverUrl, token, userId]);

  // Debounced search (300 ms)
  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setSearchResults([]);
      setSearchTotal(0);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      if (!serverUrl || !token || !userId) return;
      setSearchLoading(true);
      try {
        const res = await getLibraryItems(serverUrl, token, userId, {
          search: text.trim(),
          sortBy: "SortName",
          limit: 60,
        });
        setSearchResults(res.Items ?? []);
        setSearchTotal(res.TotalRecordCount ?? 0);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const clearSearch = () => {
    setSearchText("");
    setSearchResults([]);
    setSearchTotal(0);
    Keyboard.dismiss();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Browse</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search everything…"
            placeholderTextColor={Colors.textMuted}
            value={searchText}
            onChangeText={handleSearchChange}
            autoCorrect={false}
            autoCapitalize="none"
            keyboardAppearance="dark"
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={clearSearch} hitSlop={10}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ──── Search results ───────────────────────────────────── */}
      {isSearching ? (
        <View style={styles.flex}>
          {searchLoading ? (
            <View style={styles.resultGrid}>
              {[...Array(9)].map((_, i) => (
                <SkeletonCard key={i} size="small" width={RESULT_CARD_W} />
              ))}
            </View>
          ) : (
            <>
              {searchTotal > 0 && (
                <Text style={styles.resultCount}>
                  {searchTotal} result{searchTotal !== 1 ? "s" : ""} for &ldquo;
                  {searchText}&rdquo;
                </Text>
              )}
              {searchResults.length > 0 ? (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.Id}
                  numColumns={RESULT_COLS}
                  contentContainerStyle={styles.resultList}
                  columnWrapperStyle={styles.resultRow}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  onScrollBeginDrag={Keyboard.dismiss}
                  renderItem={({ item }) => <ResultCard item={item} />}
                />
              ) : searchText.length > 1 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>◌</Text>
                  <Text style={styles.emptyText}>
                    Nothing found for &ldquo;{searchText}&rdquo;
                  </Text>
                  <Text style={styles.emptySub}>
                    Try a shorter title or different spelling.
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>
      ) : (
        /* ──── Shelves ─────────────────────────────────────────── */
        <Animated.ScrollView
          style={styles.flex}
          contentContainerStyle={styles.shelvesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
        >
          {/* Recently Added */}
          <View style={shelfStyles.shelfSection}>
            <View style={shelfStyles.shelfHeader}>
              <Text style={shelfStyles.shelfLabel}>Recently Added</Text>
            </View>
            {shelvesLoading ? (
              <View style={shelfStyles.skeletonRow}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <SkeletonCard key={i} size="small" />
                ))}
              </View>
            ) : shelvesError ? (
              <TouchableOpacity
                onPress={loadShelves}
                style={{ paddingVertical: Spacing.md }}
                activeOpacity={0.7}
              >
                <Text style={[shelfStyles.shelfLabel, { color: Colors.textMuted, fontFamily: Typography.sans }]}>
                  Could not load — tap to retry
                </Text>
              </TouchableOpacity>
            ) : (
              <FlatList
                data={recentItems}
                keyExtractor={(item) => item.Id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={shelfStyles.shelfRow}
                renderItem={({ item }) => (
                  <ShelfCard item={item} accentColor={Colors.brand} />
                )}
              />
            )}
          </View>

          {/* Mode shelves */}
          {shelves.map(({ mode, items }) => (
            <ShelfRow
              key={mode.id}
              mode={mode}
              items={items}
              loading={shelvesLoading}
            />
          ))}
        </Animated.ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },

  header: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  headerTitle: {
    fontFamily: Typography.display,
    fontSize: 28,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },

  searchRow: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.md,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    borderWidth: 0.5,
    borderColor: Colors.surfaceBorder,
    gap: 8,
  },
  searchIcon: {
    fontSize: 18,
    color: Colors.textMuted,
    lineHeight: 22,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    color: Colors.textPrimary,
    fontFamily: Typography.sans,
    fontSize: 15,
  },
  searchClear: {
    fontSize: 13,
    color: Colors.textMuted,
    paddingLeft: 4,
    paddingVertical: 4,
  },

  resultCount: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.sm,
  },
  resultList: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: 100,
    gap: Spacing.md,
  },
  resultRow: { gap: Spacing.sm },
  resultGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    padding: Spacing.screen,
  },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyIcon: { fontSize: 36, color: Colors.textMuted },
  emptyText: {
    fontFamily: Typography.display,
    fontSize: 18,
    color: Colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 32,
    letterSpacing: -0.2,
  },
  emptySub: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
  },

  shelvesContent: {
    paddingBottom: 110,
    gap: Spacing.xl,
  },
});

const shelfStyles = StyleSheet.create({
  shelfSection: { gap: Spacing.sm },
  shelfHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    paddingHorizontal: Spacing.screen,
  },
  shelfModeIcon: { fontSize: 16, lineHeight: 20 },
  shelfLabel: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  shelfTagline: {
    fontFamily: Typography.sans,
    fontSize: 11,
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  shelfRow: {
    paddingHorizontal: Spacing.screen,
    gap: Spacing.sm,
  },
  skeletonRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.screen,
  },

  card: { width: SHELF_CARD_W, gap: 6 },
  poster: {
    width: SHELF_CARD_W,
    height: SHELF_CARD_H,
    borderRadius: Radii.md,
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
  grad: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  progressTrack: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  progressFill: { height: 2.5, borderRadius: 1 },
  title: {
    fontFamily: Typography.sans,
    fontSize: 11.5,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
});

const resultStyles = StyleSheet.create({
  card: { gap: 5 },
  poster: {
    width: "100%",
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
    fontSize: 20,
    color: Colors.textMuted,
  },
  title: {
    fontFamily: Typography.sansMedium,
    fontSize: 12,
    color: Colors.textPrimary,
    lineHeight: 16,
  },
  meta: {
    fontFamily: Typography.sans,
    fontSize: 10.5,
    color: Colors.textMuted,
  },
});

