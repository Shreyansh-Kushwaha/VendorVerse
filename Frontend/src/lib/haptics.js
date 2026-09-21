// Vibration API: Android Chrome vibrates; iOS Safari lacks the API and no-ops
// silently. Haptics are an enhancement layered on visible feedback, never the
// only channel — and they stay off actions without consequence (navigation,
// scrolling), so the ones that fire keep their meaning.
const PATTERNS = {
  tick:    10,                   // add to cart, stepper step, favourite, remove
  medium:  20,                   // status advance, stock saved
  success: [12, 60, 20],         // order placed
  warning: [25, 80, 25],         // stock ceiling hit, invalid input
  error:   [35, 70, 35, 70, 35], // request failed, order rejected
};

export function haptic(name) {
  if (!('vibrate' in navigator)) return;
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    navigator.vibrate(PATTERNS[name] ?? PATTERNS.tick);
  } catch {
    // Older WebViews throw on vibrate; feedback is already on screen.
  }
}
