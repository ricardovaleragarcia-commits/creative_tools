/* Renders window.TOOLS (see tools.js) into the grid. */

(function () {
  "use strict";

  var grid = document.getElementById("tools");
  if (!grid) return;

  var tools = Array.isArray(window.TOOLS) ? window.TOOLS : [];
  var fragment = document.createDocumentFragment();

  tools.forEach(function (tool) {
    if (!tool || !tool.title) return;

    var article = document.createElement("article");
    article.className = "tool";

    var title = document.createElement("h2");
    title.className = "tool__title";
    title.textContent = tool.title;
    article.appendChild(title);

    var media = document.createElement(tool.href ? "a" : "div");
    media.className = "tool__media";

    if (tool.href) {
      media.href = tool.href;
      media.setAttribute("aria-label", tool.title);
    }

    if (tool.image) {
      var img = document.createElement("img");
      img.src = tool.image;
      img.alt = tool.imageAlt || tool.title;
      img.loading = "lazy";
      img.decoding = "async";
      media.appendChild(img);
    }

    article.appendChild(media);

    if (tool.description) {
      var desc = document.createElement("p");
      desc.className = "tool__desc";
      desc.textContent = tool.description;
      article.appendChild(desc);
    }

    fragment.appendChild(article);
  });

  grid.replaceChildren(fragment);
})();

/* ------------------------------------------------------------------
   Cronómetro de sesión + número de tools
   ------------------------------------------------------------------
   El cronómetro cuenta desde que se carga la página.

   La segunda línea cuenta las tools publicadas en tools.js, así que se
   actualiza sola al añadir o quitar entradas: no hay nada que mantener.
------------------------------------------------------------------ */

(function () {
  "use strict";

  var timer = document.getElementById("site-timer");
  var toolsCount = document.getElementById("tools-count");
  var started = Date.now();

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function renderTimer() {
    if (!timer) return;
    var total = Math.max(0, Math.floor((Date.now() - started) / 1000));
    timer.textContent =
      "on site " +
      pad(Math.floor(total / 3600)) +
      ":" +
      pad(Math.floor((total % 3600) / 60)) +
      ":" +
      pad(total % 60);
  }

  renderTimer();
  window.setInterval(renderTimer, 1000);

  if (!toolsCount) return;

  var tools = Array.isArray(window.TOOLS) ? window.TOOLS : [];
  var total = tools.filter(function (tool) {
    return tool && tool.title;
  }).length;

  toolsCount.textContent =
    "Currently " + total + (total === 1 ? " tool on" : " tools on");
})();
