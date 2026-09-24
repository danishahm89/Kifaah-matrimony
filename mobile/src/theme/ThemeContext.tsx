import React, { createContext, useContext, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  toggle: () => void;
  colors: typeof lightColors;
}

const lightColors = {
  bg:       '#f5f0e8',
  bgCard:   '#ffffff',
  bgGrad1:  '#f5f0e8',
  bgGrad2:  '#e8ddd0',
  bgGrad3:  '#d4c9b8',
  primary:  '#2d5a27',
  primaryDk:'#1a3a16',
  accent:   '#c49a2a',
  surface:  '#ffffff',
  ink:      '#1a1a1a',
  muted:    '#666666',
  subtle:   '#999999',
  border:   'rgba(45,90,39,0.15)',
  borderStrong: 'rgba(45,90,39,0.30)',
  borderHairline: 'rgba(45,90,39,0.10)',
  red:      '#cc2200',
  redDark:  '#991a00',
  greenBg:  '#eaf5ea',
  greenText:'#1f6b30',
  inputBg:  '#ffffffee',
  shadow:   'rgba(45,90,39,0.12)',
  shimmer1: '#c49a2a',
  shimmer2: '#e8c85a',
};

const darkColors: typeof lightColors = {
  bg:       '#0f1a0e',
  bgCard:   '#1a2e18',
  bgGrad1:  '#0f1a0e',
  bgGrad2:  '#152414',
  bgGrad3:  '#1c3019',
  primary:  '#4a9e42',
  primaryDk:'#6ac060',
  accent:   '#e8c85a',
  surface:  '#1e3320',
  ink:      '#f0ece4',
  muted:    '#c0d4bc',
  subtle:   '#90b08a',
  border:   'rgba(74,158,66,0.20)',
  borderStrong: 'rgba(74,158,66,0.40)',
  borderHairline: 'rgba(74,158,66,0.12)',
  red:      '#ff6b4a',
  redDark:  '#ff8866',
  greenBg:  '#0f2410',
  greenText:'#6ac060',
  inputBg:  '#1c3018',
  shadow:   'rgba(0,0,0,0.3)',
  shimmer1: '#e8c85a',
  shimmer2: '#fde68a',
};

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  toggle: () => {},
  colors: lightColors,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');
  const toggle = () => setMode(m => m === 'light' ? 'dark' : 'light');
  const colors = mode === 'light' ? lightColors : darkColors;
  return (
    <ThemeContext.Provider value={{ mode, toggle, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { lightColors, darkColors };
