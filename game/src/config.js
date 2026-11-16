// Every tuning number and colour in one place. The farm is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.
// You are Barnaby, a border collie. The ducks panic, the fox steals, the sun sets:
// pen the ducks before sundown.

export const FIELD = { width: 1280, height: 720, hudHeight: 64, margin: 8 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The dog: faster than any duck, so a good push always catches up. */
export const DOG = {
  radius: 18,
  speed: 380,
  /** How fast the dog turns toward its target: 1 is instant, smaller is floatier. */
  steer: 14,
};

export const DUCK = {
  radius: 12,
  ducklingRadius: 8,
  /** How close the dog must get before a duck notices and runs. */
  fleeRadius: 100,
  sprinterFleeRadius: 130,
  stubbornFleeRadius: 100,
  wanderSpeed: 55,
  fleeSpeed: 235,
  sprinterFleeSpeed: 280,
  stubbornFleeSpeed: 175,
  ducklingFleeSpeed: 210,
  /** Ducks notice each other this far away and drift together. */
  flockRadius: 95,
  /** Ducks closer than this push apart so they never stack. */
  separateRadius: 26,
  /** A duck inside a pond drifts toward its middle and dawdles there. */
  pondPull: 26,
  /** Seconds a startled duck keeps running after a bark. */
  startleSeconds: 0.7,
  /** How fast a duck gets up to speed: it takes a moment to bolt, so the dog can slip behind it. */
  ramp: 5,
};

export const FOX = {
  radius: 16,
  prowlSpeed: 185,
  stalkSpeed: 265,
  /** A duck this close to a stalking fox is snatched. */
  snatchRadius: 20,
  /** Ducks run from a fox this far away. */
  scareRadius: 175,
  /** Seconds a barked-at fox stays away from the field. */
  banishedSeconds: 6,
  /** Seconds a fox waits at the edge after a snatch before prowling again. */
  gloatSeconds: 4,
};

/** The bark: scares the fox off, startles nearby ducks. A tool with a trade-off. */
export const BARK = { radius: 210, cooldownSeconds: 3 };

/** Points: a penned duck, a duckling bonus, a quick double-pen combo, a second of sun left. */
export const SCORE = { duck: 100, duckling: 50, combo: 50, secondLeft: 10 };
/** Penning two or more ducks this close together counts as one combo. */
export const COMBO_WINDOW = 2.5;

/** The pen: a fenced rectangle on the right of the field, its gate on the field side. */
export const PEN = { width: 190, height: 210, gate: 120 };

/**
 * The funnel: two fence wings angling out from the gate's edges, like a chute. A duck
 * pushed toward the pen's side anywhere near the gate slides along a wing and into the
 * gate, instead of needing to be aimed through a 120-pixel gap from across the field.
 */
export const FUNNEL = { length: 150, spread: 95 };

export const PALETTE = {
  backdrop: '#1d3a24',
  grass: '#69b455',
  grassDark: '#5da34c',
  grassLight: '#79c465',
  dirt: '#c9a06a',
  dirtDark: '#b78f5c',
  pond: '#4aa8d8',
  pondDeep: '#2f7fb8',
  hay: '#e0b64f',
  hayDark: '#c99f3a',
  fence: '#8a5a33',
  fenceDark: '#6e4525',
  barn: '#c0392b',
  barnRoof: '#8e2a20',
  dog: '#23232b',
  dogWhite: '#f4f1e8',
  duck: '#ffd23e',
  duckDark: '#eab616',
  beak: '#f07f13',
  duckling: '#ffe680',
  fox: '#e8722a',
  foxWhite: '#f4f1e8',
  text: '#fffbe8',
  muted: '#dce8c8',
  panel: '#20301f',
  panelEdge: '#4c7a3f',
  sun: '#ffcf4d',
  danger: '#ff5a4d',
  star: '#ffd23e',
  starEmpty: '#5d7a52',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'quack-herder.best';
