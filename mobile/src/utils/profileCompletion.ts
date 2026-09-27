import type { Profile } from '../types';

// Which profile items count towards "profile complete", and the friendly
// name shown when one is missing. Order = what we suggest adding first.
const ITEMS: { key: string; label: string; done: (p: Profile) => boolean; brideOnly?: boolean }[] = [
  { key: 'photo', label: 'Profile photo', done: (p) => !!p.photoUrl },
  { key: 'about', label: 'About me (at least 50 letters)', done: (p) => (p.about ?? '').trim().length >= 50 },
  { key: 'wali', label: 'Wali details', done: (p) => !!p.wali?.trim(), brideOnly: true },
  { key: 'name', label: 'Name', done: (p) => !!p.name?.trim() },
  { key: 'age', label: 'Age', done: (p) => p.age != null },
  { key: 'city', label: 'City', done: (p) => !!p.city },
  { key: 'height', label: 'Height', done: (p) => !!p.height },
  { key: 'marital', label: 'Marital status', done: (p) => !!p.marital },
  { key: 'eduProf', label: 'Education & profession', done: (p) => !!p.eduProf },
  { key: 'family', label: 'Family background', done: (p) => !!p.family?.trim() },
  { key: 'sect', label: 'Sect', done: (p) => !!p.sect },
  { key: 'prayer', label: 'Prayer', done: (p) => !!p.prayer },
  { key: 'modesty', label: 'Hijab / beard', done: (p) => !!p.modesty },
  { key: 'fasting', label: 'Fasting', done: (p) => !!p.fasting },
  { key: 'quran', label: "Qur'an", done: (p) => !!p.quran },
  { key: 'diet', label: 'Diet', done: (p) => !!p.diet },
  { key: 'smoking', label: 'Smoking', done: (p) => !!p.smoking },
];

export function profileCompletion(profile: Profile | null | undefined, gender: 'bride' | 'groom') {
  const items = ITEMS.filter((i) => !i.brideOnly || gender === 'bride');
  if (!profile) return { percent: 0, missing: items.map((i) => i.label) };
  const missing = items.filter((i) => !i.done(profile)).map((i) => i.label);
  const percent = Math.round(((items.length - missing.length) / items.length) * 100);
  return { percent, missing };
}
