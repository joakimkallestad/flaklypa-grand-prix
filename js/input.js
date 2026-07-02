// Tastatur-input. Holder nede-tilstand + "edge"-trykk (én gang pr. nedtrykk).
const Input = {
  down: {},
  pressedQueue: {},

  init() {
    const block = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"];
    window.addEventListener("keydown", (e) => {
      if (block.includes(e.code)) e.preventDefault();
      if (!this.down[e.code]) this.pressedQueue[e.code] = true; // ny nedtrykk
      this.down[e.code] = true;
    });
    window.addEventListener("keyup", (e) => { this.down[e.code] = false; });
  },

  isDown(...codes) { return codes.some((c) => this.down[c]); },

  // true én gang pr. fysisk nedtrykk
  consume(...codes) {
    for (const c of codes) {
      if (this.pressedQueue[c]) { delete this.pressedQueue[c]; return true; }
    }
    return false;
  },

  // Spiller 1 = piltaster
  player1Controls() {
    let throttle = 0, steer = 0;
    if (this.isDown("ArrowUp")) throttle += 1;
    if (this.isDown("ArrowDown")) throttle -= 1;
    if (this.isDown("ArrowLeft")) steer -= 1;
    if (this.isDown("ArrowRight")) steer += 1;
    return { throttle, steer };
  },
  // Spiller 2 = WASD
  player2Controls() {
    let throttle = 0, steer = 0;
    if (this.isDown("KeyW")) throttle += 1;
    if (this.isDown("KeyS")) throttle -= 1;
    if (this.isDown("KeyA")) steer -= 1;
    if (this.isDown("KeyD")) steer += 1;
    return { throttle, steer };
  },
  playerControls() { return this.player1Controls(); }, // alias (1P)
};
