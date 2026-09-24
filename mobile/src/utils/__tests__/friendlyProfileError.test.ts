import { ApiError } from '../../api/client';
import { friendlyProfileError } from '../friendlyProfileError';

describe('friendlyProfileError', () => {
  it('points at the wali field when the backend rejects a blank guardian name', () => {
    const err = new ApiError(400, {
      error: 'invalid_input',
      details: { fieldErrors: { wali: ['String must contain at least 1 character(s)'] }, formErrors: [] },
    });
    expect(friendlyProfileError(err)).toMatch(/wali|guardian/i);
  });

  it('points at the name field when the backend rejects a blank name', () => {
    const err = new ApiError(400, {
      error: 'invalid_input',
      details: { fieldErrors: { name: ['String must contain at least 1 character(s)'] }, formErrors: [] },
    });
    expect(friendlyProfileError(err)).toMatch(/name/i);
  });

  it('points at the age field when the backend rejects an out-of-range age', () => {
    const err = new ApiError(400, {
      error: 'invalid_input',
      details: { fieldErrors: { age: ['Number must be greater than or equal to 18'] }, formErrors: [] },
    });
    expect(friendlyProfileError(err)).toMatch(/age/i);
  });

  it('falls back to a generic message for invalid_input with no recognized field', () => {
    const err = new ApiError(400, {
      error: 'invalid_input',
      details: { fieldErrors: { city: ['Expected string, received number'] }, formErrors: [] },
    });
    const msg = friendlyProfileError(err);
    expect(msg).not.toBe('invalid_input');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('never surfaces the raw "invalid_input" code to the user', () => {
    const err = new ApiError(400, { error: 'invalid_input', details: { fieldErrors: {}, formErrors: [] } });
    expect(friendlyProfileError(err)).not.toBe('invalid_input');
  });

  it('surfaces other backend error codes verbatim', () => {
    const err = new ApiError(409, { error: 'phone_already_in_use' });
    expect(friendlyProfileError(err)).toBe('phone_already_in_use');
  });

  it('falls back to the error message for a plain Error', () => {
    expect(friendlyProfileError(new Error('Network request failed'))).toBe('Network request failed');
  });

  it('falls back to a generic message when nothing usable is available', () => {
    expect(friendlyProfileError(undefined)).toBe('Could not save your profile. Please try again.');
  });
});
