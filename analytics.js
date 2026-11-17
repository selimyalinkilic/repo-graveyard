// Google Analytics 4 — kaç kişi geliyor, kaçı mezarlık açıyor, kaçı poster indiriyor/paylaşıyor.
// GA_ID boşken hiçbir şey yüklenmez (site aynen çalışır). Kimlik: analytics.google.com > Mülk > Veri akışı > Web.
// Kişisel veri gönderilmez: GitHub kullanıcı adı olaya yazılmaz, sadece sayılar (ölü/toplam repo) ve dil.
export const GA_ID = "G-EBBRPZX05H";

let ready = false;

export function initAnalytics() {
  if (!GA_ID || ready || location.hostname === "localhost" || location.hostname === "127.0.0.1") return;
  ready = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { anonymize_ip: true });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
}

export function track(name, params = {}) {
  if (ready && window.gtag) window.gtag("event", name, params);
}
