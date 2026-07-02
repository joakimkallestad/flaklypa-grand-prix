// Bil med arcade top-down-fysikk. Brukes for både spiller og AI.
class Car {
  constructor(spec, start, isPlayer, id) {
    this.spec = spec;
    this.isPlayer = isPlayer;
    this.id = id;
    this.x = start.x;
    this.y = start.y;
    this.heading = start.heading;
    this.vx = 0;
    this.vy = 0;

    // Bane-tilstand (settes i startRace via full skanning)
    this.near = null;
    this.nearSeg = 0;

    // Løpsprogresjon (kontinuerlig arc-lengde tilbakelagt fra start)
    this.cont = 0;
    this.lastRaw = 0;
    this.lap = 0;
    this.progress = 0;
    this.finished = false;
    this.finishTime = 0;
    this.finishOrder = 0;
    this.place = 0;

    // Rundetider (oppdateres fra main)
    this.lapTimes = [];
    this.bestLap = Infinity;
    this.currentLapStart = 0;
    this._timedLap = 0;

    // Effekter / gjenstander
    this.item = null;            // "oil" | "smoke" | "boost" | null
    this.boostTimer = 0;
    this.boostJustStarted = 0;   // kort vindu der fartstaket er løsnet (boost-kick)
    this.slipTimer = 0;
    this.smokeTimer = 0;
    this.useItemNow = false;

    // Styringskilde: "p1" | "p2" | "ai" (overstyres i startRace)
    this.controller = isPlayer ? "p1" : "ai";

    // AI-hjelpere
    this.aiSkill = 1;
    this.aiItemTimer = undefined;
    this.lowSpeedTime = 0;
    this.recoverTimer = 0;
    this.bumpTimer = 0;          // satt ved barriere-treff (til stuck-recovery)

    // Visuelt
    this.wobble = 0;
    this.frames = ASSETS.cars[spec.id]; // rotasjonsframe-sett (kan overstyres av livery)
    this.tagColor = isPlayer ? "#ffd23f" : spec.colors.body;

    // Hendelser / emisjon
    this.hitWall = null;
    this.emitAcc = 0;
    this.skidAcc = 0;
    this.rutAcc = 0;
    this._wasBoost = false;
  }

  get speed() { return Math.hypot(this.vx, this.vy); }

  update(dt, controls, track, particles) {
    if (this.finished) controls = { throttle: 0, steer: 0 };

    if (this.boostTimer > 0) this.boostTimer -= dt;
    if (this.boostJustStarted > 0) this.boostJustStarted -= dt;
    if (this.slipTimer > 0) this.slipTimer -= dt;
    if (this.smokeTimer > 0) this.smokeTimer -= dt; else this.smokeTimer = 0;
    if (this.bumpTimer > 0) this.bumpTimer -= dt;

    const near0 = this.near;                       // forrige frames projeksjon (1-frame etterslep — ok)
    const onTrack0 = near0.dist <= track.halfWidth;
    const boosting = this.boostTimer > 0;
    const inSmoke = this.smokeTimer > 0;

    let maxSpeed = this.spec.topSpeed;
    if (boosting) maxSpeed *= CONFIG.BOOST_FACTOR;
    if (!onTrack0) maxSpeed *= CONFIG.OFFTRACK_MAXSPEED;
    if (inSmoke) maxSpeed *= 0.6;

    const cos = Math.cos(this.heading), sin = Math.sin(this.heading);
    const accel = controls.throttle * this.spec.accel * (boosting ? 1.4 : 1);
    this.vx += cos * accel * dt;
    this.vy += sin * accel * dt;

    const fwd = this.vx * cos + this.vy * sin;
    const speedFactor = Math.min(1, this.speed / 55);
    const dirSign = fwd >= 0 ? 1 : -1;
    this.heading += controls.steer * this.spec.turnRate * dt * speedFactor * dirSign;

    const c2 = Math.cos(this.heading), s2 = Math.sin(this.heading);
    let fComp = this.vx * c2 + this.vy * s2;
    let lComp = -this.vx * s2 + this.vy * c2;

    let lateralKeep;
    const normalKeep = 1 - this.spec.grip * 0.9;
    if (this.slipTimer > 0) {
      // demp mot null mot slutten av sklien (lerp grep → is etter gjenværende slip)
      const k = Math.min(1, this.slipTimer / CONFIG.OIL_SLIP_TIME);
      lateralKeep = normalKeep + (0.985 - normalKeep) * k;
    } else if (!onTrack0) lateralKeep = 0.86;
    else lateralKeep = normalKeep;
    lComp *= Math.pow(lateralKeep, dt * 60);

    this.wobble = Math.min(1, Math.abs(lComp) / 80);

    this.vx = fComp * c2 + lComp * (-s2);
    this.vy = fComp * s2 + lComp * (c2);

    const drag = Math.pow(onTrack0 ? CONFIG.ONTRACK_DRAG : CONFIG.OFFTRACK_DRAG, dt * 60);
    this.vx *= drag; this.vy *= drag;

    // Fartstak — løsnet kort etter boost-aktivering så "kicket" får poppe
    if (this.boostJustStarted <= 0) {
      const sp = this.speed;
      const maxRev = this.spec.topSpeed * CONFIG.REVERSE_FACTOR;
      const cap = fwd >= 0 ? maxSpeed : maxRev;
      if (sp > cap) { const k = cap / sp; this.vx *= k; this.vy *= k; }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Én windowed projeksjon pr. frame (etter flytting), vindu skalert med fart
    const win = 12 + Math.min(20, ((this.speed * dt) / CONFIG.WAYPOINT_SPACING * 3) | 0);
    this.near = track.nearestOnCenterNear(this.x, this.y, this.nearSeg, win);
    this.nearSeg = this.near.segIndex;
    const onTrack = this.near.dist <= track.halfWidth;

    this._handleBoundary(track);   // ytre ring (fjord/fjell) — siste skanse
    this._handleBarriers(track);   // diskrete kolliderere (rekkverk/stein/trær)
    this._emit(dt, track, particles, onTrack, boosting);
    this._updateLap(track);
  }

  // Ytre ugjennomtrengelig ring: radial-clamp ved halfWidth+BOUNDARY_OFFSET
  _handleBoundary(track) {
    const near = this.near;
    const wall = track.halfWidth + CONFIG.BOUNDARY_OFFSET;
    if (near.dist > wall) {
      const inv = 1 / (near.dist || 1);
      const nx = (this.x - near.x) * inv, ny = (this.y - near.y) * inv;
      this.x = near.x + nx * wall;
      this.y = near.y + ny * wall;
      const outward = this.vx * nx + this.vy * ny;
      if (outward > 0) {
        this.vx -= nx * outward * (1 + CONFIG.WALL_BOUNCE);
        this.vy -= ny * outward * (1 + CONFIG.WALL_BOUNCE);
        if (outward > 30) {
          this.hitWall = { x: this.x, y: this.y, nx: -nx, ny: -ny, speed: outward };
          this.bumpTimer = 0.4;
          if (this.isPlayer && typeof Sound !== "undefined") Sound.thud(outward / 200);
        }
      }
    }
  }

  // Diskrete barrierer (sirkler/kapsler). Push-out + drep innovergående fart.
  _handleBarriers(track) {
    const cr = CONFIG.CAR_COLLIDE_R;
    const list = track.barriersNear(this.x, this.y);
    for (const b of list) {
      let cx, cy;
      if (b.kind === "circle") { cx = b.x; cy = b.y; }
      else {
        const dx = b.x2 - b.x1, dy = b.y2 - b.y1, L2 = dx * dx + dy * dy || 1;
        let t = ((this.x - b.x1) * dx + (this.y - b.y1) * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        cx = b.x1 + t * dx; cy = b.y1 + t * dy;
      }
      const ox = this.x - cx, oy = this.y - cy;
      const d = Math.hypot(ox, oy), minD = b.r + cr;
      if (d < minD && d > 0.0001) {
        const nx = ox / d, ny = oy / d;
        this.x = cx + nx * minD; this.y = cy + ny * minD;
        const inward = this.vx * nx + this.vy * ny;   // <0 = inn i barrieren
        if (inward < 0) {
          this.vx -= nx * inward * (1 + CONFIG.WALL_BOUNCE);
          this.vy -= ny * inward * (1 + CONFIG.WALL_BOUNCE);
          const impact = -inward;
          if (impact > 30) {
            this.hitWall = { x: this.x, y: this.y, nx, ny, speed: impact };
            this.bumpTimer = 0.4;
            if (this.isPlayer && typeof Sound !== "undefined") Sound.thud(impact / 200);
          }
        }
      }
    }
  }

  _emit(dt, track, particles, onTrack, boosting) {
    if (!particles) return;
    const sliding = this.wobble > 0.5 || this.slipTimer > 0 || boosting;
    this.emitAcc += dt;
    while (this.emitAcc >= 0.03) {
      this.emitAcc -= 0.03;
      const r = this.rearPoint(13);
      if (onTrack && Math.abs(this.vx * Math.cos(this.heading) + this.vy * Math.sin(this.heading)) > 20)
        particles.exhaust(r.x, r.y, this.heading);
      if (!onTrack && this.speed > 40) particles.dirt(r.x, r.y, this.heading);
      if (sliding && this.speed > 30) particles.smoke(r.x, r.y);
    }
    // Persistent skid-spor på asfalt
    if (onTrack && sliding && this.speed > 40) {
      this.skidAcc += dt;
      if (this.skidAcc >= 0.03) { this.skidAcc = 0; track.bakeSkid(this.x, this.y, this.heading, 1); }
    }
    // Hjulspor på gress (akkumulerer med trafikk)
    if (!onTrack && this.speed > 30) {
      this.rutAcc += dt;
      if (this.rutAcc >= 0.04) { this.rutAcc = 0; track.bakeRut(this.x, this.y, this.heading); }
    }
  }

  _updateLap(track) {
    const raw = track.arcLength(this.near.segIndex, this.near.t);
    let d = raw - this.lastRaw;
    const half = track.totalLen / 2;
    if (d < -half) d += track.totalLen;       // krysset start/mål-sømmen forover
    else if (d > half) d -= track.totalLen;    // bakover
    // anti-juks: nuller urealistiske projeksjonshopp (snarvei nær hairpin)
    const maxStep = this.spec.topSpeed * CONFIG.BOOST_FACTOR * (1 / 60) * 1.5;
    if (d > maxStep || d < -maxStep) d = 0;
    this.cont += d;
    this.lastRaw = raw;                        // re-anker uansett
    this.progress = this.cont;                 // kontinuerlig — ingen rangerings-ties
    const newLap = Math.max(0, Math.floor(this.cont / track.totalLen));
    if (newLap >= track.laps && !this.finished) this.finished = true;
    this.lap = newLap;
  }

  rearPoint(dist = 18) {
    return { x: this.x - Math.cos(this.heading) * dist, y: this.y - Math.sin(this.heading) * dist };
  }

  displayLap(track) { return Math.min(this.lap + 1, track.laps); }
}
