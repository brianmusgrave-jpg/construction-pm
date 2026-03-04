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
  /**
   * Optional chrome overrides — if provided, these replace the default
   * sidebar/nav background, foreground, and accent colors. Used for
   * brand skin themes like AccuDone.
   */
  chrome?: {
    /** Sidebar/nav background color. */
    navBg: string;
    /** Sidebar/nav text color. */
    navFg: string;
    /** Sidebar/nav hover/active highlight color. */
    navAccent: string;
    /** Sidebar/nav active text color. */
    navAccentFg: string;
    /** Sidebar/nav border color. */
    navBorder: string;
  };
  /**
   * Optional app-level background override. Used for demo/recording skins
   * to apply a dark full-canvas look (e.g. AccuDone dark demo skin).
   */
  appBg?: string;
  /** If true, hides this theme from the standard settings picker (e.g. demo skins). */
  hidden?: boolean;
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
  // ── AccuDone brand themes ──
  {
    id: "accudone",
    name: "AccuDone",
    description: "Industrial, high-contrast",
    colors: {
      // Dark charcoal as primary: WCAG AA on white (16.1:1)
      primary: "#111010",
      primaryDark: "#000000",
      primaryLight: "#333333",
      primaryBg: "#f5f0e8",
    },
    chrome: {
      navBg: "#111010",
      navFg: "#f5f0e8",
      navAccent: "#F5C800",
      navAccentFg: "#111010",
      navBorder: "#2a2a2a",
    },
  },
  {
    id: "accudone-demo",
    name: "AccuDone Demo",
    description: "Full dark skin for demo recordings",
    hidden: true,
    colors: {
      primary: "#F5C800",
      primaryDark: "#D4AD00",
      primaryLight: "#FFF0A0",
      primaryBg: "#1a1a1a",
    },
    chrome: {
      navBg: "#111010",
      navFg: "#f5f0e8",
      navAccent: "#F5C800",
      navAccentFg: "#111010",
      navBorder: "#2a2a2a",
    },
    appBg: "#1C1C1C",
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
  const base: Record<string, string> = {
    "--color-primary": theme.colors.primary,
    "--color-primary-dark": theme.colors.primaryDark,
    "--color-primary-light": theme.colors.primaryLight,
    "--color-primary-bg": theme.colors.primaryBg,
  };
  if (theme.chrome) {
    base["--nav-bg"] = theme.chrome.navBg;
    base["--nav-fg"] = theme.chrome.navFg;
    base["--nav-accent"] = theme.chrome.navAccent;
    base["--nav-accent-fg"] = theme.chrome.navAccentFg;
    base["--nav-border"] = theme.chrome.navBorder;
  }
  if (theme.appBg) {
    base["--background"] = theme.appBg;
    base["--foreground"] = "#f5f0e8";
  }
  return base;
}

// ── Custom Color Utilities (Sprint 19) ──

/**
 * Darken a hex colour by a given percentage (0-100).
 * Used to auto-generate hover/dark states from a user-picked primary colour.
 */
export function darkenHex(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - percent / 100)));
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - percent / 100)));
  const b = Math.max(0, Math.round((num & 0xff) * (1 - percent / 100)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/**
 * Lighten a hex colour by a given percentage (0-100).
 * Used to auto-generate focus rings and accents.
 */
export function lightenHex(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.round(((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * (percent / 100)));
  const g = Math.min(255, Math.round(((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * (percent / 100)));
  const b = Math.min(255, Math.round((num & 0xff) + (255 - (num & 0xff)) * (percent / 100)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/**
 * Generate a full CSS custom property map from 1-3 user-picked hex colours.
 * - primary: provided by user → --color-primary
 * - secondary: optional, else auto-darkened → --color-primary-dark
 * - tertiary: optional, else auto-lightened bg → --color-primary-bg
 * - --color-primary-light is always auto-generated from primary
 */
export function getCustomColorCSS(
  primary: string,
  secondary?: string | null,
  tertiary?: string | null
): Record<string, string> {
  return {
    "--color-primary": primary,
    "--color-primary-dark": secondary || darkenHex(primary, 25),
    "--color-primary-light": lightenHex(primary, 15),
    "--color-primary-bg": tertiary || lightenHex(primary, 90),
  };
}

/**
 * Calculate relative luminance for WCAG contrast ratio checking.
 * @see https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
export function relativeLuminance(hex: string): number {
  const num = parseInt(hex.replace("#", ""), 16);
  const srgb = [((num >> 16) & 0xff) / 255, ((num >> 8) & 0xff) / 255, (num & 0xff) / 255];
  const linear = srgb.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/**
 * WCAG AA contrast ratio between two hex colours.
 * Returns a number ≥ 1. A ratio ≥ 4.5 passes for normal text.
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a colour passes WCAG AA against white (#ffffff).
 * 4.5:1 ratio required for normal text; 3:1 for large text.
 */
export function passesWCAG(hex: string, level: "AA" | "AALarge" = "AA"): boolean {
  const ratio = contrastRatio(hex, "#ffffff");
  return level === "AALarge" ? ratio >= 3 : ratio >= 4.5;
}
