// Design tokens — must match CONTRACT.md §1 exactly. Single source of truth for the app.

export const colors = {
  ink: '#201e1d',
  muted: '#605d5d',
  mutedLight: '#7d7979',
  bg: '#f3f2f2',
  surface: '#eae9e9',
  red: '#ec3013',
  redDark: '#ae1800',
  border: 'rgba(32,30,29,0.15)',
  borderStrong: 'rgba(32,30,29,0.30)',
  borderSoft: 'rgba(32,30,29,0.10)',
  borderHairline: 'rgba(32,30,29,0.12)',
  greenBg: '#eaf5ea',
  greenText: '#1f6b30',
  lowBg: '#fff2ef',
  lowText: '#ae1800',
  bubbleThem: '#eae9e9',
  toastBg: '#201e1d',
  toastText: '#f3f2f2',
  white: '#ffffff',
  placeholderStripeA: '#d7d3d3',
  placeholderStripeB: '#eae9e9',
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
