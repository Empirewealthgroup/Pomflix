import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/lib/store/authStore";
import { getLibraryItems } from "@/lib/jellyfin/media";
import type { JellyfinItem } from "@/lib/jellyfin/types";
import { Colors, Typography, Spacing, Radii } from "@/constants/theme";
import MediaCard from "@/components/MediaCard";

const { width } = Dimensions.get("window");
const COLUMNS = 3;
const CARD_WIDTH = (width - Spacing.screen * 2 - Spacing.sm * (COLUMNS - 1)) / COLUMNS;

type FilterType = "All" | "Movie" | "Series";

export default function LibraryScreen() {
  const { serverUrl, token, userId } = useAuthStore();
  const [items, setItems] = useState<JellyfinItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("All");
  const [startIndex, setStartIndex] = useState(0);
  const PAGE = 60;

  const fetchItems = useCallback(
    async (reset = false) => {
      if (!serverUrl || !token || !userId) return;
      const idx = reset ? 0 : startIndex;
      reset ? setLoading(true) : setLoadingMore(true);
      try {
        const res = await getLibraryItems(serverUrl, token, userId, {
          type: filter === "All" ? undefined : filter,
          search: search || undefined,
          startIndex: idx,
          limit: PAGE,
          sortBy: search ? "SortName" : "DateCreated",
        });
        setTotal(res.TotalRecordCount);
        setItems((prev) => (reset ? res.Items : [...prev, ...res.Items]));
        setStartIndex(idx + res.Items.length);
      } catch {}
      reset ? setLoading(false) : setLoadingMore(false);
    },
    [serverUrl, token, userId, filter, search, startIndex]
  );

  // Reset + refetch whenever filter or search changes
  useEffect(() => {
    setStartIndex(0);
    setItems([]);
    fetchItems(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search]);

  const handleEndReached = () => {
    if (!loadingMore && items.length < total) fetchItems(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          placeholder="Search library…"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          keyboardAppearance="dark"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {/* Filter pills */}
      <View style={styles.filters}>
        {(["All", "Movie", "Series"] as FilterType[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.pill, filter === f && styles.pillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.pillText, filter === f && styles.pillTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
        {total > 0 && (
          <Text style={styles.count}>{total} titles</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.textSecondary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.Id}
          numColumns={COLUMNS}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={Colors.textSecondary} style={{ marginVertical: Spacing.lg }} />
            ) : null
          }
          renderItem={({ item }) => (
            <View style={{ width: CARD_WIDTH }}>
              <MediaCard item={item} size="small" navigateTo="item" />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  searchRow: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  search: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontFamily: Typography.sans,
    fontSize: 15,
    borderWidth: 0.5,
    borderColor: Colors.surfaceBorder,
  },

  filters: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.md,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 0.5,
    borderColor: Colors.surfaceBorder,
  },
  pillActive: { backgroundColor: Colors.textPrimary },
  pillText: {
    fontFamily: Typography.sansMedium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  pillTextActive: { color: Colors.bg },
  count: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: Colors.textMuted,
    marginLeft: "auto",
  },

  grid: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  row: { gap: Spacing.sm },

  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
});
