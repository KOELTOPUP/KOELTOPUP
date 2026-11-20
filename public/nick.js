/* nick.js - tampilkan nickname otomatis saat pembeli mengisi ID.
   Dipasang dengan satu baris di index.html: <script src="nick.js"></script> (sebelum </body>) */
(function () {
  var oPick = window.pickGame, oConfirm = window.showConfirm, timer, seq = 0;

  function box() {
    var e = document.getElementById('nick');
    if (!e) {
      e = document.createElement('p');
      e.id = 'nick';
      e.className = 'sm';
      e.style.margin = '10px 0 0';
      document.getElementById('fids').insertAdjacentElement('afterend', e);
    }
    return e;
  }

  function bind() {
    if (!S.g) return;
    var g = gOf(S.g), u = document.getElementById('f_uid'), s = document.getElementById('f_srv'), el = box();
    S.nick = ''; el.textContent = '';
    if (!u || u.dataset.nb) return;
    u.dataset.nb = '1';

    function run() {
      clearTimeout(timer); S.nick = ''; el.textContent = '';
      var uid = u.value.trim(), srv = s ? s.value.trim() : '';
      if (!/^\d+$/.test(uid) || uid.length < g.f[0].min) return;
      if (g.f[1].type !== 'x' && (!/^\d+$/.test(srv) || srv.length < g.f[1].min)) return;
      var my = ++seq;
      timer = setTimeout(async function () {
        el.textContent = 'Mengecek ID...';
        try {
          var r = await api('cek-id?g=' + g.id + '&uid=' + encodeURIComponent(uid) + '&srv=' + encodeURIComponent(srv));
          if (my !== seq) return;
          S.nick = r.nick;
          el.innerHTML = 'Nickname: <b style="color:var(--ok)">' + esc(r.nick) + '</b>';
        } catch (e) {
          if (my !== seq) return;
          // 404 = ID memang tidak ketemu. Error lain (layanan belum diatur/gangguan) = diam saja, pesanan tetap bisa jalan
          el.textContent = e.status === 404 ? 'Nickname tidak ditemukan. Periksa lagi ID dan server.' : '';
        }
      }, 600);
    }
    u.addEventListener('input', run);
    if (s && g.f[1].type !== 'x') s.addEventListener('input', run);
  }

  window.pickGame = function (id) { oPick(id); bind(); };

  window.showConfirm = function () {
    oConfirm();
    if (pend && S.nick) {
      pend.nick = S.nick;
      var t = document.querySelector('#pb .rc table');
      if (t && t.rows[2]) t.rows[2].insertAdjacentHTML('afterend', '<tr><td>Nickname</td><td>' + esc(S.nick) + '</td></tr>');
    }
  };
})();
