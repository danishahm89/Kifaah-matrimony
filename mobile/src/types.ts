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

// CONTRACT.md §8.4 — status of *my* request to see this profile's photo.
export type PhotoAccessStatus = 'none' | 'pending' | 'accepted' | 'rejected';

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
  // §8.4 — present once the existing subscribed+accepted gate is satisfied; absent (undefined)
  // before that, same as `contact`/`photoUrl` staying locked. Client treats undefined as 'none'.
  photoAccessStatus?: PhotoAccessStatus;
  // ASSUMPTION (flagged in the final report — not spelled out verbatim in CONTRACT §8.4): when the
  // profile being viewed (`id` above) has itself requested to see *my* photo, this carries that
  // pending request so ProfileDetailScreen can show an inline Accept/Reject affordance for the
  // owner, reached by tapping a `photo_requested` notification (CONTRACT §8.6, referenceId =
  // requester's userId -> this screen). Null/absent when there's no such pending request.
  incomingPhotoRequest?: { id: string; status: 'pending' } | null;
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

// CONTRACT.md §8.2/§8.8 — conversation lifecycle states, lower-cased over the wire
// (`conversationStatusLabel` on the backend maps the ConversationStatus enum to these).
export type ConversationStatus = 'active' | 'closed' | 'reopen_requested' | 'blocked';

export interface ChatSummary {
  userId: string;
  name: string;
  photoUrl?: string | null;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  // §8.8 — GET /api/chats gains these. Optional/defaulted client-side (see useChat.ts) so the
  // app degrades gracefully against a backend that hasn't landed them yet: undefined is treated
  // as `active`/`canMessage: true`, matching today's (pre-§8) behavior.
  conversationId?: string;
  conversationStatus?: ConversationStatus;
  canMessage?: boolean;
  canMessageReason?: string | null;
  // Only meaningful when conversationStatus === 'reopen_requested' — whose request it is, so the
  // UI can tell the requester ("reopen request sent") from the recipient ("accept/reject") apart.
  reopenRequestedByUserId?: string | null;
}

export interface ChatMessage {
  id: string;
  fromUserId: string;
  toUserId: string;
  text: string;
  createdAt: string;
}

// CONTRACT.md §8.6 — generalized Notification.type (replaces the old candidateId/score/label/text
// match-only shape). `referenceId`'s meaning depends on `type` — see the §8.6 table.
export type NotificationType =
  | 'match_suggestion'
  | 'new_request'
  | 'request_accepted'
  | 'new_message'
  | 'photo_requested'
  | 'photo_request_accepted'
  | 'photo_request_rejected'
  | 'conversation_closed'
  | 'reopen_requested'
  | 'reopen_accepted'
  | 'reopen_rejected'
  | 'screenshot_alert';

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceId?: string | null;
  read: boolean;
  createdAt: string;
}

// CONTRACT.md §8.3 — GET /api/blocks row. `id` is the blocked user's own userId (matches the
// backend's actual response — see backend/src/routes/blocks.ts), used directly as the path param
// for DELETE /api/blocks/:userId.
export interface BlockedUserItem {
  id: string;
  name: string;
  city?: string | null;
  createdAt: string;
}

// CONTRACT.md §8.5 — wali sharing.
export type WaliShareStatus = 'none' | 'active' | 'revoked';
export interface WaliShareState {
  status: WaliShareStatus;
  createdAt?: string | null;
}
export interface WaliShareCreateResponse {
  token: string;
  url: string;
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
