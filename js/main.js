// Spilløkke + tilstandsmaskin (meny → countdown → løp → finishing → mål), med fast tidssteg.
const DIFFS = [
  { name: "Lett", skill: 0.86 },
  { name: "Normal", skill: 0.95 },
  { name: "Vill", skill: 1.05 },
];

const Game = {
  mode: "menu",       // menu | countdown | race | finishing | paused | finish
  selected: 0,
  selected2: 1,
  options: { laps: 3, difficulty: 1, players: 1 },
  time: 0,
  raceTime: 0,
  finishCounter: 0,
  countdown: 0,
  finishWait: 0,
  pauseSel: 0,

  init() {
    this.canvas = document.getElementById("screen");
    this.ctx = this.canvas.getContext("2d");
    this.renderer = new Renderer(this.ctx);

    buildAssets();
    Input.init();
    this._loadOptions();
    this._buildMenu();
    this._refreshOptions();
    this._refreshPlayersUI();
    this.showOverlay("menu");

    this._last = 0; this._acc = 0;
    requestAnimationFrame((t) => this.loop(t));

    // Debug: ?autorace lar AI styre alle biler for headless-verifisering (&cd beholder countdown, &p2 = delt skjerm).
    if (location.search.includes("autorace")) { this.autoAI = true; this.startRace(!location.search.includes("cd"), location.search.includes("p2") ? 2 : 1); }
  },

  _loadOptions() {
    try {
      const l = parseInt(localStorage.getItem("fgp_laps"), 10);
      const d = parseInt(localStorage.getItem("fgp_diff"), 10);
      const p = parseInt(localStorage.getItem("fgp_players"), 10);
      if (l === 3 || l === 5 || l === 7) this.options.laps = l;
      if (d >= 0 && d <= 2) this.options.difficulty = d;
      if (p === 1 || p === 2) this.options.players = p;
    } catch (e) {}
  },
  _saveOptions() {
    try {
      localStorage.setItem("fgp_laps", this.options.laps);
      localStorage.setItem("fgp_diff", this.options.difficulty);
      localStorage.setItem("fgp_players", this.options.players);
    } catch (e) {}
  },

  // ---------- Meny ----------
  _buildCarStrip(containerId, selectedIndex) {
    const wrap = document.getElementById(containerId);
    wrap.innerHTML = "";
    CAR_SPECS.forEach((spec, i) => {
      const div = document.createElement("div");
      div.className = "car-choice" + (i === selectedIndex ? " selected" : "");
      const cv = document.createElement("canvas");
      cv.width = 96; cv.height = 96;
      const cx = cv.getContext("2d"); cx.imageSmoothingEnabled = false;
      const spr = ASSETS.cars[spec.id].base;
      cx.translate(48, 48); cx.rotate(-Math.PI / 2);
      const sc = 2.4;
      cx.drawImage(spr, -spr.width * sc / 2, -spr.height * sc / 2, spr.width * sc, spr.height * sc);
      const stars = (v, lo, hi) => "★".repeat(1 + Math.round(((v - lo) / (hi - lo)) * 4));
      div.appendChild(cv);
      const name = document.createElement("div"); name.className = "name"; name.textContent = spec.name;
      const stats = document.createElement("div"); stats.className = "stats";
      stats.innerHTML = `Fart ${stars(spec.topSpeed, 200, 320)}<br>Grep ${stars(spec.grip, 0.6, 0.95)}<br>Start ${stars(spec.accel, 300, 450)}`;
      div.appendChild(name); div.appendChild(stats);
      wrap.appendChild(div);
    });
  },
  _buildMenu() {
    this._buildCarStrip("car-choices", this.selected);
    this._buildCarStrip("car-choices2", this.selected2);
  },
  _refreshCarStrip(containerId, selectedIndex) {
    document.querySelectorAll("#" + containerId + " .car-choice").forEach((el, i) => el.classList.toggle("selected", i === selectedIndex));
  },
  _refreshOptions() {
    document.getElementById("opt-laps").textContent = this.options.laps;
    document.getElementById("opt-diff").textContent = DIFFS[this.options.difficulty].name;
    document.getElementById("opt-sound").textContent = (typeof Sound !== "undefined" && Sound.muted) ? "Av" : "På";
  },
  _refreshPlayersUI() {
    document.getElementById("opt-players").textContent = this.options.players;
    document.getElementById("car-select-p2").classList.toggle("hidden", this.options.players !== 2);
  },

  showOverlay(which) {
    for (const id of ["menu", "finish", "pause"]) document.getElementById(id).classList.toggle("hidden", id !== which);
  },
  hideOverlays() { for (const id of ["menu", "finish", "pause"]) document.getElementById(id).classList.add("hidden"); },

  // ---------- Løp-oppsett ----------
  startRace(skipCountdown, mode) {
    mode = mode || 1;
    if (typeof Sound !== "undefined") { Sound.ensure(); Sound.unlock(); }

    this.track = new Track();
    this.track.laps = this.options.laps;
    this.particles = new Particles();
    this.world = new World(this.track);
    this.world.particles = this.particles;
    this.raceTime = 0; this.finishCounter = 0; this.placeFlash = null;

    const total = mode + CONFIG.NUM_AI;
    const starts = this.track.startPositions(total);
    this.cars = [];

    // Spiller 1
    this.player = new Car(getSpec(CAR_SPECS[this.selected].id), starts[0], true, 0);
    this.player.controller = "p1"; this.player.teamName = this.player.spec.name;
    this.cars.push(this.player);

    // Spiller 2 (kun 2P)
    this.player2 = null;
    let idc = 1;
    if (mode === 2) {
      this.player2 = new Car(getSpec(CAR_SPECS[this.selected2].id), starts[1], true, 1);
      this.player2.controller = "p2"; this.player2.teamName = this.player2.spec.name;
      this.player2.tagColor = CONFIG.P2_COLOR;
      this.cars.push(this.player2);
      idc = 2;
    }

    // AI fyller resten
    const skill = DIFFS[this.options.difficulty].skill;
    for (let i = idc; i < total; i++) {
      const spec = CAR_SPECS[i % CAR_SPECS.length];
      const livIdx = (i - idc) % AI_LIVERIES.length;
      const c = new Car(spec, starts[i], false, i);
      c.controller = "ai";
      c.frames = ASSETS.liveries[livIdx];
      c.tagColor = AI_LIVERIES[livIdx].body;
      c.teamName = AI_LIVERIES[livIdx].name;
      c.aiSkill = skill + (Math.random() * 0.08 - 0.04);
      this.cars.push(c);
    }

    // Forankre progress til mållinja (felles datum)
    const half = this.track.totalLen / 2;
    for (const c of this.cars) {
      c.near = this.track.nearestOnCenter(c.x, c.y);
      c.nearSeg = c.near.segIndex;
      c.lastRaw = this.track.arcLength(c.near.segIndex, c.near.t);
      c.cont = c.lastRaw >= half ? c.lastRaw - this.track.totalLen : c.lastRaw;
      c.currentLapStart = 0; c._timedLap = 0;
    }

    // Viewports (1 eller 2)
    this.humans = this.player2 ? [this.player, this.player2] : [this.player];
    const VW = CONFIG.VIEW_W, VH = CONFIG.VIEW_H;
    if (this.humans.length === 1) {
      this.viewports = [new Viewport(0, 0, VW, VH, this.player)];
    } else {
      const hlf = Math.floor(VW / 2);
      this.viewports = [new Viewport(0, 0, hlf, VH, this.humans[0]), new Viewport(hlf, 0, VW - hlf, VH, this.humans[1])];
    }

    this._updatePlaces();
    this._lastPlace = this.player.place;

    if (typeof Sound !== "undefined") Sound.startEngine();
    for (const vp of this.viewports) this.renderer.resetCamera(vp, this.track);

    if (skipCountdown) { this.mode = "race"; }
    else { this.mode = "countdown"; this.countdown = 3.999; }
    this.hideOverlays();
  },

  shakeFor(car, mag) { for (const vp of this.viewports) if (vp.car === car) vp.addShake(mag); },

  // ---------- Hovedløkke ----------
  loop(t) {
    const dt = Math.min(0.05, (t - this._last) / 1000 || 0);
    this._last = t;
    this.time += dt;

    if (this.mode === "countdown" || this.mode === "race" || this.mode === "finishing") {
      const step = 1 / 60;
      if (this.autoAI && !location.search.includes("slow")) {
        for (let i = 0; i < 150 && (this.mode === "countdown" || this.mode === "race" || this.mode === "finishing"); i++) this.fixedUpdate(step);
      } else {
        this._acc += dt;
        let guard = 0;
        while (this._acc >= step && guard < 5 && (this.mode === "countdown" || this.mode === "race" || this.mode === "finishing")) { this.fixedUpdate(step); this._acc -= step; guard++; }
      }
      this._updateAudio();
    } else {
      this._acc = 0;
    }

    this.handleUI();
    if (this.track && this.mode !== "menu") this.renderer.draw(this, dt);

    requestAnimationFrame((tt) => this.loop(tt));
  },

  _updateAudio() {
    if (typeof Sound === "undefined" || !Sound.engineOn) return;
    const p = this.player; // motor/skrik bundet til P1 (enkanals)
    Sound.updateEngine(p.speed, p.spec.topSpeed, p.boostTimer > 0);
    const onTrack = p.near && p.near.dist <= this.track.halfWidth;
    let scr = 0;
    if (onTrack) scr = Math.max(p.wobble > 0.45 ? p.wobble : 0, p.slipTimer > 0 ? 0.8 : 0);
    Sound.updateScreech(scr);
  },

  fixedUpdate(step) {
    if (this.mode !== "countdown" && this.mode !== "race" && this.mode !== "finishing") return;

    if (this.mode === "countdown") {
      const prev = Math.ceil(this.countdown);
      this.countdown -= step;
      const now = Math.ceil(this.countdown);
      if (now < prev && now >= 1 && typeof Sound !== "undefined") Sound.beep();
      for (const car of this.cars) car.update(step, { throttle: 0, steer: 0 }, this.track, this.particles);
      this.particles.update(step);
      if (this.countdown <= 0) { if (typeof Sound !== "undefined") Sound.go(); this.mode = "race"; }
      return;
    }

    this.raceTime += step;

    for (const car of this.cars) {
      let controls;
      if (this.autoAI) {
        controls = AI.control(car, this.track, this.world, step, this.cars);
      } else if (car.controller === "p1") {
        controls = Input.player1Controls();
        if (Input.consume("Space")) car.useItemNow = true;
      } else if (car.controller === "p2") {
        controls = Input.player2Controls();
        if (Input.consume("ShiftLeft")) car.useItemNow = true;
      } else {
        controls = AI.control(car, this.track, this.world, step, this.cars);
      }
      car.update(step, controls, this.track, this.particles);

      if (car.hitWall) {
        this.particles.sparks(car.hitWall.x, car.hitWall.y, car.hitWall.nx, car.hitWall.ny, car.hitWall.speed);
        this.shakeFor(car, Math.min(CONFIG.SHAKE_MAX, car.hitWall.speed / 40));
        car.hitWall = null;
      }

      // Rundetider
      if (car.lap > car._timedLap) {
        const lt = this.raceTime - car.currentLapStart;
        if (lt > 0.5) { car.lapTimes.push(lt); if (lt < car.bestLap) car.bestLap = lt; }
        car.currentLapStart = this.raceTime; car._timedLap = car.lap;
      } else if (car.lap < car._timedLap) {
        if (car.lapTimes.length) { car.lapTimes.pop(); car.bestLap = car.lapTimes.length ? Math.min.apply(null, car.lapTimes) : Infinity; }
        car._timedLap = car.lap; car.currentLapStart = this.raceTime;
      }

      if (car.finished && car.finishTime === 0) { car.finishTime = this.raceTime; car.finishOrder = ++this.finishCounter; }
    }

    this.world.update(step, this.cars);
    this.particles.update(step);
    this._updatePlaces();

    // Boost-punch + off-track-rumling pr. menneskebil (rist riktig halvdel)
    for (const h of this.humans) {
      if (h.boostTimer > 0 && !h._wasBoost) this.shakeFor(h, 3);
      h._wasBoost = h.boostTimer > 0;
      if (h.near && h.near.dist > this.track.halfWidth && h.speed > 60) this.shakeFor(h, 0.6);
    }

    if (this.placeFlash && this.placeFlash.t > 0) this.placeFlash.t -= step;

    // Begge mennesker i mål → finishing-fase (la AI fullføre)
    const humansDone = this.player.finished && (!this.player2 || this.player2.finished);
    if (this.mode === "race" && humansDone) {
      this.mode = "finishing"; this.finishWait = 8;
      const best = this.player2 ? Math.min(this.player.place, this.player2.place) : this.player.place;
      if (typeof Sound !== "undefined") Sound.fanfare(best === 1);
    }
    if (this.mode === "finishing") {
      this.finishWait -= step;
      if (this.cars.every((c) => c.finished) || this.finishWait <= 0) this._finishRace();
    }
  },

  _updatePlaces() {
    const sorted = [...this.cars].sort((a, b) => {
      if (a.finished && b.finished) return a.finishOrder - b.finishOrder;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
    sorted.forEach((c, i) => (c.place = i + 1));

    if ((this.mode === "race" || this.mode === "finishing") && this._lastPlace !== undefined && this.player.place !== this._lastPlace) {
      this.placeFlash = { dir: this.player.place < this._lastPlace ? 1 : -1, t: 1.2 };
    }
    this._lastPlace = this.player.place;
  },

  _finishRace() {
    this._updatePlaces();
    if (typeof Sound !== "undefined") Sound.stopEngine();
    this.placeFlash = null;
    this.mode = "finish";
    const PLACES = ["FØRSTEPLASS! 🏆", "Andreplass", "Tredjeplass", "Fjerdeplass", "Femteplass"];
    let txt;
    if (this.player2) txt = `P1: ${this.player.place}. plass  ·  P2: ${this.player2.place}. plass`;
    else txt = PLACES[this.player.place - 1] || `${this.player.place}. plass`;
    document.getElementById("finish-place").textContent = txt;
    this._renderResults();
    this.showOverlay("finish");
  },

  _renderResults() {
    const sorted = [...this.cars].sort((a, b) => a.place - b.place);
    const leader = sorted.find((c) => c.finished);
    const rows = sorted.map((c) => {
      const t = c.finished ? Renderer.formatTime(c.finishTime) : "DNF";
      let gap = "";
      if (c.finished && leader && c !== leader) gap = "+" + Renderer.formatTime(c.finishTime - leader.finishTime);
      const who = c.controller === "p1" ? "P1 · " : c.controller === "p2" ? "P2 · " : "";
      const cls = c.controller === "p1" ? ' class="me p1"' : c.controller === "p2" ? ' class="me p2"' : "";
      return `<tr${cls}><td>${c.place}</td><td>${who}${c.teamName}</td><td>${t}</td><td>${gap}</td></tr>`;
    }).join("");
    document.getElementById("results").innerHTML = `<table><tr><th>#</th><th>Bil</th><th>Tid</th><th>Gap</th></tr>${rows}</table>`;
  },

  // ---------- UI / tastetrykk utenfor fysikk ----------
  handleUI() {
    if (Input.consume("KeyM") && typeof Sound !== "undefined") { Sound.toggleMute(); this._refreshOptions(); this._refreshPauseSound(); }

    if (this.mode === "menu") {
      if (Input.consume("ArrowLeft")) { this.selected = (this.selected + CAR_SPECS.length - 1) % CAR_SPECS.length; this._refreshCarStrip("car-choices", this.selected); }
      if (Input.consume("ArrowRight")) { this.selected = (this.selected + 1) % CAR_SPECS.length; this._refreshCarStrip("car-choices", this.selected); }
      if (this.options.players === 2) {
        if (Input.consume("KeyA")) { this.selected2 = (this.selected2 + CAR_SPECS.length - 1) % CAR_SPECS.length; this._refreshCarStrip("car-choices2", this.selected2); }
        if (Input.consume("KeyD")) { this.selected2 = (this.selected2 + 1) % CAR_SPECS.length; this._refreshCarStrip("car-choices2", this.selected2); }
      }
      if (Input.consume("KeyP")) { this.options.players = this.options.players === 1 ? 2 : 1; this._saveOptions(); this._refreshPlayersUI(); }
      if (Input.consume("KeyL")) { const o = [3, 5, 7]; this.options.laps = o[(o.indexOf(this.options.laps) + 1) % o.length]; this._saveOptions(); this._refreshOptions(); }
      if (Input.consume("KeyK")) { this.options.difficulty = (this.options.difficulty + 1) % DIFFS.length; this._saveOptions(); this._refreshOptions(); }
      if (Input.consume("Enter", "NumpadEnter")) this.startRace(false, this.options.players);
    } else if (this.mode === "countdown") {
      Input.consume("Escape"); Input.consume("Enter", "NumpadEnter");
    } else if (this.mode === "race" || this.mode === "finishing") {
      if (Input.consume("Escape")) { this._pausedFrom = this.mode; this.mode = "paused"; this.pauseSel = 0; this.placeFlash = null; this._showPause(); if (typeof Sound !== "undefined") Sound.duckEngine(true); }
    } else if (this.mode === "paused") {
      if (Input.consume("ArrowUp")) { this.pauseSel = (this.pauseSel + 3) % 4; this._refreshPauseSel(); }
      if (Input.consume("ArrowDown")) { this.pauseSel = (this.pauseSel + 1) % 4; this._refreshPauseSel(); }
      if (Input.consume("Escape")) this._resume();
      if (Input.consume("Enter", "NumpadEnter")) {
        if (this.pauseSel === 0) this._resume();
        else if (this.pauseSel === 1) { if (typeof Sound !== "undefined") Sound.toggleMute(); this._refreshOptions(); this._refreshPauseSound(); }
        else if (this.pauseSel === 2) { if (typeof Sound !== "undefined") Sound.stopEngine(); this.startRace(false, this.options.players); }
        else { if (typeof Sound !== "undefined") Sound.stopEngine(); this.mode = "menu"; this.showOverlay("menu"); this._refreshOptions(); }
      }
    } else if (this.mode === "finish") {
      if (Input.consume("Enter", "NumpadEnter")) { this.mode = "menu"; this.showOverlay("menu"); }
    }
  },

  _resume() {
    this.mode = this._pausedFrom || "race";
    this.hideOverlays();
    if (typeof Sound !== "undefined") Sound.duckEngine(false);
  },
  _showPause() {
    document.getElementById("pause-info").textContent = `Runde ${this.player.displayLap(this.track)}/${this.track.laps} · ${Renderer.formatTime(this.raceTime)}`;
    this._refreshPauseSound();
    this._refreshPauseSel();
    this.showOverlay("pause");
  },
  _refreshPauseSel() {
    document.querySelectorAll("#pause-menu .pmi").forEach((el, i) => el.classList.toggle("selected", i === this.pauseSel));
  },
  _refreshPauseSound() {
    const el = document.getElementById("pmi-sound");
    if (el) el.textContent = "Lyd: " + ((typeof Sound !== "undefined" && Sound.muted) ? "Av" : "På");
  },
};

window.addEventListener("load", () => Game.init());
