import test from "node:test";
import assert from "node:assert/strict";
import {
  classify, causeOfDeath, stoneLook, stats, formatDuration, trAccusative,
  CAUSES, STRINGS, SHAPES, DAY,
} from "../core.js";

const NOW = Date.parse("2026-11-16T00:00:00Z");
const ago = (days) => new Date(NOW - days * DAY).toISOString();
const repo = (o = {}) => ({
  name: "proje", full_name: "u/proje", created_at: ago(900), pushed_at: ago(800),
  size: 120, fork: false, archived: false, stargazers_count: 0, open_issues_count: 0,
  language: "JavaScript", description: null, ...o,
});

test("her ölüm sebebinin TR ve EN metni var", () => {
  for (const lang of ["tr", "en"]) for (const k of CAUSES) assert.ok(STRINGS[lang].causes[k], `${lang}.${k}`);
});

test("causeOfDeath her zaman bilinen bir anahtar döner", () => {
  const names = ["todo-app", "my-blog", "portfolio", "netflix-clone", "hello-world", "x", "Raf", "çay"];
  for (const name of names) for (const extra of [{}, { size: 0 }, { archived: true }, { pushed_at: ago(899.9) }, { open_issues_count: 3 }, { stargazers_count: 50 }]) {
    assert.ok(CAUSES.includes(causeOfDeath(repo({ name, full_name: `u/${name}`, ...extra }))), name);
  }
});

test("causeOfDeath kural önceliği", () => {
  assert.equal(causeOfDeath(repo({ archived: true, name: "todo" })), "archived");
  assert.equal(causeOfDeath(repo({ size: 0, name: "todo" })), "stillborn");
  assert.equal(causeOfDeath(repo({ name: "netflix-clone" })), "identity");
  assert.equal(causeOfDeath(repo({ name: "todolist" })), "todo");
  assert.equal(causeOfDeath(repo({ name: "personal-portfolio" })), "portfolio");
});

test("aynı repo her seferinde aynı sebebi ve taşı alır", () => {
  const r = repo({ name: "kararli" });
  assert.equal(causeOfDeath(r), causeOfDeath({ ...r }));
  assert.deepEqual(stoneLook(r, NOW), stoneLook({ ...r }, NOW));
});

test("stoneLook değerleri sınırlar içinde", () => {
  for (let i = 0; i < 200; i++) {
    const l = stoneLook(repo({ name: `r${i}`, full_name: `u/r${i}`, pushed_at: ago(i * 20) }), NOW);
    assert.ok(SHAPES.includes(l.shape));
    assert.ok(l.tilt >= -3 && l.tilt <= 3);
    assert.ok(l.moss >= 0 && l.moss <= 1);
    assert.ok(l.height >= 0.85 && l.height <= 1.15);
  }
});

test("classify: eşik, fork ve arşiv", () => {
  const repos = [
    repo({ name: "eski", pushed_at: ago(400) }),
    repo({ name: "yeni", pushed_at: ago(10) }),
    repo({ name: "fork", fork: true, pushed_at: ago(900) }),
    repo({ name: "arsiv", archived: true, pushed_at: ago(5) }),
  ];
  const a = classify(repos, { now: NOW, thresholdDays: 365 });
  assert.deepEqual(a.dead.map((r) => r.name).sort(), ["arsiv", "eski"]);
  assert.deepEqual(a.alive.map((r) => r.name), ["yeni"]);
  const b = classify(repos, { now: NOW, thresholdDays: 365, includeForks: true });
  assert.ok(b.dead.some((r) => r.name === "fork"));
  // her repo ya ölü ya canlı, ikisi birden değil
  assert.equal(b.dead.length + b.alive.length, repos.length);
});

test("pushed_at null olan repo çökmez", () => {
  const r = repo({ pushed_at: null });
  const { dead } = classify([r], { now: NOW });
  assert.equal(dead.length, 1);
  assert.ok(CAUSES.includes(causeOfDeath(r)));
});

test("stats: oran ve boş liste", () => {
  assert.equal(stats([], []).rate, 0);
  const s = stats([repo(), repo({ language: "Go" }), repo()], [repo()]);
  assert.equal(s.rate, 75);
  assert.deepEqual(s.topLang, ["JavaScript", 2]);
});

test("formatDuration", () => {
  assert.equal(formatDuration(0.2, "tr"), "bir günden az");
  assert.equal(formatDuration(1, "en"), "1 day");
  assert.equal(formatDuration(60, "tr"), "2 ay");
  assert.equal(formatDuration(365, "en"), "1 year");
  assert.equal(formatDuration(365 * 2.5, "tr"), "2.5 yıl");
});

test("Türkçe belirtme hâli eki", () => {
  const cases = { 1: "1'i", 2: "2'si", 3: "3'ü", 4: "4'ü", 5: "5'i", 6: "6'sı", 7: "7'si", 8: "8'i", 9: "9'u",
    10: "10'u", 18: "18'i", 20: "20'yi", 30: "30'u", 40: "40'ı", 50: "50'yi", 60: "60'ı", 70: "70'i", 80: "80'i", 90: "90'ı",
    100: "100'ü", 1000: "1000'i", 0: "0'ı", 26: "26'sı", 47: "47'si" };
  for (const [n, want] of Object.entries(cases)) assert.equal(trAccusative(+n), want, n);
});
