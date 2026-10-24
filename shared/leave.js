/* Soft exit: on a click to another page of the site, fade the page out for a moment, then navigate. */
(function () {
  var root = document.documentElement;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  addEventListener("pageshow", function (e) { if (e.persisted) root.classList.remove("leaving"); });
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== "_self") return;
    var u = new URL(a.href, location.href);
    if (u.origin !== location.origin || u.pathname === location.pathname || a.hasAttribute("download")) return;
    e.preventDefault(); root.classList.add("leaving");
    setTimeout(function () { location.href = a.href; }, 280);
  });
})();
