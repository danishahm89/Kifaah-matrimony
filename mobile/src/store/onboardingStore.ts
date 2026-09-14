import { create } from 'zustand';
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
};

interface OnboardingState {
  draft: ProfileDraft;
  customCityMode: boolean;
  setField: <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => void;
  setCustomCityMode: (v: boolean) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  draft: { ...emptyDraft },
  customCityMode: false,
  setField: (key, value) => set((s) => ({ draft: { ...s.draft, [key]: value } })),
  setCustomCityMode: (v) => set({ customCityMode: v }),
  reset: () => set({ draft: { ...emptyDraft }, customCityMode: false }),
}));
