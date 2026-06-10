// Bane: senterlinje (Catmull-Rom-glattet), off-track-deteksjon, rundetelling,
// og en for-rendret "verdens-canvas" med pikselgrafikk (asfalt, kanter, gress, dekor).

class Track {
  constructor() {
    // Kontrollpunkter for en lukket bane (verdenskoordinater).
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
    this._placeScenery();
    this._renderWorld();
  }

  // --- Catmull-Rom glatting til tette waypoints ---
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
    this.segs = [];
    for (let i = 0; i < n; i++) {
      const a = wp[i], b = wp[(i + 1) % n];
      this.segs.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y });
    }
    // Verdensgrenser
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const p of wp) { minx = Math.min(minx, p.x); miny = Math.min(miny, p.y); maxx = Math.max(maxx, p.x); maxy = Math.max(maxy, p.y); }
    const pad = this.halfWidth + 120;
    this.minX = minx - pad; this.minY = miny - pad;
    this.worldW = Math.ceil(maxx - minx + pad * 2);
    this.worldH = Math.ceil(maxy - miny + pad * 2);
  }

  get numWaypoints() { return this.waypoints.length; }

  // Nærmeste waypoint-indeks til et punkt
  nearestWaypoint(x, y) {
    let best = 0, bestD = 1e18;
    const wp = this.waypoints;
    for (let i = 0; i < wp.length; i++) {
      const dx = wp[i].x - x, dy = wp[i].y - y, d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  // Nærmeste punkt på senterlinjen + avstand
  nearestOnCenter(x, y) {
    let best = 1e18, bx = x, by = y;
    for (const s of this.segs) {
      const dx = s.bx - s.ax, dy = s.by - s.ay;
      const len2 = dx * dx + dy * dy || 1;
      let t = ((x - s.ax) * dx + (y - s.ay) * dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = s.ax + t * dx, py = s.ay + t * dy;
      const d = (x - px) * (x - px) + (y - py) * (y - py);
      if (d < best) { best = d; bx = px; by = py; }
    }
    return { x: bx, y: by, dist: Math.sqrt(best) };
  }

  // Avstand fra punkt til senterlinjen (nærmeste segment)
  distanceToCenter(x, y) { return this.nearestOnCenter(x, y).dist; }

  isOnTrack(x, y) { return this.distanceToCenter(x, y) <= this.halfWidth; }

  // Retning (rad) langs banen ved waypoint-indeks
  headingAt(i) {
    const wp = this.waypoints, n = wp.length;
    const a = wp[i % n], b = wp[(i + 1) % n];
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  // Startposisjoner: oppstilt bak startlinja (waypoint 0), forskjøvet i bredden
  startPositions(count) {
    const dir = this.headingAt(0);
    const nx = Math.cos(dir), ny = Math.sin(dir);
    const px = -Math.sin(dir), py = Math.cos(dir); // sideretning
    const start = this.waypoints[0];
    const out = [];
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / 2), col = i % 2;
      const back = 18 + row * 30;
      const side = (col === 0 ? -1 : 1) * 20;
      out.push({
        x: start.x - nx * back + px * side,
        y: start.y - ny * back + py * side,
        heading: dir,
      });
    }
    return out;
  }

  _placeScenery() {
    this.scenery = [];
    const types = ["bush", "bush", "rock", "tree", "tree"];
    let seed = 1337;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    let tries = 0;
    while (this.scenery.length < 90 && tries < 4000) {
      tries++;
      const x = this.minX + rnd() * this.worldW;
      const y = this.minY + rnd() * this.worldH;
      const d = this.distanceToCenter(x, y);
      // Bare utenfor banen (med litt klaring), og ikke for langt ute
      if (d > this.halfWidth + 22 && d < this.halfWidth + 240) {
        this.scenery.push({ x, y, type: types[(rnd() * types.length) | 0] });
      }
    }
    this.scenery.sort((a, b) => a.y - b.y); // tegn bakerst først
  }

  // For-render hele banen til en stor offscreen-canvas (pixel art).
  _renderWorld() {
    const c = makeCanvas(this.worldW, this.worldH);
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    // Gress-bakgrunn med to-tone speckle
    ctx.fillStyle = CONFIG.COL_GRASS;
    ctx.fillRect(0, 0, this.worldW, this.worldH);
    let seed = 99;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    ctx.fillStyle = CONFIG.COL_GRASS2;
    for (let i = 0; i < (this.worldW * this.worldH) / 90; i++) {
      ctx.fillRect((rnd() * this.worldW) | 0, (rnd() * this.worldH) | 0, 2, 2);
    }

    const pathThrough = (lw, style) => {
      ctx.lineWidth = lw; ctx.strokeStyle = style;
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.beginPath();
      const wp = this.waypoints;
      ctx.moveTo(wp[0].x - this.minX, wp[0].y - this.minY);
      for (let i = 1; i <= wp.length; i++) {
        const p = wp[i % wp.length];
        ctx.lineTo(p.x - this.minX, p.y - this.minY);
      }
      ctx.closePath();
      ctx.stroke();
    };

    // Sandskulder, hvit kant, asfalt
    pathThrough(this.halfWidth * 2 + 16, CONFIG.COL_DIRT);
    pathThrough(this.halfWidth * 2 + 2, "#e9e9e9");      // hvit kantlinje
    pathThrough(this.halfWidth * 2 - 4, "#5b5e63");      // asfalt

    // Asfalt-speckle
    ctx.save();
    ctx.beginPath();
    // (enkel speckle over hele banen — billig nok)
    for (let i = 0; i < 6000; i++) {
      const x = (rnd() * this.worldW) | 0, y = (rnd() * this.worldH) | 0;
      if (this.distanceToCenter(x + this.minX, y + this.minY) < this.halfWidth - 3) {
        ctx.fillStyle = rnd() > 0.5 ? "#62656a" : "#54575c";
        ctx.fillRect(x, y, 2, 2);
      }
    }
    ctx.restore();

    // Start/mål-rute (rutete linje på tvers ved waypoint 0)
    this._drawFinishLine(ctx);

    // Dekor (busker, steiner, trær)
    for (const o of this.scenery) {
      const spr = ASSETS.scenery[o.type];
      ctx.drawImage(spr, Math.round(o.x - this.minX - spr.width / 2), Math.round(o.y - this.minY - spr.height / 2));
    }

    this.worldCanvas = c;
  }

  _drawFinishLine(ctx) {
    const dir = this.headingAt(0);
    const px = -Math.sin(dir), py = Math.cos(dir);
    const start = this.waypoints[0];
    const cx = start.x - this.minX, cy = start.y - this.minY;
    const sq = 6, rows = 2;
    for (let r = -Math.floor(this.halfWidth / sq); r < Math.floor(this.halfWidth / sq); r++) {
      for (let k = 0; k < rows; k++) {
        const on = (r + k) % 2 === 0;
        ctx.fillStyle = on ? "#f0f0f0" : "#222";
        const bx = cx + px * r * sq + Math.cos(dir) * (k * sq);
        const by = cy + py * r * sq + Math.sin(dir) * (k * sq);
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(dir);
        ctx.fillRect(-sq / 2, -sq / 2, sq, sq);
        ctx.restore();
      }
    }
  }
}
