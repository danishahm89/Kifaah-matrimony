// Shared TypeScript types mirroring CONTRACT.md §3 (data model) and §4 (API shapes).

export type Gender = 'bride' | 'groom';
export type Tier = 'basic' | 'premium';
export type Billing = 'monthly' | 'annual';
export type InterestStatus = 'none' | 'sent' | 'received' | 'accepted' | 'declined';
export type Language = 'en' | 'ur';

export interface User {
  id: string;
  phone: string;
  phoneVerified: boolean;
  // Optional account-recovery/display field only — never used for login (CONTRACT.md §7.1).
  email?: string | null;
  gender: Gender;
  language: Language;
  chaperoneChat: boolean;
  createdAt: string;
}

export interface Profile {
  userId: string;
  name?: string | null;
  age?: number | null;
  photoUrl?: string | null;
  sect?: string | null;
  prayer?: string | null;
  modesty?: string | null;
  wali: string;
  eduProf?: string | null;
  profField?: string | null;
  family?: string | null;
  height?: string | null;
  city?: string | null;
  marital?: string | null;
  about?: string | null;
  fasting?: string | null;
  quran?: string | null;
  hajj?: string | null;
  polygamy?: string | null;
  diet?: string | null;
  dietCustom?: string | null;
  smoking?: string | null;
  habits?: string | null;
  habitsCustom?: string | null;
  likes?: string | null;
  likesCustom?: string | null;
  dislikes?: string | null;
  dislikesCustom?: string | null;
  phone?: string | null;
  contactEmail?: string | null;
}

export interface Subscription {
  userId: string;
  tier?: Tier | null;
  billing?: Billing | null;
  status: 'inactive' | 'active' | 'cancelled';
  startedAt?: string | null;
  renewsAt?: string | null;
}

export interface ReferenceData {
  heights: string[];
  cities: string[];
  sects: string[];
  eduProfOptions: string[];
  dietOptions: string[];
  habitsOptions: string[];
  likesOptions: string[];
  dislikesOptions: string[];
  maritalOptions: string[];
  prayerOptions: string[];
  modestyOptions: { bride: string[]; groom: string[] };
  fastingOptions: string[];
  quranOptions: string[];
  hajjOptions: string[];
  polygamyOptions: { bride: string[]; groom: string[] };
  smokingOptions: string[];
}

export interface DiscoverCandidate {
  id: string;
  name: string;
  age: number;
  city: string;
  sect: string;
  eduProf: string;
  score: number;
  photoLocked: true;
}

export interface ProfileDetail {
  id: string;
  name: string;
  age: number;
  city?: string | null;
  sect?: string | null;
  prayer?: string | null;
  modesty?: string | null;
  eduProf?: string | null;
  family?: string | null;
  height?: string | null;
  marital?: string | null;
  about?: string | null;
  fasting?: string | null;
  quran?: string | null;
  hajj?: string | null;
  polygamy?: string | null;
  diet?: string | null;
  smoking?: string | null;
  habits?: string | null;
  likes?: string | null;
  dislikes?: string | null;
  score: number;
  interestStatus: InterestStatus;
  wali: string;
  contact: { phone: string; email: string } | null;
  locked?: boolean;
  lockMessage?: string;
  photoUrl: string | null;
}

export interface InterestRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  updatedAt: string;
  // Convenience fields the API is expected to join in for list views.
  name?: string;
  age?: number;
  city?: string;
  photoLocked?: boolean;
}

export interface ChatSummary {
  userId: string;
  name: string;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
}

export interface ChatMessage {
  id: string;
  fromUserId: string;
  toUserId: string;
  text: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  candidateId: string;
  score: number;
  label: string;
  text: string;
  read: boolean;
  createdAt: string;
}

export interface PricingResponse {
  basic: { monthly: number; annual: number };
  premium: { monthly: number; annual: number };
}

export interface CreateOrderResponse {
  orderId: string;
  amount: number;
  currency: 'INR';
  keyId: string;
  // Dev/test only: true when the backend skipped the real Razorpay order
  // (PAYMENTS_BYPASS). The app should skip the Razorpay checkout UI too.
  bypass?: boolean;
}

export interface VerifyPaymentResponse {
  subscription: Subscription;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ApiErrorBody {
  error: string;
  message?: string;
}
