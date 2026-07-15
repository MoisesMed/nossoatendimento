export type TenantTheme = {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  primaryContrast: string;
};

const DEFAULT_THEME: TenantTheme = {
  background: "#ffffff",
  surface: "#ffffff",
  surfaceMuted: "#f8fafc",
  border: "#e5e7eb",
  text: "#111827",
  muted: "#6b7280",
  primary: "#111827",
  primaryContrast: "#ffffff",
};

type PartialTheme = Partial<TenantTheme>;

function isHexColor(value: string) {
  return /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value);
}

export function resolveTenantTheme(input: unknown): TenantTheme {
  if (!input || typeof input !== "object") {
    return DEFAULT_THEME;
  }

  const raw = input as PartialTheme;

  const safe = <K extends keyof TenantTheme>(
    key: K,
    fallback: string,
  ): TenantTheme[K] => {
    const value = raw[key];
    if (typeof value === "string" && isHexColor(value)) {
      return value as TenantTheme[K];
    }
    return fallback as TenantTheme[K];
  };

  return {
    background: safe("background", DEFAULT_THEME.background),
    surface: safe("surface", DEFAULT_THEME.surface),
    surfaceMuted: safe("surfaceMuted", DEFAULT_THEME.surfaceMuted),
    border: safe("border", DEFAULT_THEME.border),
    text: safe("text", DEFAULT_THEME.text),
    muted: safe("muted", DEFAULT_THEME.muted),
    primary: safe("primary", DEFAULT_THEME.primary),
    primaryContrast: safe("primaryContrast", DEFAULT_THEME.primaryContrast),
  };
}

export function themeToCssVars(theme: TenantTheme): Record<string, string> {
  return {
    "--app-bg": "#ffffff",
    "--app-surface": theme.surface,
    "--app-surface-muted": theme.surfaceMuted,
    "--app-border": theme.border,
    "--app-text": theme.text,
    "--app-muted": theme.muted,
    "--app-primary": theme.primary,
    "--app-primary-contrast": theme.primaryContrast,
  };
}
