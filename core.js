// Saf mantık: DOM yok, ağ yok. Hem tarayıcıda hem node testlerinde çalışır.

export const DAY = 86_400_000;

const time = (s) => (s ? Date.parse(s) : NaN);

/** Son push zamanı; boş repolarda pushed_at null olabilir. */
export function lastActivity(repo) {
  const t = time(repo.pushed_at);
  return Number.isFinite(t) ? t : time(repo.created_at);
}

export function lifespanDays(repo) {
  return Math.max(0, (lastActivity(repo) - time(repo.created_at)) / DAY);
}

export function idleDays(repo, now = Date.now()) {
  return Math.max(0, (now - lastActivity(repo)) / DAY);
}

/** Deterministik string hash: aynı repo her seferinde aynı taşı ve yazıyı alır. */
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Repoları ölü / canlı diye ayırır. Arşivlenmiş repo her zaman ölüdür. */
export function classify(repos, { now = Date.now(), thresholdDays = 365, includeForks = false } = {}) {
  const dead = [];
  const alive = [];
  for (const r of repos) {
    if (r.fork && !includeForks) continue;
    if (r.archived || idleDays(r, now) >= thresholdDays) dead.push(r);
    else alive.push(r);
  }
  dead.sort((a, b) => lastActivity(a) - lastActivity(b)); // en eski ölü önce
  alive.sort((a, b) => lastActivity(b) - lastActivity(a));
  return { dead, alive };
}

const PATTERNS = [
  [/clone|copy|kopya/i, "identity"],
  [/todo|to-do/i, "todo"],
  [/portfolio|portfolyo|personal-site|resume|\bcv\b/i, "portfolio"],
  [/blog/i, "blog"],
  [/test|demo|example|sample|deneme|tutorial|learn|practice|playground|hello/i, "learning"],
];

const SAME_DAY = ["sameDay", "oneCommit", "firstLast"];

const GENERIC = ["shiny", "weekend", "motivation", "framework", "later"];

/** Ölüm sebebi anahtarı. Sıra önemli: en spesifik kural önce. */
export function causeOfDeath(repo) {
  if (repo.archived) return "archived";
  if ((repo.size ?? 0) === 0) return "stillborn";
  for (const [re, key] of PATTERNS) if (re.test(repo.name)) return key;
  if (lifespanDays(repo) < 1) return SAME_DAY[hash(repo.full_name || repo.name) % SAME_DAY.length];
  if ((repo.open_issues_count ?? 0) > 0) return "issues";
  if ((repo.stargazers_count ?? 0) >= 10) return "loved";
  return GENERIC[hash(repo.full_name || repo.name) % GENERIC.length];
}

/** Taşın görünümü: şekil hash'ten, yosun ve çatlak terk süresinden. */
export const SHAPES = ["round", "arch", "gothic", "slab", "obelisk"];

export function stoneLook(repo, now = Date.now()) {
  const h = hash(repo.full_name || repo.name);
  const years = idleDays(repo, now) / 365;
  return {
    shape: SHAPES[h % SHAPES.length],
    tilt: ((h >>> 8) % 7) - 3, // -3..3 derece
    moss: Math.min(1, years / 5), // 5 yılda tamamen yosunlu
    cracked: years >= 3,
    height: 0.85 + ((h >>> 4) % 30) / 100, // 0.85..1.14
  };
}

export function stats(dead, alive) {
  const counted = dead.length + alive.length;
  const langs = {};
  for (const r of dead) if (r.language) langs[r.language] = (langs[r.language] || 0) + 1;
  const topLang = Object.entries(langs).sort((a, b) => b[1] - a[1])[0] || null;
  const shortest = dead.length
    ? dead.reduce((m, r) => (lifespanDays(r) < lifespanDays(m) ? r : m))
    : null;
  return {
    total: counted,
    dead: dead.length,
    alive: alive.length,
    rate: counted ? Math.round((dead.length / counted) * 100) : 0,
    oldest: dead[0] || null,
    shortest,
    topLang,
  };
}

/** "3 ay", "2 yıl", "1 gün" gibi kaba süre. */
export function formatDuration(days, lang = "tr") {
  const t = STRINGS[lang].units;
  if (days < 1) return t.lessThanDay;
  if (days < 30) {
    const n = Math.round(days);
    return `${n} ${t.day(n)}`;
  }
  if (days < 365) {
    const n = Math.max(1, Math.round(days / 30));
    return `${n} ${t.month(n)}`;
  }
  const y = Math.round((days / 365) * 10) / 10;
  return `${Number.isInteger(y) ? y : y.toFixed(1)} ${t.year(y)}`;
}

export const CAUSES = [
  "archived", "stillborn", ...SAME_DAY, "identity", "todo", "portfolio", "blog",
  "learning", "issues", "loved", ...GENERIC,
];

export const STRINGS = {
  tr: {
    units: {
      lessThanDay: "bir günden az",
      day: () => "gün",
      month: () => "ay",
      year: () => "yıl",
    },
    causes: {
      archived: "Huzur içinde arşivlendi",
      stillborn: "Boş doğdu, tek satır yazılmadı",
      sameDay: "Doğduğu gün terk edildi",
      oneCommit: "Tek commit'lik bir ömür",
      firstLast: "İlk push'u, son push'u oldu",
      identity: "Kimlik bunalımı: başkasının kopyasıydı",
      todo: "Dünyanın bir todo uygulamasına daha ihtiyacı yoktu",
      portfolio: "Yeni portfolyo yüzünden terk edildi",
      blog: "İlk yazıdan sonra bir daha açılmadı",
      learning: "Öğrenirken gitti",
      issues: "Cevapsız issue'ların altında kaldı",
      loved: "Sevildi ama yetmedi",
      shiny: "Daha parlak bir fikir çıkageldi",
      weekend: "Hafta sonu projesiydi, pazartesi geldi",
      motivation: "Motivasyon yetmezliği",
      framework: "Yeni bir framework çıktı",
      later: "“Sonra devam ederim” dendi",
    },
  },
  en: {
    units: {
      lessThanDay: "less than a day",
      day: (n) => (n === 1 ? "day" : "days"),
      month: (n) => (n === 1 ? "month" : "months"),
      year: (n) => (n === 1 ? "year" : "years"),
    },
    causes: {
      archived: "Archived in peace",
      stillborn: "Born empty, never a single line",
      sameDay: "Abandoned the day it was born",
      oneCommit: "A one-commit life",
      firstLast: "Its first push was its last",
      identity: "Identity crisis: it was someone else's copy",
      todo: "The world didn't need another todo app",
      portfolio: "Replaced by a newer portfolio",
      blog: "Never opened again after the first post",
      learning: "Lost while learning",
      issues: "Buried under unanswered issues",
      loved: "Loved, but not enough",
      shiny: "A shinier idea came along",
      weekend: "A weekend project, then Monday came",
      motivation: "Motivation failure",
      framework: "A new framework came out",
      later: "“I'll get back to it later”",
    },
  },
};

/** Sayıya Türkçe belirtme hâli eki: 18'i, 3'ü, 6'sı, 20'yi, 100'ü. */
export function trAccusative(n) {
  n = Math.abs(Math.trunc(n));
  if (n === 0) return "0'ı";
  const ONES = ["", "i", "yi", "ü", "ü", "i", "yı", "yi", "i", "u"];
  const TENS = ["", "u", "yi", "u", "ı", "yi", "ı", "i", "i", "ı"];
  let suffix;
  if (n % 10) suffix = ONES[n % 10];
  else if (n % 100) suffix = TENS[(n % 100) / 10];
  else if (n % 1000) suffix = "ü"; // yüz
  else if (n % 1_000_000) suffix = "i"; // bin
  else suffix = "u"; // milyon
  // ünlüyle biten sayılardan sonra kaynaştırma: iki→'si, altı→'sı, yedi→'si
  if (suffix === "yi" && n % 10) suffix = "si";
  if (suffix === "yı") suffix = "sı";
  return `${n}'${suffix}`;
}
