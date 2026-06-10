// Enkel AI: følger waypoints med fartstilpasset styring, unngår hindringer,
// og bruker gjenstander på passende tidspunkt.
const AI = {
  control(car, track, world, dt) {
    const N = track.numWaypoints;
    const wp = track.nearestWaypoint(car.x, car.y);

    // Se framover — lengre ved høy fart
    const look = 2 + Math.round(car.speed / 40);
    const target = track.waypoints[(wp + look) % N];

    let desired = Math.atan2(target.y - car.y, target.x - car.x);
    let diff = angleNorm(desired - car.heading);

    // Unngå hindringer rett foran
    const avoid = this._avoidHazards(car, world);
    diff += avoid;

    const steer = clamp(diff * 2.2, -1, 1);

    // Gass: full på rett strekke, lett av i svinger
    const sharp = Math.abs(diff);
    let throttle = 1 - clamp(sharp * 0.9, 0, 0.75);
    // Brems hardt hvis veldig skarp sving ved høy fart
    if (sharp > 1.1 && car.speed > car.spec.topSpeed * 0.6) throttle = -0.3;
    throttle *= car.aiSkill || 1;

    // Bruk gjenstand
    this._maybeUseItem(car, diff, dt);

    return { throttle, steer };
  },

  _avoidHazards(car, world) {
    if (!world || !world.hazards) return 0;
    const ahead = 70;
    const fx = car.x + Math.cos(car.heading) * 40;
    const fy = car.y + Math.sin(car.heading) * 40;
    let nudge = 0;
    for (const h of world.hazards) {
      const d = Math.hypot(h.x - fx, h.y - fy);
      if (d < ahead) {
        // sidesteg: hvilken side er hindringen på?
        const rel = angleNorm(Math.atan2(h.y - car.y, h.x - car.x) - car.heading);
        nudge += (rel > 0 ? -1 : 1) * (1 - d / ahead) * 0.8;
      }
    }
    return clamp(nudge, -1, 1);
  },

  _maybeUseItem(car, diff, dt) {
    if (!car.item) return;
    if (car.aiItemTimer === undefined) car.aiItemTimer = 1 + Math.random() * 3;
    car.aiItemTimer -= dt;
    if (car.aiItemTimer > 0) return;

    if (car.item === "boost") {
      // bruk boost på rett strekke
      if (Math.abs(diff) < 0.25) { car.useItemNow = true; car.aiItemTimer = 2 + Math.random() * 2; }
    } else {
      // olje/røyk: slipp bak seg etter litt tid
      car.useItemNow = true;
      car.aiItemTimer = 2 + Math.random() * 2;
    }
  },
};

function angleNorm(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
