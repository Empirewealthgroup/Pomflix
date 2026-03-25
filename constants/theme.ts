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
    // ── Calm States ──────────────────────────────────
    wind_down: { base: "#3D2B5E", accent: "#9B7FD4", textAccent: "#C4ADEE", glow: "rgba(61,43,94,0.5)" },
    calm:      { base: "#1E3A5F", accent: "#4A8FBF", textAccent: "#7CB8E0", glow: "rgba(30,58,95,0.5)" },
    drift:     { base: "#1C2940", accent: "#4A6FA0", textAccent: "#7B9FC8", glow: "rgba(28,41,64,0.5)" },
    // ── Focus States ─────────────────────────────────
    focus:     { base: "#1B3A5C", accent: "#4A90C4", textAccent: "#7BB8E8", glow: "rgba(27,58,92,0.5)" },
    deep_work: { base: "#1E3D3F", accent: "#3A9DA8", textAccent: "#6FCBD4", glow: "rgba(30,61,63,0.5)" },
    locked_in: { base: "#5C2E00", accent: "#E07030", textAccent: "#F5A070", glow: "rgba(92,46,0,0.5)" },
    // ── Emotional States ─────────────────────────────
    escape:    { base: "#5E2240", accent: "#D47FAB", textAccent: "#EAA8C8", glow: "rgba(160,68,110,0.5)" },
    laugh:     { base: "#5C3200", accent: "#E8903A", textAccent: "#F5B47A", glow: "rgba(92,50,0,0.5)" },
    reflect:   { base: "#2A2E3D", accent: "#7B8CB0", textAccent: "#A8B5CC", glow: "rgba(42,46,61,0.5)" },
    explore:   { base: "#0F3835", accent: "#2AB09A", textAccent: "#6AD4C0", glow: "rgba(15,56,53,0.5)" },
    intimate:  { base: "#3D1028", accent: "#C05080", textAccent: "#E08AAA", glow: "rgba(61,16,40,0.5)" },
    // ── Legacy (kept for backward compat) ────────────
    windDown:  { base: "#3D2B5E", accent: "#9B7FD4", textAccent: "#C4ADEE", glow: "rgba(61,43,94,0.5)" },
    energy:    { base: "#6B2A0E", accent: "#E8703A", textAccent: "#F5A07A", glow: "rgba(196,81,26,0.5)" },
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
