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

// Tegn en top-down bil som peker mot HØYRE (heading = 0 = +x).
// w = lengde, h = bredde.
function buildCarSprite(colors) {
  const w = 30, h = 16;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  const px = (x, y, ww, hh, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, ww, hh); };

  // Hjul (mørke), stikker litt utenfor karosseriet
  px(4, 0, 6, 3, "#1a1a1a");
  px(4, h - 3, 6, 3, "#1a1a1a");
  px(20, 0, 6, 3, "#1a1a1a");
  px(20, h - 3, 6, 3, "#1a1a1a");

  // Karosseri
  px(2, 3, w - 5, h - 6, colors.body);
  px(1, 5, w - 3, h - 10, colors.body);     // litt avrundet front/bak
  // Skygge/kant
  px(2, h - 4, w - 5, 1, colors.dark);
  px(2, 3, w - 5, 1, colors.light);

  // Frontpanser-detalj + lykter
  px(w - 4, 4, 2, h - 8, colors.dark);
  px(w - 2, 4, 1, 2, "#ffe9a8");
  px(w - 2, h - 6, 1, 2, "#ffe9a8");

  // Cockpit / frontrute
  px(13, 4, 7, h - 8, "#13202b");
  px(14, 5, 5, h - 10, "#3d6f8a");
  // Hjelm / fører
  px(15, 6, 3, h - 12, colors.helmet || "#d8d8d8");

  // Stripe langs midten
  px(2, h / 2 - 1, w - 6, 2, colors.stripe);

  return c;
}

function buildBush() {
  const c = makeCanvas(20, 16);
  const ctx = c.getContext("2d");
  const blob = (x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
  blob(7, 9, 6, "#2c5e2a");
  blob(13, 8, 6, "#347033");
  blob(10, 11, 6, "#285526");
  blob(9, 7, 4, "#3f8c3b");
  return c;
}

function buildRock() {
  const c = makeCanvas(18, 14);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#7a7d82"; ctx.fillRect(2, 4, 14, 8);
  ctx.fillStyle = "#9a9da2"; ctx.fillRect(3, 4, 10, 4);
  ctx.fillStyle = "#5f6166"; ctx.fillRect(2, 10, 14, 2);
  ctx.fillStyle = "#6c6f74"; ctx.fillRect(11, 6, 5, 5);
  return c;
}

function buildTree() {
  const c = makeCanvas(26, 26);
  const ctx = c.getContext("2d");
  const blob = (x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
  // høstløv
  blob(13, 13, 10, "#8a3b1e");
  blob(9, 10, 7, "#b5531f");
  blob(17, 11, 7, "#c9772a");
  blob(13, 9, 6, "#d99a3c");
  blob(13, 16, 7, "#7a3318");
  return c;
}

function buildAssets() {
  // Biler bygges fra specs (specs.js må være lastet før dette kalles).
  for (const spec of CAR_SPECS) {
    ASSETS.cars[spec.id] = buildCarSprite(spec.colors);
  }
  ASSETS.scenery.bush = buildBush();
  ASSETS.scenery.rock = buildRock();
  ASSETS.scenery.tree = buildTree();
}
