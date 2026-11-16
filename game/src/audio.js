// Sound with no audio files: every quack, bark and jingle is a small WebAudio patch,
// built when the player first does anything (browsers only let sound start after a
// gesture). Mute is a gain of zero; the toggle is M.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context !== null) return true;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function unlock() {
    if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
  }

  /** One oscillator note: frequency slides from `from` to `to` over `seconds`. */
  function tone({ type = 'sine', from = 440, to = null, seconds = 0.15, volume = 0.5, delay = 0 }) {
    if (!ensure() || muted) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    if (to !== null) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.05);
  }

  /** A quack: a raspy sawtooth that falls fast, with a little random pitch. */
  function quack() {
    const pitch = 340 + Math.random() * 140;
    tone({ type: 'sawtooth', from: pitch, to: pitch * 0.55, seconds: 0.11, volume: 0.22 });
  }

  /** A bark: two short low thumps. */
  function bark() {
    tone({ type: 'square', from: 190, to: 120, seconds: 0.09, volume: 0.3 });
    tone({ type: 'square', from: 170, to: 110, seconds: 0.09, volume: 0.28, delay: 0.11 });
  }

  /** The pen's happy ding when a duck is safely in. */
  function penDing(combo) {
    tone({ type: 'sine', from: 880, seconds: 0.12, volume: 0.3 });
    tone({ type: 'sine', from: 1318, seconds: 0.16, volume: 0.26, delay: 0.07 });
    if (combo >= 2) tone({ type: 'sine', from: 1760, seconds: 0.2, volume: 0.24, delay: 0.14 });
  }

  /** The fox's yelp when it is barked off. */
  function yelp() {
    tone({ type: 'square', from: 620, to: 240, seconds: 0.22, volume: 0.2 });
  }

  /** A lost duck's sad slide. */
  function sadSlide() {
    tone({ type: 'triangle', from: 520, to: 180, seconds: 0.4, volume: 0.25 });
  }

  /** Level complete: four rising notes. */
  function winJingle() {
    [523, 659, 784, 1047].forEach((frequency, index) => {
      tone({ type: 'triangle', from: frequency, seconds: 0.22, volume: 0.3, delay: index * 0.11 });
    });
  }

  /** Campaign over: three falling notes. */
  function loseJingle() {
    [392, 330, 262].forEach((frequency, index) => {
      tone({ type: 'triangle', from: frequency, seconds: 0.3, volume: 0.28, delay: index * 0.16 });
    });
  }

  function click() {
    tone({ type: 'sine', from: 660, seconds: 0.06, volume: 0.2 });
  }

  function toggleMute() {
    muted = !muted;
    return muted;
  }

  return { unlock, quack, bark, penDing, yelp, sadSlide, winJingle, loseJingle, click, toggleMute, isMuted: () => muted };
}
