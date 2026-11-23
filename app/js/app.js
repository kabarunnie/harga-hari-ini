(function () {
  const B = MiniBoot;
  const root = document.getElementById("screen");
  let data = null;
  let view = "kurs";
  let amount = 1, from = "USD";
  let literPrice = "", km = "20", kml = "40", tank = "4";

  function rp(n) {
    if (n == null || !isFinite(n)) return "—";
    return "Rp " + Math.round(n).toLocaleString("id-ID");
  }
  function jisdorDate() {
    return data && data.jisdorUsd && data.jisdorUsd.date ? String(data.jisdorUsd.date).slice(0, 10) : "—";
  }
  function stale() {
    var d = jisdorDate();
    if (d === "—") return true;
    var dt = new Date(d + "T00:00:00+07:00");
    var now = B.wibNow();
    return (now - dt) > 3.5 * 86400000;
  }
  function rateOf(code) {
    if (code === "USD" && data.jisdorUsd) return { unit: data.jisdorUsd.unit || 1, mid: data.jisdorUsd.value, beli: data.jisdorUsd.value, jual: data.jisdorUsd.value, kind: "JISDOR" };
    var row = (data.transaksi || []).filter(function (r) { return r.code === code; })[0];
    if (!row) return null;
    return { unit: row.unit || 1, mid: (row.beli + row.jual) / 2, beli: row.beli, jual: row.jual, kind: "Transaksi" };
  }
  function toIdr(code, qty) {
    var r = rateOf(code);
    if (!r) return null;
    return qty / r.unit * r.mid;
  }

  function render() {
    var html = '<div class="screen-fade"><div class="top"><div><div class="eyebrow">Kurs resmi · kalkulator bensin</div><h1>Harga Hari Ini</h1></div>';
    html += '<div class="date-chip">' + B.escapeHtml(B.formatIdDate()) + "</div></div>";
    html += '<div class="tabbar" style="position:relative;border-radius:16px;margin-bottom:14px">';
    [["kurs","Kurs"],["bensin","Isi bensin"],["sumber","Sumber"]].forEach(function (x) {
      html += '<button class="' + (view===x[0]?"on":"") + '" data-view="' + x[0] + '">' + x[1] + "</button>";
    });
    html += "</div>";

    if (view === "kurs") {
      if (!data || !data.jisdorUsd) {
        html += '<div class="warn-banner">Kurs belum tersedia. Nilai tidak dikira-kira.</div>';
      } else {
        if (stale()) html += '<div class="warn-banner">Data terakhir: ' + jisdorDate() + ". Ini nilai terakhir yang berhasil diambil, bukan tebakan.</div>";
        else html += '<p class="ok-banner">JISDOR USD · tanggal kurs ' + jisdorDate() + "</p>";
        html += '<div class="card" style="margin-top:12px"><p class="muted">USD / IDR (JISDOR)</p><p class="clock">' + rp(data.jisdorUsd.value) + '</p>';
        html += '<p class="source">Sumber: Bank Indonesia — JISDOR. 1 USD = ' + rp(data.jisdorUsd.value) + "</p></div>";
        html += '<div class="card" style="margin-top:12px"><p class="lead">Konversi</p>';
        html += '<label class="field">Jumlah</label><input id="amt" type="number" min="0" step="any" value="' + B.escapeHtml(String(amount)) + '">';
        html += '<label class="field">Mata uang</label><select id="ccy">';
        var codes = ["USD"].concat((data.transaksi || []).map(function (r) { return r.code; }).filter(function (c) { return c !== "USD"; }));
        codes.forEach(function (c) { html += '<option value="' + c + '"' + (c===from?" selected":"") + ">" + c + "</option>"; });
        html += "</select>";
        var conv = toIdr(from, Number(amount) || 0);
        var r = rateOf(from);
        html += '<p class="kpi" style="margin-top:14px">' + rp(conv) + "</p>";
        if (r && r.kind === "Transaksi") html += '<p class="muted">Kurs transaksi BI beli ' + rp(r.beli) + " · jual " + rp(r.jual) + " (tengah dipakai untuk konversi). Per " + String((data.transaksi[0]||{}).date||"").slice(0,10) + ".</p>";
        html += "</div>";
        html += '<div class="card" style="margin-top:12px"><p class="lead">Kurs transaksi lain</p><div class="list">';
        (data.transaksi || []).slice(0, 26).forEach(function (r) {
          html += '<div class="row"><span>' + B.escapeHtml(r.code) + (r.unit && r.unit !== 1 ? " (" + r.unit + ")" : "") + '</span><span class="kpi" style="font-size:16px">' + rp(r.beli) + " / " + rp(r.jual) + "</span></div>";
        });
        html += "</div></div>";
        html += '<div class="btn-row"><button class="btn" id="share">Bagikan kurs USD</button></div>';
      }
    } else if (view === "bensin") {
      var bbm = data && data.bbm;
      if (!bbm || bbm.status === "unavailable" || !(bbm.items && bbm.items.length)) {
        html += '<div class="warn-banner">Harga BBM resmi belum bisa diambil otomatis dari Pertamina (halaman tidak menyediakan umpan data yang andal). Tidak ada angka yang dikira-kira. Cek langsung <a href="https://www.pertamina.com/id/harga-bbm-terkini" target="_blank" rel="noopener">pertamina.com/id/harga-bbm-terkini</a>, lalu isi harga per liter di bawah.</div>';
      } else {
        html += '<div class="ok-banner">Harga BBM terakhir terverifikasi: ' + B.escapeHtml(bbm.lastVerified || "") + "</div>";
        (bbm.items || []).forEach(function (it) {
          html += '<div class="row"><span>' + B.escapeHtml(it.name) + '</span><span class="kpi">' + rp(it.price) + "</span></div>";
        });
      }
      html += '<div class="card" style="margin-top:12px"><p class="lead">Kalkulator isi bensin</p>';
      html += '<label class="field">Harga per liter (Rp)</label><input id="harga" type="number" min="0" value="' + B.escapeHtml(literPrice) + '" placeholder="Contoh: isi sesuai spbu">';
      html += '<label class="field">Jarak (km)</label><input id="km" type="number" min="0" value="' + B.escapeHtml(km) + '">';
      html += '<label class="field">Konsumsi (km/liter) — perkiraanmu, bukan data resmi</label><input id="kml" type="number" min="0.1" step="0.1" value="' + B.escapeHtml(kml) + '">';
      html += '<label class="field">Isi tangki (liter)</label><input id="tank" type="number" min="0" step="0.1" value="' + B.escapeHtml(tank) + '">';
      var p = Number(literPrice), k = Number(km), c = Number(kml), t = Number(tank);
      var trip = (p > 0 && k > 0 && c > 0) ? (k / c) * p : null;
      var full = (p > 0 && t > 0) ? t * p : null;
      html += '<div class="row"><span>Perkiraan ongkos jarak ini</span><span class="kpi">' + (trip==null?"—":rp(trip)) + "</span></div>";
      html += '<div class="row"><span>Perkiraan isi penuh</span><span class="kpi">' + (full==null?"—":rp(full)) + "</span></div>";
      html += '<p class="note">Konsumsi dan kapasitas tangki kamu isi sendiri. Aplikasi tidak menampilkan angka resmi pabrikan atau Pertamina jika sumbernya belum terverifikasi.</p></div>';
      html += '<div class="btn-row"><button class="btn" id="shareb">Bagikan hitungan</button></div>';
      html += '<div data-ad-slot="banner" hidden></div>';
      html += '<div class="affiliate-row"><div data-affiliate="shopee" hidden><a href="#"><span data-affiliate-label>Shopee</span></a></div><div data-affiliate="tokopedia" hidden><a href="#"><span data-affiliate-label>Tokopedia</span></a></div></div>';
    } else {
      html += '<div class="card"><p class="lead">Sumber data</p><ul class="muted" style="margin:12px 0 0 18px;line-height:1.6">';
      html += '<li>USD JISDOR: web service resmi Bank Indonesia (<a href="https://www.bi.go.id/id/statistik/informasi-kurs/jisdor/Default.aspx">jisdor</a>).</li>';
      html += '<li>Mata uang lain: Kurs Transaksi Bank Indonesia (beli/jual).</li>';
      html += '<li>Harga BBM: hanya jika umpan resmi bisa diambil. Saat ini tidak. tautan resmi Pertamina tertulis di tab Isi bensin.</li>';
      html += '<li>Jika pengambilan gagal, nilai terakhir yang berhasil diambil tetap ditampilkan beserta tanggalnya. Tidak ada angka buatan.</li>';
      html += "</ul></div>";
    }
    html += '<button class="stars-btn" data-stars hidden><span data-stars-label>Hapus iklan</span></button>';
    html += '<p class="footer-links">Aplikasi mandiri. Bukan situs resmi Bank Indonesia atau Pertamina.</p></div>';
    root.innerHTML = html;
    if (MiniAds && MiniAds.apply) MiniAds.apply(root);
    Array.prototype.forEach.call(document.querySelectorAll("[data-view]"), function (b) {
      b.onclick = function () { view = b.getAttribute("data-view"); render(); };
    });
    function bindNum(id, setter) {
      var el = document.getElementById(id);
      if (!el) return;
      el.onchange = el.oninput = function () { setter(el.value); render(); var n = document.getElementById(id); if (n) { n.focus(); n.value = el.value; } };
    }
    bindNum("amt", function (v) { amount = v; });
    var ccy = document.getElementById("ccy");
    if (ccy) ccy.onchange = function () { from = ccy.value; render(); };
    bindNum("harga", function (v) { literPrice = v; });
    bindNum("km", function (v) { km = v; });
    bindNum("kml", function (v) { kml = v; });
    bindNum("tank", function (v) { tank = v; });
    var sh = document.getElementById("share");
    if (sh) sh.onclick = function () {
      var card = B.drawShareCard({
        bg: "#0F2740", ink: "#F4F7EE", muted: "#B7C4B0", accent: "#C8F249", wash: "rgba(200,242,73,0.14)",
        eyebrow: "Harga Hari Ini", title: "USD JISDOR",
        lines: [
          { text: "Tanggal kurs " + jisdorDate(), muted: true },
          { text: rp(data.jisdorUsd.value), big: true },
          { text: "Sumber: Bank Indonesia" }
        ],
        footer: "kabarunnie.github.io/harga-hari-ini"
      });
      B.shareCanvas(card, "USD JISDOR " + jisdorDate() + ": " + rp(data.jisdorUsd.value) + "\nSumber: Bank Indonesia", "https://kabarunnie.github.io/harga-hari-ini/");
    };
    var sb = document.getElementById("shareb");
    if (sb) sb.onclick = function () {
      var p = Number(literPrice), k = Number(km), c = Number(kml), t = Number(tank);
      var trip = (p > 0 && k > 0 && c > 0) ? Math.round((k / c) * p) : null;
      var text = "Hitungan isi bensin\nHarga/liter: " + (p||"—") + "\nJarak: " + k + " km\nPerkiraan ongkos: " + (trip==null?"—":rp(trip)) + "\nKonsumsi diisi sendiri, bukan data resmi.";
      B.shareText(text, "https://kabarunnie.github.io/harga-hari-ini/");
    };
  }

  B.setupTelegram();
  Promise.all([
    fetch("data/prices.json").then(function (r) { return r.ok ? r.json() : null; }),
    MiniAds.load("data/ads.json")
  ]).then(function (res) {
    data = res[0];
    render();
  }).catch(function () {
    root.innerHTML = '<p class="warn-banner">Gagal memuat data kurs. Tidak ada angka pengganti.</p>';
  });
})();
