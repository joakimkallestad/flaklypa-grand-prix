// Spilløkke + tilstandsmaskin (meny → løp → mål), med fast tidssteg.
const Game = {
  mode: "menu",       // "menu" | "race" | "paused" | "finish"
  selected: 0,
  time: 0,            // total tid (for animasjoner)
  raceTime: 0,
  finishCounter: 0,

  init() {
    this.canvas = document.getElementById("screen");
    this.ctx = this.canvas.getContext("2d");
    this.renderer = new Renderer(this.ctx);

    buildAssets();
    Input.init();
    this._buildMenu();
    this.showOverlay("menu");

    this._last = 0;
    this._acc = 0;
    requestAnimationFrame((t) => this.loop(t));

    // Debug: ?autorace starter løpet direkte (brukes til headless-verifisering)
    if (location.search.includes("autorace")) this.startRace();
  },

  // ---------- Meny ----------
  _buildMenu() {
    const wrap = document.getElementById("car-choices");
    wrap.innerHTML = "";
    CAR_SPECS.forEach((spec, i) => {
      const div = document.createElement("div");
      div.className = "car-choice" + (i === this.selected ? " selected" : "");
      const cv = document.createElement("canvas");
      cv.width = 96; cv.height = 96;
      const cx = cv.getContext("2d");
      cx.imageSmoothingEnabled = false;
      const spr = ASSETS.cars[spec.id];
      cx.translate(48, 48);
      cx.rotate(-Math.PI / 2);            // pek oppover
      const sc = 2.6;
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

  _refreshMenuSel() {
    document.querySelectorAll(".car-choice").forEach((el, i) => {
      el.classList.toggle("selected", i === this.selected);
    });
  },

  showOverlay(which) {
    for (const id of ["menu", "finish", "pause"]) {
      document.getElementById(id).classList.toggle("hidden", id !== which);
    }
    this._overlay = which;
  },
  hideOverlays() {
    for (const id of ["menu", "finish", "pause"]) document.getElementById(id).classList.add("hidden");
    this._overlay = null;
  },

  // ---------- Løp-oppsett ----------
  startRace() {
    this.track = new Track();
    this.world = new World(this.track);
    this.raceTime = 0;
    this.finishCounter = 0;

    const total = 1 + CONFIG.NUM_AI;
    const starts = this.track.startPositions(total);
    this.cars = [];

    // Spiller
    this.player = new Car(getSpec(CAR_SPECS[this.selected].id), starts[0], true);
    this.cars.push(this.player);

    // AI — velg ulike specs, varier ferdighet
    let si = 0;
    for (let i = 1; i < total; i++) {
      // hopp over spillerens spec for variasjon der det går
      let spec = CAR_SPECS[si % CAR_SPECS.length];
      if (spec.id === this.player.spec.id && CAR_SPECS.length > 1) { si++; spec = CAR_SPECS[si % CAR_SPECS.length]; }
      si++;
      const c = new Car(spec, starts[i], false);
      c.aiSkill = 0.9 + Math.random() * 0.14;
      this.cars.push(c);
    }

    // Init lastWp til faktisk nærmeste waypoint (unngå falsk linjekryssing frame 1)
    for (const c of this.cars) c.lastWp = this.track.nearestWaypoint(c.x, c.y);

    this._updatePlaces();
    this.mode = "race";
    this.hideOverlays();
  },

  // ---------- Hovedløkke ----------
  loop(t) {
    const dt = Math.min(0.05, (t - this._last) / 1000 || 0);
    this._last = t;
    this.time += dt;

    if (this.mode === "race") {
      // Fast tidssteg for stabil fysikk
      this._acc += dt;
      const step = 1 / 60;
      let guard = 0;
      while (this._acc >= step && guard < 5) { this.fixedUpdate(step); this._acc -= step; guard++; }
    } else {
      this._acc = 0;
    }

    this.handleUI();

    if (this.mode === "race" || this.mode === "paused" || this.mode === "finish") {
      if (this.track) this.renderer.draw(this);
    }

    requestAnimationFrame((tt) => this.loop(tt));
  },

  fixedUpdate(dt) {
    this.raceTime += dt;

    for (const car of this.cars) {
      let controls;
      if (car.isPlayer) {
        controls = Input.playerControls();
        if (Input.consume("Space")) car.useItemNow = true;
      } else {
        controls = AI.control(car, this.track, this.world, dt);
      }
      car.update(dt, controls, this.track, this.world);

      // Registrer måltid
      if (car.finished && car.finishTime === 0) {
        car.finishTime = this.raceTime;
        car.finishOrder = ++this.finishCounter;
      }
    }

    this.world.update(dt, this.cars);
    this._updatePlaces();

    // Løpet er over når spilleren er i mål
    if (this.player.finished && this.mode === "race") {
      this.mode = "finish";
      const place = this.player.place;
      const txt = ["FØRSTEPLASS! 🏆", "Andreplass", "Tredjeplass", "Fjerdeplass", "Femteplass"][place - 1] || `${place}. plass`;
      document.getElementById("finish-place").textContent = txt;
      this.showOverlay("finish");
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
  },

  // ---------- UI / tastetrykk utenfor fysikk ----------
  handleUI() {
    if (this.mode === "menu") {
      if (Input.consume("ArrowLeft", "KeyA")) { this.selected = (this.selected + CAR_SPECS.length - 1) % CAR_SPECS.length; this._refreshMenuSel(); }
      if (Input.consume("ArrowRight", "KeyD")) { this.selected = (this.selected + 1) % CAR_SPECS.length; this._refreshMenuSel(); }
      if (Input.consume("Enter", "NumpadEnter")) this.startRace();
    } else if (this.mode === "race") {
      if (Input.consume("Escape")) { this.mode = "paused"; this.showOverlay("pause"); }
    } else if (this.mode === "paused") {
      if (Input.consume("Escape")) { this.mode = "race"; this.hideOverlays(); }
    } else if (this.mode === "finish") {
      if (Input.consume("Enter", "NumpadEnter")) { this.mode = "menu"; this.showOverlay("menu"); }
    }
  },
};

window.addEventListener("load", () => Game.init());
