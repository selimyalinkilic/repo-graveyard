// Kullanıcıya özel paylaşım posteri: 3D sahneden kare + istatistikler.

export const FORMATS = {
  x: { w: 1200, h: 675, label: "X / Twitter" },
  ig: { w: 1080, h: 1350, label: "Instagram" },
  story: { w: 1080, h: 1920, label: "Story" },
};

function loadImage(src) {
  return new Promise((res) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

function fitFont(g, text, font, size, maxW, min = 18) {
  let s = size;
  g.font = font.replace("{s}", s);
  while (g.measureText(text).width > maxW && s > min) {
    s -= 2;
    g.font = font.replace("{s}", s);
  }
  return s;
}

function tombIcon(g, x, y, s, color) {
  g.save();
  g.translate(x, y);
  g.scale(s / 64, s / 64);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(14, 60);
  g.lineTo(14, 26);
  g.arc(32, 26, 18, Math.PI, 0);
  g.lineTo(50, 60);
  g.closePath();
  g.fill();
  g.strokeStyle = "#0a0d1a";
  g.lineWidth = 4;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(32, 22); g.lineTo(32, 40);
  g.moveTo(25, 29); g.lineTo(39, 29);
  g.stroke();
  g.restore();
}

/**
 * @param scene  Graveyard örneği (capture metodu olan)
 * @param opts   { format, profile, stats, T, url }
 */
export async function makePoster(scene, { format = "x", profile, stats, T, url }) {
  const { w, h } = FORMATS[format];
  const shot = scene.capture(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  g.drawImage(shot, 0, 0);

  const portrait = h > w;
  const u = w / 1200; // ölçek birimi
  const pad = Math.round((portrait ? 72 : 56) * (portrait ? w / 1080 : u));
  const serif = '"Cormorant Garamond", Georgia, serif';
  const sans = "Inter, system-ui, sans-serif";
  const mono = '"JetBrains Mono", Menlo, monospace';

  // karartmalar: üstte hafif, altta yazı alanı için güçlü
  let gr = g.createLinearGradient(0, 0, 0, h * 0.22);
  gr.addColorStop(0, "rgba(5,6,14,0.75)");
  gr.addColorStop(1, "rgba(5,6,14,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h * 0.22);
  const startY = portrait ? h * 0.46 : h * 0.34;
  gr = g.createLinearGradient(0, startY, 0, h);
  gr.addColorStop(0, "rgba(6,7,16,0)");
  gr.addColorStop(0.45, "rgba(6,7,16,0.82)");
  gr.addColorStop(1, "rgba(6,7,16,0.97)");
  g.fillStyle = gr;
  g.fillRect(0, startY, w, h - startY);
  if (!portrait) {
    gr = g.createLinearGradient(0, 0, w * 0.6, 0);
    gr.addColorStop(0, "rgba(6,7,16,0.55)");
    gr.addColorStop(1, "rgba(6,7,16,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, w * 0.6, h);
  }

  const S = portrait ? w / 1080 : u; // tipografi ölçeği

  // üst: marka
  tombIcon(g, pad, pad - 6 * S, 34 * S, "#b6b9c1");
  g.font = `600 ${26 * S}px ${serif}`;
  g.fillStyle = "#d9d3c4";
  g.textBaseline = "middle";
  g.fillText(T.brand, pad + 44 * S, pad + 11 * S);
  g.font = `italic 500 ${24 * S}px ${serif}`;
  g.fillStyle = "#f6b95c";
  g.textAlign = "right";
  g.fillText("Requiescat in Push", w - pad, pad + 11 * S);
  g.textAlign = "left";
  g.textBaseline = "alphabetic";

  // alt blok
  const maxW = w - pad * 2;
  let y = h - pad;

  // altbilgi: link
  g.font = `400 ${(portrait ? 26 : 19) * S}px ${mono}`;
  g.fillStyle = "rgba(236,230,214,0.55)";
  g.fillText(url.replace(/^https?:\/\//, ""), pad, y);
  y -= (portrait ? 64 : 44) * S;

  // ayrıntılar
  const details = [
    stats.oldest && [T.oldest, `${stats.oldest.name} · ${new Date(stats.oldest.created_at).getFullYear()}`],
    stats.shortest && [T.shortest, stats.shortest.name],
    stats.topLang && [T.topLang, stats.topLang[0]],
  ].filter(Boolean);
  const detailSize = (portrait ? 30 : 20) * S;
  if (portrait) {
    for (const [k, v] of details.reverse()) {
      g.font = `600 ${detailSize * 0.62}px ${sans}`;
      g.fillStyle = "rgba(185,179,198,0.85)";
      g.fillText(k.toLocaleUpperCase(), pad, y - detailSize * 1.05);
      g.font = `600 ${detailSize * 1.25}px ${serif}`;
      g.fillStyle = "#ece6d6";
      g.fillText(v, pad, y);
      y -= detailSize * 2.6;
    }
    y -= 10 * S;
  } else {
    const colW = maxW / 3;
    details.forEach(([k, v], i) => {
      const x = pad + i * colW;
      g.font = `600 ${12.5 * S}px ${sans}`;
      g.fillStyle = "rgba(185,179,198,0.85)";
      g.fillText(k.toLocaleUpperCase(), x, y - 28 * S);
      g.fillStyle = "#ece6d6";
      fitFont(g, v, `600 {s}px ${serif}`, 26 * S, colW - 24 * S, 14);
      g.fillText(v, x, y);
    });
    y -= 72 * S;
    g.strokeStyle = "rgba(236,230,214,0.14)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(pad, y + 18 * S);
    g.lineTo(w - pad, y + 18 * S);
    g.stroke();
    y -= 14 * S;
  }

  // büyük sayı
  const big = T.pct(stats.rate);
  const bigSize = (portrait ? 230 : 150) * S;
  g.font = `700 ${bigSize}px ${serif}`;
  const bigGrad = g.createLinearGradient(0, y - bigSize * 0.8, 0, y);
  bigGrad.addColorStop(0, "#ffd99a");
  bigGrad.addColorStop(1, "#e8913f");
  g.fillStyle = bigGrad;
  g.shadowColor = "rgba(246,185,92,0.35)";
  g.shadowBlur = 40 * S;
  g.fillText(big, pad - 6 * S, y);
  g.shadowBlur = 0;
  const bigW = g.measureText(big).width;

  // büyük sayının yanı (yatay) ya da altı (dikey)
  if (portrait) {
    y -= bigSize * 0.86;
  } else {
    const x = pad + bigW + 26 * S;
    g.font = `600 ${15 * S}px ${sans}`;
    g.fillStyle = "rgba(185,179,198,0.9)";
    g.fillText(T.rate.toLocaleUpperCase(), x, y - 66 * S);
    g.font = `600 ${38 * S}px ${serif}`;
    g.fillStyle = "#ece6d6";
    g.fillText(T.posterBuried(stats.dead, stats.total), x, y - 18 * S);
    y -= bigSize * 0.86;
  }
  if (portrait) {
    g.font = `600 ${44 * S}px ${serif}`;
    g.fillStyle = "#ece6d6";
    g.fillText(T.posterBuried(stats.dead, stats.total), pad, y + bigSize * 0.86 + 64 * S);
  }

  // başlık: avatar + kullanıcı
  y -= (portrait ? 40 : 18) * S;
  const av = profile.avatar_url ? await loadImage(`${profile.avatar_url}${profile.avatar_url.includes("?") ? "&" : "?"}s=160`) : null;
  const avS = (portrait ? 92 : 64) * S;
  let tx = pad;
  if (av) {
    g.save();
    g.beginPath();
    g.arc(pad + avS / 2, y - avS / 2 + 8 * S, avS / 2, 0, Math.PI * 2);
    g.closePath();
    g.clip();
    g.drawImage(av, pad, y - avS + 8 * S, avS, avS);
    g.restore();
    g.strokeStyle = "rgba(236,230,214,0.35)";
    g.lineWidth = 2 * S;
    g.beginPath();
    g.arc(pad + avS / 2, y - avS / 2 + 8 * S, avS / 2, 0, Math.PI * 2);
    g.stroke();
    tx += avS + 20 * S;
  }
  const title = T.posterTitle(profile.login);
  const ts = fitFont(g, title, `700 {s}px ${serif}`, (portrait ? 64 : 50) * S, w - tx - pad, 24);
  g.fillStyle = "#fbf6ea";
  g.fillText(title, tx, y - avS / 2 + 8 * S + ts * 0.32);

  // ince çerçeve
  g.strokeStyle = "rgba(236,230,214,0.10)";
  g.lineWidth = 2;
  g.strokeRect(pad * 0.4, pad * 0.4, w - pad * 0.8, h - pad * 0.8);

  return c;
}
