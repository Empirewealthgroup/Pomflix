import { Tabs } from "expo-router";
import { View, StyleSheet } from "react-native";
import { Colors, Typography } from "@/constants/theme";

function HomeIcon({ focused }: { focused: boolean }) {
  return (
    <View style={[styles.icon, focused && { opacity: 1 }]}>
      <View style={[styles.iconInner, focused && { backgroundColor: Colors.textPrimary }]} />
    </View>
  );
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.surfaceBorder,
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
            <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
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
          title: "Library",
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabIcon}>
              <View style={[styles.shelf, focused && styles.shelfActive]} />
              <View style={[styles.shelf, styles.shelfThin, focused && styles.shelfActive]} />
              <View style={[styles.shelf, focused && styles.shelfActive]} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

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
