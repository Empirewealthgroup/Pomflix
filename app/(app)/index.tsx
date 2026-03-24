import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { useEffect, useState } from "react";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "@/lib/store/authStore";
import { getContinueWatching } from "@/lib/jellyfin/media";
import { MODES } from "@/constants/modes";
import { Colors, Typography, Spacing } from "@/constants/theme";
import ModeCard from "@/components/ModeCard";
import MediaCard from "@/components/MediaCard";
import { SkeletonRow } from "@/components/SkeletonCard";
import type { JellyfinItem } from "@/lib/jellyfin/types";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Still up?";
  if (h < 12) return "Good morning.";
  if (h < 17) return "Good afternoon.";
  if (h < 21) return "Good evening.";
  return "Winding down?";
}

export default function HomeScreen() {
  const { serverUrl, token, userId, userName, logout } = useAuthStore();
  const [continueItems, setContinueItems] = useState<JellyfinItem[]>([]);
  const [loadingContinue, setLoadingContinue] = useState(true);

  useEffect(() => {
    if (!serverUrl || !token || !userId) return;
    setLoadingContinue(true);
    getContinueWatching(serverUrl, token, userId, 8)
      .then(setContinueItems)
      .catch(() => {})
      .finally(() => setLoadingContinue(false));
  }, [serverUrl, token, userId]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            {userName && (
              <Text style={styles.userName}>{userName}</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            logout();
          }} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Section: Choose your state */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How do you want to feel?</Text>
          <View style={styles.modeGrid}>
            {MODES.map((mode) => (
              <ModeCard key={mode.id} mode={mode} />
            ))}
          </View>
        </View>

        {/* Section: Continue Watching */}
        {(loadingContinue || continueItems.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Continue Watching</Text>
            {loadingContinue ? (
              <SkeletonRow count={3} size="medium" />
            ) : (
              <FlatList
                data={continueItems}
                keyExtractor={(item) => item.Id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rowContent}
                ItemSeparatorComponent={() => <View style={{ width: Spacing.sm }} />}
                renderItem={({ item }) => (
                  <MediaCard item={item} size="medium" navigateTo="item" />
                )}
              />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: Spacing.lg,
  },
  greeting: {
    fontFamily: Typography.display,
    fontSize: 28,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  userName: {
    fontFamily: Typography.sans,
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  logoutBtn: { paddingBottom: 4 },
  logoutText: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: Colors.textMuted,
  },

  section: { gap: Spacing.md },
  sectionTitle: {
    fontFamily: Typography.sansSemiBold,
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  modeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },

  rowContent: { paddingBottom: 4 },
});
