// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// farm is scaled to fit the window and centred, the margin filled with dark green. Flat
// shapes and canvas text: grass patches, the dirt path, the pond, the hay, the fenced pen,
// the dog, the ducks, the fox, the dust and feathers, the HUD and the panels.

import { FIELD, FONT, PALETTE, PEN } from './config.js';
import { LEVELS } from './levels.js';
import { kindStats } from './flock.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LEVEL = 'level';
export const SCREEN_OVER = 'over';
export const SCREEN_CAMPAIGN = 'campaign';

const TAU = Math.PI * 2;

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  // The grass is never flat: a fixed set of seeded patches and flowers, drawn once a
  // frame from a list made at boot, so the field looks the same every visit.
  const patches = [];
  let seed = 1234567;
  const nextRandom = () => {
    seed = (seed * 1664525 + 1013904223) | 0;
    return ((seed >>> 0) / 4294967296);
  };
  for (let index = 0; index < 46; index += 1) {
    patches.push({
      x: nextRandom() * FIELD.width,
      y: FIELD.hudHeight + nextRandom() * (FIELD.height - FIELD.hudHeight),
      rx: 40 + nextRandom() * 90,
      ry: 24 + nextRandom() * 44,
      shade: nextRandom() < 0.5 ? PALETTE.grassDark : PALETTE.grassLight,
    });
  }
  const flowers = [];
  for (let index = 0; index < 26; index += 1) {
    flowers.push({
      x: 20 + nextRandom() * (FIELD.width - 40),
      y: FIELD.hudHeight + 20 + nextRandom() * (FIELD.height - FIELD.hudHeight - 40),
      color: nextRandom() < 0.5 ? '#fff6c9' : '#ffd9e8',
    });
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${weight ?? ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ?? ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function circle(x, y, radius, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    context.fill();
  }

  function shadow(x, y, radius) {
    context.fillStyle = 'rgba(0, 0, 0, 0.18)';
    context.beginPath();
    context.ellipse(x, y + radius * 0.7, radius, radius * 0.42, 0, 0, TAU);
    context.fill();
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function drawField(state) {
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, FIELD.hudHeight, FIELD.width, FIELD.height - FIELD.hudHeight);
    for (const patch of patches) {
      context.fillStyle = patch.shade;
      context.globalAlpha = 0.35;
      context.beginPath();
      context.ellipse(patch.x, patch.y, patch.rx, patch.ry, 0, 0, TAU);
      context.fill();
    }
    context.globalAlpha = 1;
    for (const flower of flowers) {
      circle(flower.x, flower.y, 2.5, flower.color);
    }

    // The dirt path: a narrow track from the field's left edge to the pen's gate,
    // with a dashed centre line. It guides the eye (and the ducks) to the gate
    // without eating the middle of the field.
    const pen = state.pen;
    const pathTop = pen.gateY - 42;
    const pathHeight = 84;
    context.fillStyle = PALETTE.dirt;
    context.fillRect(0, pathTop, pen.x + 10, pathHeight);
    context.fillStyle = PALETTE.dirtDark;
    context.fillRect(0, pathTop, pen.x + 10, 5);
    context.fillRect(0, pathTop + pathHeight - 5, pen.x + 10, 5);
    context.fillStyle = 'rgba(0, 0, 0, 0.12)';
    for (let x = 24; x < pen.x - 24; x += 48) context.fillRect(x, pen.gateY - 3, 24, 6);

    for (const pond of state.ponds) {
      circle(pond.x, pond.y, pond.r, PALETTE.pondDeep);
      circle(pond.x, pond.y, pond.r - 8, PALETTE.pond);
      context.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(pond.x, pond.y, pond.r * 0.55, 0.3, 2.4);
      context.stroke();
      context.beginPath();
      context.arc(pond.x, pond.y, pond.r * 0.3, 3.4, 5.6);
      context.stroke();
    }

    for (const bale of state.hay) {
      circle(bale.x, bale.y, bale.r, PALETTE.hayDark);
      circle(bale.x, bale.y, bale.r - 5, PALETTE.hay);
      context.strokeStyle = PALETTE.hayDark;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(bale.x, bale.y, bale.r * 0.55, 0.4, 2.6);
      context.stroke();
    }
  }

  function drawPen(state) {
    const pen = state.pen;
    // The barn wall at the pen's back.
    context.fillStyle = PALETTE.barn;
    context.fillRect(pen.x + pen.w - 26, pen.y, 26, pen.h);
    context.fillStyle = PALETTE.barnRoof;
    context.fillRect(pen.x + pen.w - 26, pen.y, 26, 14);
    // Straw on the pen floor.
    context.fillStyle = '#d9bd7a';
    context.globalAlpha = 0.55;
    context.fillRect(pen.x + 4, pen.y + 4, pen.w - 34, pen.h - 8);
    context.globalAlpha = 1;
    // The fence: posts and two rails, with a gap for the gate on the left wall.
    context.strokeStyle = PALETTE.fence;
    context.lineWidth = 5;
    context.lineCap = 'round';
    const gateTop = pen.gateY - pen.gateH / 2;
    const gateBottom = pen.gateY + pen.gateH / 2;
    function rail(x1, y1, x2, y2) {
      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      context.stroke();
    }
    rail(pen.x, pen.y, pen.x + pen.w, pen.y);
    rail(pen.x, pen.y + pen.h, pen.x + pen.w, pen.y + pen.h);
    rail(pen.x + pen.w, pen.y, pen.x + pen.w, pen.y + pen.h);
    rail(pen.x, pen.y, pen.x, gateTop);
    rail(pen.x, gateBottom, pen.x, pen.y + pen.h);
    rail(pen.x, pen.y + 18, pen.x + pen.w, pen.y + 18);
    rail(pen.x, pen.y + pen.h - 18, pen.x + pen.w, pen.y + pen.h - 18);
    rail(pen.x + pen.w - 8, pen.y, pen.x + pen.w - 8, pen.y + pen.h);
    context.fillStyle = PALETTE.fenceDark;
    const posts = [
      [pen.x, pen.y], [pen.x + pen.w / 2, pen.y], [pen.x + pen.w, pen.y],
      [pen.x, pen.y + pen.h], [pen.x + pen.w / 2, pen.y + pen.h], [pen.x + pen.w, pen.y + pen.h],
      [pen.x, gateTop], [pen.x, gateBottom], [pen.x + pen.w, pen.y + pen.h / 2],
    ];
    for (const [px, py] of posts) {
      context.beginPath();
      context.arc(px, py, 6, 0, TAU);
      context.fill();
    }
    // The gate: two open leaves, so the way in reads at a glance.
    context.strokeStyle = PALETTE.fenceDark;
    context.lineWidth = 4;
    rail(pen.x - 16, gateTop - 12, pen.x, gateTop);
    rail(pen.x - 16, gateBottom + 12, pen.x, gateBottom);
    // The funnel wings: fence rails angling out from the gate, with posts.
    context.strokeStyle = PALETTE.fence;
    context.lineWidth = 5;
    for (const wing of pen.wings) {
      rail(wing.x1, wing.y1, wing.x2, wing.y2);
    }
    context.fillStyle = PALETTE.fenceDark;
    for (const wing of pen.wings) {
      context.beginPath();
      context.arc(wing.x2, wing.y2, 6, 0, TAU);
      context.fill();
      context.beginPath();
      context.arc((wing.x1 + wing.x2) / 2, (wing.y1 + wing.y2) / 2, 5, 0, TAU);
      context.fill();
    }
    text('PEN', pen.x + pen.w / 2 - 8, pen.y + pen.h - 12, 20, PALETTE.fenceDark, 'center', 'bold ');
  }

  function drawDuck(duck, time) {
    const stats = kindStats(duck.type);
    const radius = stats.radius;
    const body = duck.type === 'duckling' ? PALETTE.duckling : PALETTE.duck;
    const dark = duck.type === 'duckling' ? PALETTE.duck : PALETTE.duckDark;
    shadow(duck.x, duck.y, radius);
    const waddle = duck.alert ? Math.sin(time * 22) * 2 : Math.sin(time * 6) * 1;
    const heading = duck.heading;
    const hx = Math.cos(heading);
    const hy = Math.sin(heading);
    // Body, head and beak, all pointed where the duck is going.
    context.fillStyle = body;
    context.beginPath();
    context.ellipse(duck.x, duck.y + waddle * 0.4, radius + 2, radius * 0.82, heading, 0, TAU);
    context.fill();
    context.fillStyle = dark;
    context.beginPath();
    context.arc(duck.x - hx * radius * 0.4, duck.y - hy * radius * 0.4, radius * 0.55, 0, TAU);
    context.fill();
    context.fillStyle = body;
    context.beginPath();
    context.arc(duck.x + hx * radius * 1.15, duck.y + hy * radius * 1.15, radius * 0.62, 0, TAU);
    context.fill();
    context.fillStyle = PALETTE.beak;
    context.beginPath();
    context.moveTo(duck.x + hx * radius * 1.6, duck.y + hy * radius * 1.6);
    context.lineTo(duck.x + hx * radius * 2.3 - hy * radius * 0.35, duck.y + hy * radius * 2.3 + hx * radius * 0.35);
    context.lineTo(duck.x + hx * radius * 2.3 + hy * radius * 0.35, duck.y + hy * radius * 2.3 - hx * radius * 0.35);
    context.closePath();
    context.fill();
    circle(duck.x + hx * radius * 1.15 - hy * radius * 0.25, duck.y + hy * radius * 1.15 + hx * radius * 0.25, 2, '#23232b');
    if (duck.alert) {
      text('!', duck.x, duck.y - radius - 8, 20, PALETTE.danger, 'center', 'bold ');
    }
  }

  function drawDog(dog, time) {
    shadow(dog.x, dog.y, 18);
    const wag = Math.sin(time * (dog.running ? 16 : 5)) * 0.5;
    const hx = Math.cos(dog.facing);
    const hy = Math.sin(dog.facing);
    // Tail, wagging.
    context.strokeStyle = PALETTE.dog;
    context.lineWidth = 6;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(dog.x - hx * 18, dog.y - hy * 18);
    context.lineTo(dog.x - hx * 28 + -hy * wag * 10, dog.y - hy * 28 + hx * wag * 10);
    context.stroke();
    // Body and white chest.
    context.fillStyle = PALETTE.dog;
    context.beginPath();
    context.ellipse(dog.x, dog.y, 20, 14, dog.facing, 0, TAU);
    context.fill();
    context.fillStyle = PALETTE.dogWhite;
    context.beginPath();
    context.ellipse(dog.x + hx * 8, dog.y + hy * 8, 9, 7, dog.facing, 0, TAU);
    context.fill();
    // Head, ears and nose.
    context.fillStyle = PALETTE.dog;
    context.beginPath();
    context.arc(dog.x + hx * 20, dog.y + hy * 20, 11, 0, TAU);
    context.fill();
    context.beginPath();
    context.moveTo(dog.x + hx * 20 - hy * 7, dog.y + hy * 20 + hx * 7);
    context.lineTo(dog.x + hx * 30 - hy * 10, dog.y + hy * 30 + hx * 10);
    context.lineTo(dog.x + hx * 24 - hy * 2, dog.y + hy * 24 + hx * 2);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(dog.x + hx * 20 + hy * 7, dog.y + hy * 20 - hx * 7);
    context.lineTo(dog.x + hx * 30 + hy * 10, dog.y + hy * 30 - hx * 10);
    context.lineTo(dog.x + hx * 24 + hy * 2, dog.y + hy * 24 - hx * 2);
    context.closePath();
    context.fill();
    circle(dog.x + hx * 30, dog.y + hy * 30, 3.5, '#101014');
    circle(dog.x + hx * 22 - hy * 5, dog.y + hy * 22 + hx * 5, 2, '#fff');
  }

  function drawFox(fox, time) {
    shadow(fox.x, fox.y, 15);
    const heading = Math.atan2(fox.vy, fox.vx);
    const hx = Math.cos(heading);
    const hy = Math.sin(heading);
    const sway = Math.sin(time * 4) * 3;
    // Tail, white-tipped.
    context.strokeStyle = PALETTE.fox;
    context.lineWidth = 9;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(fox.x - hx * 14, fox.y - hy * 14);
    context.quadraticCurveTo(fox.x - hx * 26, fox.y - hy * 26 + sway, fox.x - hx * 34, fox.y - hy * 30 + sway);
    context.stroke();
    context.strokeStyle = PALETTE.foxWhite;
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(fox.x - hx * 30, fox.y - hy * 28 + sway);
    context.lineTo(fox.x - hx * 35, fox.y - hy * 31 + sway);
    context.stroke();
    // Body and head.
    context.fillStyle = PALETTE.fox;
    context.beginPath();
    context.ellipse(fox.x, fox.y, 17, 11, heading, 0, TAU);
    context.fill();
    context.fillStyle = PALETTE.foxWhite;
    context.beginPath();
    context.ellipse(fox.x + hx * 4, fox.y + hy * 4, 8, 5, heading, 0, TAU);
    context.fill();
    context.fillStyle = PALETTE.fox;
    context.beginPath();
    context.arc(fox.x + hx * 17, fox.y + hy * 17, 9, 0, TAU);
    context.fill();
    context.beginPath();
    context.moveTo(fox.x + hx * 17 - hy * 6, fox.y + hy * 17 + hx * 6);
    context.lineTo(fox.x + hx * 26 - hy * 9, fox.y + hy * 26 + hx * 9);
    context.lineTo(fox.x + hx * 21 - hy * 2, fox.y + hy * 21 + hx * 2);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(fox.x + hx * 17 + hy * 6, fox.y + hy * 17 - hx * 6);
    context.lineTo(fox.x + hx * 26 + hy * 9, fox.y + hy * 26 - hx * 9);
    context.lineTo(fox.x + hx * 21 + hy * 2, fox.y + hy * 21 - hx * 2);
    context.closePath();
    context.fill();
    circle(fox.x + hx * 24, fox.y + hy * 24, 3, '#101014');
    if (fox.state === 'stalk') {
      text('!', fox.x, fox.y - 26, 22, PALETTE.danger, 'center', 'bold ');
    }
  }

  function drawParticles(state) {
    for (const particle of state.particles) {
      if (!particle.active) continue;
      const fade = particle.life / particle.max;
      if (particle.kind === 'dust') {
        context.fillStyle = `rgba(201, 160, 106, ${0.55 * fade})`;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size * (1.6 - fade * 0.6), 0, TAU);
        context.fill();
      } else if (particle.kind === 'feather') {
        context.fillStyle = `rgba(255, 255, 255, ${0.85 * fade})`;
        context.beginPath();
        context.ellipse(particle.x, particle.y, particle.size, particle.size * 0.45, particle.vx * 0.05, 0, TAU);
        context.fill();
      } else if (particle.kind === 'spark') {
        context.fillStyle = `rgba(255, 210, 62, ${fade})`;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size * fade + 1, 0, TAU);
        context.fill();
      } else if (particle.kind === 'ring') {
        context.strokeStyle = `rgba(255, 255, 255, ${0.7 * fade})`;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(particle.x, particle.y, (1 - fade) * 210 + 10, 0, TAU);
        context.stroke();
      }
    }
  }

  function drawHud(state, extra) {
    context.fillStyle = 'rgba(24, 46, 24, 0.92)';
    context.fillRect(0, 0, FIELD.width, FIELD.hudHeight);
    context.fillStyle = PALETTE.panelEdge;
    context.fillRect(0, FIELD.hudHeight - 3, FIELD.width, 3);

    // Left: the level and its name.
    text(`LEVEL ${state.levelIndex + 1}`, 20, 26, 20, PALETTE.muted, 'left', 'bold ');
    text(state.level.name, 20, 52, 22, PALETTE.text, 'left', 'bold ');

    // Centre: the ducks, penned and still out, as little duck dots.
    const total = state.ducks.length;
    const dotGap = 26;
    const dotsWidth = total * dotGap;
    let dotX = FIELD.width / 2 - dotsWidth / 2;
    for (let index = 0; index < total; index += 1) {
      const duck = state.ducks[index];
      const penned = duck.penned;
      const lost = !duck.active;
      circle(dotX + 10, 26, 9, lost ? '#4c5a44' : penned ? PALETTE.duck : 'rgba(255, 210, 62, 0.25)');
      if (!lost && !penned) {
        context.strokeStyle = PALETTE.duck;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(dotX + 10, 26, 9, 0, TAU);
        context.stroke();
      }
      dotX += dotGap;
    }
    text(`${state.penned} / ${state.target} penned`, FIELD.width / 2, 56, 17, PALETTE.muted, 'center');

    // The sun: it sinks as the time runs out.
    const totalSeconds = state.level.seconds;
    const share = Math.max(0, state.timeLeft / totalSeconds);
    const sunX = FIELD.width - 340;
    const sunY = 18 + (1 - share) * 30;
    const lowTime = state.timeLeft <= 15 && state.over === null;
    circle(sunX, sunY, 13, lowTime ? PALETTE.danger : PALETTE.sun);
    context.strokeStyle = lowTime ? PALETTE.danger : PALETTE.sun;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(sunX - 44, 50);
    context.lineTo(sunX + 44, 50);
    context.stroke();
    context.fillStyle = lowTime ? PALETTE.danger : PALETTE.sun;
    context.fillRect(sunX - 44, 46, 88 * share, 7);
    const secondsLeft = Math.ceil(state.timeLeft);
    text(`${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`, sunX + 62, 32, 22, lowTime ? PALETTE.danger : PALETTE.text, 'left', 'bold ');

    // Right: the score, the best, and the bark. The bark hint sits left of the sun's
    // bar (right-aligned at sunX - 60), never under the sun or its bar.
    text(`SCORE ${state.score}`, FIELD.width - 20, 26, 22, PALETTE.text, 'right', 'bold ');
    text(`BEST ${extra.best}`, FIELD.width - 20, 52, 17, PALETTE.muted, 'right');
    const barkReady = state.barkCooldown <= 0;
    const barkLabel = barkReady ? 'SPACE — bark' : `bark ${state.barkCooldown.toFixed(1)}s`;
    text(barkLabel, sunX - 60, 52, 15, barkReady ? PALETTE.star : PALETTE.muted, 'right');
    if (extra.muted) text('muted (M)', sunX - 60, 26, 15, PALETTE.muted, 'right');
  }

  function drawToast(message, sub) {
    context.fillStyle = 'rgba(24, 46, 24, 0.88)';
    const width = 560;
    const x = (FIELD.width - width) / 2;
    roundRect(context, x, FIELD.hudHeight + 18, width, 76, 12);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    roundRect(context, x, FIELD.hudHeight + 18, width, 76, 12);
    context.stroke();
    text(message, FIELD.width / 2, FIELD.hudHeight + 52, 26, PALETTE.text, 'center', 'bold ');
    if (sub) text(sub, FIELD.width / 2, FIELD.hudHeight + 78, 17, PALETTE.muted, 'center');
  }

  function drawPanel(title, lines, prompt, stars) {
    const width = 640;
    const height = 150 + lines.length * 34 + (stars !== undefined ? 64 : 0);
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(16, 30, 16, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    roundRect(context, x, y, width, height, 16);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 3;
    roundRect(context, x, y, width, height, 16);
    context.stroke();
    let cursor = y + 72;
    text(title, FIELD.width / 2, cursor, 46, PALETTE.text, 'center', 'bold ');
    cursor += 26;
    if (stars !== undefined) {
      for (let index = 0; index < 3; index += 1) {
        const starX = FIELD.width / 2 + (index - 1) * 64;
        const filled = index < stars;
        context.fillStyle = filled ? PALETTE.star : PALETTE.starEmpty;
        context.beginPath();
        for (let point = 0; point < 10; point += 1) {
          const angle = -Math.PI / 2 + (point * Math.PI) / 5;
          const radius = point % 2 === 0 ? 26 : 11;
          const px = starX + Math.cos(angle) * radius;
          const py = cursor + 26 + Math.sin(angle) * radius;
          if (point === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.closePath();
        context.fill();
      }
      cursor += 64;
    }
    for (const line of lines) {
      text(line, FIELD.width / 2, cursor + 26, 22, PALETTE.muted, 'center');
      cursor += 34;
    }
    text(prompt, FIELD.width / 2, y + height - 30, 22, PALETTE.star, 'center');
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, extra) {
    const time = state.elapsed;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawField(state);
    drawPen(state);
    for (const duck of state.ducks) if (duck.active) drawDuck(duck, time);
    drawDog(state.dog, time);
    for (const fox of state.foxes) if (fox.active) drawFox(fox, time);
    drawParticles(state);

    if (screen === SCREEN_TITLE) {
      drawHud(state, extra);
      drawPanel('QUACK HERDER', ['The dog pushes. The ducks panic. Pen them all before sundown.', 'Move with the mouse or WASD / arrows. Space or click to bark the fox away.', 'Ducks love ponds and hate foxes. Barking startles ducks too — spend it well.'], 'Click or press Enter to start');
      return;
    }
    drawHud(state, extra);
    if (extra.toast) drawToast(extra.toast.message, extra.toast.sub);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The ducks will wait for you.'], 'Press P to keep herding');
    } else if (screen === SCREEN_LEVEL) {
      drawPanel('Level complete!', [
        `Ducks penned ${state.penned} of ${state.ducks.length}`,
        `Time bonus +${state.timeBonus}`,
        `Score ${state.score} · ${state.stars} stars so far`,
      ], state.levelIndex + 1 < LEVELS.length ? 'Press Enter for the next level' : 'Press Enter for the final tally', state.levelStars);
    } else if (screen === SCREEN_OVER) {
      drawPanel('The sun has set', [
        `Level ${state.levelIndex + 1} · ${state.level.name}`,
        `Ducks penned ${state.penned} of ${state.target} needed`,
        `Score ${state.score} · Best ${extra.best}`,
      ], 'R — retry this level · Enter — start over');
    } else if (screen === SCREEN_CAMPAIGN) {
      drawPanel('Every duck is home!', [
        `${state.stars} of ${LEVELS.length * 3} stars`,
        `Final score ${state.score} · Best ${extra.best}`,
        'Barnaby the collie hangs up his whistle.',
      ], 'Press Enter to herd them all again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view: () => view };
}
