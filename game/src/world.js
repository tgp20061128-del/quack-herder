// The game's rules and state, with no drawing and no browser in it: the dog, the ducks,
// the foxes, the pen, the ponds, the hay bales, the sundown timer, the score. step()
// advances one fixed step and returns what happened as bit flags, so the caller can react
// without the world knowing about screens or sound. Nothing here allocates after
// createWorld returns.

import { BARK, COMBO_WINDOW, DOG, DUCK, FIELD, FOX, FUNNEL, PEN, SCORE } from './config.js';
import { LEVELS } from './levels.js';
import { kindStats, steerDuck, steerFox } from './flock.js';

export const EVENT_PENNED = 1;
export const EVENT_LOST = 2;
export const EVENT_BARK = 4;
export const EVENT_WIN = 8;
export const EVENT_LOSE = 16;
export const EVENT_COMBO = 32;

const PARTICLE_POOL = 120;

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function circleHitsRect(cx, cy, r, rx, ry, rw, rh) {
  const nearestX = clamp(cx, rx, rx + rw);
  const nearestY = clamp(cy, ry, ry + rh);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < r * r;
}

export function createWorld(random) {
  const dog = { x: 90, y: FIELD.height / 2, vx: 0, vy: 0, facing: 0, running: false };
  const ducks = [];
  const foxes = [];
  const particles = [];
  for (let index = 0; index < PARTICLE_POOL; index += 1) {
    particles.push({ active: false, kind: 'dust', x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 3 });
  }
  const state = {
    dog,
    ducks,
    foxes,
    particles,
    pen: { x: 0, y: 0, w: PEN.width, h: PEN.height, gateY: 0, gateH: PEN.gate, wings: [] },
    ponds: [],
    hay: [],
    levelIndex: 0,
    level: LEVELS[0],
    timeLeft: LEVELS[0].seconds,
    score: 0,
    stars: 0,
    levelStars: 0,
    timeBonus: 0,
    penned: 0,
    target: LEVELS[0].target,
    lost: 0,
    barkCooldown: 0,
    comboCount: 0,
    comboTimer: 0,
    elapsed: 0,
    over: null,
  };

  function spawnParticle(kind, x, y, vx, vy, life, size) {
    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];
      if (particle.active) continue;
      particle.active = true;
      particle.kind = kind;
      particle.x = x;
      particle.y = y;
      particle.vx = vx;
      particle.vy = vy;
      particle.life = life;
      particle.max = life;
      particle.size = size;
      return;
    }
  }

  function burst(kind, x, y, count, speed, life, size) {
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const power = speed * (0.4 + random() * 0.6);
      spawnParticle(kind, x, y, Math.cos(angle) * power, Math.sin(angle) * power, life * (0.7 + random() * 0.6), size);
    }
  }

  function pointClear(x, y, margin) {
    for (let index = 0; index < state.ponds.length; index += 1) {
      const pond = state.ponds[index];
      if (Math.hypot(x - pond.x, y - pond.y) < pond.r + margin) return false;
    }
    for (let index = 0; index < state.hay.length; index += 1) {
      const bale = state.hay[index];
      if (Math.hypot(x - bale.x, y - bale.y) < bale.r + margin) return false;
    }
    if (circleHitsRect(x, y, margin, state.pen.x, state.pen.y, state.pen.w, state.pen.h)) return false;
    return true;
  }

  function resetLevel(levelIndex) {
    const level = LEVELS[levelIndex];
    state.levelIndex = levelIndex;
    state.level = level;
    state.timeLeft = level.seconds;
    state.elapsed = 0;
    state.penned = 0;
    state.target = level.target;
    state.lost = 0;
    state.barkCooldown = 0;
    state.comboCount = 0;
    state.comboTimer = 0;
    state.levelStars = 0;
    state.timeBonus = 0;
    state.over = null;
    state.ponds = level.ponds.map((pond) => ({ ...pond }));
    state.hay = level.hay.map((bale) => ({ ...bale }));
    state.pen.x = FIELD.width - FIELD.margin - PEN.width;
    state.pen.y = clamp(level.penY - PEN.height / 2, FIELD.hudHeight + FIELD.margin, FIELD.height - FIELD.margin - PEN.height);
    state.pen.gateY = state.pen.y + PEN.height / 2;
    // The funnel wings: from each edge of the gate, angling out into the field.
    state.pen.wings = [
      { x1: state.pen.x, y1: state.pen.gateY - PEN.gate / 2, x2: state.pen.x - FUNNEL.length, y2: state.pen.gateY - PEN.gate / 2 - FUNNEL.spread },
      { x1: state.pen.x, y1: state.pen.gateY + PEN.gate / 2, x2: state.pen.x - FUNNEL.length, y2: state.pen.gateY + PEN.gate / 2 + FUNNEL.spread },
    ];

    dog.x = 90;
    dog.y = FIELD.height / 2;
    dog.vx = 0;
    dog.vy = 0;
    dog.facing = 0;

    ducks.length = 0;
    for (let index = 0; index < level.ducks.length; index += 1) {
      let x = 200;
      let y = 300;
      for (let attempt = 0; attempt < 24; attempt += 1) {
        x = 90 + random() * (state.pen.x - 220);
        y = FIELD.hudHeight + 40 + random() * (FIELD.height - FIELD.hudHeight - 80);
        if (pointClear(x, y, 30)) break;
      }
      ducks.push({
        active: true,
        type: level.ducks[index],
        x,
        y,
        vx: 0,
        vy: 0,
        heading: random() * Math.PI * 2,
        wanderAngle: random() * Math.PI * 2,
        penned: false,
        startled: 0,
        alert: false,
      });
    }

    foxes.length = 0;
    for (let index = 0; index < level.foxes; index += 1) {
      foxes.push({
        active: true,
        x: 30,
        y: FIELD.hudHeight + 60 + random() * (FIELD.height - FIELD.hudHeight - 120),
        vx: 0,
        vy: 0,
        state: 'prowl',
        stateT: 0,
        wanderAngle: random() * Math.PI * 2,
      });
    }

    for (const particle of particles) particle.active = false;
  }

  function resetCampaign() {
    state.score = 0;
    state.stars = 0;
    resetLevel(0);
  }

  /** Push a circle out of every hay bale it overlaps. */
  function pushOutOfHay(body, radius) {
    for (let index = 0; index < state.hay.length; index += 1) {
      const bale = state.hay[index];
      const dx = body.x - bale.x;
      const dy = body.y - bale.y;
      const apart = Math.hypot(dx, dy);
      const min = bale.r + radius;
      if (apart < min && apart > 0.01) {
        body.x = bale.x + (dx / apart) * min;
        body.y = bale.y + (dy / apart) * min;
      }
    }
  }

  /**
   * Push a circle out of the funnel wings it overlaps — but only from the inside.
   * The wings are a one-way funnel, like a fish trap: a duck outside them slips through
   * the fence line into the funnel, and once inside it can only slide along a wing toward
   * the gate. A two-sided fence makes a pocket where a duck is wedged between the wing
   * and the pen's wall and can never get out.
   */
  function pushOutOfWings(body, radius) {
    const pen = state.pen;
    for (let index = 0; index < pen.wings.length; index += 1) {
      const wing = pen.wings[index];
      const dx = wing.x2 - wing.x1;
      const dy = wing.y2 - wing.y1;
      const length = Math.hypot(dx, dy);
      const ux = dx / length;
      const uy = dy / length;
      // Which side of the wing line is the gate on? (The gate is inside the funnel.)
      const gateSide = Math.sign(ux * (pen.gateY - wing.y1) - uy * (pen.x - wing.x1)) || 1;
      const bodySide = (ux * (body.y - wing.y1) - uy * (body.x - wing.x1)) * gateSide;
      if (bodySide <= 0) continue; // outside the funnel: the wing lets it through
      let along = ((body.x - wing.x1) * dx + (body.y - wing.y1) * dy) / (length * length);
      along = clamp(along, 0, 1);
      const nearestX = wing.x1 + dx * along;
      const nearestY = wing.y1 + dy * along;
      const ox = body.x - nearestX;
      const oy = body.y - nearestY;
      const apart = Math.hypot(ox, oy);
      if (apart < radius && apart > 0.01) {
        body.x = nearestX + (ox / apart) * radius;
        body.y = nearestY + (oy / apart) * radius;
      } else if (apart <= 0.01) {
        body.y -= radius;
      }
    }
  }

  /**
   * Keep a body out of the pen's walls. The gate is the only way in, through the left
   * wall; the dog is never let in at all, and a penned duck is kept inside instead.
   */
  function penWalls(body, radius, mayEnter) {
    const pen = state.pen;
    if (body.penned) {
      body.x = clamp(body.x, pen.x + radius, pen.x + pen.w - radius);
      body.y = clamp(body.y, pen.y + radius, pen.y + pen.h - radius);
      return;
    }
    if (!circleHitsRect(body.x, body.y, radius, pen.x, pen.y, pen.w, pen.h)) return;
    const inGate = body.y > pen.gateY - pen.gateH / 2 - 6 && body.y < pen.gateY + pen.gateH / 2 + 6;
    if (mayEnter && inGate && body.x - radius < pen.x + 4) return; // slipping in through the gate
    // Shove out along the nearest wall.
    const left = body.x - (pen.x - radius);
    const right = pen.x + pen.w + radius - body.x;
    const top = body.y - (pen.y - radius);
    const bottom = pen.y + pen.h + radius - body.y;
    const nearest = Math.min(left, right, top, bottom);
    if (nearest === left) body.x = pen.x - radius;
    else if (nearest === right) body.x = pen.x + pen.w + radius;
    else if (nearest === top) body.y = pen.y - radius;
    else body.y = pen.y + pen.h + radius;
  }

  function moveDog(control, dt) {
    const keys = control.kx !== 0 || control.ky !== 0;
    if (keys) {
      const length = Math.hypot(control.kx, control.ky) || 1;
      dog.vx = (control.kx / length) * DOG.speed;
      dog.vy = (control.ky / length) * DOG.speed;
    } else if (control.hasTarget) {
      const dx = control.tx - dog.x;
      const dy = control.ty - dog.y;
      const apart = Math.hypot(dx, dy);
      if (apart > 6) {
        const want = Math.min(DOG.speed, apart * 6);
        const targetVx = (dx / apart) * want;
        const targetVy = (dy / apart) * want;
        dog.vx += (targetVx - dog.vx) * Math.min(1, DOG.steer * dt);
        dog.vy += (targetVy - dog.vy) * Math.min(1, DOG.steer * dt);
      } else {
        dog.vx *= Math.max(0, 1 - 10 * dt);
        dog.vy *= Math.max(0, 1 - 10 * dt);
      }
    } else {
      dog.vx *= Math.max(0, 1 - 10 * dt);
      dog.vy *= Math.max(0, 1 - 10 * dt);
    }
    dog.x += dog.vx * dt;
    dog.y += dog.vy * dt;
    dog.x = clamp(dog.x, FIELD.margin + DOG.radius, FIELD.width - FIELD.margin - DOG.radius);
    dog.y = clamp(dog.y, FIELD.hudHeight + FIELD.margin + DOG.radius, FIELD.height - FIELD.margin - DOG.radius);
    pushOutOfHay(dog, DOG.radius);
    // The dog hops the funnel wings: only the ducks and the fox are fenced in by them.
    // (A dog that could be wedged between a wing and the pen's wall would be stuck.)
    penWalls(dog, DOG.radius, false);
    const speed = Math.hypot(dog.vx, dog.vy);
    dog.running = speed > 60;
    if (speed > 40) dog.facing = Math.atan2(dog.vy, dog.vx);
    if (dog.running && random() < dt * 14) {
      spawnParticle('dust', dog.x - Math.cos(dog.facing) * 14, dog.y - Math.sin(dog.facing) * 14, -dog.vx * 0.1, -dog.vy * 0.1, 0.5, 4);
    }
  }

  function moveDucks(dt) {
    const near = { dog, foxes, ducks, ponds: state.ponds, pen: state.pen };
    for (let index = 0; index < ducks.length; index += 1) {
      const duck = ducks[index];
      if (!duck.active) continue;
      if (duck.penned) {
        // Penned ducks mill about inside the pen and never leave.
        duck.wanderAngle += (random() - 0.5) * 2 * dt;
        duck.x += Math.cos(duck.wanderAngle) * 22 * dt;
        duck.y += Math.sin(duck.wanderAngle) * 22 * dt;
        penWalls(duck, kindStats(duck.type).radius, false);
        continue;
      }
      if (duck.startled > 0) duck.startled = Math.max(0, duck.startled - dt);
      const steered = steerDuck(duck, near, dt, random);
      // A duck takes a moment to get up to speed, so the dog can slip behind it
      // before it bolts; it also cannot turn on a dime.
      const ramp = Math.min(1, DUCK.ramp * dt);
      duck.vx += (steered.vx - duck.vx) * ramp;
      duck.vy += (steered.vy - duck.vy) * ramp;
      duck.alert = steered.fleeing;
      const oldX = duck.x;
      const oldY = duck.y;
      duck.x += duck.vx * dt;
      duck.y += duck.vy * dt;
      duck.x = clamp(duck.x, FIELD.margin + 10, FIELD.width - FIELD.margin - 10);
      duck.y = clamp(duck.y, FIELD.hudHeight + FIELD.margin + 10, FIELD.height - FIELD.margin - 10);
      pushOutOfHay(duck, kindStats(duck.type).radius);
      pushOutOfWings(duck, kindStats(duck.type).radius);
      // The pen's walls are solid except for the gate: a duck may cross the line only
      // there, in either direction. Crossing anywhere else is undone, not slid around.
      const pen = state.pen;
      const wasInside = oldX > pen.x && oldX < pen.x + pen.w && oldY > pen.y && oldY < pen.y + pen.h;
      const isInside = duck.x > pen.x && duck.x < pen.x + pen.w && duck.y > pen.y && duck.y < pen.y + pen.h;
      const throughGate =
        duck.y > pen.gateY - pen.gateH / 2 - 6 && duck.y < pen.gateY + pen.gateH / 2 + 6 && Math.min(oldX, duck.x) <= pen.x + 2;
      if (wasInside !== isInside && !throughGate) {
        duck.x = oldX;
        duck.y = oldY;
      } else if (!wasInside && !isInside) {
        penWalls(duck, kindStats(duck.type).radius, true);
      }
      if (Math.hypot(duck.vx, duck.vy) > 20) duck.heading = Math.atan2(duck.vy, duck.vx);
    }
  }

  function moveFoxes(dt) {
    const near = { dog, ducks, foxes };
    for (let index = 0; index < foxes.length; index += 1) {
      const fox = foxes[index];
      if (!fox.active) continue;
      if (fox.stateT > 0) {
        fox.stateT -= dt;
        if (fox.stateT <= 0 && (fox.state === 'banished' || fox.state === 'gloat')) fox.state = 'prowl';
      }
      const steered = steerFox(fox, near, dt, random);
      fox.vx = steered.vx;
      fox.vy = steered.vy;
      fox.x += fox.vx * dt;
      fox.y += fox.vy * dt;
      fox.x = clamp(fox.x, FIELD.margin + FOX.radius, FIELD.width - FIELD.margin - FOX.radius);
      fox.y = clamp(fox.y, FIELD.hudHeight + FIELD.margin + FOX.radius, FIELD.height - FIELD.margin - FOX.radius);
      pushOutOfHay(fox, FOX.radius);
      pushOutOfWings(fox, FOX.radius);
      penWalls(fox, FOX.radius, false);
    }
  }

  function checkPenned() {
    let events = 0;
    const pen = state.pen;
    for (let index = 0; index < ducks.length; index += 1) {
      const duck = ducks[index];
      if (!duck.active || duck.penned) continue;
      if (duck.x > pen.x + 6 && duck.x < pen.x + pen.w - 6 && duck.y > pen.y + 6 && duck.y < pen.y + pen.h - 6) {
        duck.penned = true;
        duck.vx = 0;
        duck.vy = 0;
        state.penned += 1;
        let points = SCORE.duck + (duck.type === 'duckling' ? SCORE.duckling : 0);
        if (state.comboTimer > 0) {
          state.comboCount += 1;
          if (state.comboCount >= 2) {
            points += SCORE.combo * (state.comboCount - 1);
            events |= EVENT_COMBO;
          }
        } else {
          state.comboCount = 1;
        }
        state.comboTimer = COMBO_WINDOW;
        state.score += points;
        burst('spark', duck.x, duck.y, 10, 90, 0.6, 3);
        events |= EVENT_PENNED;
      }
    }
    return events;
  }

  function checkSnatches() {
    let events = 0;
    for (let foxIndex = 0; foxIndex < foxes.length; foxIndex += 1) {
      const fox = foxes[foxIndex];
      if (!fox.active || fox.state === 'banished' || fox.state === 'gloat') continue;
      for (let duckIndex = 0; duckIndex < ducks.length; duckIndex += 1) {
        const duck = ducks[duckIndex];
        if (!duck.active || duck.penned) continue;
        if (Math.hypot(duck.x - fox.x, duck.y - fox.y) < FOX.snatchRadius + kindStats(duck.type).radius) {
          duck.active = false;
          state.lost += 1;
          fox.state = 'gloat';
          fox.stateT = FOX.gloatSeconds;
          burst('feather', duck.x, duck.y, 8, 70, 0.8, 4);
          events |= EVENT_LOST;
          break;
        }
      }
    }
    return events;
  }

  function doBark() {
    let events = 0;
    if (state.barkCooldown > 0) return events;
    state.barkCooldown = BARK.cooldownSeconds;
    burst('ring', dog.x, dog.y, 14, 260, 0.45, 3);
    for (let index = 0; index < ducks.length; index += 1) {
      const duck = ducks[index];
      if (!duck.active || duck.penned) continue;
      if (Math.hypot(duck.x - dog.x, duck.y - dog.y) < BARK.radius) {
        duck.startled = DUCK.startleSeconds;
        burst('feather', duck.x, duck.y, 3, 60, 0.6, 3);
      }
    }
    for (let index = 0; index < foxes.length; index += 1) {
      const fox = foxes[index];
      if (!fox.active) continue;
      if (Math.hypot(fox.x - dog.x, fox.y - dog.y) < BARK.radius) {
        fox.state = 'banished';
        fox.stateT = FOX.banishedSeconds;
      }
    }
    return EVENT_BARK;
  }

  function finishLevel(won) {
    if (won) {
      state.timeBonus = Math.floor(state.timeLeft) * SCORE.secondLeft;
      state.score += state.timeBonus;
      const lostAny = state.lost > 0;
      const timeShare = state.timeLeft / state.level.seconds;
      state.levelStars = lostAny ? (timeShare > 0.3 ? 2 : 1) : timeShare > 0.3 ? 3 : 2;
      state.stars += state.levelStars;
      state.over = 'win';
      return EVENT_WIN;
    }
    state.over = 'lose';
    return EVENT_LOSE;
  }

  /**
   * One fixed step. `control` carries the dog's orders ({tx, ty, hasTarget, kx, ky,
   * bark}). With `harmless` set (the title screen's backdrop) the ducks wander, the dog
   * idles and nothing scores, nothing is lost and the sun never sets.
   */
  function step(dt, control, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.barkCooldown > 0) state.barkCooldown = Math.max(0, state.barkCooldown - dt);
    if (state.comboTimer > 0) state.comboTimer = Math.max(0, state.comboTimer - dt);

    if (harmless) {
      dog.vx = 0;
      dog.vy = 0;
      moveDucks(dt);
    } else {
      if (control.bark) events |= doBark();
      moveDog(control, dt);
      moveDucks(dt);
      moveFoxes(dt);
      events |= checkPenned();
      events |= checkSnatches();
      state.timeLeft -= dt;
      if (state.over === null) {
        if (state.penned >= state.target) events |= finishLevel(true);
        else if (state.timeLeft <= 0) {
          state.timeLeft = 0;
          events |= finishLevel(false);
        }
      }
    }

    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.max(0, 1 - 3 * dt);
      particle.vy *= Math.max(0, 1 - 3 * dt);
    }
    return events;
  }

  resetCampaign();
  return { state, step, resetLevel, resetCampaign, doBark };
}
