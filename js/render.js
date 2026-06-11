// All tegning til den interne 480x270-bufferen (skaleres opp av CSS).
class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = false;
    this.camX = 0; this.camY = 0;
    this.viewX = 0; this.viewY = 0;
    this.shake = 0;
  }

  addShake(mag) { this.shake = Math.min(CONFIG.SHAKE_MAX, Math.max(this.shake, mag)); }

  // Snapp kamera direkte på spilleren (ved løpsstart) så vi unngår en glidende pan-inn fra forrige løp
  resetCamera(game) {
    const { track, player } = game;
    const VW = CONFIG.VIEW_W, VH = CONFIG.VIEW_H;
    this.camX = clamp(player.x - track.minX - VW / 2, 0, Math.max(0, track.worldW - VW));
    this.camY = clamp(player.y - track.minY - VH / 2, 0, Math.max(0, track.worldH - VH));
    this.viewX = Math.round(this.camX);
    this.viewY = Math.round(this.camY);
    this.shake = 0;
  }

  draw(game, dt) {
    const ctx = this.ctx;
    const { track, world, cars, player, particles } = game;
    this._track = track;
    const VW = CONFIG.VIEW_W, VH = CONFIG.VIEW_H;

    // Kamera med lookahead + glatting
    const laX = player.vx * CONFIG.CAM_LOOKAHEAD, laY = player.vy * CONFIG.CAM_LOOKAHEAD;
    const tX = clamp(player.x - track.minX - VW / 2 + laX, 0, Math.max(0, track.worldW - VW));
    const tY = clamp(player.y - track.minY - VH / 2 + laY, 0, Math.max(0, track.worldH - VH));
    const k = 1 - Math.pow(CONFIG.CAM_SMOOTH, Math.max(0.0001, dt || 0.016));
    this.camX += (tX - this.camX) * k;
    this.camY += (tY - this.camY) * k;
    this.camX = clamp(this.camX, 0, Math.max(0, track.worldW - VW));
    this.camY = clamp(this.camY, 0, Math.max(0, track.worldH - VH));
    this.viewX = Math.round(this.camX);
    this.viewY = Math.round(this.camY);

    const sx = (wx) => Math.round(wx - track.minX - this.viewX);
    const sy = (wy) => Math.round(wy - track.minY - this.viewY);

    // --- Verden + entiteter (med screen shake) ---
    ctx.save();
    if (this.shake > 0.1) ctx.translate(Math.round((Math.random() * 2 - 1) * this.shake), Math.round((Math.random() * 2 - 1) * this.shake));

    ctx.drawImage(track.worldCanvas, this.viewX, this.viewY, VW, VH, 0, 0, VW, VH);
    ctx.drawImage(track.skidCanvas, this.viewX, this.viewY, VW, VH, 0, 0, VW, VH);

    for (const h of world.hazards) if (h.type === "oil") this._drawOil(h, sx, sy);
    if (particles) particles.draw(ctx, sx, sy, 0);
    for (const b of world.boxes) if (b.active) this._drawBox(b, game.time, sx, sy);

    const ordered = [...cars].sort((a, b) => a.y - b.y);
    for (const car of ordered) this._drawCar(car, sx, sy);

    if (particles) particles.draw(ctx, sx, sy, 1);
    for (const h of world.hazards) if (h.type === "smoke") this._drawSmoke(h, sx, sy);

    if (player.smokeTimer > 0) this._smokeVignette();
    ctx.restore();
    this.shake *= 0.85;

    // --- HUD (rister ikke) ---
    this._drawHUD(game);
    this._drawMinimap(game);
    if (game.mode === "countdown") this._drawCountdown(game);
    if (game.mode === "finishing") this._drawBanner("I MÅL!");
  }

  _drawOil(h, sx, sy) {
    const ctx = this.ctx;
    const x = sx(h.x), y = sy(h.y);
    const a = clamp(h.life / 1.5, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.65 * a + 0.2; ctx.fillStyle = "#15171c";
    ctx.beginPath(); ctx.ellipse(x, y, CONFIG.OIL_RADIUS, CONFIG.OIL_RADIUS * 0.7, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.4; ctx.fillStyle = "#3a2a4a";
    ctx.beginPath(); ctx.ellipse(x - 4, y - 3, CONFIG.OIL_RADIUS * 0.4, CONFIG.OIL_RADIUS * 0.28, 0, 0, 7); ctx.fill();
    ctx.restore();
  }

  _drawSmoke(h, sx, sy) {
    const ctx = this.ctx;
    const x = sx(h.x), y = sy(h.y);
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
    const ctx = this.ctx;
    const x = sx(b.x), bob = Math.sin(time * 4 + b.x) * 2, y = sy(b.y) + bob;
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(x, y + 8, 8, 3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#ffd23f"; ctx.fillRect(x - 7, y - 7, 14, 14);
    ctx.fillStyle = "#e0a020"; ctx.fillRect(x - 7, y + 3, 14, 4);
    ctx.fillStyle = "#7a5a00"; ctx.fillRect(x - 2, y - 5, 4, 10); ctx.fillRect(x - 5, y - 2, 10, 4);
  }

  _drawCar(car, sx, sy) {
    const ctx = this.ctx;
    const x = sx(car.x), y = sy(car.y);

    ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(x, y + 3, 15, 8, 0, 0, 7); ctx.fill(); ctx.restore();

    if (car.boostTimer > 0) {
      const bx = x - Math.cos(car.heading) * 16, by = y - Math.sin(car.heading) * 16;
      ctx.save(); ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(bx, by, 5, 0, 7); ctx.fill();
      ctx.fillStyle = "#ff7a2c"; ctx.beginPath(); ctx.arc(bx, by, 3, 0, 7); ctx.fill();
      ctx.restore();
    }

    const set = car.frames;
    const frame = set.frames[frameIndex(set, car.heading)];
    ctx.drawImage(frame, x - Math.round(frame.width / 2), y - Math.round(frame.height / 2));

    if (car.isPlayer) {
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x - 4, y - 26); ctx.lineTo(x + 4, y - 26); ctx.closePath(); ctx.fill();
    }
  }

  _smokeVignette() {
    const ctx = this.ctx;
    ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = "#b9bcc2";
    ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H); ctx.restore();
  }

  static formatTime(s) {
    if (!isFinite(s)) return "--:--";
    const m = Math.floor(s / 60), sec = Math.floor(s % 60), cs = Math.floor((s * 100) % 100);
    return (m > 0 ? m + ":" : "") + (m > 0 ? String(sec).padStart(2, "0") : sec) + "." + String(cs).padStart(2, "0");
  }

  _drawHUD(game) {
    const ctx = this.ctx;
    const p = game.player;
    ctx.save();
    ctx.font = "bold 12px 'Courier New', monospace";
    ctx.textBaseline = "top";

    this._text(`RUNDE ${p.displayLap(game.track)}/${game.track.laps}`, 8, 8, "#ffd23f");

    // Plassering med over-/underkjørings-flash
    let placeCol = "#fff";
    if (game.placeFlash && game.placeFlash.t > 0) placeCol = game.placeFlash.dir > 0 ? "#8fffa0" : "#ff6a5a";
    this._text(`${p.place}. PLASS`, 8, 22, placeCol);

    const kmh = Math.round(p.speed * CONFIG.KMH_SCALE);
    this._text(`${kmh} km/t`, 8, 36, "#9bd");

    // Rundetider
    const split = (game.mode === "race" || game.mode === "finishing") ? game.raceTime - p.currentLapStart : 0;
    this._text(`TID ${Renderer.formatTime(split)}`, 8, 52, "#cde");
    this._text(`BESTE ${Renderer.formatTime(p.bestLap)}`, 8, 66, "#9bd");

    // Gjenstand-ikon
    const ix = CONFIG.VIEW_W - 30, iy = 8;
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.strokeRect(ix - 1, iy - 1, 24, 24);
    if (p.item) {
      const col = p.item === "boost" ? "#ffd23f" : p.item === "oil" ? "#222" : "#c9ccd2";
      ctx.fillStyle = col; ctx.fillRect(ix, iy, 22, 22);
      this._text(p.item === "boost" ? "»" : p.item === "oil" ? "O" : "~", ix + 7, iy + 5, p.item === "oil" ? "#fff" : "#222");
    }
    if (Sound && Sound.muted) this._text("🔇", ix - 2, iy + 26, "#aaa");
    ctx.restore();
  }

  _text(s, x, y, col) {
    const ctx = this.ctx;
    ctx.fillStyle = "#000"; ctx.fillText(s, x + 1, y + 1);
    ctx.fillStyle = col; ctx.fillText(s, x, y);
  }

  _drawCountdown(game) {
    const ctx = this.ctx;
    const n = Math.min(3, Math.ceil(game.countdown)); // unngå et ekstra "4"
    const frac = game.countdown - Math.floor(game.countdown); // 1→0 innen sekundet
    const label = n <= 0 ? "GO!" : String(n);
    const scale = 1 + frac * 0.8;
    ctx.save();
    ctx.translate(CONFIG.VIEW_W / 2, CONFIG.VIEW_H / 2 - 10);
    ctx.scale(scale, scale);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "bold 48px 'Courier New', monospace";
    ctx.fillStyle = "#000"; ctx.fillText(label, 2, 2);
    ctx.fillStyle = n <= 0 ? "#8fffa0" : "#ffd23f"; ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  _drawBanner(text) {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "bold 28px 'Courier New', monospace";
    ctx.fillStyle = "#000"; ctx.fillText(text, CONFIG.VIEW_W / 2 + 2, 40 + 2);
    ctx.fillStyle = "#ffd23f"; ctx.fillText(text, CONFIG.VIEW_W / 2, 40);
    ctx.restore();
  }

  _drawMinimap(game) {
    const ctx = this.ctx;
    const tr = game.track;
    const mw = 70, mh = 50, mx = CONFIG.VIEW_W - mw - 6, my = CONFIG.VIEW_H - mh - 6;
    const s = Math.min(mw / tr.worldW, mh / tr.worldH);
    const ox = mx + (mw - tr.worldW * s) / 2, oy = my + (mh - tr.worldH * s) / 2;

    ctx.save();
    ctx.globalAlpha = 0.6; ctx.fillStyle = "#000"; ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#888"; ctx.lineWidth = 1; ctx.beginPath();
    const wp = tr.waypoints;
    for (let i = 0; i <= wp.length; i++) {
      const p = wp[i % wp.length];
      const X = ox + (p.x - tr.minX) * s, Y = oy + (p.y - tr.minY) * s;
      i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
    }
    ctx.stroke();
    for (const c of game.cars) {
      ctx.fillStyle = c.tagColor;
      const X = ox + (c.x - tr.minX) * s, Y = oy + (c.y - tr.minY) * s;
      ctx.fillRect(X - 1, Y - 1, c.isPlayer ? 3 : 2, c.isPlayer ? 3 : 2);
    }
    ctx.restore();
  }
}
