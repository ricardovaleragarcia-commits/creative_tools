/* Injects the credits bar (text + clickable icons) into <footer id="credits"> on every page. */
(function () {
  var base = document.currentScript.src.replace(/[^\/]*$/, "");   // .../shared/
  var L = [
    ["https://ricardovaleragarcia.com", "Website", null],          // uses shared/favicon-64.png
    ["mailto:ricardo.valera.garcia@gmail.com", "Email", "M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1.6 2L12 12.4 19.4 7H4.6ZM4 17h16V9.3l-8 5.8-8-5.8V17Z"],
    ["https://www.instagram.com/ricardovaleragarcia/", "Instagram", "M7.800 2h8.400A5.800 5.800 0 0 1 22 7.800v8.400a5.800 5.800 0 0 1-5.800 5.800H7.800A5.800 5.800 0 0 1 2 16.200V7.800A5.800 5.800 0 0 1 7.800 2Zm-.2 2A3.600 3.600 0 0 0 4 7.600v8.800A3.600 3.600 0 0 0 7.600 20h8.800a3.600 3.600 0 0 0 3.600-3.600V7.600A3.600 3.600 0 0 0 16.400 4H7.600ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.300-3.500a1.200 1.200 0 1 1 0 2.400 1.200 1.200 0 0 1 0-2.400Z"],
    ["https://www.linkedin.com/in/rvaleragarcia/", "LinkedIn", "M4.500 3A2.500 2.500 0 1 1 4.500 8 2.500 2.500 0 0 1 4.500 3ZM2.300 9.500h4.400V21H2.300V9.500Zm7.100 0h4.200v1.600h.1c.6-1.100 2-1.900 3.900-1.900 4.100 0 4.700 2.600 4.700 6V21h-4.400v-5.100c0-1.200 0-2.800-1.700-2.800s-2 1.300-2 2.700V21H9.400V9.500Z"]
  ];
  var el = document.getElementById("credits");
  if (!el) return;
  var html = "<span>Made by Ricardo Jesús Valera García</span>";
  L.forEach(function (l) {
    var ext = l[0].indexOf("http") === 0 ? ' target="_blank" rel="noopener"' : "";
    var icon = l[2]
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + l[2] + '"/></svg>'
      : '<img src="' + base + 'favicon-64.png" alt="" width="64" height="64">';
    html += '<a href="' + l[0] + '" aria-label="' + l[1] + '" title="' + l[1] + '"' + ext + '>' + icon + '</a>';
  });
  el.innerHTML = html;
})();
