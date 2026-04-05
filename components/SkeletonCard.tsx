import { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Radii, Spacing } from "@/constants/theme";

interface SkeletonCardProps {
  width: number;
  height: number;
  borderRadius?: number;
}

function SkeletonBox({ width, height, borderRadius = Radii.md }: SkeletonCardProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1100,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  return (
    <View style={[styles.bone, { width, height, borderRadius }]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX }] },
        ]}
      >
        <LinearGradient
          colors={[
            "transparent",
            "rgba(255,255,255,0.07)",
            "rgba(255,255,255,0.13)",
            "rgba(255,255,255,0.07)",
            "transparent",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

interface SkeletonCardFullProps {
  size?: "small" | "medium" | "large";
  width?: number;
}

const SIZES = {
  small: { width: 120, height: 180 },
  medium: { width: 160, height: 240 },
  large: { width: 300, height: 180 },
};

export default function SkeletonCard({ size = "medium", width }: SkeletonCardFullProps) {
  const dims = SIZES[size];
  const w = width ?? dims.width;

  return (
    <View style={[styles.wrapper, { width: w }]}>
      <SkeletonBox width={w} height={dims.height} />
      <SkeletonBox width={w * 0.75} height={10} borderRadius={4} />
      <SkeletonBox width={w * 0.5} height={9} borderRadius={4} />
    </View>
  );
}

export function SkeletonRow({ count = 4, size = "medium" }: { count?: number; size?: "small" | "medium" | "large" }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} size={size} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bone: {
    backgroundColor: Colors.surfaceRaised,
    overflow: "hidden",
  },
  wrapper: {
    gap: Spacing.xs,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.screen,
  },
});
