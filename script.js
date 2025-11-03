// (1) Wrap everything in an immediately-invoked function expression (IIFE)
//     This creates a private scope so variables here don't leak into the global window object.
//     It also allows us to run initialization code immediately.
(() => {

  // ======== Get HTML elements ========
  // (2) Find the element with id "home" and store a reference in the variable `home`
  const home = document.getElementById("home");
  // (3) Find the element with id "game" and store a reference in `game`
  const game = document.getElementById("game");
  // (4) Get the "Start Game" button element
  const startBtn = document.getElementById("startBtn");
  // (5) Get the "Home" button that appears inside the game screen
  const homeBtn = document.getElementById("homeBtn");
  // (6) Get the "Restart" button element
  const restartBtn = document.getElementById("restart");
  // (7) Get the difficulty select dropdown element
  const diffSelect = document.getElementById("difficulty");
  // (8) Get the span that displays the current score (will be updated in real time)
  const scoreEl = document.getElementById("score");

  // (9) Get references to touch control buttons (mobile)
  const leftBtn = document.getElementById("leftBtn");
  const rightBtn = document.getElementById("rightBtn");
  const fireBtn = document.getElementById("fireBtn");

  // (10) Get the canvas element used to draw the game
  const c = document.getElementById("c");
  // (11) Acquire the 2D drawing context from the canvas — this `ctx` object is used for drawing shapes, images, colors, etc.
  const ctx = c.getContext("2d");

  // ======== Variables ========
  // (12) We'll declare game state variables here (they're defined later inside initGame but declaring reference variables here is common style)
  let player, bullets, asteroids, boosters;
  // (13) Score and control flags
  let score, running, spawn, lastShot;
  // (14) Timing and difficulty parameters
  let fireRate, spawnRate, asteroidSpeed;
  // (15) Shield state (whether shield booster active) and its remaining time
  let shieldActive = false, shieldTimer = 0;
  // (16) Keyboard input storage (object mapping keys to boolean pressed/unpressed)
  const keys = {};
  // (17) Touch-state booleans for on-screen controls (true when pressed)
  let touchLeft = false, touchRight = false, touchFire = false;

  // ======== Event Listeners ========
  // (18) Listen for keyboard key down events; mark the key as pressed in the `keys` map.
  //      e.key is a string like "ArrowLeft", "a", " " (space), etc.
  window.addEventListener("keydown", e => keys[e.key] = true);
  // (19) Listen for keyboard key up events; mark the key as released (false).
  window.addEventListener("keyup", e => keys[e.key] = false);

  // (20) Touch events: when touch starts on leftBtn set touchLeft true
  leftBtn.addEventListener("touchstart", () => touchLeft = true);
  // (21) When touch ends on leftBtn set touchLeft false
  leftBtn.addEventListener("touchend", () => touchLeft = false);
  // (22) Touch start for right button sets touchRight true
  rightBtn.addEventListener("touchstart", () => touchRight = true);
  // (23) Touch end for right button sets touchRight false
  rightBtn.addEventListener("touchend", () => touchRight = false);
  // (24) Touch start for fire button sets touchFire true
  fireBtn.addEventListener("touchstart", () => touchFire = true);
  // (25) Touch end for fire button sets touchFire false
  fireBtn.addEventListener("touchend", () => touchFire = false);

  // (26) A plain object defining configuration for each difficulty level.
  //      Each difficulty sets a min/max asteroid speed, spawn rate between asteroids, and initial fire rate.
  const difficulty = {
    easy: { asteroidSpeed: [40, 60], spawnRate: 1.6, fireRate: 250 },
    medium: { asteroidSpeed: [60, 90], spawnRate: 1.0, fireRate: 200 },
    hard: { asteroidSpeed: [90, 130], spawnRate: 0.7, fireRate: 150 }
  };

  // ======== Game Init ========
  // (27) initGame(diff) — reset or initialize all game state for a new run.
  //      `diff` is a string like "easy", "medium", "hard".
  function initGame(diff) {
    // (28) Player object with x,y coordinates and width/height values to draw and for collision checks
    player = { x: c.width / 2, y: c.height - 60, w: 36, h: 28 };
    // (29) Arrays to hold bullet, asteroid, and booster objects
    bullets = [];
    asteroids = [];
    boosters = [];
    // (30) Initialize score, spawn timer, and lastShot timestamp
    score = 0;
    spawn = 0;
    lastShot = 0;
    // (31) Reset shield state/timer
    shieldActive = false;
    shieldTimer = 0;
    // (32) Update the on-screen score display to 0
    scoreEl.textContent = "0";

    // (33) Look up difficulty settings and apply them into local variables
    const set = difficulty[diff];
    fireRate = set.fireRate;           // time (ms) between shots
    spawnRate = set.spawnRate;         // seconds between asteroid spawns (approx)
    asteroidSpeed = set.asteroidSpeed; // [min,max] vertical speeds for asteroids

    // (34) Mark game running and start the main loop with a timestamp
    running = true;
    loop(performance.now());
  }

  // ======== Create Asteroid ========
  // (35) spawnAsteroid() — generate an irregular polygon asteroid and push to asteroids array
  function spawnAsteroid() {
    // (36) Pick a random number of polygon sides between 6 and 9 (6 + 0..3)
    const sides = 6 + Math.floor(Math.random() * 4);
    // (37) Create an empty array that will hold the polygon's vertex offsets (relative to asteroid center)
    const points = [];
    // (38) Choose a base radius somewhere between 15 and 45 (smaller or larger asteroids)
    const radius = 15 + Math.random() * 30;
    // (39) For each side create a point at angle i/sides * 2π with a randomized radius multiplier to make the shape jagged
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      const r = radius * (0.7 + Math.random() * 0.6); // vary radius 70%..130%
      points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    // (40) Push a new asteroid object into the asteroids array:
    //      - x: spawn horizontal position anywhere across canvas
    //      - y: start slightly above the visible top (-40)
    //      - vy: a vertical speed picked between min/max of selected difficulty
    //      - rot: initial rotation angle
    //      - rSpeed: rotation speed (positive or negative)
    //      - points: polygon vertex offsets for drawing shape
    //      - radius: base radius used for collision size checks
    //      - hp: hitpoints proportional to size (ceil(radius/10)) — larger asteroids take more hits
    asteroids.push({
      x: Math.random() * c.width,
      y: -40,
      vy: asteroidSpeed[0] + Math.random() * (asteroidSpeed[1] - asteroidSpeed[0]),
      rot: Math.random() * Math.PI * 2,
      rSpeed: (Math.random() - 0.5) * 1.5,
      points,
      radius,
      hp: Math.ceil(radius / 10)
    });
  }

  // ======== Booster Spawn ========
  // (41) spawnBooster() — create a booster power-up that falls down the screen
  function spawnBooster() {
    // (42) Types: fireRate reduces time between shots, shield grants temporary collision immunity,
    //      score instantly adds points (simple choices)
    const types = ["fireRate", "shield", "score"];
    // (43) Push booster object into boosters array; it spawns at a random x and above top
    boosters.push({
      x: 30 + Math.random() * (c.width - 60), // keep inside margins
      y: -20,
      vy: 100,                                  // vertical speed of booster falling down
      type: types[Math.floor(Math.random() * types.length)],
      size: 12
    });
  }

  // ======== Update ========
  // (44) update(dt) — update every object by the time delta dt (seconds)
  function update(dt) {
    // (45) Move player left when ArrowLeft or 'a' or touchLeft is pressed
    if (keys["ArrowLeft"] || keys["a"] || touchLeft) player.x -= 220 * dt;
    // (46) Move player right when ArrowRight or 'd' or touchRight is pressed
    if (keys["ArrowRight"] || keys["d"] || touchRight) player.x += 220 * dt;
    // (47) Clamp player.x so the ship remains inside horizontal bounds (10px margin)
    player.x = Math.max(10, Math.min(c.width - 10 - player.w, player.x));

    // (48) Shooting: if Space or 'z' or touchFire and enough time passed since lastShot according to `fireRate`
    if ((keys[" "] || keys["z"] || touchFire) && performance.now() - lastShot > fireRate) {
      // (49) Add a bullet object at the front of the ship, traveling upward at vy = -400 px/sec
      bullets.push({ x: player.x + player.w / 2, y: player.y, vy: -400 });
      // (50) Update lastShot timestamp (ms) so firing respects fireRate
      lastShot = performance.now();
    }

    // (51) Move bullets by their vertical speed
    bullets.forEach(b => b.y += b.vy * dt);
    // (52) Remove bullets that have left the screen (y < -10)
    bullets = bullets.filter(b => b.y > -10);

    // (53) Asteroid spawn timer: decrement by dt
    spawn -= dt;
    // (54) If timer expired, reset spawn timer and spawn a new asteroid
    if (spawn <= 0) {
      spawn = spawnRate;
      spawnAsteroid();
      // (55) 20% chance to spawn a booster together with this asteroid to make boosters occasional
      if (Math.random() < 0.2) spawnBooster();
    }

    // (56) Move each asteroid down and rotate it
    asteroids.forEach(a => { a.y += a.vy * dt; a.rot += a.rSpeed * dt; });
    // (57) Remove asteroids that have passed below the bottom by >40 px
    asteroids = asteroids.filter(a => a.y < c.height + 40);

    // (58) Move boosters down
    boosters.forEach(b => b.y += b.vy * dt);
    // (59) Remove boosters that went off-screen
    boosters = boosters.filter(b => b.y < c.height + 20);

    // ====== Collision: bullets vs asteroids ======
    // (60) iterate backwards over asteroids to safely remove ones that die while iterating
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const a = asteroids[i];
      // (61) iterate backwards over bullets
      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        // (62) compute squared distance between asteroid center and bullet
        const dx = a.x - b.x, dy = a.y - b.y;
        // (63) collision test: compare squared distance to (collision radius)^2 using a.radius * 0.6 fudge factor
        if (dx * dx + dy * dy < a.radius * a.radius * 0.6) {
          // (64) remove the bullet that hit the asteroid
          bullets.splice(j, 1);
          // (65) reduce asteroid hp by 1
          a.hp--;
          // (66) if hp <= 0 then asteroid destroyed
          if (a.hp <= 0) {
            // (67) remove asteroid from array
            asteroids.splice(i, 1);
            // (68) increase score by 10
            score += 10;
            // (69) update the visible score span
            scoreEl.textContent = score;
          }
          // (70) break out of bullet loop because this asteroid has been processed against this bullet
          break;
        }
      }

      // ====== Collision: asteroid vs player (ship) ======
      // (71) if shield is not active and asteroid and player overlap then end the game
      if (!shieldActive && Math.abs(a.x - (player.x + player.w / 2)) < a.radius && Math.abs(a.y - (player.y + player.h / 2)) < a.radius) {
        // (72) stop the game loop
        running = false;
        // (73) show a simple alert with final score
        alert("💥 You were hit! Final Score: " + score);
      }
    }

    // ====== Collision: player picking up boosters ======
    // (74) iterate backwards through boosters to remove ones that were collected
    for (let i = boosters.length - 1; i >= 0; i--) {
      const b = boosters[i];
      // (75) check if booster is close enough to player center to be considered picked up
      if (Math.abs(b.x - (player.x + player.w / 2)) < 20 && Math.abs(b.y - (player.y + player.h / 2)) < 20) {
        // (76) apply the booster effect based on its type
        applyBooster(b.type);
        // (77) remove this booster from the array so it is not applied again
        boosters.splice(i, 1);
      }
    }

    // (78) Update shield timer: if shield is active, decrement the timer and disable when it hits zero
    if (shieldActive) {
      shieldTimer -= dt;
      if (shieldTimer <= 0) shieldActive = false;
    }
  }

  // (79) applyBooster(type) — apply effects based on booster `type`
  function applyBooster(type) {
    // (80) If fireRate booster: reduce fireRate (time between shots) down to a minimum guard (80ms)
    if (type === "fireRate") fireRate = Math.max(80, fireRate - 80);
    // (81) If shield booster: enable shield and set shield timer to 5 seconds
    if (type === "shield") { shieldActive = true; shieldTimer = 5; }
    // (82) If score booster: give an instant bonus and update display
    if (type === "score") { score += 50; scoreEl.textContent = score; }
  }

  // ======== Draw Everything ========
  // (83) draw() — renders the entire game frame using the canvas drawing context
  function draw() {
    // (84) Clear the whole canvas to prepare for a new frame
    ctx.clearRect(0, 0, c.width, c.height);

    // (85) Draw player ship as a simple filled triangle
    // (86) Use cyan color if shield active, otherwise default ship color
    ctx.fillStyle = shieldActive ? "#0ff" : "#7be1ff";
    ctx.beginPath();
    // (87) left corner of triangle (bottom-left of ship)
    ctx.moveTo(player.x, player.y + player.h);
    // (88) top point of triangle (ship nose)
    ctx.lineTo(player.x + player.w / 2, player.y);
    // (89) bottom-right of triangle
    ctx.lineTo(player.x + player.w, player.y + player.h);
    // (90) fill the triangle with the chosen fillStyle
    ctx.fill();

    // (91) Draw bullets as small vertical rectangles
    ctx.fillStyle = "#0ff";
    bullets.forEach(b => ctx.fillRect(b.x - 2, b.y - 8, 4, 12));

    // (92) Draw every asteroid. Each asteroid is drawn by:
    //      - saving the context state
    //      - translating to asteroid center
    //      - rotating by its current rotation
    //      - drawing the polygon using its `points` offsets
    //      - restoring the context back
    asteroids.forEach(a => {
      ctx.save();                        // (93) save current transform/state
      ctx.translate(a.x, a.y);           // (94) move origin to asteroid center
      ctx.rotate(a.rot);                 // (95) rotate the canvas by asteroid rot value
      // (96) create a radial gradient to give the asteroid depth (center -> edge)
      const grad = ctx.createRadialGradient(0, 0, a.radius * 0.3, 0, 0, a.radius);
      grad.addColorStop(0, "#666");
      grad.addColorStop(1, "#222");
      ctx.fillStyle = grad;              // (97) use gradient as fill style
      ctx.beginPath();
      const p0 = a.points[0];            // (98) move to first polygon point
      ctx.moveTo(p0.x, p0.y);
      // (99) iterate remaining polygon points and draw line to each
      for (let i = 1; i < a.points.length; i++) ctx.lineTo(a.points[i].x, a.points[i].y);
      // (100) close the path and fill the polygon
      ctx.closePath();
      ctx.fill();
      // (101) restore context so subsequent drawing is not affected by translate/rotate
      ctx.restore();
    });

    // (102) Draw boosters as colored circles with color based on type
    boosters.forEach(b => {
      ctx.fillStyle = b.type === "shield" ? "#0ff" : b.type === "fireRate" ? "#ff0" : "#f0f";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ======== Loop ========
  // (103) `last` stores previous frame timestamp for dt calculation
  let last = performance.now();
  // (104) loop(now) is called each animation frame to update & render the game
  function loop(now) {
    // (105) compute time delta in seconds but clamp to a max (0.04s) to avoid very large jumps
    const dt = Math.min(0.04, (now - last) / 1000);
    // (106) update last with the current timestamp for next frame delta
    last = now;
    // (107) only update/render while the game is running
    if (running) {
      update(dt);   // (108) update game state by dt seconds
      draw();       // (109) draw the current state
      requestAnimationFrame(loop); // (110) schedule next frame
    }
  }

  // ======== Buttons ========
  // (111) Start game button: hide home screen, show game, and initialize with selected difficulty
  startBtn.addEventListener("click", () => {
    home.classList.add("hidden");
    game.classList.remove("hidden");
    initGame(diffSelect.value);
  });

  // (112) Home button: stop running and show the home screen again
  homeBtn.addEventListener("click", () => {
    running = false;
    game.classList.add("hidden");
    home.classList.remove("hidden");
  });

  // (113) Restart button: stop current run and start a fresh one using current difficulty selection
  restartBtn.addEventListener("click", () => {
    running = false;
    initGame(diffSelect.value);
  });

// (114) Close IIFE: end of private scope
})();
