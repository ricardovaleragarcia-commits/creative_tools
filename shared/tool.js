/* Tool page helper: when the menu has to scroll, leave room at the bottom so the fixed credits bar
   never covers the last controls. (When everything fits, blocks fill the panel with 5px margins.) */
(function () {
  var menu = document.querySelector(".menu");
  if (!menu) return;
  var PAD = 44, on = false;
  var narrow = matchMedia("(max-width: 900px)");   // on wide screens the credits sit at the right, away from the menu
  function check() {
    if (!narrow.matches) { if (on) { on = false; menu.style.paddingBottom = ""; } return; }
    var over = menu.scrollHeight - (on ? PAD : 0) > menu.clientHeight + 1;
    if (over !== on) { on = over; menu.style.paddingBottom = on ? (5 + PAD) + "px" : ""; }
  }
  new ResizeObserver(check).observe(menu);
  addEventListener("resize", check);
  check();
})();
