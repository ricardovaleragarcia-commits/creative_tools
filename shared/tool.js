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
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Smooth open/close: animate height + opacity, then hide/restore.
    function slide(body, open) {
      if (body._a) body._a.cancel();
      if (reduce || !body.animate) { body.hidden = !open; return; }
      var ov = body.style.overflow; body.style.overflow = "hidden";
      var done = function () { body._a = null; body.style.overflow = ov; if (!open) body.hidden = true; };
      if (open) body.hidden = false;
      var full = body.scrollHeight, cs = getComputedStyle(body);
      var from = open ? { height: "0px", opacity: 0 } : { height: Math.min(body.offsetHeight, full) + "px", opacity: 1 };
      var to = open ? { height: Math.min(full, parseFloat(cs.maxHeight) || full) + "px", opacity: 1 } : { height: "0px", opacity: 0 };
      var a = body._a = body.animate([from, to], { duration: 260, easing: "cubic-bezier(.2,.7,.2,1)" });
      a.onfinish = done; a.oncancel = function () { body.style.overflow = ov; };
    }
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
            var o = body.hidden; h.setAttribute("aria-expanded", o ? "true" : "false"); slide(body, o);
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
  // Section headers fade in just before their first block.
  menu.querySelectorAll(".sec").forEach(function (s) {
    var b = s.querySelector(".block"), h = s.querySelector(".sec__h");
    h.style.setProperty("--i", b ? Math.max(0, +b.style.getPropertyValue("--i") - 1) : 0);
  });

  setTimeout(function () { page.classList.add("ready"); }, 1800);

  window.setFrameBg = function (css) { stage.style.setProperty("--frame-bg", css); };

})();
