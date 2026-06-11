// Power-up-system: pickup-bokser på banen + hindringer (oljesøl, røyksky) og boost.
class World {
  constructor(track) {
    this.track = track;
    this.boxes = [];
    this.hazards = [];
    this.particles = null; // settes i startRace

    const N = track.numWaypoints;
    const count = 6;
    for (let i = 0; i < count; i++) {
      const wi = Math.floor((i + 0.5) * N / count) % N;
      const p = track.waypoints[wi];
      const dir = track.headingAt(wi);
      const px = -Math.sin(dir), py = Math.cos(dir);
      const side = (i % 2 === 0 ? -1 : 1) * (track.halfWidth * 0.4);
      this.boxes.push({ x: p.x + px * side, y: p.y + py * side, active: true, respawn: 0 });
    }
  }

  giveRandomItem() {
    const r = Math.random();
    if (r < 0.4) return "boost";
    if (r < 0.7) return "oil";
    return "smoke";
  }

  update(dt, cars) {
    for (const b of this.boxes) {
      if (!b.active) {
        b.respawn -= dt;
        if (b.respawn <= 0) b.active = true;
        continue;
      }
      for (const car of cars) {
        if (car.finished) continue;
        if (!car.item && Math.hypot(car.x - b.x, car.y - b.y) < 18) {
          car.item = this.giveRandomItem();
          b.active = false;
          b.respawn = CONFIG.ITEM_RESPAWN;
          if (car.isPlayer && typeof Sound !== "undefined") Sound.pickup();
          break;
        }
      }
    }

    for (const car of cars) {
      if (car.useItemNow && car.item) this._useItem(car);
      car.useItemNow = false;
    }

    for (const h of this.hazards) h.life -= dt;
    this.hazards = this.hazards.filter((h) => h.life > 0);

    for (const h of this.hazards) {
      const r = h.type === "oil" ? CONFIG.OIL_RADIUS : CONFIG.SMOKE_RADIUS;
      for (const car of cars) {
        if (car.finished) continue;
        if (Math.hypot(car.x - h.x, car.y - h.y) < r) {
          if (h.type === "oil") car.slipTimer = CONFIG.OIL_SLIP_TIME;
          else car.smokeTimer = Math.max(car.smokeTimer, 0.5);
        }
      }
    }

    this._separateCars(cars);
  }

  _useItem(car) {
    const isP = car.isPlayer && typeof Sound !== "undefined";
    if (car.item === "boost") {
      car.boostTimer = CONFIG.BOOST_TIME;
      car.boostJustStarted = 0.2;
      car.vx += Math.cos(car.heading) * CONFIG.BOOST_KICK;
      car.vy += Math.sin(car.heading) * CONFIG.BOOST_KICK;
      if (this.particles) {
        const r = car.rearPoint(16);
        this.particles.ring(r.x, r.y, [255, 180, 40], 8, 90, 0.4, 4, 1);
      }
      if (isP) Sound.boostWhoosh();
    } else if (car.item === "oil") {
      const r = car.rearPoint(20);
      this.hazards.push({ type: "oil", x: r.x, y: r.y, life: CONFIG.OIL_TIME, maxLife: CONFIG.OIL_TIME, ownerId: car.id });
      if (this.particles) this.particles.ring(r.x, r.y, [30, 28, 40], 7, 50, 0.5, 3, 1);
      if (isP) Sound.drop();
    } else if (car.item === "smoke") {
      const r = car.rearPoint(20);
      this.hazards.push({ type: "smoke", x: r.x, y: r.y, life: CONFIG.SMOKE_TIME, maxLife: CONFIG.SMOKE_TIME, ownerId: car.id, puffs: this._makePuffs() });
      if (this.particles) this.particles.ring(r.x, r.y, [200, 202, 208], 9, 70, 0.6, 4, 12);
      if (isP) Sound.drop();
    }
    car.item = null;
  }

  _makePuffs() {
    const puffs = [];
    for (let i = 0; i < 7; i++) puffs.push({ ox: (Math.random() - 0.5) * 40, oy: (Math.random() - 0.5) * 40, r: 8 + Math.random() * 10 });
    return puffs;
  }

  _separateCars(cars) {
    const minDist = 22;
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b = cars[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d < minDist && d > 0.01) {
          const push = (minDist - d) / 2;
          dx /= d; dy /= d;
          a.x -= dx * push; a.y -= dy * push;
          b.x += dx * push; b.y += dy * push;
          a.vx -= dx * 8; a.vy -= dy * 8;
          b.vx += dx * 8; b.vy += dy * 8;
          if ((a.isPlayer || b.isPlayer) && typeof Sound !== "undefined") Sound.thud(0.4);
        }
      }
    }
  }
}
