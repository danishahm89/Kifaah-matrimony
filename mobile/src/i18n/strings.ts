// Minimal local string table — only the tab labels + language-toggle button text switch
// between English and Urdu, matching the prototype's scope (Kifaah.dc.html renderVals()).
import type { Language } from '../types';

export interface TabStrings {
  discover: string;
  matches: string;
  chat: string;
  account: string;
}

const EN: TabStrings = { discover: 'Discover', matches: 'Requests', chat: 'Messages', account: 'Profile' };
const UR: TabStrings = { discover: 'دریافت', matches: 'درخواستیں', chat: 'پیغامات', account: 'پروفائل' };

export function tabStrings(lang: Language): TabStrings {
  return lang === 'ur' ? UR : EN;
}

// Toggle button labels the language you'd switch TO.
export function langToggleLabel(lang: Language): string {
  return lang === 'ur' ? 'EN' : 'اردو';
}
