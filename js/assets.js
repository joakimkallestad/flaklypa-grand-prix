// Prosedyre-genererte piksel-sprites — ingen binærfiler nødvendig.
// Alt tegnes på små offscreen-canvaser i verdens-pikselskala (1 world px = 1 buffer px),
// slik at det blir skarp pixel art når skjermbufferen skaleres opp i CSS.

const ASSETS = { cars: {}, scenery: {} };

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return c;
}

// Tegn en top-down bil som peker mot HØYRE (heading = 0 = +x). w = lengde, h = bredde.
function buildCarSprite(colors) {
  const w = 30, h = 16;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  const px = (x, y, ww, hh, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, ww, hh); };

  px(4, 0, 6, 3, "#1a1a1a"); px(4, h - 3, 6, 3, "#1a1a1a");
  px(20, 0, 6, 3, "#1a1a1a"); px(20, h - 3, 6, 3, "#1a1a1a");

  px(2, 3, w - 5, h - 6, colors.body);
  px(1, 5, w - 3, h - 10, colors.body);
  px(2, h - 4, w - 5, 1, colors.dark);
  px(2, 3, w - 5, 1, colors.light);

  px(w - 4, 4, 2, h - 8, colors.dark);
  px(w - 2, 4, 1, 2, "#ffe9a8"); px(w - 2, h - 6, 1, 2, "#ffe9a8");

  px(13, 4, 7, h - 8, "#13202b");
  px(14, 5, 5, h - 10, "#3d6f8a");
  px(15, 6, 3, h - 12, colors.helmet || "#d8d8d8");

  px(2, h / 2 - 1, w - 6, 2, colors.stripe);
  return c;
}

// Pre-render N rotasjonsframes fra en base-sprite → knivskarpe, akse-justerte blits.
function buildCarFrames(colors, count = 32) {
  const base = buildCarSprite(colors);
  const S = 40; // ramme stor nok til diagonal
  const frames = [];
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2;
    const c = makeCanvas(S, S);
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.translate(S / 2, S / 2);
    ctx.rotate(ang);
    ctx.drawImage(base, -Math.round(base.width / 2), -Math.round(base.height / 2));
    frames.push(c);
  }
  return { base, frames, count, size: S };
}

function frameIndex(set, heading) {
  const i = Math.round((heading / (Math.PI * 2)) * set.count);
  return ((i % set.count) + set.count) % set.count;
}

function buildBush() {
  const c = makeCanvas(20, 16), ctx = c.getContext("2d");
  const blob = (x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
  blob(7, 11, 6, "#2c5e2a"); blob(13, 10, 6, "#347033"); blob(10, 13, 6, "#285526"); blob(9, 9, 4, "#3f8c3b");
  return c;
}
function buildRock() {
  const c = makeCanvas(18, 14), ctx = c.getContext("2d");
  ctx.fillStyle = "#7a7d82"; ctx.fillRect(2, 6, 14, 8);
  ctx.fillStyle = "#9a9da2"; ctx.fillRect(3, 6, 10, 4);
  ctx.fillStyle = "#5f6166"; ctx.fillRect(2, 12, 14, 2);
  ctx.fillStyle = "#6c6f74"; ctx.fillRect(11, 8, 5, 5);
  return c;
}
function buildTree() {
  const c = makeCanvas(26, 30), ctx = c.getContext("2d");
  ctx.fillStyle = "#5b3a1a"; ctx.fillRect(12, 22, 4, 8); // stamme
  const blob = (x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
  blob(13, 13, 10, "#8a3b1e"); blob(9, 10, 7, "#b5531f"); blob(17, 11, 7, "#c9772a"); blob(13, 9, 6, "#d99a3c"); blob(13, 16, 7, "#7a3318");
  return c;
}
function buildPine() {
  const c = makeCanvas(20, 30), ctx = c.getContext("2d");
  ctx.fillStyle = "#5b3a1a"; ctx.fillRect(9, 24, 3, 6);
  const tri = (cy, w, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(10, cy); ctx.lineTo(10 - w, cy + 9); ctx.lineTo(10 + w, cy + 9); ctx.closePath(); ctx.fill(); };
  tri(2, 9, "#1f5130"); tri(8, 8, "#236236"); tri(14, 7, "#2a7340");
  return c;
}
function buildBarn() {
  const c = makeCanvas(30, 24), ctx = c.getContext("2d");
  ctx.fillStyle = "#7a1d1d"; ctx.fillRect(3, 10, 24, 14);   // vegg
  ctx.fillStyle = "#9c2a2a"; ctx.fillRect(3, 10, 24, 3);
  ctx.fillStyle = "#3a3f45"; ctx.beginPath(); ctx.moveTo(1, 11); ctx.lineTo(15, 2); ctx.lineTo(29, 11); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#e8e2d2"; ctx.fillRect(12, 16, 6, 8);    // dør
  ctx.fillStyle = "#e8e2d2"; ctx.fillRect(6, 14, 3, 3); ctx.fillRect(21, 14, 3, 3);
  return c;
}

function buildAssets() {
  for (const spec of CAR_SPECS) {
    ASSETS.cars[spec.id] = buildCarFrames(spec.colors);
  }
  // AI-liveries bakes én gang og gjenbrukes på tvers av løp (immutable frames)
  ASSETS.liveries = AI_LIVERIES.map((liv) => buildCarFrames(liv));
  ASSETS.scenery.bush = buildBush();
  ASSETS.scenery.rock = buildRock();
  ASSETS.scenery.tree = buildTree();
  ASSETS.scenery.pine = buildPine();
  ASSETS.scenery.barn = buildBarn();
}
