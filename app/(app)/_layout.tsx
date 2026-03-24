import { Tabs } from "expo-router";
import { View, StyleSheet, Platform } from "react-native";
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
