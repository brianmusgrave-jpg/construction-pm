export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: string;
    primaryDark: string;
    primaryLight: string;
    primaryBg: string;
  };
}

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

export function getThemeById(id: string): ThemePreset {
  return THEME_PRESETS.find((t) => t.id === id) || THEME_PRESETS[0];
}

export function getThemeCSS(themeId: string): Record<string, string> {
  const theme = getThemeById(themeId);
  return {
    "--color-primary": theme.colors.primary,
    "--color-primary-dark": theme.colors.primaryDark,
    "--color-primary-light": theme.colors.primaryLight,
    "--color-primary-bg": theme.colors.primaryBg,
  };
}
