import { create } from 'zustand';
import { Platform } from 'react-native';
import type { Profile } from '../types';

// Local draft of the profile fields collected across ShariahQA + ProfileSetup, mirroring the
// prototype's single `state.my` object. Submitted as one PUT /api/profile/me on "Enter Kifaah".
export type ProfileDraft = Omit<Profile, 'userId' | 'photoUrl' | 'phone' | 'contactEmail'>;

const emptyDraft: ProfileDraft = {
  name: '',
  age: undefined,
  sect: '',
  prayer: '',
  modesty: '',
  wali: '',
  eduProf: '',
  profField: '',
  family: '',
  height: '',
  city: '',
  marital: '',
  about: '',
  fasting: '',
  quran: '',
  hajj: '',
  polygamy: '',
  diet: '',
  dietCustom: '',
  smoking: '',
  habits: '',
  habitsCustom: '',
  likes: '',
  likesCustom: '',
  dislikes: '',
  dislikesCustom: '',
  state: '',
  motherTongue: '',
  education: '',
  profession: '',
  prefMinAge: null,
  prefMaxAge: null,
  prefState: '',
  prefSect: '',
  prefMarital: '',
};

interface OnboardingState {
  draft: ProfileDraft;
  customCityMode: boolean;
  setField: <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => void;
  setCustomCityMode: (v: boolean) => void;
  reset: () => void;
  // Fill the draft from a saved profile, for the Edit profile flow.
  loadFrom: (profile: Partial<Profile> | null | undefined) => void;
}

// On web the sign-up form is kept in localStorage while it is being filled, so a
// page refresh, a re-login or a screen remount never wipes what was typed.
const DRAFT_KEY = 'kifaah.onboardingDraft';
function loadSaved(): ProfileDraft {
  if (Platform.OS !== 'web') return { ...emptyDraft };
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? { ...emptyDraft, ...JSON.parse(raw) } : { ...emptyDraft };
  } catch {
    return { ...emptyDraft };
  }
}
function save(draft: ProfileDraft | null) {
  if (Platform.OS !== 'web') return;
  try {
    if (draft) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage blocked — keep working in memory */
  }
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  draft: loadSaved(),
  customCityMode: false,
  setField: (key, value) => {
    set((s) => ({ draft: { ...s.draft, [key]: value } }));
    save(get().draft);
  },
  setCustomCityMode: (v) => set({ customCityMode: v }),
  reset: () => {
    save(null);
    set({ draft: { ...emptyDraft }, customCityMode: false });
  },
  loadFrom: (profile) => {
    const draft = { ...emptyDraft };
    if (profile) {
      for (const key of Object.keys(emptyDraft) as (keyof ProfileDraft)[]) {
        const v = (profile as any)[key];
        if (v !== null && v !== undefined) (draft as any)[key] = v;
      }
    }
    set({ draft, customCityMode: false });
  },
}));
