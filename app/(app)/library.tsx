import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/lib/store/authStore";
import {
  getLibraryItems,
  getGenres,
  getBackdropImageUrl,
  getPrimaryImageUrl,
  formatRuntime,
} from "@/lib/jellyfin/media";
import type { JellyfinItem, JellyfinGenre } from "@/lib/jellyfin/types";
import { Colors, Typography, Spacing, Radii } from "@/constants/theme";
import SkeletonCard from "@/components/SkeletonCard";

// --- Constants ----------------------------------------------------------------
const { width } = Dimensions.get("window");

const COLS = 3;
const GRID_PAD = Spacing.screen;
const GRID_GAP = Spacing.sm;
const CARD_W = (width - GRID_PAD * 2 - GRID_GAP * (COLS - 1)) / COLS;
const CARD_H = CARD_W * 1.5;

const FEATURED_W = width * 0.72;
const FEATURED_H = FEATURED_W * (9 / 16);

const ROW_CARD_W = 124;
const ROW_CARD_H = Math.round(ROW_CARD_W * 1.5);

const TABS = [
  { id: "movies" as const, label: "Movies" },
  { id: "shows" as const, label: "TV Shows" },
  { id: "new" as const, label: "New" },
  { id: "trending" as const, label: "Trending" },
] as const;

type Tab = "movies" | "shows" | "new" | "trending";

// --- Navigate helper ----------------------------------------------------------
function useNavigate() {
  const router = useRouter();
  return useCallback(
    (item: JellyfinItem) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (item.Type === "Series") {
        router.push({
          pathname: "/series/[seriesId]",
          params: { seriesId: item.Id },
        });
      } else {
        router.push({
          pathname: "/player/[itemId]",
          params: { itemId: item.Id, itemName: item.Name ?? "" },
        });
      }
    },
    [router]
  );
}

// --- Featured strip card (16:9 cinematic) -------------------------------------
function FeaturedCard({ item }: { item: JellyfinItem }) {
  const { serverUrl } = useAuthStore();
  const navigate = useNavigate();
  const scale = useRef(new Animated.Value(1)).current;

  const backdropTag = item.BackdropImageTags?.[0];
  const imageUrl =
    serverUrl && backdropTag
      ? getBackdropImageUrl(serverUrl, item.Id, backdropTag, Math.round(FEATURED_W * 2))
      : serverUrl && item.ImageTags?.Primary
      ? getPrimaryImageUrl(serverUrl, item.Id, item.ImageTags.Primary, Math.round(FEATURED_W * 2))
      : undefined;

  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 0.97,
      friction: 10,
      tension: 220,
      useNativeDriver: true,
    }).start();
  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      friction: 10,
      tension: 220,
      useNativeDriver: true,
    }).start();

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={() => navigate(item)}
    >
      <Animated.View style={[featuredStyles.card, { transform: [{ scale }] }]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={300}
          />
        ) : (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: Colors.surfaceRaised }]}
          />
        )}
        <LinearGradient
          colors={["transparent", "rgba(10,10,12,0.92)"]}
          style={featuredStyles.grad}
          pointerEvents="none"
        />
        <View style={featuredStyles.overlay}>
          <Text style={featuredStyles.title} numberOfLines={2}>
            {item.Name}
          </Text>
          <Text style={featuredStyles.meta}>
            {[
              item.ProductionYear,
              item.Type === "Series" ? "Series" : "Film",
            ]
              .filter(Boolean)
              .join(" . ")}
          </Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// --- Poster grid card ---------------------------------------------------------
function PosterCard({ item }: { item: JellyfinItem }) {
  const { serverUrl } = useAuthStore();
  const navigate = useNavigate();
  const scale = useRef(new Animated.Value(1)).current;

  const imageUrl =
    serverUrl && item.ImageTags?.Primary
      ? getPrimaryImageUrl(
          serverUrl,
          item.Id,
          item.ImageTags.Primary,
          Math.round(CARD_W * 2)
        )
      : undefined;

  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 1.04,
      friction: 10,
      tension: 220,
      useNativeDriver: true,
    }).start();
  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      friction: 10,
      tension: 220,
      useNativeDriver: true,
    }).start();

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={() => navigate(item)}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={posterStyles.poster}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, posterStyles.noImage]}>
              <Text style={posterStyles.noImageLetter}>{item.Name?.[0] ?? "?"}</Text>
            </View>
          )}
          <LinearGradient
            colors={["transparent", "rgba(10,10,12,0.78)"]}
            style={posterStyles.grad}
            pointerEvents="none"
          />
        </View>
        <Text style={posterStyles.title} numberOfLines={2}>
          {item.Name}
        </Text>
        {item.ProductionYear ? (
          <Text style={posterStyles.year}>{item.ProductionYear}</Text>
        ) : null}
      </Animated.View>
    </TouchableOpacity>
  );
}

// --- Row card (poster card used inside CategoryRow) --------------------------
function RowCard({ item }: { item: JellyfinItem }) {
  const { serverUrl } = useAuthStore();
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;

  const imageUrl =
    serverUrl && item.ImageTags?.Primary
      ? getPrimaryImageUrl(serverUrl, item.Id, item.ImageTags.Primary, ROW_CARD_W * 2)
      : undefined;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.96, friction: 10, tension: 220, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, friction: 10, tension: 220, useNativeDriver: true }).start();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.Type === "Series") {
      router.push({ pathname: "/series/[seriesId]", params: { seriesId: item.Id } });
    } else {
      router.push({ pathname: "/player/[itemId]", params: { itemId: item.Id, itemName: item.Name ?? "" } });
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      activeOpacity={1}
      style={{ width: ROW_CARD_W }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={catStyles.rowPoster}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          ) : (
            <View style={[StyleSheet.absoluteFill, catStyles.noImage]}>
              <Text style={catStyles.noImageLetter}>{item.Name?.[0] ?? "?"}</Text>
            </View>
          )}
          <LinearGradient
            colors={["transparent", "rgba(10,10,12,0.75)"]}
            style={catStyles.posterGrad}
            pointerEvents="none"
          />
          {!!item.UserData?.PlayedPercentage &&
          item.UserData.PlayedPercentage > 2 &&
          item.UserData.PlayedPercentage < 98 ? (
            <View style={catStyles.progressTrack}>
              <View style={[catStyles.progressFill, { width: `${item.UserData.PlayedPercentage}%` as any }]} />
            </View>
          ) : null}
        </View>
        <Text style={catStyles.cardTitle} numberOfLines={2}>{item.Name}</Text>
        {!!item.ProductionYear && <Text style={catStyles.cardYear}>{item.ProductionYear}</Text>}
      </Animated.View>
    </TouchableOpacity>
  );
}

// --- Category row (genre section with See All button) -------------------------
function CategoryRow({
  genreId,
  genreName,
  type,
}: {
  genreId: string;
  genreName: string;
  type: "Movie" | "Series";
}) {
  const { serverUrl, token, userId } = useAuthStore();
  const router = useRouter();
  const [items, setItems] = useState<JellyfinItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!serverUrl || !token || !userId) return;
    setLoading(true);
    getLibraryItems(serverUrl, token, userId, {
      type,
      genreIds: genreId,
      sortBy: "Random",
      limit: 12,
    })
      .then((res) => setItems(res.Items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [serverUrl, token, userId, genreId, type]);

  if (!loading && items.length === 0) return null;

  return (
    <View style={catStyles.section}>
      <View style={catStyles.sectionHeader}>
        <Text style={catStyles.genreLabel}>{genreName}</Text>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({ pathname: "/genre/[genreId]", params: { genreId, genreName, type } });
          }}
          hitSlop={10}
          activeOpacity={0.7}
        >
          <Text style={catStyles.seeAll}>See all →</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={catStyles.skeletonRow}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} size="small" width={ROW_CARD_W} />
          ))}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.Id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={catStyles.rowContent}
          decelerationRate="fast"
          snapToInterval={ROW_CARD_W + Spacing.sm}
          ItemSeparatorComponent={() => <View style={{ width: Spacing.sm }} />}
          renderItem={({ item }) => <RowCard item={item} />}
        />
      )}
    </View>
  );
}

// --- Search result card -------------------------------------------------------
function SearchCard({ item }: { item: JellyfinItem }) {
  const { serverUrl } = useAuthStore();
  const navigate = useNavigate();

  const imageUrl =
    serverUrl && item.ImageTags?.Primary
      ? getPrimaryImageUrl(
          serverUrl,
          item.Id,
          item.ImageTags.Primary,
          Math.round(CARD_W * 2)
        )
      : undefined;

  const meta = [
    item.ProductionYear,
    item.Type === "Series" ? "Series" : "Film",
    item.RunTimeTicks ? formatRuntime(item.RunTimeTicks) : null,
  ]
    .filter(Boolean)
    .join(" . ");

  return (
    <TouchableOpacity
      style={[searchStyles.card, { width: CARD_W }]}
      activeOpacity={0.84}
      onPress={() => navigate(item)}
    >
      <View style={[searchStyles.poster, { height: CARD_H }]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, searchStyles.noImage]}>
            <Text style={searchStyles.noImageLetter}>{item.Name?.[0] ?? "?"}</Text>
          </View>
        )}
      </View>
      <Text style={searchStyles.title} numberOfLines={2}>
        {item.Name}
      </Text>
      {meta ? <Text style={searchStyles.meta}>{meta}</Text> : null}
    </TouchableOpacity>
  );
}

// --- Main screen --------------------------------------------------------------
export default function LibraryScreen() {
  const { serverUrl, token, userId } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<Tab>("movies");
  const [tabItems, setTabItems] = useState<JellyfinItem[]>([]);
  const [tabLoading, setTabLoading] = useState(true);

  const [moviesGenres, setMoviesGenres] = useState<JellyfinGenre[] | null>(null);
  const [showsGenres, setShowsGenres] = useState<JellyfinGenre[] | null>(null);
  const [moviesGenresLoading, setMoviesGenresLoading] = useState(false);
  const [showsGenresLoading, setShowsGenresLoading] = useState(false);
  const moviesGenresLoaded = useRef(false);
  const showsGenresLoaded = useRef(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<JellyfinItem[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerBg = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: ["rgba(10,10,12,0)", "rgba(10,10,12,0.96)"],
    extrapolate: "clamp",
  });

  const mountAnim = useRef(new Animated.Value(0)).current;
  useFocusEffect(
    useCallback(() => {
      mountAnim.setValue(0);
      Animated.spring(mountAnim, {
        toValue: 1,
        friction: 18,
        tension: 60,
        useNativeDriver: true,
      }).start();
    }, [mountAnim])
  );

  const contentAnim = {
    opacity: mountAnim,
    transform: [
      {
        translateY: mountAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [22, 0],
        }),
      },
      {
        scale: mountAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  };

  const loadTab = useCallback(
    async (tab: Tab) => {
      if (!serverUrl || !token || !userId) return;

      if (tab === "movies") {
        if (moviesGenresLoaded.current) return;
        moviesGenresLoaded.current = true;
        setMoviesGenresLoading(true);
        try {
          const gs = await getGenres(serverUrl, token, userId, "Movie");
          setMoviesGenres(gs);
        } catch {
          setMoviesGenres([]);
        } finally {
          setMoviesGenresLoading(false);
        }
        return;
      }

      if (tab === "shows") {
        if (showsGenresLoaded.current) return;
        showsGenresLoaded.current = true;
        setShowsGenresLoading(true);
        try {
          const gs = await getGenres(serverUrl, token, userId, "Series");
          setShowsGenres(gs);
        } catch {
          setShowsGenres([]);
        } finally {
          setShowsGenresLoading(false);
        }
        return;
      }

      // new / trending — flat poster grid
      setTabLoading(true);
      setTabItems([]);
      try {
        type Opts = Parameters<typeof getLibraryItems>[3];
        const opts: Opts = { limit: 42 };
        if (tab === "new") {
          opts.sortBy = "DateAdded";
          opts.sortOrder = "Descending";
        } else if (tab === "trending") {
          opts.sortBy = "PlayCount";
          opts.sortOrder = "Descending";
        }
        const res = await getLibraryItems(serverUrl, token, userId, opts);
        setTabItems(res.Items ?? []);
      } catch {
        setTabItems([]);
      } finally {
        setTabLoading(false);
      }
    },
    [serverUrl, token, userId]
  );

  useEffect(() => {
    loadTab(activeTab);
  }, [activeTab, loadTab]);

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

  const openSearch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchOpen(true);
  };

  const closeSearch = () => {
    setSearchText("");
    setSearchResults([]);
    setSearchTotal(0);
    Keyboard.dismiss();
    setSearchOpen(false);
  };

  const switchTab = (tab: Tab) => {
    if (activeTab === tab) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scrollY.setValue(0);
    setActiveTab(tab);
  };

  const featuredItems = useMemo(
    () =>
      tabItems
        .filter((i) => (i.BackdropImageTags?.length ?? 0) > 0 || i.ImageTags?.Primary)
        .slice(0, 6),
    [tabItems]
  );

  const sectionLabel = useMemo(() => {
    if (activeTab === "new") return "Newly Added";
    return "Trending Now";
  }, [activeTab]);

  const ListHeader = useMemo(() => {
    if (tabLoading) {
      return (
        <View style={styles.gridSkeletonWrap}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} size="small" width={CARD_W} />
          ))}
        </View>
      );
    }
    return (
      <View>
        {featuredItems.length > 0 && (
          <View style={styles.featuredWrap}>
            <FlatList
              data={featuredItems}
              keyExtractor={(i) => i.Id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredRow}
              snapToInterval={FEATURED_W + GRID_GAP}
              decelerationRate="fast"
              renderItem={({ item }) => <FeaturedCard item={item} />}
            />
          </View>
        )}
        <Text style={styles.sectionLabel}>{sectionLabel}</Text>
      </View>
    );
  }, [tabLoading, featuredItems, sectionLabel]);

  const TabBar = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabRow}
      style={styles.tabScroll}
    >
      {TABS.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[styles.tabPill, activeTab === tab.id && styles.tabPillActive]}
          activeOpacity={0.75}
          onPress={() => switchTab(tab.id)}
        >
          <Text
            style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient
        colors={["rgba(60,12,20,0.24)", Colors.bg]}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.4]}
        pointerEvents="none"
      />

      <Animated.View style={[styles.stickyHeader, { backgroundColor: headerBg }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Browse</Text>
          <TouchableOpacity
            style={styles.searchPill}
            onPress={openSearch}
            activeOpacity={0.76}
          >
            <Text style={styles.searchPillText}>Search</Text>
          </TouchableOpacity>
        </View>
        {TabBar}
      </Animated.View>

      <Animated.View style={[styles.flex, contentAnim]}>
        {activeTab === "movies" || activeTab === "shows" ? (
          // Genre category rows
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.catContent}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
          >
            {(activeTab === "movies" ? moviesGenresLoading : showsGenresLoading) ? (
              <View style={styles.genresLoadingWrap}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={styles.genreSkelSection}>
                    <View style={styles.genreSkelLabel} />
                    <View style={styles.genreSkelRow}>
                      {[0, 1, 2, 3].map((j) => (
                        <SkeletonCard key={j} size="small" width={ROW_CARD_W} />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              (activeTab === "movies" ? moviesGenres ?? [] : showsGenres ?? []).map((g) => (
                <CategoryRow
                  key={g.Id}
                  genreId={g.Id}
                  genreName={g.Name}
                  type={activeTab === "movies" ? "Movie" : "Series"}
                />
              ))
            )}
          </ScrollView>
        ) : (
          // Flat grid for New / Trending
          <FlatList
            data={tabLoading ? [] : tabItems}
            keyExtractor={(item) => item.Id}
            numColumns={COLS}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.gridRow}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
            ListHeaderComponent={ListHeader}
            renderItem={({ item }) => <PosterCard item={item} />}
          />
        )}
      </Animated.View>

      <Modal
        visible={searchOpen}
        animationType="fade"
        transparent
        onRequestClose={closeSearch}
        statusBarTranslucent
      >
        <BlurView
          intensity={80}
          tint="dark"
          style={[StyleSheet.absoluteFill, { paddingTop: insets.top }]}
        >
          <View style={searchStyles.header}>
            <View style={searchStyles.inputWrap}>
              <Text style={searchStyles.icon}>⌕</Text>
              <TextInput
                style={searchStyles.input}
                placeholder="Search everything..."
                placeholderTextColor="rgba(255,255,255,0.42)"
                value={searchText}
                onChangeText={handleSearchChange}
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
                keyboardAppearance="dark"
                returnKeyType="search"
                onSubmitEditing={Keyboard.dismiss}
              />
              {searchText.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setSearchText("");
                    setSearchResults([]);
                    setSearchTotal(0);
                  }}
                  hitSlop={10}
                >
                  <Text style={searchStyles.clear}>x</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={closeSearch} style={searchStyles.cancelBtn}>
              <Text style={searchStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {searchLoading ? (
            <View style={searchStyles.gridSkel}>
              {[...Array(9)].map((_, i) => (
                <SkeletonCard key={i} size="small" width={CARD_W} />
              ))}
            </View>
          ) : searchText.length > 0 ? (
            searchResults.length > 0 ? (
              <>
                <Text style={searchStyles.count}>
                  {searchTotal} result{searchTotal !== 1 ? "s" : ""} for "{searchText}"
                </Text>
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.Id}
                  numColumns={COLS}
                  contentContainerStyle={searchStyles.results}
                  columnWrapperStyle={searchStyles.resultRow}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  onScrollBeginDrag={Keyboard.dismiss}
                  renderItem={({ item }) => <SearchCard item={item} />}
                />
              </>
            ) : (
              <View style={searchStyles.empty}>
                <Text style={searchStyles.emptyIcon}>O</Text>
                <Text style={searchStyles.emptyText}>
                  Nothing found for "{searchText}"
                </Text>
                <Text style={searchStyles.emptySub}>
                  Try a shorter title or different spelling.
                </Text>
              </View>
            )
          ) : (
            <View style={searchStyles.hint}>
              <Text style={searchStyles.hintIcon}>⌕</Text>
              <Text style={searchStyles.hintText}>Start typing to search</Text>
              <Text style={searchStyles.hintSub}>Movies, shows, and more</Text>
            </View>
          )}
        </BlurView>
      </Modal>
    </SafeAreaView>
  );
}

// --- Styles -------------------------------------------------------------------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },

  stickyHeader: { zIndex: 10 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radii.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 5,
    borderWidth: 0.5,
    borderColor: Colors.surfaceBorder,
  },
  searchPillIcon: { fontSize: 14, color: Colors.textMuted },
  searchPillText: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: Colors.textSecondary,
  },

  tabScroll: { marginBottom: Spacing.xs },
  tabRow: {
    paddingHorizontal: Spacing.screen,
    gap: Spacing.xs,
    paddingBottom: 6,
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 0.5,
    borderColor: "transparent",
  },
  tabPillActive: {
    backgroundColor: Colors.brand,
    borderColor: Colors.brandLight,
  },
  tabLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  tabLabelActive: { color: Colors.textPrimary },

  featuredWrap: { marginBottom: Spacing.md },
  featuredRow: { paddingHorizontal: Spacing.screen, gap: GRID_GAP },
  sectionLabel: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 10.5,
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.3,
    paddingHorizontal: Spacing.screen,
    marginBottom: Spacing.sm,
  },

  gridContent: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: 110,
    gap: GRID_GAP,
  },
  gridRow: { gap: GRID_GAP },
  gridSkeletonWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
    paddingBottom: Spacing.md,
  },

  catContent: { paddingTop: Spacing.md, paddingBottom: 110 },
  genresLoadingWrap: {
    gap: Spacing.xl,
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.sm,
  },
  genreSkelSection: { gap: Spacing.sm },
  genreSkelLabel: {
    height: 13,
    width: 110,
    borderRadius: Radii.sm,
    backgroundColor: Colors.surfaceRaised,
  },
  genreSkelRow: { flexDirection: "row", gap: Spacing.sm },
});

const catStyles = StyleSheet.create({
  section: { marginBottom: Spacing.xl },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.screen,
    marginBottom: Spacing.sm,
  },
  genreLabel: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 16,
    color: Colors.textPrimary,
    letterSpacing: -0.1,
  },
  seeAll: {
    fontFamily: Typography.sansMedium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  skeletonRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.screen,
  },
  rowContent: { paddingHorizontal: Spacing.screen },
  rowPoster: {
    width: ROW_CARD_W,
    height: ROW_CARD_H,
    borderRadius: Radii.sm,
    overflow: "hidden",
    backgroundColor: Colors.surfaceRaised,
  },
  noImage: {
    backgroundColor: Colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  noImageLetter: {
    fontFamily: Typography.display,
    fontSize: 20,
    color: Colors.textMuted,
  },
  posterGrad: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: ROW_CARD_H * 0.38,
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

const featuredStyles = StyleSheet.create({
  card: {
    width: FEATURED_W,
    height: FEATURED_H,
    borderRadius: Radii.md,
    overflow: "hidden",
    backgroundColor: Colors.surfaceRaised,
  },
  grad: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: FEATURED_H * 0.55,
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
    gap: 3,
  },
  title: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 14,
    color: Colors.textPrimary,
    letterSpacing: -0.1,
  },
  meta: {
    fontFamily: Typography.sans,
    fontSize: 11.5,
    color: Colors.textSecondary,
  },
});

const posterStyles = StyleSheet.create({
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
  noImageLetter: {
    fontFamily: Typography.display,
    fontSize: 22,
    color: Colors.textMuted,
  },
  grad: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: CARD_H * 0.38,
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

const searchStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.09)",
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    gap: 8,
  },
  icon: { fontSize: 14, color: Colors.textMuted, lineHeight: 22 },
  input: {
    flex: 1,
    paddingVertical: 11,
    color: Colors.textPrimary,
    fontFamily: Typography.sans,
    fontSize: 15,
  },
  clear: { fontSize: 13, color: Colors.textMuted, paddingLeft: 4, paddingVertical: 4 },
  cancelBtn: { paddingVertical: 8, paddingLeft: 4 },
  cancelText: {
    fontFamily: Typography.sansMedium,
    fontSize: 14,
    color: Colors.brandLight,
  },
  count: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.sm,
  },
  results: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: 100,
    gap: Spacing.md,
  },
  resultRow: { gap: GRID_GAP },
  gridSkel: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
    padding: Spacing.screen,
  },
  card: { gap: 5 },
  poster: {
    width: "100%",
    borderRadius: Radii.sm,
    overflow: "hidden",
    backgroundColor: Colors.surfaceRaised,
  },
  noImage: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceRaised,
  },
  noImageLetter: {
    fontFamily: Typography.display,
    fontSize: 22,
    color: Colors.textMuted,
  },
  title: {
    fontFamily: Typography.sans,
    fontSize: 11.5,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  meta: {
    fontFamily: Typography.sans,
    fontSize: 10.5,
    color: Colors.textMuted,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
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
  hint: { flex: 1, alignItems: "center", paddingTop: 80, gap: 8 },
  hintIcon: { fontSize: 28, color: "rgba(255,255,255,0.35)" },
  hintText: {
    fontFamily: Typography.sansMedium,
    fontSize: 15,
    color: "rgba(255,255,255,0.58)",
    textAlign: "center",
  },
  hintSub: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: "rgba(255,255,255,0.32)",
    textAlign: "center",
  },
});
