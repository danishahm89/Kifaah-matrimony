import { useAuthStore } from '../store/authStore';
import type {
  ChatMessage,
  ChatSummary,
  CreateOrderResponse,
  DiscoverCandidate,
  FaqItem,
  Gender,
  InterestRequest,
  NotificationItem,
  PricingResponse,
  Profile,
  ProfileDetail,
  ReferenceData,
  Subscription,
  User,
  VerifyPaymentResponse,
} from '../types';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super((body && (body.error || body.message)) || `Request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

// A 401 on an authenticated request triggers exactly one silent refresh-and-retry (CONTRACT.md
// §7.2/§7 "refresh-token handling"). `refreshInFlight` dedups concurrent 401s onto one shared
// refresh call instead of each firing its own (a "refresh storm").
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const currentRefreshToken = useAuthStore.getState().refreshToken;
      if (!currentRefreshToken) return false;
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: currentRefreshToken }),
        });
        if (!res.ok) return false;
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        if (!data?.token || !data?.refreshToken) return false;
        await useAuthStore.getState().setTokens(data.token, data.refreshToken);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  let body: any = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    // Only an authenticated request (one that sent a token) gets the refresh-and-retry
    // treatment, and only once — a 401 from otp/send, otp/verify, or refresh itself just
    // fails normally, which also rules out any refresh-triggered-by-refresh recursion.
    if (res.status === 401 && token && !isRetry) {
      const refreshed = await refreshSession();
      if (refreshed) {
        return request<T>(path, options, true);
      }
      await useAuthStore.getState().logout();
    }
    throw new ApiError(res.status, body);
  }
  return body as T;
}

function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}
function post<T>(path: string, data?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined });
}
function put<T>(path: string, data?: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body: data !== undefined ? JSON.stringify(data) : undefined });
}
function del<T>(path: string, data?: unknown): Promise<T> {
  return request<T>(path, { method: 'DELETE', body: data !== undefined ? JSON.stringify(data) : undefined });
}

// ---- Auth ----
// Phone+OTP via Twilio Verify (CONTRACT.md §7.2) — replaces the old email/password signup/login.
export const authApi = {
  sendOtp: (phone: string) => post<{ ok: true }>('/api/auth/otp/send', { phone }),
  // `gender` is included whenever it's known from the "I am a..." pick step and omitted for the
  // "Already have an account? Log in" path; the backend requires it only for brand-new accounts
  // and otherwise ignores it, per §7.2.
  verifyOtp: (phone: string, code: string, gender?: Gender) =>
    post<{ token: string; refreshToken: string; user: User; isNewUser: boolean }>('/api/auth/otp/verify', {
      phone,
      code,
      ...(gender ? { gender } : {}),
    }),
  refresh: (refreshToken: string) => post<{ token: string; refreshToken: string }>('/api/auth/refresh', { refreshToken }),
  logout: (refreshToken: string) => post<{ ok: true }>('/api/auth/logout', { refreshToken }),
  logoutAll: () => post<{ ok: true }>('/api/auth/logout-all'),
  me: () => get<{ user: User; profile: Profile | null; subscription: Subscription | null }>('/api/auth/me'),
};

// ---- Reference data ----
export const referenceApi = {
  get: () => get<ReferenceData>('/api/reference'),
};

// ---- Profile / account ----
export const profileApi = {
  me: () => get<Profile>('/api/profile/me'),
  update: (patch: Partial<Profile>) => put<Profile>('/api/profile/me', patch),
  uploadPhoto: (fileUri: string, fileName: string, mimeType: string) => {
    const form = new FormData();
    // @ts-expect-error — RN's FormData file shape isn't in the DOM lib types.
    form.append('file', { uri: fileUri, name: fileName, type: mimeType });
    return request<{ photoUrl: string }>('/api/profile/photo', { method: 'POST', body: form });
  },
};

export const accountApi = {
  setLanguage: (language: 'en' | 'ur') => put<{ ok: true }>('/api/account/language', { language }),
  setChaperone: (chaperoneChat: boolean) => put<{ ok: true }>('/api/account/chaperone', { chaperoneChat }),
  registerPushToken: (expoPushToken: string) => post<{ ok: true }>('/api/account/push-token', { expoPushToken }),
  deletePushToken: (expoPushToken: string) => del<{ ok: true }>('/api/account/push-token', { expoPushToken }),
};

// ---- Discover / profiles ----
export const discoverApi = {
  list: () => get<DiscoverCandidate[]>('/api/discover'),
};
export const profilesApi = {
  detail: (id: string) => get<ProfileDetail>(`/api/profiles/${id}`),
};

// ---- Interests ----
// GET /api/interests/sent and /received nest the other member's identity under
// `profile` (see backend/src/routes/interests.ts) rather than returning it flat with
// fromUserId/toUserId — map to the flat `InterestRequest` shape the screens use.
interface RawInterestListItem {
  id: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  profile: { id: string; name: string; age: number | null; city: string | null; sect: string | null };
}
function mapSentItem(raw: RawInterestListItem): InterestRequest {
  const myId = useAuthStore.getState().user?.id ?? '';
  return {
    id: raw.id,
    status: raw.status,
    createdAt: raw.createdAt,
    updatedAt: raw.createdAt,
    fromUserId: myId,
    toUserId: raw.profile.id,
    name: raw.profile.name,
    age: raw.profile.age ?? undefined,
    city: raw.profile.city ?? undefined,
  };
}
function mapReceivedItem(raw: RawInterestListItem): InterestRequest {
  const myId = useAuthStore.getState().user?.id ?? '';
  return {
    id: raw.id,
    status: raw.status,
    createdAt: raw.createdAt,
    updatedAt: raw.createdAt,
    fromUserId: raw.profile.id,
    toUserId: myId,
    name: raw.profile.name,
    age: raw.profile.age ?? undefined,
    city: raw.profile.city ?? undefined,
  };
}
export const interestsApi = {
  send: (profileId: string) => post<InterestRequest>(`/api/interests/${profileId}`),
  sent: () => get<RawInterestListItem[]>('/api/interests/sent').then((rows) => rows.map(mapSentItem)),
  received: () => get<RawInterestListItem[]>('/api/interests/received').then((rows) => rows.map(mapReceivedItem)),
  accept: (id: string) => post<InterestRequest>(`/api/interests/${id}/accept`),
  decline: (id: string) => post<InterestRequest>(`/api/interests/${id}/decline`),
};

// ---- Chat ----
export const chatApi = {
  conversations: () => get<ChatSummary[]>('/api/chats'),
  // GET /api/chats/:userId/messages returns { messages, chaperoneChat } (backend/src/routes/chats.ts);
  // the app sources the chaperone banner state from the auth store's user.chaperoneChat instead, so
  // only the message list is needed here.
  messages: (userId: string) =>
    get<{ messages: ChatMessage[]; chaperoneChat: boolean }>(`/api/chats/${userId}/messages`).then((r) => r.messages),
  send: (userId: string, text: string) => post<ChatMessage>(`/api/chats/${userId}/messages`, { text }),
};

// ---- Notifications ----
export const notificationsApi = {
  list: () => get<NotificationItem[]>('/api/notifications'),
  readAll: () => post<{ ok: true }>('/api/notifications/read-all'),
};

// ---- Match engine ----
export const matchEngineApi = {
  runNow: () => post<{ notifications: NotificationItem[] }>('/api/match-engine/run-now'),
};

// ---- Pricing & payments ----
export const pricingApi = {
  get: () => get<PricingResponse>('/api/pricing'),
};
export const paymentsApi = {
  createOrder: (tier: 'basic' | 'premium', billing: 'monthly' | 'annual') =>
    post<CreateOrderResponse>('/api/payments/create-order', { tier, billing }),
  verify: (orderId: string, paymentId: string, signature: string) =>
    post<VerifyPaymentResponse>('/api/payments/verify', { orderId, paymentId, signature }),
};

// ---- FAQ ----
export const faqApi = {
  list: () => get<FaqItem[]>('/api/faq'),
};
