import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { getModeById } from "@/constants/modes";
import { useAuthStore } from "@/lib/store/authStore";
import { getSuggestionsForMode, getBackdropImageUrl, getPrimaryImageUrl, formatRuntime } from "@/lib/jellyfin/media";
import type { JellyfinItem } from "@/lib/jellyfin/types";
import { Colors, Typography, Spacing, Radii } from "@/constants/theme";

const { width } = Dimensions.get("window");

export default function ModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { serverUrl, token, userId } = useAuthStore();
  const mode = getModeById(id);

  const [suggestions, setSuggestions] = useState<JellyfinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!mode || !serverUrl || !token || !userId) return;
    setLoading(true);
    getSuggestionsForMode(serverUrl, token, userId, mode, 5)
      .then(setSuggestions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [mode?.id]);

  if (!mode) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ color: Colors.textSecondary, margin: Spacing.lg }}>Mode not found.</Text>
      </SafeAreaView>
    );
  }

  const handlePlay = (itemId: string) => {
    router.push(`/player/${itemId}`);
  };

  return (
    <View style={styles.root}>
      {/* Ambient background */}
      <LinearGradient
        colors={[`${mode.colors.base}CC`, `${mode.colors.base}33`, Colors.bg]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe}>
        {/* Back */}
        <TouchableOpacity
          style={styles.back}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Text style={styles.backText}>← All modes</Text>
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Mode identity */}
          <View style={styles.identity}>
            <Text style={[styles.modeIcon, { color: mode.colors.accent }]}>{mode.icon}</Text>
            <Text style={styles.modeLabel}>{mode.label}</Text>
            <Text style={[styles.modeTagline, { color: mode.colors.textAccent }]}>
              {mode.tagline}
            </Text>
            <Text style={styles.modeDescription}>{mode.description}</Text>
          </View>

          {/* Suggestions */}
          <View style={styles.suggestionsSection}>
            <Text style={styles.sectionLabel}>Curated for this moment</Text>

            {loading ? (
              <ActivityIndicator color={mode.colors.accent} style={{ marginTop: Spacing.xl }} />
            ) : suggestions.length === 0 ? (
              <Text style={styles.empty}>No suggestions found. Try the Library.</Text>
            ) : (
              <View style={styles.suggestionsList}>
                {suggestions.map((item) => {
                  const isSelected = selected === item.Id;
                  const imageUrl =
                    serverUrl && item.BackdropImageTags?.[0]
                      ? getBackdropImageUrl(serverUrl, item.Id, item.BackdropImageTags[0], width * 2)
                      : serverUrl && item.ImageTags?.Primary
                      ? getPrimaryImageUrl(serverUrl, item.Id, item.ImageTags.Primary, 600)
                      : undefined;

                  return (
                    <Pressable
                      key={item.Id}
                      onPress={() => setSelected(isSelected ? null : item.Id)}
                      style={[styles.suggestion, isSelected && { borderColor: `${mode.colors.accent}88` }]}
                    >
                      {/* Backdrop thumbnail */}
                      <View style={styles.thumb}>
                        {imageUrl ? (
                          <Image
                            source={{ uri: imageUrl }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                            transition={200}
                          />
                        ) : (
                          <View style={[StyleSheet.absoluteFill, styles.noThumb]} />
                        )}
                        <LinearGradient
                          colors={["transparent", "rgba(10,10,12,0.7)"]}
                          style={StyleSheet.absoluteFill}
                          pointerEvents="none"
                        />
                      </View>

                      {/* Info */}
                      <View style={styles.suggestionInfo}>
                        <View style={styles.suggestionInfoTop}>
                          <Text style={styles.suggestionTitle} numberOfLines={2}>{item.Name}</Text>
                          <View style={styles.suggestionMeta}>
                            {item.ProductionYear && (
                              <Text style={styles.metaText}>{item.ProductionYear}</Text>
                            )}
                            {item.RunTimeTicks && (
                              <Text style={styles.metaText}>{formatRuntime(item.RunTimeTicks)}</Text>
                            )}
                            {item.CommunityRating && (
                              <Text style={styles.metaText}>★ {item.CommunityRating.toFixed(1)}</Text>
                            )}
                          </View>
                          {item.Overview && (
                            <Text style={styles.overview} numberOfLines={isSelected ? 6 : 2}>
                              {item.Overview}
                            </Text>
                          )}
                        </View>

                        {/* Play button — visible when selected or always */}
                        <TouchableOpacity
                          style={[styles.playBtn, { backgroundColor: mode.colors.accent }]}
                          onPress={() => handlePlay(item.Id)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.playBtnText}>▶  Play</Text>
                        </TouchableOpacity>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Library shortcut */}
          <TouchableOpacity
            style={styles.libraryLink}
            onPress={() => router.push("/(app)/library")}
          >
            <Text style={[styles.libraryLinkText, { color: mode.colors.textAccent }]}>
              Browse full library →
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  safe: { flex: 1 },

  back: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  backText: {
    fontFamily: Typography.sansMedium,
    fontSize: 14,
    color: Colors.textSecondary,
  },

  content: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
  },

  identity: { alignItems: "center", gap: Spacing.sm, paddingTop: Spacing.md },
  modeIcon: { fontSize: 40 },
  modeLabel: {
    fontFamily: Typography.display,
    fontSize: 40,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  modeTagline: {
    fontFamily: Typography.displayItalic,
    fontSize: 18,
  },
  modeDescription: {
    fontFamily: Typography.sans,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },

  suggestionsSection: { gap: Spacing.md },
  sectionLabel: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  suggestionsList: { gap: Spacing.md },

  suggestion: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radii.lg,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: Colors.surfaceBorder,
  },

  thumb: {
    width: "100%",
    height: 160,
    backgroundColor: Colors.surface,
  },
  noThumb: { backgroundColor: Colors.surfaceRaised },

  suggestionInfo: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  suggestionInfoTop: { gap: Spacing.xs },
  suggestionTitle: {
    fontFamily: Typography.display,
    fontSize: 20,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  suggestionMeta: { flexDirection: "row", gap: Spacing.md },
  metaText: {
    fontFamily: Typography.sans,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  overview: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginTop: 2,
  },

  playBtn: {
    borderRadius: Radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  playBtnText: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 15,
    color: Colors.bg,
  },

  empty: {
    fontFamily: Typography.sans,
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: Spacing.md,
  },

  libraryLink: { alignItems: "center", paddingVertical: Spacing.sm },
  libraryLinkText: {
    fontFamily: Typography.sansMedium,
    fontSize: 14,
  },
});
