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

  // Sections: a child of .menu with data-sec starts a collapsible section that runs until the next one.
  // data-open = open by default. The user's choice is remembered. A section titled "Export" sticks to the bottom.
  (function () {
    var kids = Array.prototype.slice.call(menu.children);
    if (!kids.some(function (k) { return k.hasAttribute("data-sec"); })) return;
    menu.classList.add("sectioned");
    var key = "ct-sec-" + location.pathname, saved = {};
    try { saved = JSON.parse(localStorage.getItem(key)) || {}; } catch (e) {}
    var cur = null, n = 0;
    kids.forEach(function (k) {
      if (k.hasAttribute("data-sec")) {
        var title = k.getAttribute("data-sec"), open = title in saved ? !!saved[title] : k.hasAttribute("data-open");
        var sec = document.createElement("section"); sec.className = "sec" + (title === "Export" ? " sec--export" : "");
        var h = document.createElement("button"); h.type = "button"; h.className = "sec__h";
        var id = "sec" + (++n); h.setAttribute("aria-controls", id);
        var t = document.createElement("span"); t.innerHTML = title; h.appendChild(t);
        var c = document.createElement("span"); c.className = "sec__c"; c.setAttribute("aria-hidden", "true"); h.appendChild(c);
        var body = document.createElement("div"); body.className = "sec__body"; body.id = id;
        function set(o) { h.setAttribute("aria-expanded", o ? "true" : "false"); body.hidden = !o; }
        set(open);
        (function (title, h, body) {
          h.addEventListener("click", function () {
            var o = body.hidden; h.setAttribute("aria-expanded", o ? "true" : "false"); body.hidden = !o;
            saved[title] = o; try { localStorage.setItem(key, JSON.stringify(saved)); } catch (e) {}
          });
        })(title, h, body);
        sec.appendChild(h); sec.appendChild(body); menu.insertBefore(sec, k);
        cur = body;
      }
      if (cur) cur.appendChild(k);
    });
  })();

  menu.querySelectorAll(".block").forEach(function (b, i) { b.style.setProperty("--i", i); });

  setTimeout(function () { page.classList.add("ready"); }, 1800);

  window.setFrameBg = function (css) { stage.style.setProperty("--frame-bg", css); };

})();
