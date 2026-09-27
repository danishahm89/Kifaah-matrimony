// Help & Support contact details. Can be overridden at build time with
// EXPO_PUBLIC_SUPPORT_EMAIL and EXPO_PUBLIC_SUPPORT_WHATSAPP (country code + number, digits only).
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'alzakwaantours@gmail.com';
export const SUPPORT_WHATSAPP = (process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP || '919990543267').replace(/\D/g, '');

// Grievance Officer (IT Rules 2021 / MeitY matrimonial advisory). Replace the
// name with a real person before public launch.
export const GRIEVANCE_OFFICER_NAME = process.env.EXPO_PUBLIC_GRIEVANCE_OFFICER || 'Grievance Officer, Kifaah';
export const LEGAL_LAST_UPDATED = '28 September 2026';
