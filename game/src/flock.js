// How a duck thinks and how a fox hunts. No drawing and no browser here, only steering:
// a duck wanders, drifts toward its flock, dawdles in ponds, follows its mother when it is
// a duckling, and runs from the dog and the fox. A fox prowls, stalks the nearest duck, and
// runs for the edge when barked at. The world moves the bodies; this file only says where
// each one wants to go.

import { DUCK, FIELD, FOX } from './config.js';

const KIND = {
  normal: { fleeRadius: DUCK.fleeRadius, fleeSpeed: DUCK.fleeSpeed, radius: DUCK.radius },
  sprinter: { fleeRadius: DUCK.sprinterFleeRadius, fleeSpeed: DUCK.sprinterFleeSpeed, radius: DUCK.radius },
  stubborn: { fleeRadius: DUCK.stubbornFleeRadius, fleeSpeed: DUCK.stubbornFleeSpeed, radius: DUCK.radius },
  duckling: { fleeRadius: DUCK.fleeRadius, fleeSpeed: DUCK.ducklingFleeSpeed, radius: DUCK.ducklingRadius },
};

export function kindStats(type) {
  return KIND[type] ?? KIND.normal;
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/**
 * The velocity a duck wants this step. `near` carries the dog, the foxes, the other ducks
 * and the ponds, so the duck can weigh them all at once.
 */
export function steerDuck(duck, near, dt, random) {
  const stats = kindStats(duck.type);
  let vx = 0;
  let vy = 0;
  let fleeing = false;

  // The dog: run away, harder the closer it is.
  const dogDistance = distance(duck.x, duck.y, near.dog.x, near.dog.y);
  if (dogDistance < stats.fleeRadius && dogDistance > 0.01) {
    const strength = 0.7 + 0.3 * (1 - dogDistance / stats.fleeRadius);
    vx += ((duck.x - near.dog.x) / dogDistance) * stats.fleeSpeed * strength;
    vy += ((duck.y - near.dog.y) / dogDistance) * stats.fleeSpeed * strength;
    fleeing = true;
  }

  // A bark startles even a calm duck into running from the dog for a moment.
  if (duck.startled > 0 && dogDistance > 0.01) {
    vx += ((duck.x - near.dog.x) / dogDistance) * stats.fleeSpeed * 0.9;
    vy += ((duck.y - near.dog.y) / dogDistance) * stats.fleeSpeed * 0.9;
    fleeing = true;
  }

  // A fox: run farther and faster than from the dog.
  for (let index = 0; index < near.foxes.length; index += 1) {
    const fox = near.foxes[index];
    if (!fox.active || fox.state === 'banished') continue;
    const foxDistance = distance(duck.x, duck.y, fox.x, fox.y);
    if (foxDistance < FOX.scareRadius && foxDistance > 0.01) {
      vx += ((duck.x - fox.x) / foxDistance) * stats.fleeSpeed * 1.1;
      vy += ((duck.y - fox.y) / foxDistance) * stats.fleeSpeed * 1.1;
      fleeing = true;
    }
  }

  // The flock: ducks bunch together, tighter when they are scared — a flock that
  // runs as one can be pushed as one, and several ducks go through the gate together.
  // (A lone duck still sprints; a flock moves slower but stays together.)
  let flockX = 0;
  let flockY = 0;
  let flockCount = 0;
  for (let index = 0; index < near.ducks.length; index += 1) {
    const other = near.ducks[index];
    if (other === duck || !other.active || other.penned) continue;
    const apart = distance(duck.x, duck.y, other.x, other.y);
    if (apart > DUCK.flockRadius) continue;
    flockX += other.x;
    flockY += other.y;
    flockCount += 1;
    if (apart < DUCK.separateRadius && apart > 0.01) {
      vx += ((duck.x - other.x) / apart) * 90;
      vy += ((duck.y - other.y) / apart) * 90;
    }
  }
  if (flockCount > 0) {
    const centreX = flockX / flockCount;
    const centreY = flockY / flockCount;
    const centreDistance = distance(duck.x, duck.y, centreX, centreY);
    if (centreDistance > 0.01) {
      const bunch = fleeing ? 150 : 45;
      vx += ((centreX - duck.x) / centreDistance) * bunch;
      vy += ((centreY - duck.y) / centreDistance) * bunch;
    }
  }

  // A duckling stays glued to the nearest grown duck.
  if (duck.type === 'duckling') {
    let mother = null;
    let motherDistance = 220;
    for (let index = 0; index < near.ducks.length; index += 1) {
      const other = near.ducks[index];
      if (other === duck || !other.active || other.penned || other.type === 'duckling') continue;
      const apart = distance(duck.x, duck.y, other.x, other.y);
      if (apart < motherDistance) {
        motherDistance = apart;
        mother = other;
      }
    }
    if (mother !== null && motherDistance > 24) {
      vx += ((mother.x - duck.x) / motherDistance) * 130;
      vy += ((mother.y - duck.y) / motherDistance) * 130;
    }
  }

  // A pond is a pull: ducks near one drift in and dawdle.
  for (let index = 0; index < near.ponds.length; index += 1) {
    const pond = near.ponds[index];
    const pondDistance = distance(duck.x, duck.y, pond.x, pond.y);
    if (pondDistance < pond.r + 40 && pondDistance > 0.01) {
      const pull = fleeing ? 0.15 : 0.6;
      vx += ((pond.x - duck.x) / pondDistance) * DUCK.pondPull * pull;
      vy += ((pond.y - duck.y) / pondDistance) * DUCK.pondPull * pull;
    }
  }

  // Pressed against a wall: run along it, away from the dog, instead of shoving
  // straight into it forever. (A flock pinned against the pen's bottom wall by a dog
  // below it otherwise never moves again.)
  if (fleeing) {
    const slide = 140;
    const dogDx = Math.sign(duck.x - near.dog.x) || 1;
    const dogDy = Math.sign(duck.y - near.dog.y) || 1;
    const nearHorizontal = (edgeY) => Math.abs(duck.y - edgeY) < 36;
    const nearVertical = (edgeX) => Math.abs(duck.x - edgeX) < 36;
    // The field's own walls.
    if (nearHorizontal(FIELD.hudHeight + FIELD.margin + 10) || nearHorizontal(FIELD.height - FIELD.margin - 10)) {
      vx += dogDx * slide;
    }
    if (nearVertical(FIELD.margin + 10) || nearVertical(FIELD.width - FIELD.margin - 10)) {
      vy += dogDy * slide;
    }
    // The pen's top and bottom walls (not the left wall: the gate is there, and a duck
    // beside it should go through it, not slide away from it). A duck pinned here
    // slides toward the gate's side of the pen, never away from it — and the slide is
    // stronger than the flock's pull, or a bunched flock sits in the pocket forever.
    if (near.pen && duck.x > near.pen.x - 40 && duck.x < near.pen.x + near.pen.w + 40) {
      if (nearHorizontal(near.pen.y) || nearHorizontal(near.pen.y + near.pen.h)) {
        vx += Math.sign(near.pen.x - duck.x) * 200;
      }
    }
  }

  // Walls: a duck pressed against one slides back toward the open field instead of
  // camping in a corner where no dog can ever get behind it.
  const wallZone = 70;
  const wallPush = 130;
  const leftEdge = FIELD.margin + 10;
  const rightEdge = FIELD.width - FIELD.margin - 10;
  const topEdge = FIELD.hudHeight + FIELD.margin + 10;
  const bottomEdge = FIELD.height - FIELD.margin - 10;
  if (duck.x < leftEdge + wallZone) vx += wallPush * (1 - (duck.x - leftEdge) / wallZone);
  if (duck.x > rightEdge - wallZone) vx -= wallPush * (1 - (rightEdge - duck.x) / wallZone);
  if (duck.y < topEdge + wallZone) vy += wallPush * (1 - (duck.y - topEdge) / wallZone);
  if (duck.y > bottomEdge - wallZone) vy -= wallPush * (1 - (bottomEdge - duck.y) / wallZone);

  // Wandering: a slow random turn, quieter while fleeing.
  duck.wanderAngle += (random() - 0.5) * 2.4 * dt;
  const wanderWeight = fleeing ? 0.15 : 0.7;
  vx += Math.cos(duck.wanderAngle) * DUCK.wanderSpeed * wanderWeight;
  vy += Math.sin(duck.wanderAngle) * DUCK.wanderSpeed * wanderWeight;

  const top = fleeing ? stats.fleeSpeed * 1.15 : DUCK.wanderSpeed * 1.6;
  const speed = Math.hypot(vx, vy);
  if (speed > top) {
    vx = (vx / speed) * top;
    vy = (vy / speed) * top;
  }
  return { vx, vy, fleeing };
}

/**
 * A herding autopilot: the dog a player would want to be. It picks the duck farthest
 * from the gate, stands behind it on the gate's far side, and pushes it home — and it
 * sticks with that duck until it is penned, instead of chasing whichever duck moved.
 * It barks when a fox comes close enough to threaten the herd.
 */
export function createHerder() {
  let target = null;
  let pushing = false;
  const idle = { tx: 0, ty: 0, hasTarget: false, kx: 0, ky: 0, bark: false };

  return function herdControl(state) {
    const pen = state.pen;
    const gateX = pen.x;
    const gateY = pen.gateY;

    // Bark when a fox is close enough for the bark to reach it AND close enough to
    // a duck to be a threat. A bark startles the ducks too, so it is spent on a fox
    // that is actually hunting, not on one merely passing by.
    let bark = false;
    for (const fox of state.foxes) {
      if (!fox.active || fox.state === 'banished') continue;
      if (Math.hypot(fox.x - state.dog.x, fox.y - state.dog.y) > 210) continue;
      for (const duck of state.ducks) {
        if (!duck.active || duck.penned) continue;
        if (Math.hypot(fox.x - duck.x, fox.y - duck.y) < 260) {
          bark = true;
          break;
        }
      }
      if (bark) break;
    }

    // Keep the current duck until it is penned or gone. Switching mid-push sends the
    // dog running back and forth across the field while no duck gets anywhere.
    // (The check is by identity in this level's ducks: a duck from an earlier level
    // is a ghost, and chasing it would run the dog at nothing.)
    let targetDistance = -1;
    if (target !== null && state.ducks.includes(target) && target.active && !target.penned) {
      targetDistance = Math.hypot(target.x - gateX, target.y - gateY);
    } else {
      target = null;
    }
    if (target === null) {
      for (const duck of state.ducks) {
        if (!duck.active || duck.penned) continue;
        const apart = Math.hypot(duck.x - gateX, duck.y - gateY);
        if (apart > targetDistance) {
          targetDistance = apart;
          target = duck;
        }
      }
    }
    if (target === null) return { ...idle, bark };

    const dx = target.x - gateX;
    const dy = target.y - gateY;
    const length = Math.hypot(dx, dy) || 1;
    const pointX = target.x + (dx / length) * 46;
    const pointY = target.y + (dy / length) * 46;
    const dogToPoint = Math.hypot(state.dog.x - pointX, state.dog.y - pointY);
    // Two thresholds, not one: once the dog is pushing it keeps pushing until it is
    // well off the line, and once it is lining up it keeps lining up until it is
    // close. A single threshold makes the dog vibrate on the spot.
    if (pushing && dogToPoint > 50) pushing = false;
    if (!pushing && dogToPoint < 20) pushing = true;
    // Pushing: drive through the duck, toward the gate — the dog never stops on the
    // duck itself, so it cannot vibrate on the spot between two targets.
    if (pushing) {
      const gx = gateX - target.x;
      const gy = gateY - target.y;
      const gl = Math.hypot(gx, gy) || 1;
      return { tx: target.x + (gx / gl) * 40, ty: target.y + (gy / gl) * 40, hasTarget: true, kx: 0, ky: 0, bark };
    }
    return { tx: pointX, ty: pointY, hasTarget: true, kx: 0, ky: 0, bark };
  };
}

/**
 * The velocity a fox wants this step, and its state. It prowls until a duck is close
 * enough to stalk, stalks until it snatches one or is barked away, then slinks off.
 */
export function steerFox(fox, near, dt, random) {
  if (fox.state === 'banished') {
    // Run for the nearest edge and stay there until the banishment wears off.
    const edgeX = fox.x < 640 ? 24 : 1256;
    const dx = edgeX - fox.x;
    const dy = 360 - fox.y;
    const length = Math.hypot(dx, dy) || 1;
    return { vx: (dx / length) * FOX.prowlSpeed * 1.4, vy: (dy / length) * FOX.prowlSpeed * 1.4 };
  }
  if (fox.state === 'gloat') {
    return { vx: 0, vy: 0 };
  }

  // Find the nearest duck still out in the field.
  let prey = null;
  let preyDistance = 340;
  for (let index = 0; index < near.ducks.length; index += 1) {
    const duck = near.ducks[index];
    if (!duck.active || duck.penned) continue;
    const apart = distance(fox.x, fox.y, duck.x, duck.y);
    if (apart < preyDistance) {
      preyDistance = apart;
      prey = duck;
    }
  }

  if (fox.state === 'stalk' && prey === null) fox.state = 'prowl';
  if (fox.state === 'prowl' && prey !== null) fox.state = 'stalk';

  if (fox.state === 'stalk' && prey !== null) {
    const dx = prey.x - fox.x;
    const dy = prey.y - fox.y;
    const length = Math.hypot(dx, dy) || 1;
    // It keeps a little distance from the dog even while it hunts.
    let vx = (dx / length) * FOX.stalkSpeed;
    let vy = (dy / length) * FOX.stalkSpeed;
    const dogDistance = distance(fox.x, fox.y, near.dog.x, near.dog.y);
    if (dogDistance < 110 && dogDistance > 0.01) {
      vx += ((fox.x - near.dog.x) / dogDistance) * 120;
      vy += ((fox.y - near.dog.y) / dogDistance) * 120;
    }
    return { vx, vy };
  }

  // Prowling: a slow wander along the field's edge.
  fox.wanderAngle += (random() - 0.5) * 1.6 * dt;
  return {
    vx: Math.cos(fox.wanderAngle) * FOX.prowlSpeed,
    vy: Math.sin(fox.wanderAngle) * FOX.prowlSpeed * 0.6,
  };
}
