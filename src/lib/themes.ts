/**
 * @file themes.ts
 * @description Theme presets and CSS variable helpers for Construction PM.
 *
 * Themes are applied by injecting CSS custom properties (--color-primary, etc.)
 * onto the root element. The active theme ID is stored in the user's settings
 * and retrieved via `getThemeCSS()` on the server to avoid flash-of-wrong-theme.
 *
 * To add a new theme: append an entry to THEME_PRESETS. The settings page
 * renders them automatically from this array.
 */

/** A single color theme definition. */
export interface ThemePreset {
  /** Unique identifier stored in user settings (e.g. "blue", "orange"). */
  id: string;
  /** Human-readable name shown in the settings UI. */
  name: string;
  /** Short descriptor shown beneath the name. */
  description: string;
  colors: {
    /** Primary brand color — used for buttons, links, active states. */
    primary: string;
    /** Darker shade — used for hover states and borders. */
    primaryDark: string;
    /** Lighter shade — used for focus rings and accents. */
    primaryLight: string;
    /** Very light background tint — used for highlighted sections. */
    primaryBg: string;
  };
}

/** All available theme presets, in display order. First entry is the default. */
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "blue",
    name: "Professional Blue",
    description: "Traditional, formal",
    colors: {
      primary: "#2563eb",
      primaryDark: "#1e40af",
      primaryLight: "#3b82f6",
      primaryBg: "#eff6ff",
    },
  },
  {
    id: "orange",
    name: "Construction Orange",
    description: "Warm, construction-focused",
    colors: {
      primary: "#ea580c",
      primaryDark: "#c2410c",
      primaryLight: "#f97316",
      primaryBg: "#fff7ed",
    },
  },
  {
    id: "teal",
    name: "Deep Teal",
    description: "Modern, calm",
    colors: {
      primary: "#0d9488",
      primaryDark: "#115e59",
      primaryLight: "#14b8a6",
      primaryBg: "#f0fdfa",
    },
  },
  {
    id: "slate",
    name: "Slate Charcoal",
    description: "Sophisticated, minimal",
    colors: {
      primary: "#475569",
      primaryDark: "#334155",
      primaryLight: "#64748b",
      primaryBg: "#f8fafc",
    },
  },
  {
    id: "green",
    name: "Forest Green",
    description: "Growth, sustainable",
    colors: {
      primary: "#16a34a",
      primaryDark: "#15803d",
      primaryLight: "#22c55e",
      primaryBg: "#f0fdf4",
    },
  },
];

/**
 * Look up a theme preset by ID. Falls back to the first preset (blue) for
 * unknown IDs, so the app never breaks on a stale stored theme ID.
 */
export function getThemeById(id: string): ThemePreset {
  return THEME_PRESETS.find((t) => t.id === id) || THEME_PRESETS[0];
}

/**
 * Generate a CSS custom property map for the given theme ID.
 * Intended for use in a `style` prop on the root layout element.
 *
 * @example
 *   <html style={getThemeCSS(user.themeId)}>
 *
 * @returns A record of CSS variable names → hex color values
 */
export function getThemeCSS(themeId: string): Record<string, string> {
  const theme = getThemeById(themeId);
  return {
    "--color-primary": theme.colors.primary,
    "--color-primary-dark": theme.colors.primaryDark,
    "--color-primary-light": theme.colors.primaryLight,
    "--color-primary-bg": theme.colors.primaryBg,
  };
}
