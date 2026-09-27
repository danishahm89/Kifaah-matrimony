// Help & Support contact details. Set these at build time:
//   EXPO_PUBLIC_SUPPORT_EMAIL=help@example.com
//   EXPO_PUBLIC_SUPPORT_WHATSAPP=919999999999   (country code + number, digits only)
// A contact row is hidden when its value is empty, so nothing broken is ever shown.
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '';
export const SUPPORT_WHATSAPP = (process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP ?? '').replace(/\D/g, '');
