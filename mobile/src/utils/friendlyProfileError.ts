import { ApiError } from '../api/client';
import { useAuthStore } from '../store/authStore';

/**
 * Maps a profile save/update failure to a message a user can act on.
 * The backend's PUT /api/profile/me returns a bare `{ error: "invalid_input" }`
 * code on validation failure (see profileUpdateSchema in backend/src/routes/profile.ts),
 * which ApiError surfaces verbatim as `message`. Showing that code to the user
 * ("invalid_input") isn't actionable, so translate the known ones here.
 */
const FIELD_LABELS: Record<string, string> = {
  name: 'your name',
  about: '"About me"',
  family: '"Family background"',
  wali: "your Wali's details",
  city: 'your city',
  dietCustom: 'your diet note',
  habitsCustom: 'your habits note',
  likesCustom: 'your likes note',
  dislikesCustom: 'your dislikes note',
};

export function friendlyProfileError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.body?.error === 'invalid_input') {
      // Guardian (wali) name is the field most likely to be blank at this point,
      // since the Shariah QA screen doesn't require it before letting you continue.
      const fieldErrors = e.body?.details?.fieldErrors ?? {};
      if (fieldErrors.wali && useAuthStore.getState().user?.gender !== 'groom') {
        return "Please go back and add your wali's (guardian's) name.";
      }
      if (fieldErrors.name) {
        return 'Please enter your name.';
      }
      if (fieldErrors.age) {
        return 'Please enter a valid age (18 or older).';
      }
      return "Some details couldn't be saved. Please check what you've entered and try again.";
    }
    if (e.body?.error === 'contact_details_not_allowed') {
      const label = FIELD_LABELS[e.body?.field as string] ?? 'your profile';
      return `Please remove phone numbers, emails, links or social media IDs from ${label}. They can't be shared on Kifaah.`;
    }
    if (e.body?.error) {
      return String(e.body.error);
    }
  }
  if (e instanceof Error && e.message) {
    return e.message;
  }
  return 'Could not save your profile. Please try again.';
}
