import {
  classify, causeOfDeath, stoneLook, stats as calcStats, lifespanDays, idleDays,
  formatDuration, lastActivity, STRINGS, trAccusative,
} from "./core.js";
import { FORMATS, makePoster } from "./poster.js";
import { icon, hydrateIcons } from "./icons.js";

const UI = {
  tr: {
    brand: "Repo Graveyard",
    eyebrow: "Requiescat in Push",
    title: "Repo Graveyard",
    lede: "Terk edilmiş repoların son durağı. Bir GitHub kullanıcı adı yaz, yarım kalan hayallerin arasında dolaş.",
    placeholder: "kullanıcı adı",
    open: "Mezarlığı aç",
    deadAfter: "Ölü sayılır:",
    thresholdLabel: "Ölü sayılma süresi",
    m6: "6 ay", y1: "1 yıl", y2: "2 yıl",
    forks: "Fork'ları da göm",
    copy: "Linki kopyala", copied: "Kopyalandı",
    tweet: "X'te paylaş",
    newSearch: "Başka mezarlık",
    poster: "Poster oluştur",
    posterTitle: "Paylaşım posteri",
    download: "PNG indir",
    copyImage: "Görseli kopyala",
    imageCopied: "Kopyalandı",
    share: "Paylaş",
    posterNote: "X'te paylaşırken indirdiğin görseli tweet'e eklemeyi unutma.",
    hint: "Kaydır ya da sürükle: yürü · Taşa tıkla: oku",
    loading: "Mezarlık hazırlanıyor…",
    foot: "Sadece herkese açık repolar görünür. Veriler doğrudan GitHub'dan gelir ve tarayıcında işlenir.",
    digging: "Mezarlar kazılıyor…",
    notFound: (u) => `“${u}” diye birini bulamadık. Belki o da terk edilmiştir.`,
    rateLimit: (m) => `GitHub saatlik sınırı doldu. ${m} dakika sonra tekrar dene.`,
    netError: "GitHub'a ulaşılamadı. Bağlantını kontrol et.",
    ledgerOf: "mezarlığı",
    gateSub: "mezarlığı",
    ledgerSub: (n) => `${n} herkese açık repo tarandı`,
    buried: "Yatan repo",
    rate: "Ölüm oranı",
    oldest: "En eski ölü",
    shortest: "En kısa ömür",
    topLang: "En çok gömülen dil",
    none: "—",
    deadFor: (d) => `${d} önce öldü`,
    lived: (d) => `${d} yaşadı`,
    cause: "Ölüm sebebi",
    born: "Doğum",
    lastPush: "Son nefes",
    lifespan: "Ömrü",
    language: "Dil",
    stars: "Yıldız",
    openRepo: "GitHub'da aç",
    empty: "Burada kimse yatmıyor. Ya çok disiplinlisin ya da yeni başladın.",
    aliveTitle: "Hâlâ nefes alanlar",
    aliveBtn: (n) => `Nefes alanlar (${n})`,
    aliveSub: "Bunlara iyi bak. Sıradakiler onlar olabilir.",
    lastBreath: (d) => `${d} önce`,
    today: "bugün",
    tweetText: (n, r) => `GitHub mezarlığımda ${n} repo yatıyor, ölüm oranım %${r} 🪦\n\nSeninki kaç?`,
    tabTitle: (u) => `${u} · Repo Graveyard`,
    pct: (n) => `%${n}`,
    docTitle: "Repo Graveyard: terk edilmiş GitHub repolarını 3D mezarlıkta gez",
    posterTitle2: (u) => `${u} mezarlığı`,
    posterBuried: (d, t) => `${t} repodan ${trAccusative(d)} toprak altında`,
  },
  en: {
    brand: "Repo Graveyard",
    eyebrow: "Requiescat in Push",
    title: "Repo Graveyard",
    lede: "The final resting place of abandoned repos. Type a GitHub username and walk among the unfinished dreams.",
    placeholder: "username",
    open: "Open the graveyard",
    deadAfter: "Dead after:",
    thresholdLabel: "Time until considered dead",
    m6: "6 months", y1: "1 year", y2: "2 years",
    forks: "Bury forks too",
    copy: "Copy link", copied: "Copied",
    tweet: "Share on X",
    newSearch: "Another graveyard",
    poster: "Make a poster",
    posterTitle: "Share poster",
    download: "Download PNG",
    copyImage: "Copy image",
    imageCopied: "Copied",
    share: "Share",
    posterNote: "When sharing on X, attach the downloaded image to your post.",
    hint: "Scroll or drag to walk · Click a stone to read it",
    loading: "Preparing the graveyard…",
    foot: "Only public repos are visible. Data comes straight from GitHub and is processed in your browser.",
    digging: "Digging the graves…",
    notFound: (u) => `We couldn't find “${u}”. Maybe they were abandoned too.`,
    rateLimit: (m) => `GitHub's hourly limit is used up. Try again in ${m} minutes.`,
    netError: "Couldn't reach GitHub. Check your connection.",
    ledgerOf: "graveyard",
    gateSub: "graveyard",
    ledgerSub: (n) => `${n} public repos scanned`,
    buried: "Buried repos",
    rate: "Death rate",
    oldest: "Oldest dead",
    shortest: "Shortest life",
    topLang: "Most buried language",
    none: "—",
    deadFor: (d) => `dead for ${d}`,
    lived: (d) => `lived ${d}`,
    cause: "Cause of death",
    born: "Born",
    lastPush: "Last breath",
    lifespan: "Lifespan",
    language: "Language",
    stars: "Stars",
    openRepo: "Open on GitHub",
    empty: "Nobody rests here. Either you're very disciplined or you just started.",
    aliveTitle: "Still breathing",
    aliveBtn: (n) => `Still breathing (${n})`,
    aliveSub: "Take good care of these. They might be next.",
    lastBreath: (d) => `${d} ago`,
    today: "today",
    tweetText: (n, r) => `${n} repos rest in my GitHub graveyard. Death rate: ${r}% 🪦\n\nWhat's yours?`,
    tabTitle: (u) => `${u} · Repo Graveyard`,
    pct: (n) => `${n}%`,
    docTitle: "Repo Graveyard: walk through your abandoned GitHub repos in 3D",
    posterTitle2: (u) => `${u}'s graveyard`,
    posterBuried: (d, t) => `${d} of ${t} repos buried`,
  },
};

const LANG_COLORS = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5", Java: "#b07219",
  PHP: "#4F5D95", Vue: "#41b883", HTML: "#e34c26", CSS: "#563d7c", Go: "#00ADD8",
  Rust: "#dea584", "C#": "#178600", "C++": "#f34b7d", C: "#555555", Ruby: "#701516",
  Swift: "#F05138", Kotlin: "#A97BFF", Dart: "#00B4AB", Shell: "#89e051",
  GDScript: "#355570", SCSS: "#c6538c", Svelte: "#ff3e00", Jupyter: "#DA5B0B",
};

const $ = (s) => document.querySelector(s);
const state = {
  lang: pickLang(),
  threshold: 365,
  forks: false,
  user: null,
  profile: null,
  repos: null,
  view: null, // { dead, alive, stats }
  scene: null,
  posterFormat: "x",
};

function pickLang() {
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "tr" || q === "en") return q;
  try { const s = localStorage.getItem("rg-lang"); if (s === "tr" || s === "en") return s; } catch {}
  return "en";
}

const t = () => UI[state.lang];

function applyI18n() {
  document.documentElement.lang = state.lang;
  for (const el of document.querySelectorAll("[data-i18n]")) {
    const v = t()[el.dataset.i18n];
    if (typeof v === "string") el.textContent = v;
  }
  for (const el of document.querySelectorAll("[data-i18n-placeholder]")) el.placeholder = t()[el.dataset.i18nPlaceholder];
  for (const el of document.querySelectorAll("[data-i18n-aria]")) el.setAttribute("aria-label", t()[el.dataset.i18nAria]);
  for (const b of document.querySelectorAll(".lang button")) b.setAttribute("aria-pressed", String(b.dataset.lang === state.lang));
  document.title = state.user ? t().tabTitle(state.user) : t().docTitle;
}

function syncControls() {
  for (const b of document.querySelectorAll(".seg button")) b.setAttribute("aria-checked", String(+b.dataset.days === state.threshold));
  $("#forks").checked = state.forks;
}

function syncUrl() {
  const p = new URLSearchParams();
  if (state.user) p.set("u", state.user);
  if (state.threshold !== 365) p.set("d", state.threshold);
  if (state.forks) p.set("forks", "1");
  const q = p.toString();
  history.replaceState(null, "", q ? `?${q}` : location.pathname);
}

/* ---------- GitHub ---------- */

class GhError extends Error {
  constructor(kind, extra) { super(kind); this.kind = kind; this.extra = extra; }
}

async function gh(path) {
  let res;
  try {
    res = await fetch(`https://api.github.com${path}`, { headers: { Accept: "application/vnd.github+json" } });
  } catch {
    throw new GhError("net");
  }
  if (res.status === 404) throw new GhError("notFound");
  if (res.status === 403 || res.status === 429) {
    const reset = +res.headers.get("x-ratelimit-reset") * 1000;
    const mins = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 60000)) : 60;
    throw new GhError("rateLimit", mins);
  }
  if (!res.ok) throw new GhError("net");
  return res.json();
}

async function loadUser(user) {
  const profile = await gh(`/users/${encodeURIComponent(user)}`);
  const repos = [];
  const pages = Math.min(5, Math.ceil((profile.public_repos || 0) / 100) || 1);
  for (let page = 1; page <= pages; page++) {
    const batch = await gh(`/users/${encodeURIComponent(user)}/repos?per_page=100&type=owner&sort=pushed&page=${page}`);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return { profile, repos };
}

/* ---------- ortak ---------- */

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const year = (ms) => new Date(ms).getFullYear();
const dur = (days) => formatDuration(days, state.lang);
const fmtDate = (ms) => new Date(ms).toLocaleDateString(state.lang === "tr" ? "tr-TR" : "en-US", { year: "numeric", month: "short", day: "numeric" });

function showStatus(html, error = false) {
  const el = $("#status");
  el.hidden = false;
  el.className = "status" + (error ? " status--error" : "");
  el.innerHTML = html;
}

function computeView() {
  const now = Date.now();
  const { dead, alive } = classify(state.repos, { now, thresholdDays: state.threshold, includeForks: state.forks });
  state.view = { now, dead, alive, stats: calcStats(dead, alive) };
}

function ledgerHtml(withAvatar) {
  const T = t();
  const { stats: s, now } = state.view;
  const p = state.profile;
  const av = withAvatar && p.avatar_url ? `<img class="ledger__avatar" src="${esc(p.avatar_url)}&s=64" alt="">` : "";
  return `
    <div class="ledger__head">
      <h2 class="ledger__title">${av}<a href="${esc(p.html_url)}" target="_blank" rel="noopener">${esc(p.login)}</a> ${T.ledgerOf}</h2>
      <span class="ledger__sub">${T.ledgerSub(s.total)}</span>
    </div>
    <div class="stat"><div class="stat__label">${T.buried}</div><div class="stat__value"><span class="num">${s.dead}</span><span class="stat__of"> / ${s.total}</span></div></div>
    <div class="stat"><div class="stat__label">${T.rate}</div><div class="stat__value"><span class="num">${T.pct(s.rate)}</span></div></div>
    <div class="stat"><div class="stat__label">${T.oldest}</div><div class="stat__value stat__value--small">${s.oldest ? esc(s.oldest.name) : T.none}</div><div class="stat__hint">${s.oldest ? T.deadFor(dur(idleDays(s.oldest, now))) : "&nbsp;"}</div></div>
    <div class="stat"><div class="stat__label">${T.topLang}</div><div class="stat__value stat__value--small">${s.topLang ? esc(s.topLang[0]) : T.none}</div><div class="stat__hint">${s.topLang ? `× ${s.topLang[1]}` : "&nbsp;"}</div></div>`;
}

function aliveListHtml() {
  const T = t();
  const { alive, now } = state.view;
  return `<ul>${alive.map((r) => {
    const d = idleDays(r, now);
    return `<li><a href="${esc(r.html_url)}" target="_blank" rel="noopener"><span class="pulse"></span><span class="name">${esc(r.name)}</span><span class="when">${d < 1 ? T.today : T.lastBreath(dur(d))}</span></a></li>`;
  }).join("")}</ul>`;
}

/* ---------- 3D ---------- */

function graveFor(repo, now) {
  const look = stoneLook(repo, now);
  const cause = STRINGS[state.lang].causes[causeOfDeath(repo)];
  return {
    key: repo.full_name || repo.name,
    shape: look.shape,
    look,
    repo,
    info: {
      name: repo.name,
      years: `${year(Date.parse(repo.created_at))} — ${year(lastActivity(repo))}`,
      lived: t().lived(dur(lifespanDays(repo))),
      epitaph: repo.description ? `“${repo.description}”` : cause,
      language: repo.language,
      stars: repo.stargazers_count,
      lang: state.lang === "tr" ? "tr-TR" : "en-US",
    },
  };
}

function render3d() {
  const T = t();
  const { dead, alive, now } = state.view;
  $("#ledger").className = "ledger ledger--hud glass";
  $("#ledger").innerHTML = ledgerHtml(true);
  $("#aliveLabel").textContent = T.aliveBtn(alive.length);
  $("#aliveBtn").hidden = !alive.length;
  $("#drawer").hidden = true;
  $("#card").hidden = true;
  state.scene.setGraves(state.profile.login, T.gateSub, dead.map((r) => graveFor(r, now)));
  $("#hud").hidden = false;
  document.body.classList.add("in-yard");
  const hint = $("#hint");
  hint.classList.remove("is-gone");
  clearTimeout(hint._t);
  hint._t = setTimeout(() => hint.classList.add("is-gone"), 7000);
}

function showCard(gv, i) {
  const card = $("#card");
  if (!gv) { card.hidden = true; return; }
  const T = t();
  const r = gv.repo;
  const now = state.view.now;
  const cause = STRINGS[state.lang].causes[causeOfDeath(r)];
  const color = LANG_COLORS[r.language] || "#888";
  card.className = "card glass";
  card.innerHTML = `
    <button class="icon-btn card__close" id="cardClose" aria-label="Close">${icon("x")}</button>
    <div class="card__rip">R · I · P</div>
    <h3>${esc(r.name)}</h3>
    <div class="card__years">${gv.info.years}</div>
    ${r.description ? `<p class="card__desc">“${esc(r.description)}”</p>` : ""}
    <dl>
      <dt>${T.cause}</dt><dd>${esc(cause)}</dd>
      <dt>${T.born}</dt><dd>${fmtDate(Date.parse(r.created_at))}</dd>
      <dt>${T.lastPush}</dt><dd>${fmtDate(lastActivity(r))} · ${T.deadFor(dur(idleDays(r, now)))}</dd>
      <dt>${T.lifespan}</dt><dd>${dur(lifespanDays(r))}</dd>
      ${r.language ? `<dt>${T.language}</dt><dd><i class="dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px"></i>${esc(r.language)}</dd>` : ""}
      ${r.stargazers_count ? `<dt>${T.stars}</dt><dd>★ ${r.stargazers_count}</dd>` : ""}
    </dl>
    <div class="card__nav">
      <button class="icon-btn" id="cardPrev" aria-label="Previous">${icon("arrowLeft")}</button>
      <button class="icon-btn" id="cardNext" aria-label="Next">${icon("arrowRight")}</button>
      <span class="card__count">${i + 1} / ${state.view.dead.length}</span>
      <span class="grow"></span>
      <a class="btn btn--secondary btn--sm" href="${esc(r.html_url)}" target="_blank" rel="noopener">${T.openRepo}${icon("external")}</a>
    </div>`;
  card.hidden = false;
  $("#cardClose").onclick = () => state.scene.unfocus();
  $("#cardPrev").onclick = () => state.scene.focusIndex(i - 1);
  $("#cardNext").onclick = () => state.scene.focusIndex(i + 1);
  $("#tip").hidden = true;
}

function onHover(gv, px) {
  const tip = $("#tip");
  if (!gv || !px || !$("#card").hidden) { tip.hidden = true; return; }
  tip.textContent = gv.repo.name;
  tip.style.left = px.x + "px";
  tip.style.top = px.y + "px";
  tip.hidden = false;
}

/* ---------- 2D yedek ---------- */

const ORNAMENT = `<svg class="stone__orn" viewBox="0 0 46 10" aria-hidden="true"><path d="M1 5h16M29 5h16" stroke="currentColor" stroke-width="1.2"/><path d="M23 1l4 4-4 4-4-4z" fill="currentColor"/></svg>`;

function tombstone2d(repo, i, now) {
  const g = graveFor(repo, now);
  const cause = STRINGS[state.lang].causes[causeOfDeath(repo)];
  const color = LANG_COLORS[repo.language] || "#3a3d46";
  return `
    <a class="plot" href="${esc(repo.html_url)}" target="_blank" rel="noopener"
       style="--i:${i};--tilt:${g.look.tilt};--moss:${g.look.moss.toFixed(2)};--h:${g.look.height.toFixed(2)}">
      <div class="stone-wrap"><div class="stone stone--${g.shape}">
        <div class="stone__rip engraved">R·I·P</div>
        <h3 class="stone__name engraved">${esc(repo.name)}</h3>
        <div class="stone__years engraved">${g.info.years}</div>
        ${ORNAMENT}
        <div class="stone__lived engraved">${esc(g.info.lived)}</div>
        <p class="stone__epitaph engraved">${esc(g.info.epitaph)}</p>
        ${repo.description ? `<div class="stone__cause engraved">${esc(cause)}</div>` : ""}
        <div class="stone__base engraved">
          ${repo.language ? `<span><i class="dot" style="background:${color}"></i>${esc(repo.language)}</span>` : ""}
          ${repo.stargazers_count ? `<span>★ ${repo.stargazers_count}</span>` : ""}
        </div>
      </div></div>
      <div class="plot__grass"></div>
    </a>`;
}

function render2d() {
  const T = t();
  const { dead, alive, now } = state.view;
  $("#ledger2d").innerHTML = ledgerHtml(false);
  $("#yard").innerHTML = dead.length ? dead.map((r, i) => tombstone2d(r, i, now)).join("") : `<p class="empty">${T.empty}</p>`;
  $("#alive").innerHTML = alive.length ? `<h2>${T.aliveTitle}</h2><p class="sub">${T.aliveSub}</p>${aliveListHtml()}` : "";
  $("#results").hidden = false;
}

/* ---------- akış ---------- */

function render() {
  if (!state.repos) return;
  computeView();
  $("#status").hidden = true;
  if (state.scene) render3d();
  else render2d();
}

async function open(user) {
  user = user.trim().replace(/^@/, "").replace(/^https?:\/\/github\.com\//i, "").split("/")[0];
  if (!user) return;
  $("#username").value = user;
  showStatus(`<span class="flame"></span>${t().digging}`);
  try {
    const { profile, repos } = await loadUser(user);
    Object.assign(state, { user: profile.login, profile, repos });
    syncUrl();
    applyI18n();
    render();
    if (!state.scene) $("#ledger2d").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    const T = t();
    const msg = e.kind === "notFound" ? T.notFound(esc(user)) : e.kind === "rateLimit" ? T.rateLimit(e.extra) : T.netError;
    showStatus(msg, true);
  }
}

function backToLanding() {
  state.user = null;
  state.repos = null;
  syncUrl();
  applyI18n();
  document.body.classList.remove("in-yard");
  $("#hud").hidden = true;
  $("#card").hidden = true;
  $("#drawer").hidden = true;
  $("#tip").hidden = true;
  $("#status").hidden = true;
  state.scene?.showLanding();
  setTimeout(() => $("#username").focus(), 300);
}

/* ---------- poster ---------- */

let posterBlob = null;

function shareUrl() {
  const u = new URL(location.href);
  u.search = "";
  u.searchParams.set("u", state.user);
  return u.toString();
}

async function buildPoster() {
  const img = $("#posterImg");
  const wait = $("#posterWait");
  for (const b of document.querySelectorAll(".poster__tabs button")) b.setAttribute("aria-selected", String(b.dataset.format === state.posterFormat));
  wait.hidden = false;
  img.style.opacity = 0.3;
  await new Promise((r) => requestAnimationFrame(() => r()));
  const T = { ...t(), posterTitle: t().posterTitle2 };
  const canvas = await makePoster(state.scene, {
    format: state.posterFormat, profile: state.profile, stats: state.view.stats, T, url: shareUrl(),
  });
  posterBlob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
  img.src = URL.createObjectURL(posterBlob);
  img.style.opacity = 1;
  wait.hidden = true;
  $("#tweet").href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(t().tweetText(state.view.stats.dead, state.view.stats.rate))}&url=${encodeURIComponent(shareUrl())}`;
  const file = new File([posterBlob], "poster.png", { type: "image/png" });
  $("#posterShare").hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
}

function posterFileName() {
  return `repo-graveyard-${state.user}-${state.posterFormat}.png`;
}

$("#posterBtn").addEventListener("click", () => {
  $("#posterDlg").showModal();
  buildPoster();
});
for (const b of document.querySelectorAll(".poster__tabs button")) {
  b.addEventListener("click", () => { state.posterFormat = b.dataset.format; buildPoster(); });
}
$("#posterDownload").addEventListener("click", () => {
  if (!posterBlob) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(posterBlob);
  a.download = posterFileName();
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
$("#posterCopy").addEventListener("click", async () => {
  if (!posterBlob) return;
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": posterBlob })]);
    const label = $("#posterCopy span");
    label.textContent = t().imageCopied;
    setTimeout(() => (label.textContent = t().copyImage), 1600);
  } catch {}
});
$("#posterShare").addEventListener("click", async () => {
  if (!posterBlob) return;
  const file = new File([posterBlob], posterFileName(), { type: "image/png" });
  try {
    await navigator.share({ files: [file], text: t().tweetText(state.view.stats.dead, state.view.stats.rate), url: shareUrl() });
  } catch {}
});

/* ---------- olaylar ---------- */

$("#form").addEventListener("submit", (e) => { e.preventDefault(); open($("#username").value); });

for (const b of document.querySelectorAll(".seg button")) {
  b.addEventListener("click", () => { state.threshold = +b.dataset.days; syncControls(); syncUrl(); render(); });
}
$("#forks").addEventListener("change", (e) => { state.forks = e.target.checked; syncUrl(); render(); });

for (const b of document.querySelectorAll(".lang button")) {
  b.addEventListener("click", () => {
    state.lang = b.dataset.lang;
    try { localStorage.setItem("rg-lang", state.lang); } catch {}
    applyI18n();
    render();
  });
}

$("#copy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(shareUrl()); } catch { return; }
  const b = $("#copy");
  const label = b.querySelector("span");
  label.textContent = t().copied;
  setTimeout(() => (label.textContent = t().copy), 1600);
});

$("#newSearch").addEventListener("click", backToLanding);
$("#home").addEventListener("click", (e) => {
  if (!state.scene || !state.user) return;
  e.preventDefault();
  backToLanding();
});

$("#aliveBtn").addEventListener("click", () => {
  const d = $("#drawer");
  if (!d.hidden) { d.hidden = true; return; }
  d.className = "drawer glass";
  d.innerHTML = `<h2>${t().aliveTitle}</h2><p class="sub">${t().aliveSub}</p>${aliveListHtml()}`;
  d.hidden = false;
});

addEventListener("keydown", (e) => {
  const sc = state.scene;
  if (!sc || !state.user || $("#posterDlg").open) return;
  if (e.target.closest("input, textarea")) return;
  const k = e.key;
  if (k === "Escape") { sc.unfocus(); $("#drawer").hidden = true; }
  else if (k === "ArrowRight" && sc.mode === "focus") sc.focusIndex(sc.focus.userData.index + 1);
  else if (k === "ArrowLeft" && sc.mode === "focus") sc.focusIndex(sc.focus.userData.index - 1);
  else if (k === "ArrowUp" || k === "w") sc.walk(-1.2);
  else if (k === "ArrowDown" || k === "s") sc.walk(1.2);
  else if (k === "Enter" && sc.mode !== "focus" && sc.stones.length) {
    // en yakın taşa bak
    let best = 0, bd = Infinity;
    sc.stones.forEach((s, i) => { const d = Math.abs(s.position.z - (sc.camZ - 2.5)); if (d < bd) { bd = d; best = i; } });
    sc.focusIndex(best);
  } else return;
  e.preventDefault();
});

/* ---------- başlangıç ---------- */

async function boot() {
  hydrateIcons();
  const params = new URLSearchParams(location.search);
  if ([182, 365, 730].includes(+params.get("d"))) state.threshold = +params.get("d");
  state.forks = params.get("forks") === "1";
  applyI18n();
  syncControls();

  let three = null;
  if (params.get("2d") !== "1") {
    try {
      three = await import("./scene.js");
      if (!three.webglAvailable()) three = null;
    } catch (e) {
      console.warn("3D yüklenemedi, 2D görünüm kullanılacak", e);
      three = null;
    }
  }

  if (three) {
    document.body.classList.add("is3d");
    const loader = $("#loader");
    loader.hidden = false;
    const scene = new three.Graveyard($("#scene"), {
      onHover,
      onSelect: (gv, i) => showCard(gv, i),
      onProgress: (p) => ($("#loaderBar").style.width = `${Math.round(p * 100)}%`),
    });
    try {
      await scene.init();
      state.scene = scene;
      window.__graveyard = scene; // hata ayıklama için
    } catch (e) {
      console.warn("3D başlatılamadı", e);
      document.body.classList.remove("is3d");
    }
    loader.hidden = true;
  }

  if (params.get("u")) {
    await open(params.get("u"));
    // hata ayıklama: ?debugZ=-6 ya da ?debugFocus=0
    const dz = params.get("debugZ"), df = params.get("debugFocus");
    if (state.scene && dz) setTimeout(() => { state.scene.mode = "walk"; state.scene.walk(+dz - state.scene.targetZ); }, 500);
    if (state.scene && df) setTimeout(() => state.scene.focusIndex(+df), 500);
  }
}

boot();
