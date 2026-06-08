"use client";

// Web Audio sound effects, synthesized (no audio assets to bundle/license):
//  - playTick(): a short click for each peg passing the flipper during a spin
//  - playCheer(): an applause-style noise swell + triumphant chord on a win
// Honors a persisted mute flag and degrades silently if audio is unavailable or
// still blocked by the browser's autoplay policy (no user gesture yet).

const MUTE_KEY = "choicewheel:muted";

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;
let muted: boolean | null = null; // lazy-loaded from localStorage

function loadMuted(): boolean {
  if (muted !== null) return muted;
  if (typeof window === "undefined") return false;
  muted = window.localStorage.getItem(MUTE_KEY) === "1";
  return muted;
}

export function isMuted(): boolean {
  return loadMuted();
}

export function setMuted(value: boolean) {
  muted = value;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  }
}

// Create (once) and resume the AudioContext. Call from a user gesture so the
// browser lets it run.
export function ensureAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as WebkitWindow).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function playTick() {
  if (loadMuted()) return;
  const ac = ensureAudio();
  if (!ac || ac.state !== "running") return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "square";
  osc.frequency.value = 1150;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.1, t + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.04);
}

export function playCheer() {
  if (loadMuted()) return;
  const ac = ensureAudio();
  if (!ac || ac.state !== "running") return;
  const t0 = ac.currentTime;

  // 1. Applause-style swell: white noise through a bandpass, ramping up then down.
  const dur = 1.7;
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise = ac.createBufferSource();
  noise.buffer = buffer;
  const band = ac.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1400;
  band.Q.value = 0.5;
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0.0001, t0);
  ng.gain.linearRampToValueAtTime(0.22, t0 + 0.25);
  ng.gain.linearRampToValueAtTime(0.16, t0 + 0.9);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  noise.connect(band).connect(ng).connect(ac.destination);
  noise.start(t0);
  noise.stop(t0 + dur);

  // 2. Triumphant major chord, lightly arpeggiated.
  const chord = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  chord.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const start = t0 + i * 0.07;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + 0.95);
  });
}
