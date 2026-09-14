import "dotenv/config";
import { PrismaClient, Gender } from "@prisma/client";

const prisma = new PrismaClient();

type DemoGender = "bride" | "groom";

interface DemoProfile {
  gender: DemoGender;
  name: string;
  age: number;
  city: string;
  sect: string;
  prayer: string;
  modesty: string;
  eduProf: string;
  profField: string;
  family: string;
  height: string;
  marital: string;
  about: string;
  wali: string;
  phone: string;
  contactEmail: string;
  diet: string;
  smoking: string;
  fasting: string;
  quran: string;
  hajj: string;
  polygamy: string;
  habits: string;
  likes: string;
  dislikes: string;
}

// Verbatim from CONTRACT.md §6 seed data (transcribed from the design
// prototype's PROFILES + PROFILE_EXTRA constants).
const DEMO_PROFILES: DemoProfile[] = [
  {
    gender: "bride",
    name: "Ayesha K.",
    age: 26,
    city: "Hyderabad",
    sect: "Sunni · Hanafi",
    prayer: "Prays 5x daily",
    modesty: "Wears hijab",
    eduProf: "M.A. Economics · Bank officer",
    profField: "Banking",
    family: "Middle-class, father is a retailer, one married sister",
    height: "5'3\"",
    marital: "Never married",
    about:
      "Looking for a practicing brother who prays regularly and is settled in his career. Family-oriented, enjoys reading and cooking.",
    wali: "Father — Abdul Kareem",
    phone: "+91 98765 41123",
    contactEmail: "ayesha.k@example.com",
    diet: "Halal, non-vegetarian",
    smoking: "Non-smoker",
    fasting: "Fasts in Ramadan & voluntary fasts",
    quran: "Reads with tajweed",
    hajj: "Performed Umrah",
    polygamy: "Open to being a co-wife if warranted",
    habits: "Enjoys reading",
    likes: "Cooking",
    dislikes: "Lack of punctuality",
  },
  {
    gender: "groom",
    name: "Imran S.",
    age: 29,
    city: "Bengaluru",
    sect: "Sunni · Shafi'i",
    prayer: "Prays 5x daily",
    modesty: "Keeps a beard",
    eduProf: "B.Tech · Software engineer",
    profField: "Technology",
    family: "Close-knit family, one younger brother",
    height: "5'9\"",
    marital: "Never married",
    about:
      "Seeking a partner who values deen and family. I pray in congregation when possible and want to build a home rooted in faith.",
    wali: "Elder brother — Farhan",
    phone: "+91 99876 54456",
    contactEmail: "imran.s@example.com",
    diet: "Halal, non-vegetarian",
    smoking: "Non-smoker",
    fasting: "Fasts in Ramadan & voluntary fasts",
    quran: "Reads with tajweed",
    hajj: "Planning to",
    polygamy: "Prefer monogamy only",
    habits: "Regular exerciser",
    likes: "Islamic studies",
    dislikes: "Smoking",
  },
  {
    gender: "bride",
    name: "Sana R.",
    age: 24,
    city: "Lucknow",
    sect: "Sunni · Hanafi",
    prayer: "Mostly prays 5x",
    modesty: "Wears hijab & niqab",
    eduProf: "B.Sc. Nursing · Staff nurse",
    profField: "Healthcare",
    family: "Religious household, father is an imam",
    height: "5'1\"",
    marital: "Never married",
    about:
      "I value modesty and simplicity. Looking for someone kind, financially stable and committed to raising a family on Islamic values.",
    wali: "Father — Imam Rasheed",
    phone: "+91 97654 37789",
    contactEmail: "sana.r@example.com",
    diet: "Halal, vegetarian",
    smoking: "Non-smoker",
    fasting: "Fasts in Ramadan & voluntary fasts",
    quran: "Reads, still learning",
    hajj: "Not yet",
    polygamy: "Open to discuss",
    habits: "Homely, prefers staying in",
    likes: "Islamic studies",
    dislikes: "Gossip",
  },
  {
    gender: "groom",
    name: "Yusuf A.",
    age: 31,
    city: "Hyderabad",
    sect: "Sunni · Hanafi",
    prayer: "Prays 5x daily",
    modesty: "Trimmed beard",
    eduProf: "MBA · Business analyst",
    profField: "Business",
    family: "Business family, two sisters both married",
    height: "5'11\"",
    marital: "Divorced, no children",
    about:
      "Previously married, no children. Looking to remarry within the community — someone understanding, practicing and family-minded.",
    wali: "Father — Abdul Rahman",
    phone: "+91 96543 22231",
    contactEmail: "yusuf.a@example.com",
    diet: "Halal, non-vegetarian",
    smoking: "Trying to quit",
    fasting: "Fasts in Ramadan only",
    quran: "Reads with tajweed",
    hajj: "Performed Hajj",
    polygamy: "Open to discuss",
    habits: "Volunteers / community work",
    likes: "Travelling",
    dislikes: "Lying",
  },
  {
    gender: "bride",
    name: "Fatima N.",
    age: 28,
    city: "Chennai",
    sect: "Sunni · Shafi'i",
    prayer: "Prays 5x daily",
    modesty: "Wears hijab",
    eduProf: "PhD candidate, Biology · Research scholar",
    profField: "Academia",
    family: "Educated family, both parents retired teachers",
    height: "5'4\"",
    marital: "Never married",
    about:
      "Academic by profession, deeply rooted in faith. Looking for a partner who respects my career and shares a love for learning.",
    wali: "Father — Nasir Ahmed",
    phone: "+91 95432 15567",
    contactEmail: "fatima.n@example.com",
    diet: "Eggetarian",
    smoking: "Non-smoker",
    fasting: "Fasts in Ramadan & voluntary fasts",
    quran: "Reads with tajweed",
    hajj: "Performed Umrah",
    polygamy: "Prefer monogamy only",
    habits: "Enjoys reading",
    likes: "Islamic studies",
    dislikes: "Lack of punctuality",
  },
  {
    gender: "groom",
    name: "Bilal H.",
    age: 27,
    city: "Delhi",
    sect: "Shia",
    prayer: "Prays 5x daily",
    modesty: "Clean-shaven",
    eduProf: "B.Com · Family business, textiles",
    profField: "Business",
    family: "Business family",
    height: "5'8\"",
    marital: "Never married",
    about:
      "Run our family textile business. Looking for a sister who is warm, family-oriented and comfortable with a joint family setup.",
    wali: "Father — Haider Hussain",
    phone: "+91 94321 03345",
    contactEmail: "bilal.h@example.com",
    diet: "Halal, non-vegetarian",
    smoking: "Occasional",
    fasting: "Fasts in Ramadan only",
    quran: "Reads, still learning",
    hajj: "Not yet",
    polygamy: "Open to discuss",
    habits: "Regular exerciser",
    likes: "Sports",
    dislikes: "Smoking",
  },
  {
    gender: "bride",
    name: "Zainab M.",
    age: 23,
    city: "Bengaluru",
    sect: "Sunni · Hanafi",
    prayer: "Prays 5x daily",
    modesty: "Wears hijab",
    eduProf: "B.Ed · School teacher",
    profField: "Education",
    family: "Large joint family, three siblings",
    height: "5'2\"",
    marital: "Never married",
    about:
      "A teacher by profession, I enjoy working with children. Looking for a practicing brother ready for a simple, sincere marriage.",
    wali: "Elder brother — Tariq",
    phone: "+91 93210 98890",
    contactEmail: "zainab.m@example.com",
    diet: "Halal, vegetarian",
    smoking: "Non-smoker",
    fasting: "Fasts in Ramadan & voluntary fasts",
    quran: "Reads with tajweed",
    hajj: "Planning to",
    polygamy: "Open to being a co-wife if warranted",
    habits: "Enjoys reading",
    likes: "Cooking",
    dislikes: "Gossip",
  },
  {
    gender: "groom",
    name: "Hamza I.",
    age: 30,
    city: "Pune",
    sect: "Sunni · Hanafi",
    prayer: "Mostly prays 5x",
    modesty: "Full beard",
    eduProf: "M.Tech · Civil engineer",
    profField: "Engineering",
    family: "Nuclear family, only child",
    height: "5'10\"",
    marital: "Never married",
    about:
      "Civil engineer working on infrastructure projects. Looking for a life partner who is patient, practicing and easy to talk to.",
    wali: "Father — Iqbal",
    phone: "+91 92109 86612",
    contactEmail: "hamza.i@example.com",
    diet: "Halal, non-vegetarian",
    smoking: "Non-smoker",
    fasting: "Fasts in Ramadan only",
    quran: "Reads, still learning",
    hajj: "Not yet",
    polygamy: "Prefer monogamy only",
    habits: "Volunteers / community work",
    likes: "Travelling",
    dislikes: "Lack of punctuality",
  },
  {
    gender: "bride",
    name: "Mariam T.",
    age: 25,
    city: "Hyderabad",
    sect: "Sunni · Hanafi",
    prayer: "Prays 5x daily",
    modesty: "Wears hijab",
    eduProf: "B.A. Psychology · HR executive",
    profField: "HR",
    family: "Small family, one younger brother",
    height: "5'3\"",
    marital: "Never married",
    about:
      "Interested in counselling and community work. Looking for someone respectful, practicing and ready to build a home together.",
    wali: "Father — Yaqub",
    phone: "+91 91098 74478",
    contactEmail: "mariam.t@example.com",
    diet: "Eggetarian",
    smoking: "Non-smoker",
    fasting: "Fasts in Ramadan & voluntary fasts",
    quran: "Reads with tajweed",
    hajj: "Performed Umrah",
    polygamy: "Open to discuss",
    habits: "Homely, prefers staying in",
    likes: "Islamic studies",
    dislikes: "Smoking",
  },
  {
    gender: "groom",
    name: "Ahmed Z.",
    age: 28,
    city: "Jaipur",
    sect: "Sunni · Shafi'i",
    prayer: "Prays 5x daily",
    modesty: "Trimmed beard",
    eduProf: "B.Pharm · Pharmacist",
    profField: "Healthcare",
    family: "Business family, one elder sister",
    height: "5'7\"",
    marital: "Never married",
    about:
      "Run a family pharmacy. Looking for someone grounded, kind and interested in a stable, faith-centered married life.",
    wali: "Father — Zubair",
    phone: "+91 90987 69934",
    contactEmail: "ahmed.z@example.com",
    diet: "Halal, non-vegetarian",
    smoking: "Non-smoker",
    fasting: "Fasts in Ramadan only",
    quran: "Reads with tajweed",
    hajj: "Not yet",
    polygamy: "Open to discuss",
    habits: "Regular exerciser",
    likes: "Sports",
    dislikes: "Lying",
  },
];

// Login phone numbers for seeded demo accounts. +91900000000X is inside
// India's mobile numbering plan shape (E.164, 10 digits after +91) but the
// 900000000x block is not a real assignable subscriber range — these are
// dev-seed-only fixtures, never real numbers, and only ever reachable
// through the ConsoleOtpProvider in dev/test (never Twilio — Twilio Verify
// itself would simply fail to deliver an SMS to a non-existent number).
// Distinct from Profile.phone (`demo.phone`, e.g. "+91 98765 41123"), which
// is the in-app *contact* field shown to matches once unlocked.
function loginPhoneFor(index: number): string {
  return `+9190000000${String(index).padStart(2, "0")}`;
}

async function main() {
  console.log(`Seeding ${DEMO_PROFILES.length} demo profiles...`);

  for (let i = 0; i < DEMO_PROFILES.length; i++) {
    const demo = DEMO_PROFILES[i];
    const phone = loginPhoneFor(i + 1);
    const gender: Gender = demo.gender === "bride" ? "BRIDE" : "GROOM";

    await prisma.user.upsert({
      where: { phone },
      update: {},
      create: {
        phone,
        phoneVerified: true,
        gender,
        profile: {
          create: {
            name: demo.name,
            age: demo.age,
            city: demo.city,
            sect: demo.sect,
            prayer: demo.prayer,
            modesty: demo.modesty,
            eduProf: demo.eduProf,
            profField: demo.profField,
            family: demo.family,
            height: demo.height,
            marital: demo.marital,
            about: demo.about,
            wali: demo.wali,
            phone: demo.phone,
            contactEmail: demo.contactEmail,
            diet: demo.diet,
            smoking: demo.smoking,
            fasting: demo.fasting,
            quran: demo.quran,
            hajj: demo.hajj,
            polygamy: demo.polygamy,
            habits: demo.habits,
            likes: demo.likes,
            dislikes: demo.dislikes,
          },
        },
        subscription: { create: {} },
      },
    });

    console.log(`  seeded ${demo.name} <${phone}>`);
  }

  console.log(
    "Done. Demo accounts have no password — log in via POST /api/auth/otp/send + /api/auth/otp/verify " +
      "using one of the phone numbers above; the dev ConsoleOtpProvider prints the OTP code to this " +
      "server's stdout instead of sending a real SMS. See backend/README.md."
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
