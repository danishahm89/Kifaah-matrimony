// Help & Support contact details. Can be overridden at build time with
// EXPO_PUBLIC_SUPPORT_EMAIL and EXPO_PUBLIC_SUPPORT_WHATSAPP (country code + number, digits only).
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'alzakwaantours@gmail.com';
export const SUPPORT_WHATSAPP = (process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP || '919990543267').replace(/\D/g, '');
