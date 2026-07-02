// Prosedyre-genererte piksel-sprites — ingen binærfiler nødvendig.
// Alt tegnes på små offscreen-canvaser i verdens-pikselskala (1 world px = 1 buffer px),
// slik at det blir skarp pixel art når skjermbufferen skaleres opp i CSS.
// Scenery lagres som ARRAYS av varianter pr. type (ASSETS.scenery[type][variant]).

const ASSETS = { cars: {}, scenery: {} };

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return c;
}

// ---- Biler ----------------------------------------------------------------
// Top-down bil som peker mot HØYRE (heading = 0 = +x). 36×18, detaljert m/ skygge.
function buildCarSprite(colors, shape) {
  shape = shape || "balansert";
  const W = 36, H = 18;
  const c = makeCanvas(W, H);
  const ctx = c.getContext("2d");
  const px = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };

  const fatWheel = shape === "rally" ? 1 : 0;
  // Hjul (mørke) m/ nav-høylys
  for (const wx of [7, 25]) {
    px(wx, 0 - fatWheel, 7, 3 + fatWheel, "#171717");
    px(wx, H - 3, 7, 3 + fatWheel, "#171717");
    px(wx + 1, 1, 5, 1, "#3a3a3a");
    px(wx + 1, H - 2, 5, 1, "#3a3a3a");
  }

  // Karosseri
  if (shape === "racer") {
    px(4, 3, 28, 12, colors.body);
    px(3, 5, 31, 8, colors.body);
    px(30, 6, 6, 6, colors.body);            // lang, smal nese
    px(2, 1, 6, 2, colors.dark);             // bakvinge
    px(2, H - 3, 6, 2, colors.dark);
  } else if (shape === "rally") {
    px(3, 2, 30, 14, colors.body);           // stubben, høyere hytte
    px(2, 4, 32, 10, colors.body);
    px(33, 6, 2, 6, colors.body);
  } else {
    px(3, 3, 30, 12, colors.body);
    px(2, 5, 32, 8, colors.body);
    px(33, 6, 2, 6, colors.body);
  }

  // Skygge/høylys-kanter
  px(3, H - 4, 30, 1, colors.dark);
  px(3, 3, 30, 1, colors.light);

  // Frontpanser + lykter
  px(33, 5, 2, 8, colors.dark);
  px(34, 5, 1, 2, "#ffe9a8");
  px(34, 11, 1, 2, "#ffe9a8");

  // Cockpit / frontrute + fører
  const cabX = shape === "rally" ? 13 : 15;
  px(cabX, 4, 8, 10, "#13202b");
  px(cabX + 1, 5, 6, 8, "#3d6f8a");
  px(cabX + 2, 7, 3, 4, colors.helmet || "#d8d8d8");

  // Taklys (rally)
  if (shape === "rally") {
    px(24, 6, 2, 1, "#ffe9a8");
    px(24, 11, 2, 1, "#ffe9a8");
  }

  // Midtstripe
  px(2, H / 2 - 1, 31, 2, colors.stripe);
  return c;
}

// Pre-render N rotasjonsframes (skarpe akse-justerte blits). S = 48 (rom for 36-diagonal).
function buildCarFrames(colors, count, shape) {
  count = count || 32;
  const base = buildCarSprite(colors, shape);
  const S = 48;
  const frames = [];
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2;
    const cv = makeCanvas(S, S);
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.translate(S / 2, S / 2);
    ctx.rotate(ang);
    ctx.drawImage(base, -Math.round(base.width / 2), -Math.round(base.height / 2));
    frames.push(cv);
  }
  return { base, frames, count, size: S };
}

function frameIndex(set, heading) {
  const i = Math.round((heading / (Math.PI * 2)) * set.count);
  return ((i % set.count) + set.count) % set.count;
}

// ---- Nordisk scenery (varianter) -----------------------------------------
const _blob = (ctx, x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };

// Bjørk: hvit bark m/ svarte merker, lys løvkrone (én høst-variant)
function buildBirch(v) {
  const C = CONFIG, scale = 1 + v * 0.18;
  const w = Math.round(20 * scale), h = Math.round(34 * scale);
  const c = makeCanvas(w, h), ctx = c.getContext("2d");
  const cx = w / 2;
  // stamme
  ctx.fillStyle = C.COL_BIRCH_BARK; ctx.fillRect(cx - 2, h - 16, 4, 16);
  ctx.fillStyle = C.COL_BIRCH_MARK;
  for (let y = h - 14; y < h - 2; y += 4) ctx.fillRect(cx - 2, y, 3, 1);
  // krone
  const leaf = v === 2 ? C.COL_AUTUMN : C.COL_BIRCH_LEAF;
  _blob(ctx, cx, 13, 9 * scale, leaf);
  _blob(ctx, cx - 5, 10, 6 * scale, leaf);
  _blob(ctx, cx + 5, 11, 6 * scale, leaf);
  _blob(ctx, cx, 8, 6 * scale, v === 2 ? "#e0953a" : "#a4c46e");
  return c;
}

// Furu: høy rødbrun stamme, sparsomme runde blågrønne tufser
function buildPineN(v) {
  const C = CONFIG, scale = 1 + v * 0.2;
  const w = Math.round(18 * scale), h = Math.round(40 * scale);
  const c = makeCanvas(w, h), ctx = c.getContext("2d");
  const cx = w / 2;
  ctx.fillStyle = "#6e4a2a"; ctx.fillRect(cx - 2, h - 24, 4, 24);
  ctx.fillStyle = "#8a5e38"; ctx.fillRect(cx - 2, h - 24, 1, 24);
  _blob(ctx, cx, 9, 8 * scale, C.COL_PINE);
  _blob(ctx, cx - 4, 15, 5 * scale, C.COL_PINE);
  _blob(ctx, cx + 4, 16, 5 * scale, C.COL_PINE);
  _blob(ctx, cx, 7, 5 * scale, "#3f7259");
  return c;
}

// Gran: stablede trekanter, dyp grønn, snø-dryss på én variant
function buildSpruce(v) {
  const C = CONFIG, scale = 1 + v * 0.16;
  const w = Math.round(22 * scale), h = Math.round(38 * scale);
  const c = makeCanvas(w, h), ctx = c.getContext("2d");
  const cx = w / 2;
  ctx.fillStyle = "#5a3a1e"; ctx.fillRect(cx - 1, h - 6, 3, 6);
  const tri = (cy, half, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - half, cy + half * 1.3); ctx.lineTo(cx + half, cy + half * 1.3); ctx.closePath(); ctx.fill(); };
  const tiers = [[3, 11], [9, 9], [15, 7]];
  for (const [cy, half] of tiers) {
    tri(cy, half * scale, C.COL_SPRUCE);
    ctx.fillStyle = C.COL_SPRUCE_HI; ctx.beginPath();
    ctx.moveTo(cx, cy); ctx.lineTo(cx - half * scale, cy + half * 1.3 * scale); ctx.lineTo(cx, cy + half * 1.3 * scale); ctx.closePath(); ctx.fill();
  }
  if (v === 2) { ctx.fillStyle = C.COL_SNOW; for (const [cy] of tiers) ctx.fillRect(cx - 1, cy + 1, 3, 2); }
  return c;
}

// Stein/kampestein: granitt m/ høylys + skygge, mose-variant
function buildBoulder(v) {
  const C = CONFIG, scale = 1 + v * 0.3;
  const w = Math.round(18 * scale), h = Math.round(15 * scale);
  const c = makeCanvas(w, h), ctx = c.getContext("2d");
  ctx.fillStyle = C.COL_GRANITE; ctx.fillRect(2, 4, w - 4, h - 4);
  ctx.fillStyle = C.COL_GRANITE_HI; ctx.fillRect(3, 4, (w - 6) * 0.6, 4);
  ctx.fillStyle = C.COL_GRANITE_SH; ctx.fillRect(2, h - 4, w - 4, 2);
  ctx.fillStyle = C.COL_GRANITE_SH; ctx.fillRect((w - 4) * 0.7, 6, 4, 5);
  if (v === 1) { ctx.fillStyle = "#3f6b34"; ctx.fillRect(3, 4, 5, 2); ctx.fillRect(w - 7, 5, 4, 2); }
  return c;
}

// Tømmerhus: lafteplank-vegg, torvtak, vindu + dør
function buildCabin(v) {
  const C = CONFIG;
  const w = 32, h = 26;
  const c = makeCanvas(w, h), ctx = c.getContext("2d");
  // vegg (laftekurser)
  ctx.fillStyle = C.COL_LOG; ctx.fillRect(3, 10, w - 6, h - 10);
  ctx.fillStyle = C.COL_LOG_HI;
  for (let y = 11; y < h - 1; y += 3) ctx.fillRect(3, y, w - 6, 1);
  // torvtak
  ctx.fillStyle = C.COL_SOD; ctx.beginPath(); ctx.moveTo(1, 11); ctx.lineTo(w / 2, 2); ctx.lineTo(w - 1, 11); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#4a6a30"; ctx.fillRect(1, 10, w - 2, 2);
  // dør + vindu
  ctx.fillStyle = "#5a3a1e"; ctx.fillRect(13, 17, 6, 9);
  ctx.fillStyle = "#ffe9a8"; ctx.fillRect(6, 14, 4, 4);
  ctx.fillStyle = (v === 1) ? "#cfe6ff" : "#ffe9a8"; ctx.fillRect(22, 14, 4, 4);
  return c;
}

// Fjell/berg: granittflate m/ lag og snøtopp
function buildCliff(v) {
  const C = CONFIG, scale = 1 + v * 0.4;
  const w = Math.round(46 * scale), h = Math.round(40 * scale);
  const c = makeCanvas(w, h), ctx = c.getContext("2d");
  const cx = w / 2;
  ctx.fillStyle = C.COL_GRANITE_SH; ctx.beginPath();
  ctx.moveTo(cx, 2); ctx.lineTo(2, h - 1); ctx.lineTo(w - 2, h - 1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.COL_GRANITE; ctx.beginPath();
  ctx.moveTo(cx, 2); ctx.lineTo(cx - w * 0.32, h - 1); ctx.lineTo(cx + w * 0.18, h - 1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.COL_GRANITE_HI; ctx.fillRect(cx - 2, 6, 3, h - 10);
  // snøtopp
  ctx.fillStyle = C.COL_SNOW; ctx.beginPath();
  ctx.moveTo(cx, 2); ctx.lineTo(cx - 7, 12); ctx.lineTo(cx + 6, 11); ctx.closePath(); ctx.fill();
  return c;
}

function buildVariants(fn, n) { const a = []; for (let i = 0; i < n; i++) a.push(fn(i)); return a; }

function buildAssets() {
  for (const spec of CAR_SPECS) ASSETS.cars[spec.id] = buildCarFrames(spec.colors, 32, spec.shape);
  ASSETS.liveries = AI_LIVERIES.map((liv) => buildCarFrames(liv, 32, "balansert"));

  ASSETS.scenery.birch = buildVariants(buildBirch, 3);
  ASSETS.scenery.pine = buildVariants(buildPineN, 3);
  ASSETS.scenery.spruce = buildVariants(buildSpruce, 3);
  ASSETS.scenery.boulder = buildVariants(buildBoulder, 3);
  ASSETS.scenery.cabin = buildVariants(buildCabin, 2);
  ASSETS.scenery.cliff = buildVariants(buildCliff, 2);
}
