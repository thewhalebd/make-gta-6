// Sound and music, all synthesized with WebAudio oscillators — no audio
// files, no network. A tiny sequencer plays a sunny latin-flavoured loop
// (bass plus chords plus a plucked lead), and one-shot effects cover
// gunshots, punches, sirens, pickups and the engine hum while driving.
// The 3D rebuild changes nothing here: the same sounds play over the same
// game, only the camera moved.

export function createAudio() {
  let context = null;
  let master = null;
  let musicTimer = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;
  let step = 0;

  // A minor-key groove, 16 steps a bar at 112 bpm: bass roots and a bright
  // lead line. Zeros are rests.
  const BASS_LINE = [110, 0, 110, 0, 130.8, 0, 98, 0, 110, 0, 110, 0, 146.8, 0, 164.8, 0];
  const LEAD_LINE = [440, 523.3, 659.3, 523.3, 587.3, 659.3, 783.9, 659.3, 440, 523.3, 659.3, 880, 783.9, 659.3, 587.3, 523.3];

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return false;
      context = new AudioCtor();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  // One oscillator note: an optional slide down, a quick fade to silence.
  function tone(freq, dur, type, vol, delay = 0, slideTo = 0) {
    if (!ensure() || muted) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  // A burst of filtered noise, fading out — the body of a gunshot or crash.
  function noiseBurst(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const start = context.currentTime;
    const length = Math.floor(context.sampleRate * dur);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.value = vol;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  function musicStep() {
    if (!context || muted) return;
    const i = step % 16;
    const bass = BASS_LINE[i];
    if (bass) tone(bass, 0.22, 'triangle', 0.16);
    if (i % 4 === 0) tone(LEAD_LINE[i] / 2, 0.3, 'sine', 0.05);
    if (i % 2 === 0) tone(LEAD_LINE[i], 0.16, 'square', 0.035);
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
      noiseBurst(0.14, 0.5, 1800);
      tone(180, 0.08, 'square', 0.2, 0, 60);
    },
    punch() {
      noiseBurst(0.08, 0.3, 500);
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
      noiseBurst(0.25, 0.45, 700);
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
