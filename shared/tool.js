/* Tool page helper.
   - Title: the tool name (from <title>) goes on the top right, over the main color.
   - Workspace: a block at the top of the menu. ON = the stage keeps the palette color around the artwork;
     OFF = the stage becomes the frame background (set by the tool with setFrameBg) and crop marks show the frame edges.
   - When the menu has to scroll, leave room at the bottom so the fixed credits bar never covers the last controls. */
(function () {
  var page = document.querySelector(".toolpage");
  if (!page) return;
  var menu = page.querySelector(".menu"), stage = page.querySelector(".stage"), art = page.querySelector(".artwork");

  var title = page.querySelector(".toolhead__title");
  if (title) title.textContent = document.title.replace(/\s*[—-]\s*Creative tools\s*$/, "");

  // crop marks, placed over the artwork frame (only visible when the workspace is off)
  var crop = document.createElement("div");
  crop.className = "crop"; crop.setAttribute("aria-hidden", "true");
  stage.appendChild(crop);
  function place() {
    var s = stage.getBoundingClientRect(), a = art.getBoundingClientRect();
    stage.style.setProperty("--fx", (a.left - s.left) + "px");
    stage.style.setProperty("--fy", (a.top - s.top) + "px");
    stage.style.setProperty("--fw", a.width + "px");
    stage.style.setProperty("--fh", a.height + "px");
  }
  new ResizeObserver(place).observe(stage);
  new ResizeObserver(place).observe(art);
  addEventListener("resize", place);

  // workspace block
  var on = localStorage.getItem("ct-workspace") !== "off";
  var blk = document.createElement("div");
  blk.className = "block full";
  blk.innerHTML = '<div class="t">Workspace</div><div class="btns fill">' +
    '<button type="button" data-m="on">Workspace</button><button type="button" data-m="off">No workspace</button></div>';
  menu.insertBefore(blk, menu.firstChild);
  function paint() {
    stage.classList.toggle("is-off", !on);
    blk.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", (b.getAttribute("data-m") === "on") === on); });
    place();
  }
  blk.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    on = b.getAttribute("data-m") === "on";
    try { localStorage.setItem("ct-workspace", on ? "on" : "off"); } catch (err) {}
    paint();
  });
  paint();

  // tools call this when their artwork background changes (CSS color or gradient)
  window.setFrameBg = function (css) { stage.style.setProperty("--frame-bg", css); };

  // when the menu has to scroll, keep room under the last control for the fixed credits bar (narrow screens)
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
