import { Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { UR } from './ur';

// Translation helper. English text is the key; Urdu comes from ./ur.ts and falls back to English
// when a line isn't translated yet. `{name}` placeholders are filled from `vars`.
// Switching language remounts the screens (see App.tsx), so reading the language at render time
// is enough — no hook needed, which lets small helper components use it too.
export function currentLang(): 'en' | 'ur' {
  return useAuthStore.getState().user?.language === 'ur' ? 'ur' : 'en';
}

export function tr(text: string, vars?: Record<string, string | number | null | undefined>): string {
  if (typeof text !== 'string') return text as any;
  let out = currentLang() === 'ur' ? UR[text] ?? text : text;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v == null ? '' : String(v));
  }
  return out;
}

export function isRTL() {
  return currentLang() === 'ur';
}

// Flip the whole page right-to-left for Urdu on web.
export function applyDocumentDirection(lang: 'en' | 'ur') {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
}
