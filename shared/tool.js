/* Tool page helper.
   - Title: the tool name (from <title>) sits on top of the card-colored stage.
   - Tools call window.setFrameBg(css) when their artwork background changes (kept for later use).
*/
(function () {
  var page = document.querySelector(".toolpage");
  if (!page) return;
  var menu = page.querySelector(".menu"), stage = page.querySelector(".stage");

  var title = page.querySelector(".toolhead__title");
  if (title) title.textContent = document.title.replace(/\s*[—-]\s*Creative tools\s*$/, "");

  menu.querySelectorAll(".block").forEach(function (b, i) { b.style.setProperty("--i", i); });

  setTimeout(function () { page.classList.add("ready"); }, 1800);

  window.setFrameBg = function (css) { stage.style.setProperty("--frame-bg", css); };

})();
