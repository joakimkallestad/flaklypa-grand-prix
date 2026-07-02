// All tegning til den interne 480x270-bufferen (skaleres opp av CSS).
// Viewport-abstraksjon: 1P = én viewport (0,0,480,270); 2P = to (0,0,240,270)+(240,0,240,270).

class Viewport {
  constructor(dx, dy, dw, dh, car) {
    this.dx = dx; this.dy = dy; this.dw = dw; this.dh = dh;
    this.car = car;
    this.camX = 0; this.camY = 0; this.viewX = 0; this.viewY = 0; this.shake = 0;
  }
  addShake(mag) { this.shake = Math.min(CONFIG.SHAKE_MAX, Math.max(this.shake, mag)); }
}

class Renderer {
  constructor(ctx) { this.ctx = ctx; ctx.imageSmoothingEnabled = false; }

  resetCamera(vp, track) {
    const VW = vp.dw, VH = vp.dh;
    vp.camX = clamp(vp.car.x - track.minX - VW / 2, 0, Math.max(0, track.worldW - VW));
    vp.camY = clamp(vp.car.y - track.minY - VH / 2, 0, Math.max(0, track.worldH - VH));
    vp.viewX = Math.round(vp.camX); vp.viewY = Math.round(vp.camY); vp.shake = 0;
  }

  draw(game, dt) {
    const ctx = this.ctx;
    this._track = game.track;
    ctx.clearRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);

    // Sorter biler etter y én gang pr. frame (deles av alle viewports)
    this._ordered = [...game.cars].sort((a, b) => a.y - b.y);

    for (const vp of game.viewports) this.drawView(game, dt, vp);

    if (game.viewports.length > 1) {
      const x = Math.floor(CONFIG.VIEW_W / 2);
      ctx.fillStyle = "#0d0f12"; ctx.fillRect(x - 1, 0, 2, CONFIG.VIEW_H);
    }

    this._drawMinimap(game);
    if (game.mode === "countdown") this._drawCountdown(game);
    if (game.mode === "finishing") this._drawBanner("I MÅL!");
  }

  drawView(game, dt, vp) {
    const ctx = this.ctx;
    const { track, world, cars, particles } = game;
    const VW = vp.dw, VH = vp.dh, car = vp.car;
    const look = game.viewports.length > 1 ? CONFIG.CAM_LOOKAHEAD_2P : CONFIG.CAM_LOOKAHEAD;

    // Per-visning kamera (lookahead + glatting + klemming)
    const tX = clamp(car.x - track.minX - VW / 2 + car.vx * look, 0, Math.max(0, track.worldW - VW));
    const tY = clamp(car.y - track.minY - VH / 2 + car.vy * look, 0, Math.max(0, track.worldH - VH));
    const k = 1 - Math.pow(CONFIG.CAM_SMOOTH, Math.max(0.0001, dt || 0.016));
    vp.camX += (tX - vp.camX) * k; vp.camY += (tY - vp.camY) * k;
    vp.camX = clamp(vp.camX, 0, Math.max(0, track.worldW - VW));
    vp.camY = clamp(vp.camY, 0, Math.max(0, track.worldH - VH));
    vp.viewX = Math.round(vp.camX); vp.viewY = Math.round(vp.camY);

    const sx = (wx) => Math.round(wx - track.minX - vp.viewX);
    const sy = (wy) => Math.round(wy - track.minY - vp.viewY);

    ctx.save();
    ctx.beginPath(); ctx.rect(vp.dx, vp.dy, VW, VH); ctx.clip();
    ctx.translate(vp.dx, vp.dy);

    ctx.save();
    if (vp.shake > 0.1) ctx.translate(Math.round((Math.random() * 2 - 1) * vp.shake), Math.round((Math.random() * 2 - 1) * vp.shake));

    this._blitWorld(track, vp.viewX, vp.viewY, VW, VH);

    for (const h of world.hazards) if (h.type === "oil") this._drawOil(h, sx, sy);
    if (particles) particles.draw(ctx, sx, sy, 0, VW, VH);
    for (const b of world.boxes) if (b.active) this._drawBox(b, game.time, sx, sy);

    for (const c of this._ordered) this._drawCar(c, sx, sy, vp);

    if (particles) particles.draw(ctx, sx, sy, 1, VW, VH);
    for (const h of world.hazards) if (h.type === "smoke") this._drawSmoke(h, sx, sy);

    if (car.smokeTimer > 0) this._smokeVignette(VW, VH);
    ctx.restore();           // shake
    vp.shake *= 0.85;

    this._drawHUD(game, car, VW, VH);
    ctx.restore();           // klipping + translate
  }

  _blitWorld(track, vx, vy, VW, VH) {
    const ctx = this.ctx;
    ctx.drawImage(track.worldCanvas, vx, vy, VW, VH, 0, 0, VW, VH);
    ctx.drawImage(track.rutCanvas, vx, vy, VW, VH, 0, 0, VW, VH);
    ctx.drawImage(track.skidCanvas, vx, vy, VW, VH, 0, 0, VW, VH);
  }

  _drawOil(h, sx, sy) {
    const ctx = this.ctx, x = sx(h.x), y = sy(h.y);
    const a = clamp(h.life / CONFIG.OIL_FADE, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.65 * a + 0.15; ctx.fillStyle = "#15171c";
    ctx.beginPath(); ctx.ellipse(x, y, CONFIG.OIL_RADIUS, CONFIG.OIL_RADIUS * 0.7, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.4 * a; ctx.fillStyle = "#3a2a4a";
    ctx.beginPath(); ctx.ellipse(x - 4, y - 3, CONFIG.OIL_RADIUS * 0.4, CONFIG.OIL_RADIUS * 0.28, 0, 0, 7); ctx.fill();
    ctx.restore();
  }

  _drawSmoke(h, sx, sy) {
    const ctx = this.ctx, x = sx(h.x), y = sy(h.y);
    const a = clamp(h.life / 1.5, 0, 1) * 0.7;
    ctx.save();
    for (const p of h.puffs) {
      ctx.globalAlpha = a * 0.6; ctx.fillStyle = "#c9ccd2";
      ctx.beginPath(); ctx.arc(x + p.ox, y + p.oy, p.r, 0, 7); ctx.fill();
      ctx.globalAlpha = a * 0.4; ctx.fillStyle = "#9aa0a8";
      ctx.beginPath(); ctx.arc(x + p.ox + 2, y + p.oy + 2, p.r * 0.7, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  _drawBox(b, time, sx, sy) {
    const ctx = this.ctx, x = sx(b.x), bob = Math.sin(time * 4 + b.x) * 2, y = sy(b.y) + bob;
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(x, y + 8, 8, 3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#ffd23f"; ctx.fillRect(x - 7, y - 7, 14, 14);
    ctx.fillStyle = "#e0a020"; ctx.fillRect(x - 7, y + 3, 14, 4);
    ctx.fillStyle = "#7a5a00"; ctx.fillRect(x - 2, y - 5, 4, 10); ctx.fillRect(x - 5, y - 2, 10, 4);
  }

  _drawCar(car, sx, sy, vp) {
    const ctx = this.ctx, x = sx(car.x), y = sy(car.y);

    ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(x, y + 3, 16, 8, 0, 0, 7); ctx.fill(); ctx.restore();

    if (car.boostTimer > 0) {
      const bx = x - Math.cos(car.heading) * 18, by = y - Math.sin(car.heading) * 18;
      ctx.save(); ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(bx, by, 5, 0, 7); ctx.fill();
      ctx.fillStyle = "#ff7a2c"; ctx.beginPath(); ctx.arc(bx, by, 3, 0, 7); ctx.fill();
      ctx.restore();
    }

    const set = car.frames;
    const frame = set.frames[frameIndex(set, car.heading)];
    ctx.drawImage(frame, x - Math.round(frame.width / 2), y - Math.round(frame.height / 2));

    // Markør: gul pil over bilen denne visningen følger; liten tag for andre menneskebil
    if (car === vp.car) {
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath(); ctx.moveTo(x, y - 22); ctx.lineTo(x - 4, y - 28); ctx.lineTo(x + 4, y - 28); ctx.closePath(); ctx.fill();
    } else if (car.isPlayer) {
      ctx.fillStyle = car.tagColor;
      ctx.fillRect(x - 2, y - 27, 4, 4);
    }
  }

  _smokeVignette(VW, VH) {
    const ctx = this.ctx;
    ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = "#b9bcc2"; ctx.fillRect(0, 0, VW, VH); ctx.restore();
  }

  static formatTime(s) {
    if (!isFinite(s)) return "--:--";
    const m = Math.floor(s / 60), sec = Math.floor(s % 60), cs = Math.floor((s * 100) % 100);
    return (m > 0 ? m + ":" : "") + (m > 0 ? String(sec).padStart(2, "0") : sec) + "." + String(cs).padStart(2, "0");
  }

  _drawHUD(game, car, VW, VH) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = "bold 12px 'Courier New', monospace"; ctx.textBaseline = "top";

    this._text(`RUNDE ${car.displayLap(game.track)}/${game.track.laps}`, 8, 8, "#ffd23f");
    let placeCol = "#fff";
    if (car === game.player && game.placeFlash && game.placeFlash.t > 0) placeCol = game.placeFlash.dir > 0 ? "#8fffa0" : "#ff6a5a";
    this._text(`${car.place}. PLASS`, 8, 22, placeCol);
    this._text(`${Math.round(car.speed * CONFIG.KMH_SCALE)} km/t`, 8, 36, "#9bd");

    const split = (game.mode === "race" || game.mode === "finishing") ? game.raceTime - car.currentLapStart : 0;
    this._text(`TID ${Renderer.formatTime(split)}`, 8, 52, "#cde");
    this._text(`BESTE ${Renderer.formatTime(car.bestLap)}`, 8, 66, "#9bd");

    const ix = VW - 30, iy = 8;
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.strokeRect(ix - 1, iy - 1, 24, 24);
    if (car.item) {
      const col = car.item === "boost" ? "#ffd23f" : car.item === "oil" ? "#222" : "#c9ccd2";
      ctx.fillStyle = col; ctx.fillRect(ix, iy, 22, 22);
      this._text(car.item === "boost" ? "»" : car.item === "oil" ? "O" : "~", ix + 7, iy + 5, car.item === "oil" ? "#fff" : "#222");
    }
    if (typeof Sound !== "undefined" && Sound.muted) this._text("🔇", ix - 2, iy + 26, "#aaa");
    ctx.restore();
  }

  _text(s, x, y, col) {
    const ctx = this.ctx;
    ctx.fillStyle = "#000"; ctx.fillText(s, x + 1, y + 1);
    ctx.fillStyle = col; ctx.fillText(s, x, y);
  }

  _drawCountdown(game) {
    const ctx = this.ctx;
    const n = Math.min(3, Math.ceil(game.countdown));
    const frac = game.countdown - Math.floor(game.countdown);
    const label = n <= 0 ? "GO!" : String(n);
    const scale = 1 + frac * 0.8;
    ctx.save();
    ctx.translate(CONFIG.VIEW_W / 2, CONFIG.VIEW_H / 2 - 10); ctx.scale(scale, scale);
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 48px 'Courier New', monospace";
    ctx.fillStyle = "#000"; ctx.fillText(label, 2, 2);
    ctx.fillStyle = n <= 0 ? "#8fffa0" : "#ffd23f"; ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  _drawBanner(text) {
    const ctx = this.ctx;
    ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 28px 'Courier New', monospace";
    ctx.fillStyle = "#000"; ctx.fillText(text, CONFIG.VIEW_W / 2 + 2, 40 + 2);
    ctx.fillStyle = "#ffd23f"; ctx.fillText(text, CONFIG.VIEW_W / 2, 40); ctx.restore();
  }

  _drawMinimap(game) {
    const ctx = this.ctx, tr = game.track, mini = tr.mini;
    const mw = mini.w, mh = mini.h, mx = Math.floor((CONFIG.VIEW_W - mw) / 2), my = CONFIG.VIEW_H - mh - 6;
    ctx.save();
    ctx.globalAlpha = 0.6; ctx.fillStyle = "#000"; ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4); ctx.globalAlpha = 1;
    ctx.drawImage(mini.canvas, mx, my);
    for (const c of game.cars) {
      ctx.fillStyle = c.tagColor;
      const X = mx + mini.ox + (c.x - tr.minX) * mini.s, Y = my + mini.oy + (c.y - tr.minY) * mini.s;
      const sz = c.isPlayer ? 3 : 2;
      ctx.fillRect(X - 1, Y - 1, sz, sz);
    }
    ctx.restore();
  }
}
