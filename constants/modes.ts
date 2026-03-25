// ─── Mood types ──────────────────────────────────────────────────────────────

export type ModeId =
  | "wind_down" | "calm" | "drift"          // Calm
  | "focus" | "deep_work" | "locked_in"     // Focus
  | "escape" | "laugh" | "reflect" | "explore" | "intimate"; // Emotional

export type MoodCategory = "calm" | "focus" | "emotional";

export type ModeColors = {
  base: string;
  accent: string;
  textAccent: string;
  glow: string;
};

export type Mode = {
  id: ModeId;
  label: string;
  tagline: string;
  description: string;
  icon: string;
  category: MoodCategory;
  colors: ModeColors;
  jellyfinGenres: string[];
  jellyfinGenresFallback: string[];
  jellyfinTags: string[];
  maxRuntimeMinutes?: number;
};

// ─── Mood definitions ─────────────────────────────────────────────────────────

export const MODES: Mode[] = [
  // ── Calm ──────────────────────────────────────────────────────────────────
  {
    id: "wind_down",
    label: "Wind Down",
    tagline: "Let the day dissolve.",
    description: "Gentle, unhurried stories to ease you toward rest.",
    icon: "◐",
    category: "calm",
    colors: { base: "#3D2B5E", accent: "#9B7FD4", textAccent: "#C4ADEE", glow: "rgba(61,43,94,0.5)" },
    jellyfinGenres: ["Drama", "Romance", "Animation", "Fantasy"],
    jellyfinGenresFallback: ["Drama", "Animation"],
    jellyfinTags: ["winddown", "calm", "cozy", "gentle"],
    maxRuntimeMinutes: 120,
  },
  {
    id: "calm",
    label: "Calm",
    tagline: "Quiet and still.",
    description: "Peaceful content that asks nothing of you.",
    icon: "○",
    category: "calm",
    colors: { base: "#1E3A5F", accent: "#4A8FBF", textAccent: "#7CB8E0", glow: "rgba(30,58,95,0.5)" },
    jellyfinGenres: ["Documentary", "Nature", "Biography"],
    jellyfinGenresFallback: ["Documentary"],
    jellyfinTags: ["calm", "peaceful", "nature", "quiet"],
    maxRuntimeMinutes: 90,
  },
  {
    id: "drift",
    label: "Drift",
    tagline: "Between wake and sleep.",
    description: "Ambient, gentle content for the edge of consciousness.",
    icon: "◌",
    category: "calm",
    colors: { base: "#1C2940", accent: "#4A6FA0", textAccent: "#7B9FC8", glow: "rgba(28,41,64,0.5)" },
    jellyfinGenres: ["Animation", "Nature", "Family"],
    jellyfinGenresFallback: ["Animation", "Family"],
    jellyfinTags: ["ambient", "soft", "nature"],
    maxRuntimeMinutes: 45,
  },
  // ── Focus ─────────────────────────────────────────────────────────────────
  {
    id: "focus",
    label: "Focus",
    tagline: "Still water. Clear mind.",
    description: "Documentaries and considered stories that sharpen without distraction.",
    icon: "◈",
    category: "focus",
    colors: { base: "#1B3A5C", accent: "#4A90C4", textAccent: "#7BB8E8", glow: "rgba(27,58,92,0.5)" },
    jellyfinGenres: ["Documentary", "Biography", "History", "Nature"],
    jellyfinGenresFallback: ["Documentary", "Biography"],
    jellyfinTags: ["focus", "calm", "documentary", "nature"],
    maxRuntimeMinutes: 90,
  },
  {
    id: "deep_work",
    label: "Deep Work",
    tagline: "No distractions. No compromise.",
    description: "High-quality, absorbing content that keeps you in the zone.",
    icon: "◧",
    category: "focus",
    colors: { base: "#1E3D3F", accent: "#3A9DA8", textAccent: "#6FCBD4", glow: "rgba(30,61,63,0.5)" },
    jellyfinGenres: ["Documentary", "Biography", "History"],
    jellyfinGenresFallback: ["Documentary"],
    jellyfinTags: ["focus", "deep", "documentary"],
    maxRuntimeMinutes: 120,
  },
  {
    id: "locked_in",
    label: "Locked In",
    tagline: "High energy. Full send.",
    description: "Fast-paced, intense content that matches your peak state.",
    icon: "◉",
    category: "focus",
    colors: { base: "#5C2E00", accent: "#E07030", textAccent: "#F5A070", glow: "rgba(92,46,0,0.5)" },
    jellyfinGenres: ["Action", "Thriller", "Sport", "Adventure"],
    jellyfinGenresFallback: ["Action", "Thriller"],
    jellyfinTags: ["energy", "action", "fast", "intense"],
  },
  // ── Emotional ─────────────────────────────────────────────────────────────
  {
    id: "escape",
    label: "Escape",
    tagline: "Somewhere else entirely.",
    description: "Worlds far enough from yours to disappear into.",
    icon: "◎",
    category: "emotional",
    colors: { base: "#5E2240", accent: "#D47FAB", textAccent: "#EAA8C8", glow: "rgba(160,68,110,0.5)" },
    jellyfinGenres: ["Science Fiction", "Fantasy", "Mystery", "Adventure"],
    jellyfinGenresFallback: ["Science Fiction", "Fantasy"],
    jellyfinTags: ["escape", "adventure", "fantasy", "travel"],
  },
  {
    id: "laugh",
    label: "Laugh",
    tagline: "Light, easy, joyful.",
    description: "Content that doesn't demand anything except your smile.",
    icon: "◑",
    category: "emotional",
    colors: { base: "#5C3200", accent: "#E8903A", textAccent: "#F5B47A", glow: "rgba(92,50,0,0.5)" },
    jellyfinGenres: ["Comedy", "Animation", "Family"],
    jellyfinGenresFallback: ["Comedy", "Animation"],
    jellyfinTags: ["comedy", "funny", "light", "fun"],
    maxRuntimeMinutes: 100,
  },
  {
    id: "reflect",
    label: "Reflect",
    tagline: "Sit with something real.",
    description: "Thoughtful, introspective stories that stay with you.",
    icon: "◗",
    category: "emotional",
    colors: { base: "#2A2E3D", accent: "#7B8CB0", textAccent: "#A8B5CC", glow: "rgba(42,46,61,0.5)" },
    jellyfinGenres: ["Drama", "Biography", "History"],
    jellyfinGenresFallback: ["Drama"],
    jellyfinTags: ["drama", "thoughtful", "introspective"],
    maxRuntimeMinutes: 150,
  },
  {
    id: "explore",
    label: "Explore",
    tagline: "Follow your curiosity.",
    description: "Discovery, knowledge, and wonder about the world.",
    icon: "⊕",
    category: "emotional",
    colors: { base: "#0F3835", accent: "#2AB09A", textAccent: "#6AD4C0", glow: "rgba(15,56,53,0.5)" },
    jellyfinGenres: ["Documentary", "Travel", "Adventure", "Nature"],
    jellyfinGenresFallback: ["Documentary", "Adventure"],
    jellyfinTags: ["exploration", "discovery", "travel", "nature"],
  },
  {
    id: "intimate",
    label: "Intimate",
    tagline: "Close. Quiet. Connected.",
    description: "Romantic and emotionally resonant stories.",
    icon: "◆",
    category: "emotional",
    colors: { base: "#3D1028", accent: "#C05080", textAccent: "#E08AAA", glow: "rgba(61,16,40,0.5)" },
    jellyfinGenres: ["Romance", "Drama"],
    jellyfinGenresFallback: ["Drama"],
    jellyfinTags: ["romance", "relationship", "emotional"],
    maxRuntimeMinutes: 130,
  },
];

// ─── Grouped by category (for View All screen) ───────────────────────────────

export const MOOD_CATEGORIES: { id: MoodCategory; label: string; moods: Mode[] }[] = [
  { id: "calm",      label: "Calm States",      moods: MODES.filter((m) => m.category === "calm") },
  { id: "focus",     label: "Focus States",     moods: MODES.filter((m) => m.category === "focus") },
  { id: "emotional", label: "Emotional States", moods: MODES.filter((m) => m.category === "emotional") },
];

// ─── Lookup with backward-compat shim ────────────────────────────────────────

export const getModeById = (id: string): Mode | undefined => {
  // Remap persisted old IDs from before the mood system rewrite
  if (id === "energy")    return MODES.find((m) => m.id === "locked_in");
  if (id === "wind-down") return MODES.find((m) => m.id === "wind_down");
  return MODES.find((m) => m.id === id);
};
