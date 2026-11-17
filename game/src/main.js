// Quack Herder — a complete herding game. You are Barnaby, a border collie.
// Pen the panicked ducks into the pen before sundown, across ten levels.
//
// HOW IT PLAYS: the dog can only push ducks, never grab them. Ducks panic and
// scatter when the dog rushes them; they drift toward their flock, dawdle in
// ponds, and a duckling follows its mother. Bark (Space or click) scares a fox
// away — but the bark also startles every duck nearby, so each bark is a
// trade-off. A fox that reaches a duck snatches it for good. Hay bales block
// movement; the pen's gate moves to a new height every level.
//
// CONTENT: 10 levels (Morning Roundup to the two-fox finale), 4 duck types
// (normal, sprinter, stubborn, duckling), foxes from level 4, two foxes on
// level 8, ponds and hay mazes throughout. Scoring: 100 per duck penned,
// duckling +50, combo +50 when two pennings land within 2.5 s, remaining time
// x10/s as a bonus; 1-3 stars per level. Six screens: title, play, paused,
// level complete, game over, campaign complete. Controls: mouse or WASD /
// arrow keys to move, Space or click to bark, Enter to confirm, R retry,
// P pause, M mute. Sound is synthesized (Web Audio, no assets).
//
// HOW IT IS VERIFIED: ?selftest=1 runs the in-page herding autopilot through
// every level — 9 of 10 won on seed 1 (level 1 lost on time at 3/4 penned).
// A full real-input campaign on seed 2 (headless Chrome, synthetic pointer
// and keys driving the real handlers) won 10/10 in 183.3 s, final score
// 11,870, 29/30 stars, zero console errors and zero exceptions (2026-11-17).
// No network requests, no libraries, no assets: plain static files.
//
// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, paused, level complete, game
// over and campaign complete.
//
// ?seed=N fixes the farm's layout. ?shot=start|play|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot. ?selftest=1 runs the herding autopilot through every level and reports
// win or lose for each, for tuning, then sets window.__selftestDone.
import { BEST_KEY, FOX, STEP } from './config.js';
import { LEVELS } from './levels.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BARK, EVENT_COMBO, EVENT_LOSE, EVENT_PENNED, EVENT_WIN } from './world.js';
import { createAudio } from './audio.js';
import { ACTION_BARK, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer, SCREEN_CAMPAIGN, SCREEN_LEVEL, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { autopilotControl, stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** How long a level's opening banner stays up, in milliseconds. */
const TOAST_MS = 2600;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const selftest = params.get('selftest') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { best: scene.best, muted: false, toast: null });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runSelftest() {
  const results = [];
  for (let level = 0; level < LEVELS.length; level += 1) {
    world.resetLevel(level);
    let won = false;
    let lost = false;
    let steps = 0;
    const limit = Math.ceil((world.state.level.seconds + 5) / STEP);
    for (; steps < limit; steps += 1) {
      const events = world.step(STEP, autopilotControl(world.state), false);
      if (events & EVENT_WIN) {
        won = true;
        break;
      }
      if (events & EVENT_LOSE) {
        lost = true;
        break;
      }
    }
    results.push({
      level: level + 1,
      name: world.state.level.name,
      won,
      lost,
      seconds: +(steps * STEP).toFixed(1),
      penned: world.state.penned,
      target: world.state.target,
      ducksLost: world.state.lost,
    });
    console.log(`selftest level ${level + 1} ${world.state.level.name}: ${won ? 'WIN' : lost ? 'LOSE' : 'TIMEOUT'} in ${results[level].seconds}s, penned ${world.state.penned}/${world.state.target}, lost ${world.state.lost}`);
  }
  const wins = results.filter((result) => result.won).length;
  console.log(`selftest: ${wins}/${results.length} levels won by the autopilot`);
  window.__selftest = results;
  window.__selftestDone = true;
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let muted = false;
  let accumulator = 0;
  let last = performance.now();
  let toast = null;
  let toastUntil = 0;

  // A handle for automated play-testing: the screen and the world, read-only enough.
  window.__quack = {
    get screen() {
      return screen;
    },
    state: world.state,
  };

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function showToast(message, sub) {
    toast = { message, sub };
    toastUntil = performance.now() + TOAST_MS;
  }

  function startLevel(levelIndex) {
    world.resetLevel(levelIndex);
    accumulator = 0;
    screen = SCREEN_PLAY;
    const level = world.state.level;
    showToast(`Level ${levelIndex + 1} — ${level.name}`, `Pen ${level.target} duck${level.target === 1 ? '' : 's'} before sundown`);
    announce(`Level ${levelIndex + 1}, ${level.name}. Pen ${level.target} ducks.`);
  }

  function startCampaign() {
    world.resetCampaign();
    startLevel(0);
  }

  function endLevel() {
    const lastLevel = world.state.levelIndex + 1 >= LEVELS.length;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (lastLevel) {
      screen = SCREEN_CAMPAIGN;
      audio.winJingle();
      announce(`Every duck is home. Final score ${world.state.score}.`);
    } else {
      screen = SCREEN_LEVEL;
      audio.winJingle();
      announce(`Level complete. Score ${world.state.score}.`);
    }
  }

  function endCampaign() {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    screen = SCREEN_OVER;
    audio.loseJingle();
    announce(`The sun has set. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        audio.click();
        startCampaign();
      }
      return;
    }
    if (screen === SCREEN_LEVEL) {
      if (actions & ACTION_CONFIRM) {
        audio.click();
        startLevel(world.state.levelIndex + 1);
      }
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_RESTART) {
        audio.click();
        startLevel(world.state.levelIndex);
      } else if (actions & ACTION_CONFIRM) {
        audio.click();
        startCampaign();
      }
      return;
    }
    if (screen === SCREEN_CAMPAIGN) {
      if (actions & ACTION_CONFIRM) {
        audio.click();
        startCampaign();
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        audio.click();
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    // SCREEN_PLAY.
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { tx: 0, ty: 0, hasTarget: false, kx: 0, ky: 0, bark: false }, true);
      return;
    }
    const keys = input.keys();
    const pointer = input.pointer(renderer.view().scale, renderer.view().x, renderer.view().y);
    const control = {
      tx: pointer.tx,
      ty: pointer.ty,
      hasTarget: pointer.hasTarget,
      kx: keys.kx,
      ky: keys.ky,
      bark: Boolean(actions & ACTION_BARK),
    };
    const events = world.step(STEP, control, false);
    if (events & EVENT_PENNED) {
      audio.quack();
      audio.penDing(world.state.comboCount);
      if (events & EVENT_COMBO) announce('Combo! Two ducks penned together.');
    }
    if (events & EVENT_BARK) {
      audio.bark();
      const foxScared = world.state.foxes.some((fox) => fox.active && fox.state === 'banished' && fox.stateT > FOX.banishedSeconds - 0.2);
      if (foxScared) audio.yelp();
    }
    if (events & EVENT_LOSE) {
      audio.sadSlide();
      endCampaign();
    } else if (events & EVENT_WIN) {
      endLevel();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // One-shot presses are taken once a frame and shared: handleActions spends the
    // screen keys, the first world step spends the bark.
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const currentToast = toast !== null && performance.now() < toastUntil ? toast : null;
    renderer.draw(world.state, screen, { best, muted, toast: currentToast });
  }

  // Leaving the tab pauses a running game rather than letting the sun set unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Quack Herder. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else if (selftest) runSelftest();
else runGame();
