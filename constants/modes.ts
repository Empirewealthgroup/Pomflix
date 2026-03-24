import { Colors } from "./theme";

export type ModeId = "focus" | "wind-down" | "energy" | "escape";

export type Mode = {
  id: ModeId;
  label: string;
  tagline: string;
  description: string;
  icon: string;
  colors: (typeof Colors.modes)[keyof typeof Colors.modes];
  // Tags used to filter Jellyfin content
  jellyfinGenres: string[];
  jellyfinTags: string[];
  maxRuntimeMinutes?: number;
};

export const MODES: Mode[] = [
  {
    id: "focus",
    label: "Focus",
    tagline: "Still water. Clear mind.",
    description: "Documentaries and slow-paced films that sharpen without distraction.",
    icon: "◈",
    colors: Colors.modes.focus,
    jellyfinGenres: ["Documentary", "Biography", "History", "Nature"],
    jellyfinTags: ["focus", "calm", "documentary", "nature"],
    maxRuntimeMinutes: 90,
  },
  {
    id: "wind-down",
    label: "Wind Down",
    tagline: "Let the day dissolve.",
    description: "Gentle, unhurried stories to ease you toward rest.",
    icon: "◐",
    colors: Colors.modes.windDown,
    jellyfinGenres: ["Drama", "Romance", "Animation", "Fantasy"],
    jellyfinTags: ["winddown", "calm", "cozy", "gentle"],
    maxRuntimeMinutes: 120,
  },
  {
    id: "energy",
    label: "Energy",
    tagline: "Ignite. Move. Burn.",
    description: "High-octane films that move fast and hit harder.",
    icon: "◉",
    colors: Colors.modes.energy,
    jellyfinGenres: ["Action", "Sport", "Thriller", "Adventure"],
    jellyfinTags: ["energy", "action", "fast", "intense"],
  },
  {
    id: "escape",
    label: "Escape",
    tagline: "Somewhere else entirely.",
    description: "Worlds far enough from yours to disappear into.",
    icon: "◌",
    colors: Colors.modes.escape,
    jellyfinGenres: ["Science Fiction", "Fantasy", "Mystery", "Travel"],
    jellyfinTags: ["escape", "adventure", "fantasy", "travel"],
  },
];

export const getModeById = (id: string): Mode | undefined =>
  MODES.find((m) => m.id === id);
