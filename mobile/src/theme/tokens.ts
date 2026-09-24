// Design tokens — must match CONTRACT.md §1 exactly. Single source of truth for the app.

export const colors = {
  ink: '#1a1a2e',
  muted: '#6b6570',
  mutedLight: '#8a7d8a',
  bg: '#f5f0e8',
  surface: '#faf6f0',
  red: '#ec3013',
  redDark: '#ae1800',
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
} as const;

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
