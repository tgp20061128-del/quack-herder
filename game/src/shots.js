// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules
// forward from a fresh world, steered by a herding autopilot (stand behind the duck that
// is farthest from the gate, on the gate's far side, and push it home; bark when a fox
// comes close), so the frame is what a short game really looks like and the same seed
// always gives the same frame.

import { STEP } from './config.js';
import { createHerder } from './flock.js';
import { EVENT_LOSE, EVENT_WIN } from './world.js';
import { SCREEN_LEVEL, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 25;
const END_LIMIT_SECONDS = 200;

const IDLE_CONTROL = { tx: 0, ty: 0, hasTarget: false, kx: 0, ky: 0, bark: false };

/** One step of the herding autopilot, kept on one duck until it is penned. */
export const autopilotControl = createHerder();

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return
 * the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.resetCampaign();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, IDLE_CONTROL, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  let events = 0;
  for (let index = 0; index < limit / STEP; index += 1) {
    events = world.step(STEP, autopilotControl(world.state), false);
    if (events & EVENT_WIN) return { screen: SCREEN_LEVEL, best: world.state.score };
    if (events & EVENT_LOSE) return { screen: SCREEN_OVER, best: world.state.score };
  }
  return { screen: SCREEN_PLAY, best: world.state.score };
}
