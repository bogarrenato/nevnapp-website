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

  // Rímes versek (verse)
  ['verse', 'Ma öröm csillan az arcodon,\nvirág nyílik névnapodon.\n{name}, legyen fény az utadon,\nszeretet kísérjen minden napodon!'],
  ['verse', 'Csengjen dal és nyíljon virág,\nmosolyogjon rád az egész világ.\n{name}, teljesüljön minden álmod,\nszerencse kísérje minden vágyod!'],
  ['verse', '{name}, ma rád ragyog az ég,\nhozzon örömöt, békét még.\nLegyen a szívedben sok remény,\nkísérjen utadon tiszta fény!'],
  ['verse', 'Kertben nyílik száz szál virág,\n{name}, téged köszönt ma a világ.\nMosoly üljön mindig arcodon,\nboldogság legyen minden napodon!'],
  ['verse', 'Névnapodon száll a jókívánság,\nkörülötted legyen mosoly és virág.\n{name}, legyen vidám minden álmod,\nöröm tegye széppé a világod!'],
  ['verse', 'Boldog névnapot, {name}, szívből kívánom,\nöröm kísérjen minden kis világon.\nLegyen előtted fényes az út,\nbánat ma hozzád sose jut!'],
  ['verse', '{name}, ez a nap most rólad szól,\ncsendül a dal, a jókedv dalol.\nLegyen szíved könnyű, vidám,\nöröm ragyogjon rád igazán!'],
  ['verse', 'Neved ma ünnepi virág,\nszeretettel néz rád a világ.\n{name}, legyen áldott minden napod,\nöröm tegye széppé minden holnapod!'],
  ['verse', 'Ma a nap is szebben ragyog,\nszívedben az öröm nagyot dobog.\n{name}, jó szerencse járjon veled,\nboldogság töltse meg az életed!'],
  ['verse', 'Szálljon hozzád sok-sok jó,\nlegyen minden perced ragyogó.\n{name}, ma csak rólad szól a dal,\nboldogságod messze szárnyal!'],
  ['verse', 'Hozzon a reggel derűt, fényt,\na délután sok szép reményt.\n{name}, este is mosoly várjon,\nszeretet legyen minden álmon!'],
  ['verse', 'Névnapodra csokor virág,\nveled nevet ma a világ.\n{name}, szívből azt kívánom,\nöröm kísérjen minden világon!'],

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

  ['verse', 'Flowers bloom on this bright day,\n{name}, may joy come your way.\nMay your year be full of light,\nand every dream be warm and bright!'],
  ['verse', 'A name so sweet, a heart so kind,\n{name}, you are one of a kind.\nHappy nameday, bright and true,\nmay every good thing come to you!'],
  ['verse', 'Let laughter ring and candles glow,\nlet every happy feeling grow.\n{name}, may your nameday shine,\nwith joy and love in every line!'],
  ['verse', 'The sky is clear, the day is bright,\n{name}, may your heart feel light.\nMay luck and laughter stay with you,\nand every wish you make come true!'],

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
  verse: 'Rímes versike',
  sms: 'SMS-be',
  formal: 'Hivatalos',
  funny: 'Vicces',
  quote: 'Idézet',
};

export const KIND_LABELS_EN: Record<GreetingKind, string> = {
  short: 'Short greeting',
  verse: 'Rhyming poem',
  sms: 'SMS',
  formal: 'Formal',
  funny: 'Funny',
  quote: 'Quote',
};
