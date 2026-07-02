// Lett partikkelsystem med levetid. Pooled, hard tak, framerate-uavhengig emisjon styres av kallere.
// layer: 0 = bakke (under biler), 1 = luft (over biler). Farger som [r,g,b].
class Particles {
  constructor(cap = 600) { this.list = []; this.cap = cap; }

  spawn(o) {
    if (this.list.length >= this.cap) this.list.shift();
    this.list.push({
      x: o.x, y: o.y, vx: o.vx || 0, vy: o.vy || 0,
      life: o.life, maxLife: o.life,
      r0: o.r0, r1: o.r1 != null ? o.r1 : o.r0,
      col0: o.col0, col1: o.col1 || o.col0,
      grav: o.grav || 0, drag: o.drag != null ? o.drag : 0.92,
      layer: o.layer || 0,
    });
  }

  _rand(a, b) { return a + Math.random() * (b - a); }

  exhaust(x, y, heading) {
    const back = heading + Math.PI;
    this.spawn({
      x, y,
      vx: Math.cos(back) * 14 + this._rand(-8, 8), vy: Math.sin(back) * 14 + this._rand(-8, 8),
      life: this._rand(0.3, 0.6), r0: 1.5, r1: 4, col0: [120, 120, 124], col1: [80, 80, 84], layer: 1, drag: 0.9,
    });
  }
  dirt(x, y, heading) {
    const back = heading + Math.PI;
    this.spawn({
      x, y,
      vx: Math.cos(back) * 40 + this._rand(-30, 30), vy: Math.sin(back) * 40 + this._rand(-30, 30),
      life: this._rand(0.3, 0.7), r0: 2, r1: 1, col0: [169, 138, 85], col1: [120, 96, 56], grav: 0, layer: 0, drag: 0.86,
    });
  }
  smoke(x, y) {
    this.spawn({
      x: x + this._rand(-3, 3), y: y + this._rand(-3, 3),
      vx: this._rand(-10, 10), vy: this._rand(-14, -2),
      life: this._rand(0.4, 0.8), r0: 3, r1: 9, col0: [220, 222, 226], col1: [150, 152, 158], layer: 1, drag: 0.9,
    });
  }
  sparks(x, y, nx, ny, speed) {
    const n = 6 + Math.min(8, Math.round(speed / 30));
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(ny, nx) + this._rand(-1, 1);
      const sp = this._rand(60, 60 + speed);
      this.spawn({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: this._rand(0.12, 0.3), r0: 1.5, r1: 0.5, col0: [255, 240, 180], col1: [255, 150, 30], grav: 120, layer: 1, drag: 0.9,
      });
    }
  }
  ring(x, y, col, n, spd, life, r0, r1) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this._rand(-0.2, 0.2);
      this.spawn({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life, r0, r1, col0: col, col1: col, layer: 0, drag: 0.88 });
    }
  }

  update(dt) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.life -= dt;
      if (p.life <= 0) { l.splice(i, 1); continue; }
      const k = Math.pow(p.drag, dt * 60);
      p.vx *= k; p.vy *= k; p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }

  draw(ctx, sx, sy, layer, VW, VH) {
    const w = VW || CONFIG.VIEW_W, h = VH || CONFIG.VIEW_H;
    for (const p of this.list) {
      if (p.layer !== layer) continue;
      const px = sx(p.x), py = sy(p.y);
      if (px < -10 || px > w + 10 || py < -10 || py > h + 10) continue; // bounds-cull (delt skjerm)
      const f = 1 - p.life / p.maxLife;       // 0→1 over levetid
      const a = Math.max(0, p.life / p.maxLife);
      const r = p.r0 + (p.r1 - p.r0) * f;
      const cr = Math.round(p.col0[0] + (p.col1[0] - p.col0[0]) * f);
      const cg = Math.round(p.col0[1] + (p.col1[1] - p.col0[1]) * f);
      const cb = Math.round(p.col0[2] + (p.col1[2] - p.col0[2]) * f);
      ctx.fillStyle = "rgba(" + cr + "," + cg + "," + cb + "," + a.toFixed(3) + ")";
      const s = Math.max(1, Math.round(r * 2));
      ctx.fillRect(Math.round(px - r), Math.round(py - r), s, s);
    }
  }
}
