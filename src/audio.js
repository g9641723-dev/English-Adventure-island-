let ctx,
  timer,
  note = 0,
  enabled = false,
  music = true;
const tune = [261.63, 329.63, 392, 523.25, 440, 392, 329.63, 293.66];
function tone(freq, duration = 0.18, volume = 0.055) {
  if (!ctx || !enabled) return;
  const o = ctx.createOscillator(),
    g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  o.connect(g);
  g.connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + duration);
}
function restart() {
  clearInterval(timer);
  if (enabled && music && !document.hidden)
    timer = setInterval(
      () => tone(tune[note++ % tune.length], 0.7, 0.022),
      720,
    );
}
export async function setSound(value) {
  enabled = value;
  if (value) {
    try {
      ctx ??= new (window.AudioContext || window.webkitAudioContext)();
      await ctx.resume();
    } catch {
      enabled = false;
      return false;
    }
  }
  restart();
  return enabled;
}
export function effect(correct) {
  tone(correct ? 659 : 220);
  if (correct) setTimeout(() => tone(880, 0.3), 100);
}
export function duck(value) {
  music = !value;
  restart();
}
document.addEventListener("visibilitychange", () => {
  restart();
  if (document.hidden) window.speechSynthesis?.cancel();
});
