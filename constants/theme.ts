// Pomflix Design System
// Apple-influenced · Pomegranate-rooted · Nature Zen

export const Colors = {
  // ── Backgrounds ────────────────────────────────────
  bg: "#0A0A0C",
  surface: "#141416",
  surfaceRaised: "#1C1C1F",
  surfaceBorder: "rgba(255,255,255,0.07)",

  // ── Brand — Pomegranate ─────────────────────────────
  brand: "#8B1A2E",
  brandLight: "#B8243E",
  brandGlow: "rgba(139, 26, 46, 0.45)",

  // ── Text ───────────────────────────────────────────
  textPrimary: "#F2EDE8",
  textSecondary: "#8A8780",
  textMuted: "#46443F",

  // ── Modes ──────────────────────────────────────────
  modes: {
    focus: {
      base: "#1B3A5C",
      accent: "#4A90C4",
      textAccent: "#7BB8E8",
      glow: "rgba(27, 58, 92, 0.5)",
    },
    windDown: {
      base: "#3D2B5E",
      accent: "#9B7FD4",
      textAccent: "#C4ADEE",
      glow: "rgba(61, 43, 94, 0.5)",
    },
    energy: {
      base: "#6B2A0E",
      accent: "#E8703A",
      textAccent: "#F5A07A",
      glow: "rgba(196, 81, 26, 0.5)",
    },
    escape: {
      base: "#5E2240",
      accent: "#D47FAB",
      textAccent: "#EAA8C8",
      glow: "rgba(160, 68, 110, 0.5)",
    },
  },
} as const;

export const Typography = {
  display: "PlayfairDisplay_600SemiBold",
  displayBold: "PlayfairDisplay_700Bold",
  displayItalic: "PlayfairDisplay_600SemiBold_Italic",
  sans: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
  sansSemiBold: "Inter_600SemiBold",
  sansBold: "Inter_700Bold",
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  screen: 20,
} as const;

export const Radii = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
} as const;
