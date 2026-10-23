/* Palette picked on the landing (the dots). Applied before first paint from <head>, so every page matches.
   Stored per browser; the landing and the tools read the same key.
   theme-color = a lighter tint of the palette's main color, so Safari's toolbar matches the page. */
(function () {
  var KEY = "ct-palette";
  var LIST = ["red", "green", "purple", "orange", "blue", "white", "black"];
  var TINT = {          // main color mixed 35% with white
    red: "#ff5959", green: "#59dbb8", purple: "#bea9f5", orange: "#ffb67b",
    blue: "#6fa2ff", white: "#ffffff", black: "#595959"
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
  var cur = get();
  document.documentElement.setAttribute("data-palette", cur);
  themeColor(cur);
})();
