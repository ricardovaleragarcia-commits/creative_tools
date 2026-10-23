/* Palette picked on the landing (the dots). Applied before first paint from <head>, so every page matches.
   Stored per browser; the landing and the tools read the same key. */
(function () {
  var KEY = "ct-palette";
  var LIST = ["red", "green", "purple", "orange", "blue", "white", "black"];
  function get() { try { var p = localStorage.getItem(KEY); return LIST.indexOf(p) >= 0 ? p : "red"; } catch (e) { return "red"; } }
  function set(p) {
    document.documentElement.setAttribute("data-palette", p);
    try { localStorage.setItem(KEY, p); } catch (e) {}
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", getComputedStyle(document.documentElement).getPropertyValue("--main").trim());
  }
  window.CTPalette = { list: LIST, get: get, set: set };
  document.documentElement.setAttribute("data-palette", get());
})();
