// Bil med arcade top-down-fysikk. Brukes for både spiller og AI.
class Car {
  constructor(spec, start, isPlayer) {
    this.spec = spec;
    this.isPlayer = isPlayer;
    this.x = start.x;
    this.y = start.y;
    this.heading = start.heading;
    this.vx = 0;
    this.vy = 0;

    // Løpsstatus
    this.lap = 0;            // antall fullførte runder
    this.passedHalf = false; // har passert midten siden sist startlinje-kryss
    this.lastWp = 0;
    this.progress = 0;       // for rangering
    this.finished = false;
    this.finishTime = 0;
    this.place = 0;

    // Effekter / gjenstander
    this.item = null;        // "oil" | "smoke" | "boost" | null
    this.boostTimer = 0;
    this.slipTimer = 0;      // sklir etter olje
    this.smokeTimer = 0;     // inne i røyk
    this.useItemNow = false; // settes av input/AI

    // Visuelt
    this.wobble = 0;         // liten "wobble" når man sklir
  }

  get speed() { return Math.hypot(this.vx, this.vy); }

  // controls: { throttle: -1..1, steer: -1..1 }
  update(dt, controls, track, world) {
    if (this.finished) controls = { throttle: 0, steer: 0 };

    // Tidsnedtelling på effekter
    if (this.boostTimer > 0) this.boostTimer -= dt;
    if (this.slipTimer > 0) this.slipTimer -= dt;
    if (this.smokeTimer > 0) this.smokeTimer -= dt; else this.smokeTimer = 0;

    const onTrack = track.isOnTrack(this.x, this.y);
    const boosting = this.boostTimer > 0;
    const inSmoke = this.smokeTimer > 0;

    let maxSpeed = this.spec.topSpeed;
    if (boosting) maxSpeed *= CONFIG.BOOST_FACTOR;
    if (!onTrack) maxSpeed *= CONFIG.OFFTRACK_MAXSPEED;
    if (inSmoke) maxSpeed *= 0.6;

    const cos = Math.cos(this.heading), sin = Math.sin(this.heading);

    // Motorkraft langs kjøreretning
    const accel = controls.throttle * this.spec.accel * (boosting ? 1.4 : 1);
    this.vx += cos * accel * dt;
    this.vy += sin * accel * dt;

    // Styring — skaleres med fart, og snur "riktig vei" ved rygging
    const fwd = this.vx * cos + this.vy * sin;
    const speedFactor = Math.min(1, this.speed / 55);
    const dirSign = fwd >= 0 ? 1 : -1;
    this.heading += controls.steer * this.spec.turnRate * dt * speedFactor * dirSign;

    // Dekomponer fart i forover/side relativt til (ny) kjøreretning
    const c2 = Math.cos(this.heading), s2 = Math.sin(this.heading);
    let fComp = this.vx * c2 + this.vy * s2;
    let lComp = -this.vx * s2 + this.vy * c2;

    // Veigrep: hvor mye sidefart beholdes pr. steg (høyt = mye sleng)
    let lateralKeep;
    if (this.slipTimer > 0) lateralKeep = 0.985;           // olje = nesten ingen grep
    else if (!onTrack) lateralKeep = 0.86;                 // gress/grus = mister grep
    else lateralKeep = 1 - this.spec.grip * 0.9;           // normalt grep fra spec
    const stepK = Math.pow(lateralKeep, dt * 60);
    lComp *= stepK;

    this.wobble = Math.min(1, Math.abs(lComp) / 80);

    // Sett sammen fart igjen
    this.vx = fComp * c2 + lComp * (-s2);
    this.vy = fComp * s2 + lComp * (c2);

    // Generell luft-/rullemotstand
    const drag = Math.pow(onTrack ? 0.993 : CONFIG.OFFTRACK_DRAG, dt * 60);
    this.vx *= drag;
    this.vy *= drag;

    // Begrens topp- og ryggefart
    const sp = this.speed;
    const maxRev = this.spec.topSpeed * CONFIG.REVERSE_FACTOR;
    const cap = fwd >= 0 ? maxSpeed : maxRev;
    if (sp > cap) { const k = cap / sp; this.vx *= k; this.vy *= k; }

    // Flytt
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this._handleWalls(track);
    this._updateLap(track);
  }

  _handleWalls(track) {
    const near = track.nearestOnCenter(this.x, this.y);
    const wall = track.halfWidth + 26; // sandskulder før "vegg"
    if (near.dist > wall) {
      const nx = (this.x - near.x) / (near.dist || 1);
      const ny = (this.y - near.y) / (near.dist || 1);
      // Skyv tilbake til veggen
      this.x = near.x + nx * wall;
      this.y = near.y + ny * wall;
      // Fjern utovergående fart, behold litt
      const outward = this.vx * nx + this.vy * ny;
      if (outward > 0) {
        this.vx -= nx * outward * (1 + CONFIG.WALL_BOUNCE);
        this.vy -= ny * outward * (1 + CONFIG.WALL_BOUNCE);
      }
    }
  }

  _updateLap(track) {
    const N = track.numWaypoints;
    const wp = track.nearestWaypoint(this.x, this.y);
    const prev = this.lastWp;

    if (wp > N * 0.4 && wp < N * 0.6) this.passedHalf = true;

    // Forover-kryssing av startlinja (fra siste fjerdedel til første)
    if (prev > N * 0.7 && wp < N * 0.3) {
      if (this.passedHalf) {
        this.lap++;
        this.passedHalf = false;
        if (this.lap >= track.laps && !this.finished) {
          this.finished = true;
        }
      }
    } else if (prev < N * 0.3 && wp > N * 0.7) {
      // Bakover over linja — ikke gi gratis runde
      if (this.lap > 0) this.lap--;
      this.passedHalf = true;
    }

    this.lastWp = wp;
    this.progress = this.lap * N + wp;
  }

  // Senterpunkt litt bak bilen (til å slippe olje/røyk)
  rearPoint(dist = 18) {
    return { x: this.x - Math.cos(this.heading) * dist, y: this.y - Math.sin(this.heading) * dist };
  }

  displayLap(track) { return Math.min(this.lap + 1, track.laps); }
}
