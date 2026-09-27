// Design tokens — must match CONTRACT.md §1 exactly. Single source of truth for the app.

const lightTokenColors = {
  ink: '#1a1a2e',
  muted: '#6b6570',
  mutedLight: '#8a7d8a',
  bg: '#f5f0e8',
  surface: '#faf6f0',
  card: '#ffffff',
  red: '#ec3013',
  redDark: '#ae1800',
  primary: '#2d5a27',
  accent: '#c49a2a',
  border: 'rgba(45,90,39,0.15)',
  borderStrong: 'rgba(45,90,39,0.30)',
  borderSoft: 'rgba(45,90,39,0.10)',
  borderHairline: 'rgba(45,90,39,0.12)',
  greenBg: '#e8f4e4',
  greenText: '#2d5a27',
  lowBg: '#fef4d4',
  lowText: '#8b6914',
  bubbleThem: '#e8f4e4',
  toastBg: '#201e1d',
  toastText: '#f3f2f2',
  white: '#ffffff',
  placeholderStripeA: '#e8e0d0',
  placeholderStripeB: '#f5f0e8',
};

export type TokenColors = { [K in keyof typeof lightTokenColors]: string };

const darkTokenColors: TokenColors = {
  ink: '#f0ece4',
  muted: '#b9c6b4',
  mutedLight: '#98a892',
  bg: '#0f1a0e',
  surface: '#172616',
  card: '#1a2e18',
  red: '#ff6b4a',
  redDark: '#ff8866',
  primary: '#6ac060',
  accent: '#e8c85a',
  border: 'rgba(120,190,110,0.22)',
  borderStrong: 'rgba(120,190,110,0.40)',
  borderSoft: 'rgba(120,190,110,0.14)',
  borderHairline: 'rgba(120,190,110,0.14)',
  greenBg: '#1d3a1b',
  greenText: '#8fd486',
  lowBg: '#3a3014',
  lowText: '#f0d27a',
  bubbleThem: '#1f3a1d',
  toastBg: '#f0ece4',
  toastText: '#1a1a1a',
  white: '#ffffff',
  placeholderStripeA: '#1f2e1c',
  placeholderStripeB: '#15221a',
};

// `colors` is a live object: switching theme copies the chosen palette into it, and every
// `themedStyles` sheet rebuilds on next access. Anything reading `colors.x` at render time
// therefore follows the theme — which is what fixes dark text on the dark background.
export const colors: TokenColors = { ...lightTokenColors };

let themeVersion = 0;
export type TokenMode = 'light' | 'dark';

export function applyTokenTheme(mode: TokenMode) {
  Object.assign(colors, mode === 'dark' ? darkTokenColors : lightTokenColors);
  themeVersion += 1;
}

export function getThemeVersion() {
  return themeVersion;
}

// Wrap a StyleSheet so it is rebuilt with the current palette after a theme switch.
export function themedStyles<T extends object>(factory: () => T): T {
  let builtFor = -1;
  let cache: T;
  return new Proxy({} as T, {
    get(_target, key) {
      if (builtFor !== themeVersion) {
        cache = factory();
        builtFor = themeVersion;
      }
      return (cache as any)[key];
    },
  });
}

export const fonts = {
  regular: 'Archivo_400Regular',
  semiBold: 'Archivo_600SemiBold',
  extraBold: 'Archivo_800ExtraBold',
} as const;

export const fontSizes = {
  brand: 32,
  tabHeader: 22,
  xl: 20,
  lg: 16,
  bodyStrong: 15,
  body: 14,
  small: 13,
  label: 12,
  eyebrow: 11,
  chip: 10,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// Flat design system — zero border radius everywhere except the unread dot.
export const radius = {
  none: 0,
  dot: 50,
} as const;

export const borderWidth = {
  hairline: 1,
  rule: 2,
} as const;
