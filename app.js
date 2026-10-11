// Общий код сайта: ссылки на скачивание и счётчики.
// Числа берутся из раздела Releases на GitHub — он сам считает каждое скачивание файла.
(function () {
  var KEY = "phub_stats_v1";
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
  function mb(bytes) { return Math.round(bytes / 1048576) + " МБ"; }
  function getJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(r.status === 403 || r.status === 429 ? "limit" : "http");
      return r.json();
    });
  }
  function cfg() { return getJSON("data/games.json"); }
  // Запасная ссылка, если GitHub не ответил: прямой адрес файла в релизе.
  function direct(c, game, file) {
    return "https://github.com/" + c.user + "/" + c.repo + "/releases/download/" + game.tag + "/" + encodeURIComponent(file);
  }
  function build(c, lists) {
    var files = {};              // имя файла -> {n, size, url, date, version}
    lists.forEach(function (rel, ri) {
      (rel || []).forEach(function (r) {
        (r.assets || []).forEach(function (a) {
          var f = files[a.name] || (files[a.name] = { n: 0, size: 0, url: "", date: "", version: "" });
          f.n += a.download_count;
          // Скачивать даём самую свежую выкладку из основного репозитория.
          if (ri === 0 && (!f.date || r.published_at > f.date)) { f.date = r.published_at; f.url = a.browser_download_url; f.size = a.size; f.version = r.tag_name; }
        });
      });
    });
    var out = { t: Date.now(), total: 0, games: [] };
    c.games.forEach(function (g) {
      var row = { id: g.id, title: g.title, version: g.version, n: 0, files: [] };
      g.files.forEach(function (gf) {
        var f = files[gf.name] || { n: 0, size: 0, url: "", date: "" };
        row.n += f.n;
        row.files.push({ name: gf.name, platform: gf.platform, n: f.n, size: f.size, date: f.date, url: f.url || direct(c, g, gf.name), live: !!f.url });
      });
      out.total += row.n; out.games.push(row);
    });
    return out;
  }
  function load(force) {
    try {
      var cached = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!force && cached && Date.now() - cached.t < 5 * 60 * 1000) return Promise.resolve(cached);
    } catch (e) {}
    return cfg().then(function (c) {
      var repos = [c.repo].concat(c.extraRepos || []);
      return Promise.all(repos.map(function (r, i) {
        var p = getJSON("https://api.github.com/repos/" + c.user + "/" + r + "/releases?per_page=100");
        return i === 0 ? p : p.catch(function () { return []; });   // старый репозиторий не обязателен
      })).then(function (lists) {
        var out = build(c, lists);
        try { localStorage.setItem(KEY, JSON.stringify(out)); } catch (e) {}
        return out;
      });
    });
  }
  // Пока GitHub не ответил (или не ответил вовсе), кнопки ведут по прямым адресам.
  function fallbackLinks() {
    return cfg().then(function (c) {
      c.games.forEach(function (g) {
        g.files.forEach(function (f) {
          document.querySelectorAll('[data-file="' + f.name + '"]').forEach(function (a) { if (!a.getAttribute("href")) a.href = direct(c, g, f.name); });
        });
      });
    }).catch(function () {});
  }
  function fill(s) {
    s.games.forEach(function (g) {
      document.querySelectorAll('[data-count="' + g.id + '"]').forEach(function (e) { e.textContent = fmt(g.n); });
      g.files.forEach(function (f) {
        document.querySelectorAll('[data-file="' + f.name + '"]').forEach(function (a) { a.href = f.url; });
        if (f.size) document.querySelectorAll('[data-size="' + f.name + '"]').forEach(function (e) { e.textContent = mb(f.size); });
      });
    });
    document.querySelectorAll("[data-total]").forEach(function (e) { e.textContent = fmt(s.total); });
  }
  window.Hub = { load: load, fill: fill, fallbackLinks: fallbackLinks, fmt: fmt, mb: mb, getJSON: getJSON };
})();
