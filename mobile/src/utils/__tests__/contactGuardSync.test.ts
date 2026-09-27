import fs from 'fs';
import path from 'path';
import { findContactDetails } from '../contactGuard';

// The app keeps a copy of the server's contact guard for instant feedback.
// This fails if the two drift apart.
describe('contactGuard copy', () => {
  it('matches backend/src/lib/contactGuard.ts', () => {
    const server = path.resolve(__dirname, '../../../../backend/src/lib/contactGuard.ts');
    if (!fs.existsSync(server)) return; // app-only checkout
    const app = fs.readFileSync(path.resolve(__dirname, '../contactGuard.ts'), 'utf8');
    const body = app.split('\n').slice(3).join('\n');
    expect(body).toBe(fs.readFileSync(server, 'utf8'));
  });

  it('blocks a hidden number and allows normal text', () => {
    expect(findContactDetails('nine eight seven six five four three two one zero').blocked).toBe(true);
    expect(findContactDetails('wh@ts@pp pe aao').blocked).toBe(true);
    expect(findContactDetails('Assalamu alaikum, how is your family?').blocked).toBe(false);
  });
});
