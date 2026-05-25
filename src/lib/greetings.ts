/**
 * Köszöntő szöveg-generátor — minden névhez deterministikusan kiválaszt 6-8
 * köszöntőt a 25-25 sablonból a név hash alapján. Így ugyanazt a névre mindig
 * ugyanazokat a köszöntőket látja a user, de a 1500 név közt jól szórt.
 *
 * SEO-impact: minden /name oldalra ~600-800 új szó tartalom kerül,
 * pontosan ami a long-tail keyword-öket célozza:
 *   - "{name} napi köszöntő"
 *   - "{name} napra vers"
 *   - "{name} napi SMS"
 *   - "boldog névnapot {name} idézet"
 */

export type GreetingKind = 'short' | 'verse' | 'sms' | 'formal' | 'funny' | 'quote';
export interface Greeting {
  kind: GreetingKind;
  text: string;
}

// ── HU sablonok — {name} placeholder ────────────────────────────────────────
const HU_TEMPLATES: Array<[GreetingKind, string]> = [
  // Rövid (short)
  ['short', 'Boldog névnapot kívánok, kedves {name}! Sok boldogságot, egészséget és örömöt!'],
  ['short', 'Kedves {name}! Névnapod alkalmából minden szépet és jót kívánok!'],
  ['short', 'Hát itt van újra a Te napod, {name}! Élvezd a percet, és sok boldog évet hozzon!'],
  ['short', 'Boldog névnapot, {name}! 🌷 Ne felejtsd el, milyen különleges vagy.'],
  ['short', '{name}, légy büszke a nevedre — mert mögötte egy egyedi ember áll!'],

  // Vers (verse)
  ['verse', 'Virág bontja szirmait,\nNap mosolyog rád,\n{name}! Légy boldog ma,\nÉs lélekben szabad!'],
  ['verse', 'Sok-sok év, sok-sok mosoly,\nÉs egy {name} aki ragyog!\nBoldog névnapot néked,\nSzeretettel ölelünk!'],
  ['verse', 'Ma {name} ünnepel,\nFényes nap köszönt rád!\nLegyen boldog éveden,\nSok meleg ölelés!'],
  ['verse', 'A neved szép és csodás,\nMint egy tavaszi virág.\nBoldog névnapot, {name},\nSose hagyjon el a vidámság!'],

  // SMS rövid
  ['sms', 'Boldog névnapot, {name}! 🎉 Sok szeretettel ölellek.'],
  ['sms', '{name}! 🌹 Boldog névnapot kívánok!'],
  ['sms', 'Sok boldog névnapot, drága {name}! ❤️'],
  ['sms', 'Hé {name}! 🥳 Egy óriási BOLDOG NÉVNAPOT küldök!'],
  ['sms', 'Drága {name}, ne feledd: ma a Te napod! 💐 Boldog névnapot!'],
  ['sms', '🎂 {name}, sok-sok mosolyt és szeretetet hozzon ez a nap! Boldog névnapot!'],

  // Hivatalos (formal)
  ['formal', 'Tisztelt {name}! Engedje meg, hogy névnapja alkalmából tisztelettel köszöntsem. Egészséget, sikert és boldogságot kívánok!'],
  ['formal', 'Kedves {name}! Névnapja alkalmából őszintén kívánok sok sikert, jó egészséget és számos boldog pillanatot.'],
  ['formal', '{name}! Munkatársaim és magam nevében köszöntöm névnapja alkalmából. Erőt, egészséget, boldogságot!'],

  // Vicces (funny)
  ['funny', '{name}, ezt a tortát csak neked sütöttem! 🎂 Egy nappal idősebb vagy, de nem nézel ki annak!'],
  ['funny', 'Boldog névnapot, {name}! Maradj örökre fiatal — vagyis legalább a következő névnapig! 😂'],
  ['funny', 'Az élet olyan, mint a torta — legyen ma minden szelete a tied, {name}! 🍰'],
  ['funny', '{name}! Ne feledd: hivatalosan ma minden hibád megbocsátunk! 😉 Boldog névnapot!'],

  // Idézet (quote)
  ['quote', '"Az élet túl rövid ahhoz, hogy ne ünnepeljünk meg minden alkalmat" — kedves {name}, boldog névnapot!'],
  ['quote', '"A boldogság apró pillanatokban él" — egy ilyen pillanat a mai, {name}!'],
  ['quote', '"Aki nevet, az győz" — {name}, ma kacagjunk együtt! Boldog névnapot!'],
];

// ── EN sablonok ─────────────────────────────────────────────────────────────
const EN_TEMPLATES: Array<[GreetingKind, string]> = [
  ['short', 'Happy nameday, dear {name}! Wishing you joy, health and happiness!'],
  ['short', 'Dear {name}! On your nameday, may all good things come your way!'],
  ['short', '{name}, today is YOUR day! Enjoy every moment of it.'],
  ['short', 'Happy nameday, {name}! 🌷 Remember how special you are.'],

  ['verse', 'Flowers bloom on this fine day,\nFor {name} to dance and play.\nMay your year be filled with light,\nAnd your soul forever bright!'],
  ['verse', 'A name so sweet, a soul so kind,\n{name} — one of a kind!\nHappy nameday from the heart,\nMay joy and love never depart!'],

  ['sms', 'Happy nameday, {name}! 🎉 Sending big hugs.'],
  ['sms', '{name}! 🌹 Wishing you a wonderful nameday!'],
  ['sms', 'Many happy returns, dear {name}! ❤️'],
  ['sms', 'Hey {name}! 🥳 Sending you a HUGE happy nameday!'],
  ['sms', '🎂 {name}, may today bring smiles and love your way!'],

  ['formal', 'Dear {name}! On the occasion of your nameday, please accept my best wishes for health, success and happiness.'],
  ['formal', '{name}! On behalf of all of us, congratulations on your nameday. Wishing you strength, health and joy.'],

  ['funny', '{name}, this cake is just for you! 🎂 You\'re a day older, but you don\'t look it!'],
  ['funny', 'Happy nameday, {name}! Stay forever young — at least until next year! 😂'],
  ['funny', 'Life is like a cake — may every slice today be yours, {name}! 🍰'],

  ['quote', '"Life is too short not to celebrate every occasion" — happy nameday, {name}!'],
  ['quote', '"Happiness lives in the small moments" — today is one of those, {name}!'],
];

// Deterministic hash a név → szám
function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h) + name.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h);
}

export function getGreetings(name: string, lang: 'hu' | 'en' = 'hu', count = 8): Greeting[] {
  const templates = lang === 'hu' ? HU_TEMPLATES : EN_TEMPLATES;
  const hash = nameHash(name);
  const result: Greeting[] = [];
  const used = new Set<number>();

  // Garantálunk minimum 1-1-et minden kategóriából, ami elérhető
  const kinds: GreetingKind[] = ['short', 'verse', 'sms', 'formal', 'funny', 'quote'];
  for (const kind of kinds) {
    const indices = templates
      .map((t, i) => ({ t, i }))
      .filter((x) => x.t[0] === kind)
      .map((x) => x.i);
    if (indices.length === 0) continue;
    const idx = indices[hash % indices.length];
    used.add(idx);
    result.push({ kind: templates[idx][0], text: templates[idx][1].replace(/\{name\}/g, name) });
  }

  // Töltsük fel a maradékot véletlenszerűen
  let attempts = 0;
  while (result.length < count && attempts < 100) {
    const idx = (hash * 31 + attempts) % templates.length;
    if (!used.has(idx)) {
      used.add(idx);
      result.push({ kind: templates[idx][0], text: templates[idx][1].replace(/\{name\}/g, name) });
    }
    attempts++;
  }

  return result.slice(0, count);
}

export const KIND_LABELS_HU: Record<GreetingKind, string> = {
  short: 'Rövid köszöntő',
  verse: 'Versike',
  sms: 'SMS-be',
  formal: 'Hivatalos',
  funny: 'Vicces',
  quote: 'Idézet',
};

export const KIND_LABELS_EN: Record<GreetingKind, string> = {
  short: 'Short greeting',
  verse: 'Poem',
  sms: 'SMS',
  formal: 'Formal',
  funny: 'Funny',
  quote: 'Quote',
};
