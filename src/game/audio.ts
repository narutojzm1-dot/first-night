type Kind = "chop" | "place" | "hurt" | "jump" | "land" | "craft" | "dawn" | "night" | "swing" | "ui" | "sleep" | "break";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfx: GainNode | null = null;
let windGain: GainNode | null = null;
let muted = false;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    sfx = ctx.createGain();
    sfx.gain.value = 0.8;
    master.gain.value = muted ? 0 : 0.9;
    sfx.connect(master);
    master.connect(ctx.destination);
    const frames = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    windGain = ctx.createGain();
    windGain.gain.value = 0.012;
    src.connect(filter);
    filter.connect(windGain);
    windGain.connect(master);
    src.start();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function unlockAudio(): void {
  ensure();
}

export function resumeAudio(): void {
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

export function setMuted(next: boolean): void {
  muted = next;
  if (master && ctx) master.gain.setTargetAtTime(next ? 0 : 0.9, ctx.currentTime, 0.03);
}

export function isMuted(): boolean {
  return muted;
}

export function setWind(night: number): void {
  if (!windGain || !ctx) return;
  const g = 0.01 + night * 0.04;
  windGain.gain.setTargetAtTime(muted ? 0 : g, ctx.currentTime, 0.2);
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  slide = 0,
): void {
  const ac = ensure();
  if (!ac || !sfx || muted) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(sfx);
  osc.start(t);
  osc.stop(t + dur + 0.02);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
}

export function playSfx(kind: Kind): void {
  const jitter = 0.94 + Math.random() * 0.12;
  switch (kind) {
    case "chop":
      tone(180 * jitter, 0.07, "square", 0.08, -80);
      tone(90, 0.09, "triangle", 0.06);
      break;
    case "break":
      tone(240 * jitter, 0.08, "square", 0.09, -140);
      tone(520, 0.05, "triangle", 0.04);
      break;
    case "place":
      tone(320 * jitter, 0.06, "square", 0.06, 40);
      break;
    case "jump":
      tone(420 * jitter, 0.08, "sine", 0.05, 180);
      break;
    case "land":
      tone(140, 0.06, "triangle", 0.05, -40);
      break;
    case "hurt":
      tone(196, 0.14, "sawtooth", 0.07, -120);
      tone(90, 0.18, "square", 0.05);
      break;
    case "swing":
      tone(640 * jitter, 0.05, "square", 0.04, -300);
      break;
    case "craft":
      tone(523, 0.07, "triangle", 0.06);
      tone(659, 0.09, "triangle", 0.05);
      break;
    case "ui":
      tone(660, 0.04, "sine", 0.04);
      break;
    case "night":
      tone(196, 0.4, "sine", 0.06, -40);
      tone(155, 0.5, "triangle", 0.05);
      break;
    case "sleep":
      tone(392, 0.18, "sine", 0.06);
      tone(494, 0.22, "sine", 0.05);
      tone(587, 0.28, "triangle", 0.05);
      break;
    case "dawn":
      tone(523, 0.16, "triangle", 0.07);
      tone(659, 0.2, "triangle", 0.06);
      tone(784, 0.28, "sine", 0.06);
      break;
    default:
      break;
  }
}
