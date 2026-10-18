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
