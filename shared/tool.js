/* Tool page helper.
   - Title: the tool name (from <title>) sits on top of the card-colored stage.
   - Tools call window.setFrameBg(css) when their artwork background changes (kept for later use).
   - When the menu has to scroll, leave room at the bottom so the fixed credits bar never covers the last controls. */
(function () {
  var page = document.querySelector(".toolpage");
  if (!page) return;
  var menu = page.querySelector(".menu"), stage = page.querySelector(".stage");

  var title = page.querySelector(".toolhead__title");
  if (title) title.textContent = document.title.replace(/\s*[—-]\s*Creative tools\s*$/, "");

  window.setFrameBg = function (css) { stage.style.setProperty("--frame-bg", css); };

  var PAD = 44, pad = false;
  var narrow = matchMedia("(max-width: 900px)");
  function checkMenu() {
    if (!narrow.matches) { if (pad) { pad = false; menu.style.paddingBottom = ""; } return; }
    var over = menu.scrollHeight - (pad ? PAD : 0) > menu.clientHeight + 1;
    if (over !== pad) { pad = over; menu.style.paddingBottom = pad ? (5 + PAD) + "px" : ""; }
  }
  new ResizeObserver(checkMenu).observe(menu);
  addEventListener("resize", checkMenu);
  checkMenu();
})();
