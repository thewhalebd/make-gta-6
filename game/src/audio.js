// Sound and music, all synthesized with WebAudio oscillators — no audio files,
// no network. A tiny sequencer plays a sunny latin-flavoured loop (bass + chords +
// a plucked lead), and one-shot effects cover gunshots, punches, sirens, pickups
// and the engine hum while driving.

export function createAudio() {
  let context = null;
  let master = null;
  let musicTimer = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;
  let step = 0;

  // A minor-key groove: bass roots and a bright lead, 8 steps a bar at 112 bpm.
  const BASS = [110, 0, 110, 0, 130.8, 0, 98, 0, 110, 0, 110, 0, 146.8, 0, 164.8, 0];
  const LEAD = [440, 523.3, 659.3, 523.3, 587.3, 659.3, 783.9, 659.3, 440, 523.3, 659.3, 880, 783.9, 659.3, 587.3, 523.3];

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      context = new AC();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ensure() || muted) return;
    const t0 = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const t0 = context.currentTime;
    const len = Math.floor(context.sampleRate * dur);
    const buffer = context.createBuffer(1, len, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = context.createBufferSource();
    src.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  function musicStep() {
    if (!context || muted) return;
    const i = step % 16;
    const bass = BASS[i];
    if (bass) tone(bass, 0.22, 'triangle', 0.16);
    if (i % 4 === 0) tone(LEAD[i] / 2, 0.3, 'sine', 0.05);
    if (i % 2 === 0) tone(LEAD[i], 0.16, 'square', 0.035);
    step += 1;
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = window.setInterval(musicStep, 268);
    },
    stopMusic() {
      if (musicTimer) window.clearInterval(musicTimer);
      musicTimer = null;
    },
    gunshot() {
      noise(0.14, 0.5, 1800);
      tone(180, 0.08, 'square', 0.2, 0, 60);
    },
    punch() {
      noise(0.08, 0.3, 500);
      tone(120, 0.08, 'sine', 0.25, 0, 60);
    },
    pickup() {
      tone(660, 0.1, 'sine', 0.25);
      tone(990, 0.16, 'sine', 0.25, 0.09);
    },
    cash() {
      tone(880, 0.08, 'sine', 0.2);
      tone(1174, 0.08, 'sine', 0.2, 0.07);
      tone(1568, 0.14, 'sine', 0.2, 0.14);
    },
    crash() {
      noise(0.25, 0.45, 700);
    },
    siren() {
      tone(720, 0.4, 'sine', 0.06, 0, 980);
      tone(980, 0.4, 'sine', 0.06, 0.4, 720);
    },
    mission() {
      tone(523, 0.12, 'triangle', 0.25);
      tone(659, 0.12, 'triangle', 0.25, 0.12);
      tone(784, 0.24, 'triangle', 0.25, 0.24);
    },
    busted() {
      tone(392, 0.25, 'sawtooth', 0.15, 0, 196);
      tone(196, 0.5, 'sawtooth', 0.15, 0.25);
    },
    engine(speed01) {
      if (!ensure() || muted) return;
      if (!engineOsc) {
        engineOsc = context.createOscillator();
        engineGain = context.createGain();
        engineOsc.type = 'sawtooth';
        engineGain.gain.value = 0;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      engineOsc.frequency.value = 60 + speed01 * 160;
      engineGain.gain.value = 0.05 + speed01 * 0.05;
    },
    engineOff() {
      if (engineGain) engineGain.gain.value = 0;
    },
  };
}
