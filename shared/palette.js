/* Palette picked on the landing (the dots). Applied before first paint from <head>, so every page matches.
   Stored per browser; the landing and the tools read the same key.
   theme-color = a lighter tint of the palette's main color, so Safari's toolbar matches the page. */
(function () {
  var KEY = "ct-palette";
  var LIST = ["red", "green", "purple", "orange", "blue", "white", "black", "pink", "yellow", "teal", "sand", "midnight"];
  var TINT = {          // main color mixed 35% with white
    red: "#ff5959", green: "#59dbb8", purple: "#bea9f5", orange: "#ffb67b",
    blue: "#6fa2ff", white: "#ffffff", black: "#595959",
    pink: "#ff8fc2", yellow: "#ffe666", teal: "#6cc4cc", sand: "#e5d6c0", midnight: "#5a6580"
  };
  function get() { try { var p = localStorage.getItem(KEY); return LIST.indexOf(p) >= 0 ? p : "red"; } catch (e) { return "red"; } }
  function themeColor(p) {
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement("meta"); m.name = "theme-color"; document.head.appendChild(m); }
    m.content = TINT[p];
  }
  function set(p) {
    document.documentElement.setAttribute("data-palette", p);
    try { localStorage.setItem(KEY, p); } catch (e) {}
    themeColor(p);
  }
  window.CTPalette = { list: LIST, get: get, set: set };
  // on reload / back-forward the entrance animations are skipped (they made everything flicker)
  try {
    var nav = performance.getEntriesByType("navigation")[0], root = document.documentElement;
    if (nav && nav.type !== "navigate") root.classList.add("no-intro");
    else if (!/\/tools\//.test(location.pathname) && !sessionStorage.getItem("ct-intro") && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.classList.add("intro");                    // landing, first visit of this session: dots orbit first (landing.js ends it)
      setTimeout(function () { root.classList.remove("intro"); root.classList.add("intro-played"); }, 6000);   // failsafe: never leave the page hidden
    }
  } catch (e) {}
  var cur = get();
  document.documentElement.setAttribute("data-palette", cur);
  themeColor(cur);
})();
