// Bane: senterlinje (Catmull-Rom-glattet), arc-lengde-progresjon, off-track-deteksjon,
// kurvatur (AI), diskrete barrierer + grid, for-rendret verdens-canvas (nordisk pixel art),
// persistent skid-lag + gress-spor-lag, og cachet minimap.

class Track {
  constructor() {
    this.controls = [
      { x: 360, y: 250 }, { x: 820, y: 190 }, { x: 1240, y: 250 },
      { x: 1520, y: 470 }, { x: 1470, y: 760 }, { x: 1150, y: 900 },
      { x: 760, y: 870 }, { x: 470, y: 950 }, { x: 220, y: 740 },
      { x: 200, y: 460 },
    ];
    this.halfWidth = CONFIG.TRACK_HALF_WIDTH;
    this.laps = CONFIG.LAPS;

    this.waypoints = this._buildWaypoints();
    this._buildSegments();
    this._buildCurvature();
    this._placeScenery();
    this._placeBarriers();     // edge-poster + scenery-kolliderere
    this._buildBarrierGrid();
    this._renderWorld();
    this._buildMinimap();
  }

  _buildWaypoints() {
    const cp = this.controls, n = cp.length, out = [];
    const cr = (p0, p1, p2, p3, t) => {
      const t2 = t * t, t3 = t2 * t;
      return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    };
    for (let i = 0; i < n; i++) {
      const p0 = cp[(i - 1 + n) % n], p1 = cp[i], p2 = cp[(i + 1) % n], p3 = cp[(i + 2) % n];
      const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(2, Math.round(segLen / CONFIG.WAYPOINT_SPACING));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        out.push({ x: cr(p0.x, p1.x, p2.x, p3.x, t), y: cr(p0.y, p1.y, p2.y, p3.y, t) });
      }
    }
    return out;
  }

  _buildSegments() {
    const wp = this.waypoints, n = wp.length;
    this.segs = []; this.segLens = []; this.segS = [];
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const a = wp[i], b = wp[(i + 1) % n];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      this.segs.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y });
      this.segLens.push(len); this.segS.push(acc); acc += len;
    }
    this.totalLen = acc;

    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const p of wp) { minx = Math.min(minx, p.x); miny = Math.min(miny, p.y); maxx = Math.max(maxx, p.x); maxy = Math.max(maxy, p.y); }
    const pad = this.halfWidth + CONFIG.BOUNDARY_OFFSET + 110;
    this.minX = minx - pad; this.minY = miny - pad;
    this.worldW = Math.ceil(maxx - minx + pad * 2);
    this.worldH = Math.ceil(maxy - miny + pad * 2);
  }

  _buildCurvature() {
    const n = this.waypoints.length;
    this.curvature = new Array(n);
    for (let i = 0; i < n; i++) this.curvature[i] = Math.abs(angleNorm(this.headingAt(i) - this.headingAt((i - 1 + n) % n)));
  }

  // jevn kurvatur over et lite vindu (mot flimmer)
  smoothCurv(i) {
    const n = this.curvature.length;
    let k = 0; for (let o = -2; o <= 2; o++) k += this.curvature[(i + o + n) % n];
    return k / 5;
  }

  get numWaypoints() { return this.waypoints.length; }

  maxCurvatureAhead(seg, count) {
    const n = this.curvature.length;
    let m = 0; for (let k = 0; k <= count; k++) m = Math.max(m, this.curvature[(seg + k) % n]);
    return m;
  }

  arcLength(segIndex, t) { return this.segS[segIndex] + t * this.segLens[segIndex]; }

  nearestOnCenter(x, y) {
    let best = 1e18, bx = x, by = y, bi = 0, bt = 0;
    const segs = this.segs;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const dx = s.bx - s.ax, dy = s.by - s.ay;
      const len2 = dx * dx + dy * dy || 1;
      let t = ((x - s.ax) * dx + (y - s.ay) * dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = s.ax + t * dx, py = s.ay + t * dy;
      const d = (x - px) * (x - px) + (y - py) * (y - py);
      if (d < best) { best = d; bx = px; by = py; bi = i; bt = t; }
    }
    return { x: bx, y: by, dist: Math.sqrt(best), segIndex: bi, t: bt };
  }

  // Windowed lokal-søk; faller bare tilbake til full skanning ved ekte teleport (utenfor ytre ring).
  nearestOnCenterNear(x, y, hint, window = 12) {
    const segs = this.segs, n = segs.length;
    let best = 1e18, bx = x, by = y, bi = hint, bt = 0;
    for (let o = -window; o <= window; o++) {
      const i = ((hint + o) % n + n) % n;
      const s = segs[i];
      const dx = s.bx - s.ax, dy = s.by - s.ay;
      const len2 = dx * dx + dy * dy || 1;
      let t = ((x - s.ax) * dx + (y - s.ay) * dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = s.ax + t * dx, py = s.ay + t * dy;
      const d = (x - px) * (x - px) + (y - py) * (y - py);
      if (d < best) { best = d; bx = px; by = py; bi = i; bt = t; }
    }
    const dist = Math.sqrt(best);
    if (dist > this.halfWidth + CONFIG.BOUNDARY_OFFSET + 20) return this.nearestOnCenter(x, y);
    return { x: bx, y: by, dist, segIndex: bi, t: bt };
  }

  distanceToCenter(x, y) { return this.nearestOnCenter(x, y).dist; }
  isOnTrack(x, y) { return this.distanceToCenter(x, y) <= this.halfWidth; }

  nearestWaypoint(x, y) {
    let best = 0, bestD = 1e18;
    const wp = this.waypoints;
    for (let i = 0; i < wp.length; i++) {
      const dx = wp[i].x - x, dy = wp[i].y - y, d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  headingAt(i) {
    const wp = this.waypoints, n = wp.length;
    const a = wp[i % n], b = wp[(i + 1) % n];
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  startPositions(count) {
    const dir = this.headingAt(0);
    const nx = Math.cos(dir), ny = Math.sin(dir);
    const px = -Math.sin(dir), py = Math.cos(dir);
    const start = this.waypoints[0];
    const out = [];
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / 2), col = i % 2;
      const back = 22 + row * 30;
      const side = (col === 0 ? -1 : 1) * 20;
      out.push({ x: start.x - nx * back + px * side, y: start.y - ny * back + py * side, heading: dir });
    }
    return out;
  }

  // --- Scenery (nordisk, med varianter). Inkluderer SYNLIGE kant-barrierer (stein). ---
  _placeScenery() {
    this.scenery = [];
    let seed = 1337;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const hw = this.halfWidth, B = CONFIG.BOUNDARY_OFFSET, n = this.waypoints.length;

    // Synlig steinrekke langs begge kanter (= barriere), med gap på innersiden av svinger (snarveier)
    const BR = hw + CONFIG.BARRIER_OFFSET;
    const stepN = Math.max(1, Math.round(CONFIG.BARRIER_SPACING / CONFIG.WAYPOINT_SPACING));
    for (let i = 0; i < n; i += stepN) {
      const dir = this.headingAt(i), px = -Math.sin(dir), py = Math.cos(dir);
      const k = this.smoothCurv(i);
      const turnSign = angleNorm(this.headingAt((i + 6) % n) - dir) >= 0 ? 1 : -1;
      for (const sgn of [-1, 1]) {
        if (sgn === turnSign && k > CONFIG.SHORTCUT_CURV && rnd() < CONFIG.SHORTCUT_GAP_CHANCE) continue;
        this.scenery.push({ x: this.waypoints[i].x + px * sgn * BR, y: this.waypoints[i].y + py * sgn * BR, type: "boulder", variant: (rnd() * 3) | 0, edge: true });
      }
    }

    // Skogsbelte (utenfor steinrekka, holder snarvei-lanene åpne)
    let tries = 0;
    while (this.scenery.length < 380 && tries < 16000) {
      tries++;
      const x = this.minX + rnd() * this.worldW, y = this.minY + rnd() * this.worldH;
      const d = this.distanceToCenter(x, y);
      if (d > hw + CONFIG.BARRIER_OFFSET + 18 && d < hw + B - 40) {
        const r = rnd();
        let type;
        if (d > hw + 190) type = r < 0.55 ? "spruce" : r < 0.8 ? "pine" : "boulder";
        else type = r < 0.42 ? "birch" : r < 0.72 ? "spruce" : r < 0.88 ? "boulder" : "pine";
        this.scenery.push({ x, y, type, variant: (rnd() * 3) | 0 });
      }
    }
    // Fjell/berg langs vannkanten (ytre ring)
    for (let i = 0; i < n; i += 6) {
      const dir = this.headingAt(i), px = -Math.sin(dir), py = Math.cos(dir);
      for (const sgn of [-1, 1]) {
        const r = hw + B - 10 + rnd() * 90;
        this.scenery.push({ x: this.waypoints[i].x + px * sgn * r, y: this.waypoints[i].y + py * sgn * r, type: "cliff", variant: (rnd() * 2) | 0 });
      }
    }
    // Tømmerhus nær start/mål
    const dir0 = this.headingAt(0), px0 = -Math.sin(dir0), py0 = Math.cos(dir0), s0 = this.waypoints[0];
    this.scenery.push({ x: s0.x + px0 * (hw + 150) + Math.cos(dir0) * 50, y: s0.y + py0 * (hw + 150) + Math.sin(dir0) * 50, type: "cabin", variant: 0 });
    this.scenery.push({ x: s0.x - px0 * (hw + 170) - Math.cos(dir0) * 40, y: s0.y - py0 * (hw + 170) - Math.sin(dir0) * 40, type: "cabin", variant: 1 });

    this.scenery.sort((a, b) => a.y - b.y);
  }

  // --- Barrierer (kollisjon) bygges fra scenery (radius = stamme/base, ikke kronen) ---
  _placeBarriers() {
    this.barriers = [];
    const R = { boulder: 10, spruce: 7, pine: 6, birch: 4, cabin: 13, cliff: 16 };
    for (const o of this.scenery) {
      const r = R[o.type] || 0;
      if (r > 0) this.barriers.push({ kind: "circle", x: o.x, y: o.y, r });
    }
  }

  _buildBarrierGrid() {
    this.barCell = CONFIG.BARRIER_CELL;
    this.barGW = Math.ceil(this.worldW / this.barCell);
    this.barGrid = new Map();
    const put = (gx, gy, idx) => {
      if (gx < 0 || gy < 0 || gx >= this.barGW) return;
      const key = gy * this.barGW + gx;
      let a = this.barGrid.get(key); if (!a) this.barGrid.set(key, a = []); a.push(idx);
    };
    this.barriers.forEach((b, idx) => {
      let minx, miny, maxx, maxy;
      if (b.kind === "circle") { minx = b.x - b.r; maxx = b.x + b.r; miny = b.y - b.r; maxy = b.y + b.r; }
      else { minx = Math.min(b.x1, b.x2) - b.r; maxx = Math.max(b.x1, b.x2) + b.r; miny = Math.min(b.y1, b.y2) - b.r; maxy = Math.max(b.y1, b.y2) + b.r; }
      const gx0 = ((minx - this.minX) / this.barCell) | 0, gx1 = ((maxx - this.minX) / this.barCell) | 0;
      const gy0 = ((miny - this.minY) / this.barCell) | 0, gy1 = ((maxy - this.minY) / this.barCell) | 0;
      for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) put(gx, gy, idx);
    });
    this._barSeen = new Set();
  }

  barriersNear(x, y) {
    const gx = ((x - this.minX) / this.barCell) | 0, gy = ((y - this.minY) / this.barCell) | 0;
    const out = [], seen = this._barSeen; seen.clear();
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const a = this.barGrid.get((gy + dy) * this.barGW + (gx + dx)); if (!a) continue;
      for (const idx of a) if (!seen.has(idx)) { seen.add(idx); out.push(this.barriers[idx]); }
    }
    return out;
  }

  // --- For-render verden (nordisk) ---
  _renderWorld() {
    const c = makeCanvas(this.worldW, this.worldH);
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const hw = this.halfWidth, corridor = hw + CONFIG.BOUNDARY_OFFSET;

    let seed = 99;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    // Fjord (alt utenfor gress-korridoren)
    ctx.fillStyle = CONFIG.COL_FJORD;
    ctx.fillRect(0, 0, this.worldW, this.worldH);

    const pathThrough = (lw, style) => {
      ctx.lineWidth = lw; ctx.strokeStyle = style; ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.beginPath();
      const wp = this.waypoints;
      ctx.moveTo(wp[0].x - this.minX, wp[0].y - this.minY);
      for (let i = 1; i <= wp.length; i++) { const p = wp[i % wp.length]; ctx.lineTo(p.x - this.minX, p.y - this.minY); }
      ctx.closePath(); ctx.stroke();
    };

    pathThrough(corridor * 2 + 30, CONFIG.COL_DIRT);   // sand-strand
    pathThrough(corridor * 2, CONFIG.COL_GRASS);        // gress-korridor
    pathThrough(hw * 2 + 16, CONFIG.COL_DIRT);          // bane-skulder
    pathThrough(hw * 2 + 2, "#e9e9e9");                 // hvit kantlinje
    pathThrough(hw * 2 - 4, "#5b5e63");                 // asfalt

    // Speckle: gress, vann og asfalt
    const N = (this.worldW * this.worldH / 130) | 0;
    for (let i = 0; i < N; i++) {
      const x = (rnd() * this.worldW) | 0, y = (rnd() * this.worldH) | 0;
      const d = this.distanceToCenter(x + this.minX, y + this.minY);
      if (d < hw - 3) { if (rnd() > 0.5) { ctx.fillStyle = rnd() > 0.5 ? "#62656a" : "#54575c"; ctx.fillRect(x, y, 2, 2); } }
      else if (d < corridor) { ctx.fillStyle = CONFIG.COL_GRASS2; ctx.fillRect(x, y, 2, 2); }
      else { if (rnd() > 0.6) { ctx.fillStyle = CONFIG.COL_FJORD_HI; ctx.fillRect(x, y, 2, 1); } }
    }

    this._drawCurbs(ctx);
    this._drawFinishLine(ctx);

    for (const o of this.scenery) {
      const set = ASSETS.scenery[o.type]; if (!set) continue;
      const spr = set[o.variant % set.length];
      ctx.drawImage(spr, Math.round(o.x - this.minX - spr.width / 2), Math.round(o.y - this.minY - spr.height));
    }

    this.worldCanvas = c;

    // Persistent skid-lag + gress-spor-lag
    this.skidCanvas = makeCanvas(this.worldW, this.worldH);
    this.skidCtx = this.skidCanvas.getContext("2d"); this.skidCtx.imageSmoothingEnabled = false;
    this.rutCanvas = makeCanvas(this.worldW, this.worldH);
    this.rutCtx = this.rutCanvas.getContext("2d"); this.rutCtx.imageSmoothingEnabled = false;
    this.rutGW = Math.ceil(this.worldW / CONFIG.RUT_CELL);
    this.rutWear = new Float32Array(this.rutGW * Math.ceil(this.worldH / CONFIG.RUT_CELL));
  }

  _drawCurbs(ctx) {
    const wp = this.waypoints, n = wp.length, sq = 7;
    for (let i = 0; i < n; i++) {
      if (this.smoothCurv(i) < 0.045) continue;
      const dir = this.headingAt(i), px = -Math.sin(dir), py = Math.cos(dir);
      const cx = wp[i].x - this.minX, cy = wp[i].y - this.minY, edge = this.halfWidth - 4;
      for (const sgn of [-1, 1]) {
        ctx.save();
        ctx.translate(cx + px * sgn * edge, cy + py * sgn * edge); ctx.rotate(dir);
        ctx.fillStyle = i % 2 === 0 ? "#d62828" : "#eeeeee";
        ctx.fillRect(-sq / 2, -3, sq, 6); ctx.restore();
      }
    }
  }

  _drawFinishLine(ctx) {
    const dir = this.headingAt(0), px = -Math.sin(dir), py = Math.cos(dir);
    const start = this.waypoints[0], cx = start.x - this.minX, cy = start.y - this.minY;
    const sq = 6, rows = 2;
    for (let r = -Math.floor(this.halfWidth / sq); r < Math.floor(this.halfWidth / sq); r++) {
      for (let k = 0; k < rows; k++) {
        ctx.fillStyle = (r + k) % 2 === 0 ? "#f0f0f0" : "#222";
        const bx = cx + px * r * sq + Math.cos(dir) * (k * sq), by = cy + py * r * sq + Math.sin(dir) * (k * sq);
        ctx.save(); ctx.translate(bx, by); ctx.rotate(dir); ctx.fillRect(-sq / 2, -sq / 2, sq, sq); ctx.restore();
      }
    }
  }

  // Cachet minimap-banelinje (slipper å stroke hundrevis av segmenter hver frame)
  _buildMinimap() {
    const mw = 70, mh = 50;
    const s = Math.min(mw / this.worldW, mh / this.worldH);
    const ox = (mw - this.worldW * s) / 2, oy = (mh - this.worldH * s) / 2;
    const cv = makeCanvas(mw, mh), ctx = cv.getContext("2d");
    ctx.strokeStyle = "#8a8f96"; ctx.lineWidth = 1; ctx.beginPath();
    const wp = this.waypoints;
    for (let i = 0; i <= wp.length; i++) {
      const p = wp[i % wp.length];
      const X = ox + (p.x - this.minX) * s, Y = oy + (p.y - this.minY) * s;
      i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
    }
    ctx.stroke();
    this.mini = { canvas: cv, s, ox, oy, w: mw, h: mh };
  }

  bakeSkid(x, y, heading, intensity) {
    const ctx = this.skidCtx, px = -Math.sin(heading), py = Math.cos(heading);
    ctx.fillStyle = "rgba(22,22,26," + (0.16 * Math.min(1, intensity)).toFixed(3) + ")";
    for (const sgn of [-1, 1]) {
      const bx = x - this.minX + px * sgn * 5, by = y - this.minY + py * sgn * 5;
      ctx.fillRect(Math.round(bx - 1.5), Math.round(by - 1.5), 3, 3);
    }
  }

  // Gress-spor: akkumulerer med trafikk, men metter pr. celle (blir aldri svart)
  bakeRut(x, y, heading) {
    const gx = ((x - this.minX) / CONFIG.RUT_CELL) | 0, gy = ((y - this.minY) / CONFIG.RUT_CELL) | 0;
    if (gx < 0 || gy < 0 || gx >= this.rutGW) return;
    const idx = gy * this.rutGW + gx;
    const w = this.rutWear[idx];
    if (w >= CONFIG.RUT_CAP) return;
    this.rutWear[idx] = Math.min(CONFIG.RUT_CAP, w + CONFIG.RUT_GAIN * (1 - w / CONFIG.RUT_CAP));
    const ctx = this.rutCtx, px = -Math.sin(heading), py = Math.cos(heading);
    ctx.fillStyle = "rgba(138,122,85," + CONFIG.RUT_STAMP_ALPHA.toFixed(3) + ")";
    for (const sgn of [-1, 1]) {
      const bx = x - this.minX + px * sgn * 5, by = y - this.minY + py * sgn * 5;
      ctx.fillRect(Math.round(bx - 2), Math.round(by - 2), 4, 4);
    }
  }
}
