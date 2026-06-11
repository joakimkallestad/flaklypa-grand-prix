// AI: racinglinje med kurvatur-basert svingbremsing, stuck-recovery, subtil rubber-banding,
// strategisk gjenstandsbruk og smartere hindrings-unngåelse.
const AI = {
  control(car, track, world, dt, cars) {
    // --- Stuck-recovery: rygg ut hvis fast utenfor banen i lav fart ---
    const onTrack = car.near.dist <= track.halfWidth;
    if (!onTrack && car.speed < 20) car.lowSpeedTime += dt; else car.lowSpeedTime = 0;
    if (car.lowSpeedTime > 1.2 && car.recoverTimer <= 0) car.recoverTimer = 0.7;
    if (car.recoverTimer > 0) {
      car.recoverTimer -= dt;
      const inward = Math.atan2(car.near.y - car.y, car.near.x - car.x);
      const diff = angleNorm(inward - car.heading);
      return { throttle: -0.9, steer: clamp(-diff * 2, -1, 1) };
    }

    const N = track.numWaypoints;
    const wp = car.near.segIndex;
    let look = Math.round(car.speed * 1.2 / CONFIG.WAYPOINT_SPACING);
    look = clamp(look, 3, 14);

    const maxCurv = track.maxCurvatureAhead(wp, look);

    // Racinglinje: sikt mot et punkt forskjøvet mot innersiden av svingen
    const aheadDir = track.headingAt((wp + look) % N);
    const curDir = track.headingAt(wp);
    const cornerSign = angleNorm(aheadDir - curDir) >= 0 ? 1 : -1;
    const base = track.waypoints[(wp + look) % N];
    const perpx = -Math.sin(curDir), perpy = Math.cos(curDir);
    const offset = (track.halfWidth - 16) * clamp(maxCurv * 4, 0, 1) * -cornerSign;
    const tx = base.x + perpx * offset, ty = base.y + perpy * offset;

    let desired = Math.atan2(ty - car.y, tx - car.x);
    let diff = angleNorm(desired - car.heading);
    diff += this._avoidHazards(car, world);
    const steer = clamp(diff * 2.2, -1, 1);

    // Hjørnefart fra kurvatur (lavere grep = bremser tidligere)
    let cornerTarget = car.spec.topSpeed * clamp(1 - maxCurv * 1.2 / car.spec.grip, 0.4, 1);

    // Subtil rubber-banding
    cornerTarget *= this._rubber(car, cars, track) * (car.aiSkill || 1);

    let throttle;
    if (car.speed > cornerTarget * 1.05) throttle = -0.4;
    else if (car.speed < cornerTarget * 0.9) throttle = 1;
    else throttle = 0.4;
    // lett av i skarpe styreutslag
    throttle -= clamp(Math.abs(diff) * 0.5, 0, 0.6);
    throttle = clamp(throttle, -1, 1);

    this._maybeUseItem(car, diff, maxCurv, dt, cars, track);
    return { throttle, steer };
  },

  _rubber(car, cars, track) {
    if (!cars) return 1;
    let maxP = -1e18, secondP = -1e18;
    for (const c of cars) {
      if (c.progress > maxP) { secondP = maxP; maxP = c.progress; }
      else if (c.progress > secondP) secondP = c.progress;
    }
    const gap = maxP - car.progress;
    if (gap > 1) return clamp(1 + CONFIG.RUBBER_GAIN * (gap / track.totalLen), 1, CONFIG.RUBBER_MAX);
    // leder: mild brems hvis langt foran nestemann
    if ((car.progress - secondP) > track.totalLen * 0.15) return CONFIG.RUBBER_LEADER;
    return 1;
  },

  _avoidHazards(car, world) {
    if (!world || !world.hazards) return 0;
    const ahead = 70;
    const fx = car.x + Math.cos(car.heading) * 40;
    const fy = car.y + Math.sin(car.heading) * 40;
    let worst = null, worstD = ahead;
    for (const h of world.hazards) {
      // ignorer egen nylig sluppet hindring bak seg
      const rel = angleNorm(Math.atan2(h.y - car.y, h.x - car.x) - car.heading);
      if (h.ownerId === car.id && Math.abs(rel) > Math.PI / 2) continue;
      const d = Math.hypot(h.x - fx, h.y - fy);
      if (d < worstD) { worstD = d; worst = { h, rel, d }; }
    }
    if (!worst) return 0;
    return (worst.rel > 0 ? -1 : 1) * (1 - worst.d / ahead) * 0.9;
  },

  _maybeUseItem(car, diff, maxCurv, dt, cars, track) {
    if (!car.item) return;
    if (car.aiItemTimer === undefined) car.aiItemTimer = 1 + Math.random() * 2;
    car.aiItemTimer -= dt;

    if (car.item === "boost") {
      // boost kun på rett strekke i god fart
      if (Math.abs(diff) < 0.2 && maxCurv < 0.04 && car.speed > car.spec.topSpeed * 0.5) {
        car.useItemNow = true; car.aiItemTimer = 2 + Math.random() * 2;
      }
      return;
    }

    // olje/røyk: slipp når en rival er tett bak — ellers fallback-timer
    let rivalBehind = false;
    if (cars) {
      for (const o of cars) {
        if (o === car || o.finished) continue;
        if (o.progress < car.progress && (car.progress - o.progress) < 120) {
          const rel = Math.abs(angleNorm(Math.atan2(o.y - car.y, o.x - car.x) - car.heading));
          if (rel > Math.PI * 0.55) { rivalBehind = true; break; }
        }
      }
    }
    if (rivalBehind || car.aiItemTimer <= -6) {
      car.useItemNow = true; car.aiItemTimer = 2 + Math.random() * 2;
    }
  },
};

function angleNorm(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
