import { describe, it, expect } from "vitest";
import { findContactDetails, findContactDetailsAcross } from "../src/lib/contactGuard";

const blocked: [string, string][] = [
  // phone numbers, plain and hidden
  ["phone", "call me 9876543210"],
  ["phone", "+91 98765 43210"],
  ["phone", "98-765-432-10"],
  ["phone", "9 8 7 6 5 4 3 2 1 0"],
  ["phone", "9.8.7.6.5.4.3.2.1.0"],
  ["phone", "9️⃣8️⃣7️⃣6️⃣5️⃣4️⃣3️⃣2️⃣1️⃣0️⃣"],
  ["phone", "98🌹76🌹54🌹32🌹10"],
  ["phone", "nine eight seven six five four three two one zero"],
  ["phone", "nyn ate sevn six fyv for tree to won zero"],
  ["phone", "ninety eight seventy six fifty four thirty two ten"],
  ["phone", "double nine eight seven six five four three two one"],
  ["phone", "nau aath saat chhe paanch char teen do ek shunya"],
  ["phone", "98seven6five4three2one0"],
  ["phone", "98765o432l0"],
  ["phone", "9a8b7c6d5e4f3g2h1i0"],
  ["phone", "٩٨٧٦٥٤٣٢١٠"],
  ["phone", "९८७६५४३२१०"],
  ["phone", "①②③④⑤⑥⑦⑧⑨⓪"],
  ["phone", "９８７６５４３２１０"],
  ["phone", "mob no 98765 43"],
  // email, hidden
  ["email", "mail me at ali.khan@gmail.com"],
  ["email", "ali dot khan at gmail dot com"],
  ["email", "alikhan at the rate gmail dot com"],
  ["email", "my g m a i l is alikhan92"],
  ["email", "my gmial alikhan"],
  ["email", "pay on ali@okaxis"],
  ["email", "ali@gmail"],
  // links
  ["link", "visit www.example.com"],
  ["link", "https://t.me/alikhan"],
  ["link", "alikhan dot in"],
  // social apps, short forms, look-alikes
  ["social", "find me on insta"],
  ["social", "add me on whatsapp"],
  ["social", "whats app karo"],
  ["social", "wh@ts@pp pe aao"],
  ["social", "w h a t s a p p"],
  ["social", "w.h.a.t.s.a.p.p"],
  ["social", "1nst4gr4m"],
  ["social", "my ig is alik92"],
  ["social", "fb pe aa jao"],
  ["social", "snap me"],
  ["social", "tg pe milo"],
  ["social", "telegram me milte hain"],
  ["social", "check my tiktok"],
  ["social", "youtube channel ali vlogs"],
  ["social", "my id is @ali_khan92"],
  ["social", "wa kro"],
  ["social", "whtsp me"],
  ["social", "mywhatsappis ali"],
  ["social", "іnstаgrаm"], // Cyrillic look-alike letters
  ["social", "in​sta​gram"], // zero-width spaces
  ["social", "mera number do"],
  ["social", "send me your number"],
  ["social", "ur nmbr plz"],
  ["social", "text me please"],
  ["social", "dm me"],
  ["social", "let's talk outside the app"],
];

const allowed = [
  "Assalamu alaikum, how are you?",
  "I pray 5 times a day and I am 27 years old.",
  "My family is from Aligarh, we are 3 brothers and 2 sisters.",
  "I work as a software engineer at a bank.",
  "Please talk to my Wali, my father, InshaAllah.",
  "I do not smoke. No, I have not done Hajj yet.",
  "Height 5'8\", born in 1998.",
  "Born 1998, working since 2020, age 27.",
  "I like reading and cooking biryani on weekends.",
  "We are 5 to 6 people in the family, I want to go for Umrah.",
  "I did my installation training in 2019 at a big company.",
  "Salary is around 8 to 10 lakh per year.",
  "I wake up for Fajr at 5 and go to work at 9.",
  "My snapshot of life: family first, deen always.",
  "Waiting for your reply, jazakAllah khair.",
];

describe("contact guard", () => {
  it.each(blocked)("blocks %s: %s", (kind, text) => {
    const r = findContactDetails(text);
    expect(r.blocked).toBe(true);
    expect(r.kinds).toContain(kind);
  });
  it.each(allowed)("allows: %s", (text) => {
    expect(findContactDetails(text)).toEqual({ blocked: false, kinds: [] });
  });
  it("catches a number split over several messages", () => {
    expect(findContactDetailsAcross(["98765"], "43210").blocked).toBe(true);
    expect(findContactDetailsAcross(["nine eight seven", "six five four"], "three two one zero").blocked).toBe(true);
    expect(findContactDetailsAcross(["How are you?"], "I am fine, alhamdulillah").blocked).toBe(false);
  });
});
