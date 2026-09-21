// A dot flies from the pressed control to the header cart, so "it went in the
// cart" is shown rather than announced. Uses the Web Animations API on a
// throwaway element — no React state, no layout work on the page itself.
export function flyToCart(fromEl) {
  const target = [...document.querySelectorAll('[data-cart-target]')]
    .find((el) => el.offsetParent !== null);
  if (!fromEl || !target || typeof fromEl.animate !== 'function') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const a = fromEl.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const dot = document.createElement('span');
  const color = document.documentElement.classList.contains('dark') ? '#FB923C' : '#C2410C';
  dot.style.cssText =
    `position:fixed;left:${a.left + a.width / 2 - 6}px;top:${a.top + a.height / 2 - 6}px;` +
    `width:12px;height:12px;border-radius:50%;background:${color};z-index:60;pointer-events:none;`;
  document.body.appendChild(dot);

  const anim = dot.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      {
        transform:
          `translate(${b.left + b.width / 2 - (a.left + a.width / 2)}px, ` +
          `${b.top + b.height / 2 - (a.top + a.height / 2)}px) scale(0.35)`,
        opacity: 0.75,
      },
    ],
    { duration: 420, easing: 'cubic-bezier(0.5, -0.1, 0.4, 1)' },
  );
  anim.onfinish = () => dot.remove();
  anim.oncancel = () => dot.remove();
}
