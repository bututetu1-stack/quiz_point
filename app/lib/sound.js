// 効果音（Web Audio）。AudioContext は1つを使い回す（作りすぎると iPhone で鳴らなくなる）

let ctx = null;
const audio = () => {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

// 1音鳴らす：wave 波形, f0→f1 Hz, 開始 at 秒後, 長さ dur 秒
const tone = (c, wave, f0, f1, at, dur, vol = 0.1) => {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  const t = c.currentTime + at;
  osc.type = wave;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.4);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.start(t);
  osc.stop(t + dur);
};

export const playSound = (type, enabled) => {
  if (!enabled) return;
  try {
    const c = audio();
    if (!c) return;
    if (type === 'correct') tone(c, 'sine', 880, 1108, 0, 0.5);
    else if (type === 'wrong') tone(c, 'sawtooth', 150, 100, 0, 0.5, 0.08);
    else if (type === 'pop') tone(c, 'square', 600, 600, 0, 0.12, 0.04);
    else if (type === 'win') [523, 659, 784, 1047].forEach((f, i) => tone(c, 'triangle', f, f, i * 0.12, i === 3 ? 0.7 : 0.18, 0.12));
  } catch (e) {
    // ユーザー操作前などのエラーは無視
  }
};
