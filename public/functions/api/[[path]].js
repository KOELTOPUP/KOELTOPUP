// Backend Cloudflare Pages Functions + D1. Semua route ada di /api/*
// Binding yang dibutuhkan: DB (D1) dan ADMIN_PIN (secret).

// Katalog harga di sisi server: harga TIDAK dipercaya dari browser.
// Harus sama dengan GAMES di index.html. Ubah harga di kedua tempat.
const CAT = {
  ml: { name: 'Mobile Legends', uid: [6, 12], srv: [3, 6], items: { '86 Diamond': 21000, '172 Diamond': 42000, '257 Diamond': 62000, '344 Diamond': 83000, '514 Diamond': 123000, '706 Diamond': 168000 } },
  pubg: { name: 'PUBG Mobile', uid: [8, 12], fixed: 'Indonesia', items: { '60 UC': 15000, '325 UC': 75000, '660 UC': 150000, '1800 UC': 380000 } },
  ff: { name: 'Free Fire', uid: [7, 12], fixed: 'Indonesia', items: { '70 Diamond': 10000, '140 Diamond': 20000, '355 Diamond': 50000, '720 Diamond': 100000, '1450 Diamond': 200000 } },
};
const STS = ['Menunggu Pembayaran', 'Menunggu Verifikasi', 'Diproses', 'Berhasil', 'Pending (kendala sistem)', 'Gagal', 'Refund'];
const PAY = ['QRIS', 'DANA', 'OVO', 'SeaBank'];

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const nowStr = () => new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
const row = r => ({ code: r.code, g: r.g, gname: r.gname, uid: r.uid, srv: r.srv, item: r.item, price: r.price, pay: r.pay, wa: r.wa, sender: r.sender, st: r.st, date: r.date, hist: JSON.parse(r.hist || '[]') });
const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const isAdmin = (req, env) => !!env.ADMIN_PIN && same(req.headers.get('X-Admin-Pin') || '', String(env.ADMIN_PIN));
const mask = u => (u.length <= 4 ? u[0] + 'xxxx' : u.slice(0, 2) + 'xxxx' + u.slice(-2));

export async function onRequest({ request, env, params }) {
  const p = [].concat(params.path || []);
  const m = request.method;
  const db = DB;
  try {
    if (!db) return json({ error: 'Database belum terhubung' }, 500);

    // ---- Publik ----
    if (m === 'GET' && p[0] === 'games' && p.length === 1) {
      const { results } = await db.prepare('SELECT id,status FROM games').all();
      const games = {};
      for (const r of results) if (r.status === 'maint') games[r.id] = 'maint';
      return json({ games });
    }

    if (m === 'GET' && p[0] === 'recent' && p.length === 1) {
      const { results } = await db.prepare("SELECT uid,item,gname,created_at FROM orders WHERE st='Berhasil' ORDER BY created_at DESC LIMIT 10").all();
      return json({ recent: results.map(r => ({ id: mask(r.uid), item: r.item, gname: r.gname, t: r.created_at })) });
    }

    if (m === 'POST' && p[0] === 'orders' && p.length === 1) {
      const b = await request.json().catch(() => null);
      if (!b) return json({ error: 'Data tidak valid' }, 400);
      const g = CAT[b.g];
      if (!g) return json({ error: 'Game tidak dikenal' }, 400);
      const code = String(b.code || '');
      if (!/^TP-\d{6}-[A-Z0-9]{6}$/.test(code)) return json({ error: 'Kode tidak valid' }, 400);
      const uid = String(b.uid || '');
      if (!/^\d+$/.test(uid) || uid.length < g.uid[0] || uid.length > g.uid[1]) return json({ error: 'ID tidak valid' }, 400);
      let srv = g.fixed;
      if (!srv) {
        srv = String(b.srv || '');
        if (!/^\d+$/.test(srv) || srv.length < g.srv[0] || srv.length > g.srv[1]) return json({ error: 'Zone/Server tidak valid' }, 400);
      }
      const price = g.items[b.item];
      if (!price) return json({ error: 'Item tidak valid' }, 400);
      if (!PAY.includes(b.pay)) return json({ error: 'Metode pembayaran tidak valid' }, 400);
      const wa = String(b.wa || '');
      if (!/^\d{9,15}$/.test(wa)) return json({ error: 'Nomor WhatsApp tidak valid' }, 400);
      const sender = String(b.sender || '').trim().slice(0, 60);
      if (sender.length < 3) return json({ error: 'Nama pengirim wajib diisi' }, 400);
      const gm = await db.prepare('SELECT status FROM games WHERE id=?').bind(b.g).first();
      if (gm && gm.status === 'maint') return json({ error: 'Game ini sedang gangguan' }, 400);

      const date = nowStr();
      const st = 'Menunggu Verifikasi';
      const hist = JSON.stringify([{ d: date, st }]);
      try {
        await db.prepare('INSERT INTO orders (code,g,gname,uid,srv,item,price,pay,wa,sender,st,date,created_at,hist) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .bind(code, b.g, g.name, uid, srv, b.item, price, b.pay, wa, sender, st, date, Date.now(), hist).run();
      } catch (e) {
        if (String(e.message).includes('UNIQUE')) return json({ error: 'Kode sudah dipakai' }, 409);
        throw e;
      }
      const r = await db.prepare('SELECT * FROM orders WHERE code=?').bind(code).first();
      return json({ order: row(r) }, 201);
    }

    if (m === 'GET' && p[0] === 'orders' && p.length === 2) {
      const r = await db.prepare('SELECT * FROM orders WHERE code=?').bind(p[1].toUpperCase()).first();
      if (!r) return json({ error: 'Tidak ditemukan' }, 404);
      return json({ order: row(r) });
    }

    // ---- Admin (header X-Admin-Pin) ----
    if (p[0] === 'admin') {
      if (!isAdmin(request, env)) return json({ error: 'PIN salah' }, 401);

      if (m === 'GET' && p[1] === 'orders' && p.length === 2) {
        const { results } = await db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 500').all();
        return json({ orders: results.map(row) });
      }

      if (m === 'POST' && p[1] === 'orders' && p[3] === 'status') {
        const b = await request.json().catch(() => null);
        if (!b || !STS.includes(b.st)) return json({ error: 'Status tidak valid' }, 400);
        const r = await db.prepare('SELECT hist FROM orders WHERE code=?').bind(p[2]).first();
        if (!r) return json({ error: 'Tidak ditemukan' }, 404);
        const hist = JSON.parse(r.hist || '[]');
        hist.push({ d: nowStr(), st: b.st });
        await db.prepare('UPDATE orders SET st=?,hist=? WHERE code=?').bind(b.st, JSON.stringify(hist), p[2]).run();
        return json({ ok: true });
      }

      if (m === 'POST' && p[1] === 'games' && p.length === 2) {
        const b = await request.json().catch(() => null);
        if (!b || !CAT[b.id] || !['ok', 'maint'].includes(b.status)) return json({ error: 'Data tidak valid' }, 400);
        await db.prepare('INSERT INTO games (id,status) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status').bind(b.id, b.status).run();
        return json({ ok: true });
      }
    }

    return json({ error: 'Tidak ditemukan' }, 404);
  } catch (e) {
    return json({ error: 'Kesalahan server' }, 500);
  }
}
