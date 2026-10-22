/* Controlled scroll with a touch of resistance: wheel input moves a target and the
   scroll position eases toward it. Applies to the page and to scrollable panels (.menu).
   Touch, keyboard and scrollbar dragging stay native. Disabled with prefers-reduced-motion.
   Tweak the feel with TAU (ms): higher = heavier / more resistance. */
(function () {
  var TAU = 130;     // easing time constant in ms
  var SPEED = 0.9;   // wheel delta multiplier
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var states = new WeakMap();
  var root = document.scrollingElement || document.documentElement;

  function stateOf(el) {
    var s = states.get(el);
    if (!s) {
      s = { cur: el.scrollTop, target: el.scrollTop, raf: 0, last: 0, own: false };
      states.set(el, s);
      var src = el === root ? window : el;
      src.addEventListener("scroll", function () {
        if (s.raf) return;                    // our own animation is driving it
        s.cur = s.target = el.scrollTop;      // keyboard / scrollbar / anchor jumps
      }, { passive: true });
    }
    return s;
  }
  function max(el) { return el.scrollHeight - (el === root ? window.innerHeight : el.clientHeight); }

  function scrollableFrom(node) {
    for (var el = node; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      var o = getComputedStyle(el).overflowY;
      if ((o === "auto" || o === "scroll") && el.scrollHeight > el.clientHeight + 1) return el;
    }
    return max(root) > 1 ? root : null;
  }

  function step(el, s, t) {
    var dt = Math.min(64, t - s.last || 16); s.last = t;
    var k = 1 - Math.exp(-dt / TAU);
    s.cur += (s.target - s.cur) * k;
    if (Math.abs(s.target - s.cur) < 0.4) s.cur = s.target;
    el.scrollTop = s.cur;
    if (s.cur !== s.target) s.raf = requestAnimationFrame(function (n) { step(el, s, n); });
    else s.raf = 0;
  }

  addEventListener("wheel", function (e) {
    if (e.ctrlKey || e.metaKey || e.defaultPrevented || e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    var el = scrollableFrom(e.target);
    if (!el) return;
    var s = stateOf(el), m = max(el);
    var d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
    if (!s.raf) s.cur = s.target = el.scrollTop;
    var next = Math.max(0, Math.min(m, s.target + d * SPEED));
    if (next === s.target && (el.scrollTop <= 0 || el.scrollTop >= m)) return;   // at the edge: let the parent handle it
    e.preventDefault();
    s.target = next;
    if (!s.raf) { s.last = performance.now(); s.raf = requestAnimationFrame(function (n) { step(el, s, n); }); }
  }, { passive: false });
})();
