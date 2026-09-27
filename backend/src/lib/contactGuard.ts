// Blocks contact details in anything one member writes for another to read
// (chat messages, profile text). Members must meet through Kifaah's own
// steps: mutual accept, Wali, then contact reveal by the app.
//
// People hide contact details on purpose, so the text is checked in several
// "cleaned up" forms:
//   - digitView: finds phone numbers written with spaces, symbols, emoji,
//     number words (English, Hindi/Urdu, common misspellings like "nyn",
//     "ate", "fyv"), tens words ("ninety eight"), "double 9", letters used as
//     digits ("98765o432l"), single junk letters between digits
//     ("9a8b7c6d..."), non-Latin digits (Arabic, Devanagari, Bengali,
//     fullwidth, circled, superscript, keycap emoji).
//   - wordView: finds app names and email/links with look-alike symbols
//     ("wh@ts@pp", "1nst4", "g.m.a.i.l", "w h a t s a p p", Cyrillic
//     look-alike letters, zero-width characters) and short forms
//     ("wa", "whtsp", "insta", "ig", "fb", "snap", "tg", "mob no", "ph no").
// It will never catch 100% (e.g. a number split over many messages), so the
// chat route also checks the sender's last few messages together, and every
// block is recorded for admins to review.

export type ContactKind = "phone" | "email" | "link" | "social";

// ---------- shared clean-up ----------

const ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\uFE0F\u20E3]/g;

// Cyrillic / Greek letters that look like Latin ones.
const HOMOGLYPHS: Record<string, string> = {
  а: "a", в: "b", е: "e", ё: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x",
  і: "i", ј: "j", ѕ: "s", ԁ: "d", ɡ: "g", ο: "o", α: "a", ε: "e", ι: "i", κ: "k", ν: "v", ρ: "p", τ: "t",
  υ: "u", χ: "x", ω: "w",
};

// Unicode digit blocks -> ASCII: Arabic-Indic, Eastern Arabic-Indic, Devanagari, Bengali,
// Gurmukhi, Gujarati, Tamil, Telugu, Kannada, Malayalam, fullwidth.
const DIGIT_BLOCKS = [0x0660, 0x06f0, 0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0xff10];

function baseClean(raw: string): string {
  let out = "";
  for (const ch of raw.normalize("NFKC").replace(ZERO_WIDTH, "")) {
    const code = ch.codePointAt(0)!;
    const block = DIGIT_BLOCKS.find((b) => code >= b && code <= b + 9);
    if (block !== undefined) out += String(code - block);
    else out += HOMOGLYPHS[ch.toLowerCase()] ?? ch;
  }
  return out.toLowerCase();
}

// ---------- digitView: phone numbers ----------

const UNITS: Record<string, string> = {
  zero: "0", zer0: "0", zro: "0", oh: "0", o: "0", nil: "0", shunya: "0", sifar: "0", sunya: "0",
  one: "1", won: "1", wan: "1", ek: "1", ik: "1",
  two: "2", to: "2", too: "2", tu: "2", tw0: "2", do: "2", doo: "2",
  three: "3", thre: "3", tree: "3", tri: "3", teen: "3", tin: "3",
  four: "4", for: "4", fore: "4", foor: "4", fr: "4", char: "4", chaar: "4", chār: "4",
  five: "5", fiv: "5", fyv: "5", phive: "5", faiv: "5", paanch: "5", panch: "5", pach: "5",
  six: "6", sixx: "6", siks: "6", sics: "6", chhe: "6", chhah: "6", chah: "6", che: "6", chhay: "6",
  seven: "7", sevn: "7", sevan: "7", seben: "7", saat: "7", sat: "7",
  eight: "8", ate: "8", ait: "8", eit: "8", aath: "8", aat: "8", ath: "8",
  nine: "9", nyn: "9", nyne: "9", nain: "9", naine: "9", nau: "9", nao: "9", nou: "9",
};
const TENS: Record<string, string> = {
  twenty: "2", thirty: "3", forty: "4", fourty: "4", fifty: "5", sixty: "6", seventy: "7", eighty: "8", ninety: "9",
};
const TEENS: Record<string, string> = {
  ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16",
  seventeen: "17", eighteen: "18", nineteen: "19", das: "10",
};
const FILLERS = new Set(["and", "then", "phir", "aur", "dash", "space", "hyphen", "-", "&"]);

function numberWordsToDigits(text: string): string {
  // Split glued letter/digit tokens: "98seven6five" -> "98 seven 6 five".
  const spaced = text.replace(/(\d)([a-z])/g, "$1 $2").replace(/([a-z])(\d)/g, "$1 $2");
  const tokens = spaced.split(/[\s,.;:!?/\\|_*~•·+()[\]{}"'`]+/).filter(Boolean);

  const isDigits = (t: string) => /^\d+$/.test(t);
  const isWord = (t: string) => t in UNITS || t in TENS || t in TEENS || t === "double" || t === "triple";
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    // Collect a run of number-ish tokens (fillers allowed inside a run).
    let j = i;
    let numeric = 0;
    let words = 0;
    while (j < tokens.length && (isDigits(tokens[j]) || isWord(tokens[j]) || (FILLERS.has(tokens[j]) && j > i))) {
      if (isDigits(tokens[j])) numeric += 1;
      else if (isWord(tokens[j])) {
        numeric += 1;
        words += 1;
      }
      j += 1;
    }
    if (j > i && numeric >= 3 && words > 0) {
      let digits = "";
      for (let k = i; k < j; k++) {
        const t = tokens[k];
        if (isDigits(t)) digits += t;
        else if (t === "double" || t === "triple") {
          const next = tokens[k + 1];
          const d = next && (isDigits(next) ? next[0] : UNITS[next]);
          if (d) {
            digits += d.repeat(t === "double" ? 2 : 3);
            k += 1;
          }
        } else if (t in TENS) {
          const next = tokens[k + 1];
          if (next && next in UNITS && UNITS[next] !== "0") {
            digits += TENS[t] + UNITS[next];
            k += 1;
          } else digits += TENS[t] + "0";
        } else if (t in TEENS) digits += TEENS[t];
        else if (t in UNITS) digits += UNITS[t];
      }
      out.push(digits);
      i = j;
    } else {
      out.push(tokens[i]);
      i += 1;
    }
  }
  return out.join(" ");
}

function digitView(clean: string): string {
  let t = clean;
  // Letters and symbols used as digits inside a digit run: "98765o432l" -> "9876504321".
  const LEET_DIGIT: Record<string, string> = { o: "0", q: "0", i: "1", l: "1", "|": "1", "!": "1", z: "2", s: "5", b: "8", g: "9" };
  for (let pass = 0; pass < 2; pass++) {
    t = t.replace(/(?<=\d)[oqilz|!sbg](?=\d)/g, (c) => LEET_DIGIT[c]);
  }
  // Single junk letters / symbols between digits: "9a8b7c6d5e" -> "98765".
  t = t.replace(/(?<=\d)\s?[a-z#$%^&=<>✓♥❤★☆]\s?(?=\d)/g, "");
  t = numberWordsToDigits(t);
  return t;
}

// 10+ digits (an Indian mobile, or a landline with STD code) with any
// separators that are not letters: spaces, dashes, dots, emoji...
const PHONE = /(?:\+?\d[^a-z\d\n]{0,4}){10,}/;
// 7+ digits next to a contact word ("mob no 98765 43", "call 8765432").
const PHONE_WITH_WORD = /(?:^|[^a-z])(?:no|num|number|nmbr|mob|mobile|ph|phone|fone|cell|call|contact|whatsapp|wa|dial|ring)(?![a-z])[^a-z]{0,12}(?:\d[^a-z\d\n]{0,4}){7,}/;

// ---------- wordView: apps, emails, links ----------

const LEET_LETTER: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g", "@": "a", $: "s", "!": "i", "|": "i", "€": "e", "£": "l",
};

function wordView(clean: string): string {
  // Look-alike symbols inside words: "wh@ts@pp", "1nst4gr4m".
  let t = clean.replace(/[a-z0-9@$!|€£]+/g, (tok) => (/[a-z]/.test(tok) ? tok.replace(/[0134578@$!|€£9]/g, (c) => LEET_LETTER[c] ?? c) : tok));
  // Spelled out letter by letter: "w h a t s a p p", "i.n.s.t.a", "g-m-a-i-l".
  t = t.replace(/\b(?:[a-z][\s.\-_*,]+){2,}[a-z]\b/g, (run) => run.replace(/[\s.\-_*,]+/g, ""));
  return t;
}

// App names and short forms, checked on word boundaries.
const SOCIAL_WORDS = [
  "whatsapp", "whatsap", "whatapp", "watsapp", "watsap", "whtsapp", "whtsap", "whtsp", "whtspp", "wtsapp", "wtsap",
  "wtsp", "wapp", "whats app", "whats ap", "wa", "wp", "w/a", "w.a", "watts app",
  "instagram", "instagrm", "insta", "instaa", "inst", "insta id", "ig", "igid",
  "telegram", "telegrm", "tele gram", "tg", "tlgrm", "t.me",
  "snapchat", "snap chat", "snap", "snp", "sc id",
  "facebook", "face book", "fb", "fbid", "messenger", "msngr",
  "twitter", "x.com", "signal app", "skype", "linkedin", "viber", "wechat", "discord", "hike", "sharechat",
  "tiktok", "tik tok", "threads", "youtube", "yt channel", "reddit", "hangouts", "google chat", "kik", "line id",
  "zoom", "meet.google", "botim", "imo",
  "gpay", "google pay", "paytm", "phonepe", "phone pe", "upi", "upi id", "bhim",
];
const SOCIAL = new RegExp(`(?:^|[^a-z])(?:${SOCIAL_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&").replace(/ /g, "\\s*")).join("|")})(?![a-z])`);
// Very distinctive names, also caught when glued to other words ("mywhatsappis").
const SQUASHED = /whatsapp|watsapp|whtsapp|instagram|telegram|snapchat|facebook|linkedin|hotmail|rediffmail|protonmail|googlemail/;

const EMAIL = /[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|\{at\}|\s+at\s+|\s+at\s*the\s*rate\s+|\s+attherate\s+)\s*[a-z0-9-]+(?:\s*(?:\.|\(dot\)|\[dot\]|\s+dot\s+|\s+point\s+)\s*[a-z]{2,})+/;
const EMAIL_WORDS = /(?:^|[^a-z])(gmail|g mail|gmial|gmai|gmal|jimail|yahoo|yahu|hotmail|hotmial|outlook|rediff|rediffmail|icloud|protonmail|live\.com|ymail|email id|mail id|e mail|emailid|mailid)(?![a-z])/;
const AT_ADDRESS = /[a-z0-9._-]{2,}\s*@\s*[a-z]{2,}/;
const LINK =
  /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]{2,}\s*(?:\.|\(dot\)|\[dot\]|\s+dot\s+)\s*(?:com|in|net|org|co|me|io|ly|app|link|to|gg|info|xyz|site|online|page)\b(?:\/\S*)?/;
const HANDLE = /(?:^|[\s(:])@[a-z0-9_.]{3,}/;

// Asking for or offering contact, incl. short forms: "mob no", "ph no", "cntct", "nmbr", "dm me".
const ASKING =
  /\b(my|mera|meri|mere|apna|apni|your|ur|yr|aapka|aapki|apka|apki|tumhara|tera|teri|his|her|papa\s*ka|abbu\s*ka|ammi\s*ka|wali\s*ka)\s+(number|numbr|nmbr|numb|num|no\.?|nbr|mobile|mob|mobil|cell|phone|fone|phn|ph|contact|cntct|contct|email|e\s*mail|mail|id|handle|insta|whatsapp|wa|ig|fb|snap|telegram|gmail)\b|\b(call|text|txt|msg|message|ping|contact|dm|pm|inbox|whatsapp|wa)\s+(me|karo|kro|kariye|kijiye|krna|karna|kar\s*do)\b|\b(number|numbr|nmbr|no\.?|contact|id)\s+(do|dijiye|dedo|de\s*do|bhejo|bhej\s*do|share|send|batao|bata\s*do|chahiye)\b|\b(mob|mobile|ph|phone|cell|contact|whatsapp|wa)\s*(no|num|number|nmbr|#)\b|\b(dm|pm)\s+(me|kr|kar)\b|\b(outside|bahar|off)\s+(the\s+)?(app|kifaah)\b/;

export interface ContactCheck {
  blocked: boolean;
  kinds: ContactKind[];
}

export function findContactDetails(raw: string | null | undefined): ContactCheck {
  if (!raw || !raw.trim()) return { blocked: false, kinds: [] };
  const clean = baseClean(raw);
  const digits = digitView(clean);
  const words = wordView(clean);
  const squashed = words.replace(/[^a-z]/g, "");
  const kinds = new Set<ContactKind>();

  if (PHONE.test(digits) || PHONE_WITH_WORD.test(digits)) kinds.add("phone");
  if (EMAIL.test(clean) || EMAIL.test(words) || EMAIL_WORDS.test(words) || AT_ADDRESS.test(clean)) kinds.add("email");
  if (LINK.test(clean) || LINK.test(words)) kinds.add("link");
  if (HANDLE.test(clean) || SOCIAL.test(words) || SQUASHED.test(squashed) || ASKING.test(words) || ASKING.test(clean)) {
    kinds.add("social");
  }
  return { blocked: kinds.size > 0, kinds: Array.from(kinds) };
}

/**
 * Checks a new chat message together with the sender's last few messages, to
 * catch a number or ID split across several short messages.
 */
export function findContactDetailsAcross(previous: string[], next: string): ContactCheck {
  const single = findContactDetails(next);
  if (single.blocked) return single;
  if (previous.length === 0) return single;
  const joined = [...previous, next].join(" ");
  const combined = findContactDetails(joined);
  // Only a phone or email built from pieces counts here; a keyword in an
  // older message was already allowed on its own.
  const kinds = combined.kinds.filter((k) => k === "phone" || k === "email");
  return { blocked: kinds.length > 0, kinds };
}

export const CONTACT_BLOCKED_MESSAGE =
  "For everyone's safety, phone numbers, emails, links and social media IDs can't be shared on Kifaah. Contact details are shared by the app after you both accept.";
