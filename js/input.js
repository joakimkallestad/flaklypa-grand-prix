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

  // Styringsinput for spilleren
  playerControls() {
    let throttle = 0, steer = 0;
    if (this.isDown("ArrowUp", "KeyW")) throttle += 1;
    if (this.isDown("ArrowDown", "KeyS")) throttle -= 1;
    if (this.isDown("ArrowLeft", "KeyA")) steer -= 1;
    if (this.isDown("ArrowRight", "KeyD")) steer += 1;
    return { throttle, steer };
  },
};
