/* 三角洲行动 · 烽火地带物品价值浏览器 —— 原生 JS */
(function () {
  "use strict";

  // 品质配置：白绿蓝紫金红（顺序按用户要求：红/金/紫/蓝在前，再加绿/白）
  var QUALITY = {
    red:    { zh: "红色", icon: "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/diamond-fill.svg" },
    gold:   { zh: "金色", icon: "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/star-fill.svg" },
    purple: { zh: "紫色", icon: "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/gem.svg" },
    blue:   { zh: "蓝色", icon: "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/droplet-half.svg" },
    green:  { zh: "绿色", icon: "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/leaf.svg" },
    white:  { zh: "白色", icon: "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/circle.svg" }
  };
  var QUALITY_ORDER = ["red", "gold", "purple", "blue", "green", "white"];

  var WORTH_ORDER = ["必带", "推荐", "酌情", "不推荐", "未定价"];

  var state = {
    items: [],
    search: "",
    qualities: new Set(),   // 空 = 全部
    worths: new Set(),
    sort: "value_desc"
  };

  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function fmt(n) {
    if (n == null) return "—";
    return n.toLocaleString("zh-CN");
  }

  /* ---------- 主题 ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    $("themeToggle").textContent = t === "dark" ? "🌙" : "☀️";
    try { localStorage.setItem("df-theme", t); } catch (e) {}
  }
  $("themeToggle").addEventListener("click", function () {
    var cur = document.documentElement.getAttribute("data-theme");
    applyTheme(cur === "dark" ? "light" : "dark");
  });

  /* ---------- 筛选器 ---------- */
  function buildChips() {
    var qBox = $("qualityFilters");
    qBox.innerHTML = "";
    var all = document.createElement("div");
    all.className = "chip active";
    all.textContent = "全部";
    all.dataset.q = "*";
    qBox.appendChild(all);
    QUALITY_ORDER.forEach(function (k) {
      var c = document.createElement("div");
      c.className = "chip";
      c.dataset.q = k;
      var dot = '<span class="dot" style="background:' + colorOf(k) + '"></span>';
      c.innerHTML = dot + QUALITY[k].zh;
      qBox.appendChild(c);
    });
    qBox.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip) return;
      var q = chip.dataset.q;
      if (q === "*") { state.qualities.clear(); }
      else {
        if (state.qualities.has(q)) state.qualities.delete(q);
        else state.qualities.add(q);
      }
      syncChips(qBox, state.qualities, "*");
      render();
    });

    var wBox = $("worthFilters");
    wBox.innerHTML = "";
    var wall = document.createElement("div");
    wall.className = "chip active";
    wall.textContent = "全部";
    wall.dataset.w = "*";
    wBox.appendChild(wall);
    WORTH_ORDER.forEach(function (w) {
      var c = document.createElement("div");
      c.className = "chip";
      c.dataset.w = w;
      c.textContent = w;
      wBox.appendChild(c);
    });
    wBox.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip) return;
      var w = chip.dataset.w;
      if (w === "*") { state.worths.clear(); }
      else {
        if (state.worths.has(w)) state.worths.delete(w);
        else state.worths.add(w);
      }
      syncChips(wBox, state.worths, "*");
      render();
    });
  }
  function syncChips(box, set, allKey) {
    Array.prototype.forEach.call(box.children, function (chip) {
      var key = chip.dataset.q || chip.dataset.w;
      if (key === allKey) {
        chip.classList.toggle("active", set.size === 0);
      } else {
        chip.classList.toggle("active", set.has(key));
      }
    });
  }
  function colorOf(q) {
    var map = { white:"#cdd2da", green:"#36c46a", blue:"#3b82f6",
                purple:"#a855f7", gold:"#f5c518", red:"#ef4444" };
    return map[q] || "#888";
  }

  /* ---------- 过滤 + 排序 ---------- */
  function filterSort() {
    var kw = state.search.trim().toLowerCase();
    var list = state.items.filter(function (it) {
      if (state.qualities.size && !state.qualities.has(it.quality)) return false;
      if (state.worths.size && !state.worths.has(it.worth)) return false;
      if (kw) {
        var hay = (it.name + " " + it.category + " " + it.sub_category).toLowerCase();
        if (hay.indexOf(kw) === -1) return false;
      }
      return true;
    });

    var s = state.sort;
    list.sort(function (a, b) {
      // 未定价一律沉底
      if (a.value == null && b.value == null) return 0;
      if (a.value == null) return 1;
      if (b.value == null) return -1;
      switch (s) {
        case "value_asc": return a.value - b.value;
        case "ssv_desc":  return (b.singleSlotValue || 0) - (a.singleSlotValue || 0);
        case "ssv_asc":   return (a.singleSlotValue || 0) - (b.singleSlotValue || 0);
        case "name_asc":  return a.name.localeCompare(b.name, "zh");
        default:          return b.value - a.value; // value_desc
      }
    });
    return list;
  }

  /* ---------- 渲染 ---------- */
  function cardHTML(it) {
    var q = QUALITY[it.quality] || QUALITY.white;
    var priced = it.value != null;
    var valHTML = priced
      ? '<span class="value-num">' + fmt(it.value) + '</span><span class="value-unit">哈夫币</span>'
      : '<span class="value-num unpriced">价值未知</span>';
    var ssv = it.singleSlotValue != null ? fmt(it.singleSlotValue) + " /格" : "—";
    var slots = it.slots != null ? it.slots : "—";
    var desc = it.description ? esc(it.description) : "<i>暂无描述</i>";
    var weight = it.weight_kg != null ? it.weight_kg + " kg" : "—";
    var size = it.slot_size || "—";

    return '' +
      '<div class="card q-' + it.quality + '" data-id="' + esc(it.id) + '">' +
        '<div class="card-head">' +
          '<div class="q-icon"><img src="' + q.icon + '" alt="" onerror="this.style.display=\'none\'"></div>' +
          '<div class="card-name">' + esc(it.name) + '</div>' +
          '<div class="q-badge">' + q.zh + '</div>' +
        '</div>' +
        '<div class="value-row">' + valHTML + '</div>' +
        '<div class="meta-row">' +
          '<span>占用 <b>' + slots + '</b> 格</span>' +
          '<span>单格 <b>' + ssv + '</b></span>' +
        '</div>' +
        '<span class="worth worth-' + it.worth + '">' + it.worth + '</span>' +
        '<div class="details">' +
          '<p class="desc">' + desc + '</p>' +
          '<dl>' +
            '<dt>分类</dt><dd>' + esc(it.category) + ' / ' + esc(it.sub_category || "—") + '</dd>' +
            '<dt>重量</dt><dd>' + weight + '</dd>' +
            '<dt>尺寸</dt><dd>' + esc(size) + '</dd>' +
            '<dt>单格价值</dt><dd>' + ssv + '</dd>' +
            '<dt>携带建议</dt><dd>' + it.worth + '</dd>' +
          '</dl>' +
        '</div>' +
      '</div>';
  }

  function render() {
    var list = filterSort();
    var grid = $("grid");
    grid.innerHTML = list.map(cardHTML).join("");
    $("empty").hidden = list.length !== 0;
    $("count").textContent = list.length;

    var af = [];
    if (state.qualities.size) af.push([].concat(QUALITY_ORDER.filter(function (k) { return state.qualities.has(k); })).map(function (k) { return QUALITY[k].zh; }).join("、"));
    if (state.worths.size) af.push([].concat(WORTH_ORDER.filter(function (w) { return state.worths.has(w); })).join("、"));
    if (state.search.trim()) af.push('“' + state.search.trim() + '”');
    $("activeFilters").textContent = af.length ? "（筛选：" + af.join(" · ") + "）" : "";
  }

  /* 卡片展开 */
  $("grid").addEventListener("click", function (e) {
    var card = e.target.closest(".card");
    if (card) card.classList.toggle("open");
  });

  /* 搜索 / 排序 */
  $("search").addEventListener("input", function (e) {
    state.search = e.target.value; render();
  });
  $("sort").addEventListener("change", function (e) {
    state.sort = e.target.value; render();
  });

  /* ---------- 启动 ---------- */
  function init() {
    var saved = null;
    try { saved = localStorage.getItem("df-theme"); } catch (e) {}
    applyTheme(saved === "light" ? "light" : "dark");
    buildChips();
    fetch("items.json", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        state.items = data.items || [];
        render();
      })
      .catch(function (err) {
        $("grid").innerHTML =
          '<div class="empty" style="grid-column:1/-1">' +
          '无法加载 <b>items.json</b>：' + esc(err.message) + '<br><br>' +
          '请通过本地服务器或 GitHub Pages 打开本页面。<br>' +
          '本地预览可在本目录执行：<code>python -m http.server 8080</code><br>' +
          '然后访问 http://localhost:8080</div>';
      });
  }

  init();
})();
