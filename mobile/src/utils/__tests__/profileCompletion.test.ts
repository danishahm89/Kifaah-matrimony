import { profileCompletion } from '../profileCompletion';

describe('profileCompletion', () => {
  it('is 0% with nothing filled and lists the photo first', () => {
    const r = profileCompletion({ userId: 'u', wali: '' }, 'bride');
    expect(r.percent).toBe(0);
    expect(r.missing[0]).toBe('Profile photo');
  });

  it('does not ask brothers for a Wali', () => {
    const r = profileCompletion({ userId: 'u', wali: '' }, 'groom');
    expect(r.missing).not.toContain('Wali details');
  });

  it('reaches 100% when everything is filled', () => {
    const r = profileCompletion(
      {
        userId: 'u',
        wali: 'Father',
        photoUrl: '/api/photos/x',
        about: 'x'.repeat(60),
        name: 'A',
        age: 25,
        city: 'Aligarh',
        height: '5\'4"',
        marital: 'Never married',
        eduProf: 'MBA',
        family: 'Joint family',
        sect: 'Hanafi',
        prayer: '5 times',
        modesty: 'Yes',
        fasting: 'Always',
        quran: 'Fluent',
        diet: 'Halal',
        smoking: 'No',
      },
      'bride'
    );
    expect(r.percent).toBe(100);
    expect(r.missing).toEqual([]);
  });
});
