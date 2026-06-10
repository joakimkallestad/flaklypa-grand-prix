// All tegning til den interne 480x270-bufferen (skaleres opp av CSS).
class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = false;
    this.camX = 0; this.camY = 0;
  }

  draw(game) {
    const ctx = this.ctx;
    const { track, world, cars, player } = game;
    this._track = track;
    const VW = CONFIG.VIEW_W, VH = CONFIG.VIEW_H;

    // Kamera følger spiller, klemt til verdensgrensene
    const tx = player.x - track.minX - VW / 2;
    const ty = player.y - track.minY - VH / 2;
    this.camX = clamp(tx, 0, Math.max(0, track.worldW - VW));
    this.camY = clamp(ty, 0, Math.max(0, track.worldH - VH));

    // 1) Verden (asfalt, gress, kanter, dekor)
    ctx.drawImage(track.worldCanvas, Math.round(this.camX), Math.round(this.camY), VW, VH, 0, 0, VW, VH);

    // 2) Oljesøl (på bakken, under biler)
    for (const h of world.hazards) {
      if (h.type === "oil") this._drawOil(h);
    }

    // 3) Pickup-bokser
    for (const b of world.boxes) {
      if (b.active) this._drawBox(b, game.time);
    }

    // 4) Biler (bakerst først)
    const ordered = [...cars].sort((a, b) => a.y - b.y);
    for (const car of ordered) this._drawCar(car);

    // 5) Røyksky (over biler)
    for (const h of world.hazards) {
      if (h.type === "smoke") this._drawSmoke(h);
    }

    // 6) Hvis spilleren er i røyk: tåkete vignett
    if (player.smokeTimer > 0) this._smokeVignette();

    // 7) HUD
    this._drawHUD(game);
    this._drawMinimap(game);
  }

  sx(wx) { return Math.round(wx - this.track().minX - this.camX); }
  sy(wy) { return Math.round(wy - this.track().minY - this.camY); }
  track() { return this._track; }

  _drawOil(h) {
    const ctx = this.ctx;
    const x = Math.round(h.x - this._track.minX - this.camX);
    const y = Math.round(h.y - this._track.minY - this.camY);
    const a = clamp(h.life / 1.5, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.65 * a + 0.2;
    ctx.fillStyle = "#15171c";
    ctx.beginPath(); ctx.ellipse(x, y, CONFIG.OIL_RADIUS, CONFIG.OIL_RADIUS * 0.7, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#3a2a4a";
    ctx.beginPath(); ctx.ellipse(x - 4, y - 3, CONFIG.OIL_RADIUS * 0.4, CONFIG.OIL_RADIUS * 0.28, 0, 0, 7); ctx.fill();
    ctx.restore();
  }

  _drawSmoke(h) {
    const ctx = this.ctx;
    const x = h.x - this._track.minX - this.camX;
    const y = h.y - this._track.minY - this.camY;
    const a = clamp(h.life / 1.5, 0, 1) * 0.7;
    ctx.save();
    for (const p of h.puffs) {
      ctx.globalAlpha = a * 0.6;
      ctx.fillStyle = "#c9ccd2";
      ctx.beginPath(); ctx.arc(x + p.ox, y + p.oy, p.r, 0, 7); ctx.fill();
      ctx.globalAlpha = a * 0.4;
      ctx.fillStyle = "#9aa0a8";
      ctx.beginPath(); ctx.arc(x + p.ox + 2, y + p.oy + 2, p.r * 0.7, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  _drawBox(b, time) {
    const ctx = this.ctx;
    const x = Math.round(b.x - this._track.minX - this.camX);
    const bob = Math.sin(time * 4 + b.x) * 2;
    const y = Math.round(b.y - this._track.minY - this.camY + bob);
    // skygge
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath(); ctx.ellipse(x, y + 8, 8, 3, 0, 0, 7); ctx.fill();
    // boks
    ctx.fillStyle = "#ffd23f"; ctx.fillRect(x - 7, y - 7, 14, 14);
    ctx.fillStyle = "#e0a020"; ctx.fillRect(x - 7, y + 3, 14, 4);
    ctx.fillStyle = "#7a5a00"; ctx.fillRect(x - 2, y - 5, 4, 10);
    ctx.fillRect(x - 5, y - 2, 10, 4);
  }

  _drawCar(car) {
    const ctx = this.ctx;
    const spr = ASSETS.cars[car.spec.id];
    const x = car.x - this._track.minX - this.camX;
    const y = car.y - this._track.minY - this.camY;

    // skygge
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(x, y + 3, 15, 8, 0, 0, 7); ctx.fill();
    ctx.restore();

    // boost-flamme bak bilen
    if (car.boostTimer > 0) {
      const bx = x - Math.cos(car.heading) * 16;
      const by = y - Math.sin(car.heading) * 16;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(bx, by, 5, 0, 7); ctx.fill();
      ctx.fillStyle = "#ff7a2c"; ctx.beginPath(); ctx.arc(bx, by, 3, 0, 7); ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(car.heading);
    ctx.drawImage(spr, -Math.round(spr.width / 2), -Math.round(spr.height / 2));
    ctx.restore();

    // liten markør over spiller-bilen
    if (car.isPlayer) {
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath();
      ctx.moveTo(x, y - 18); ctx.lineTo(x - 4, y - 24); ctx.lineTo(x + 4, y - 24);
      ctx.closePath(); ctx.fill();
    }
  }

  _smokeVignette() {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#b9bcc2";
    ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
    ctx.restore();
  }

  _drawHUD(game) {
    const ctx = this.ctx;
    const p = game.player;
    ctx.save();
    ctx.font = "bold 12px 'Courier New', monospace";
    ctx.textBaseline = "top";

    // Runde
    this._text(`RUNDE ${p.displayLap(game.track)}/${game.track.laps}`, 8, 8, "#ffd23f");
    // Plassering
    this._text(`${p.place}. PLASS`, 8, 22, "#fff");
    // Fart
    const kmh = Math.round(p.speed * 0.5);
    this._text(`${kmh} km/t`, 8, 36, "#9bd");

    // Gjenstand-ikon
    const ix = CONFIG.VIEW_W - 30, iy = 8;
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1;
    ctx.strokeRect(ix - 1, iy - 1, 24, 24);
    if (p.item) {
      const col = p.item === "boost" ? "#ffd23f" : p.item === "oil" ? "#222" : "#c9ccd2";
      ctx.fillStyle = col; ctx.fillRect(ix, iy, 22, 22);
      ctx.fillStyle = p.item === "oil" ? "#fff" : "#222";
      this._text(p.item === "boost" ? "»" : p.item === "oil" ? "O" : "~", ix + 7, iy + 5, p.item === "oil" ? "#fff" : "#222");
    }
    ctx.restore();
  }

  _text(s, x, y, col) {
    const ctx = this.ctx;
    ctx.fillStyle = "#000"; ctx.fillText(s, x + 1, y + 1);
    ctx.fillStyle = col; ctx.fillText(s, x, y);
  }

  _drawMinimap(game) {
    const ctx = this.ctx;
    const tr = game.track;
    const mw = 70, mh = 50, mx = CONFIG.VIEW_W - mw - 6, my = CONFIG.VIEW_H - mh - 6;
    const sx = mw / tr.worldW, sy = mh / tr.worldH;
    const s = Math.min(sx, sy);
    const ox = mx + (mw - tr.worldW * s) / 2;
    const oy = my + (mh - tr.worldH * s) / 2;

    ctx.save();
    ctx.globalAlpha = 0.6; ctx.fillStyle = "#000";
    ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
    ctx.globalAlpha = 1;

    // banelinje
    ctx.strokeStyle = "#888"; ctx.lineWidth = 1;
    ctx.beginPath();
    const wp = tr.waypoints;
    for (let i = 0; i <= wp.length; i++) {
      const p = wp[i % wp.length];
      const X = ox + (p.x - tr.minX) * s, Y = oy + (p.y - tr.minY) * s;
      i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
    }
    ctx.stroke();

    // biler
    for (const c of game.cars) {
      ctx.fillStyle = c.isPlayer ? "#ffd23f" : c.spec.colors.body;
      const X = ox + (c.x - tr.minX) * s, Y = oy + (c.y - tr.minY) * s;
      ctx.fillRect(X - 1, Y - 1, c.isPlayer ? 3 : 2, c.isPlayer ? 3 : 2);
    }
    ctx.restore();
  }
}
