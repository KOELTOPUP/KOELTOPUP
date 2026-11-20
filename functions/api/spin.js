// Lucky Spin: kode sekali pakai, hadiah ditentukan SERVER (bukan browser).
// Butuh: binding D1 bernama DB, dan variabel ADMIN_PIN (samakan dengan PIN admin kamu).
// Ubah hadiah dan peluangnya di PRIZES. w = bobot peluang (makin besar makin sering).
// Isi hadiah yang benar-benar sanggup kamu berikan.
const PRIZES = [
  { l: '20 Diamond', w: 30 },
  { l: 'Diskon 5rb', w: 25 },
  { l: '50 Diamond', w: 15 },
  { l: 'Diskon 10rb', w: 12 },
  { l: 'Voucher 15rb', w: 8 },
  { l: '100 Diamond', w: 5 },
  { l: 'Diskon 20rb', w: 4 },
  { l: '200 Diamond', w: 1 },
];
const AL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rnd = n => { const b = new Uint32Array(1); crypto.getRandomValues(b); return (b[0] / 4294967296) * n; };
const pick = () => { let r = rnd(PRIZES.reduce((a, p) => a + p.w, 0)); for (let i = 0; i < PRIZES.length; i++) { if ((r -= PRIZES[i].w) < 0) return i; } return 0; };
const part = () => Array.from({ length: 4 }, () => AL[Math.floor(rnd(AL.length))]).join('');
const admin = (req, env) => env.ADMIN_PIN && req.headers.get('X-Admin-Pin') === env.ADMIN_PIN;
const err = (m, s) => Response.json({ error: m }, { status: s });

export async function onRequestGet({ request, env }) {
  if (new URL(request.url).searchParams.get('list')) {
    if (!admin(request, env)) return err('PIN salah', 401);
    const { results } = await env.DB.prepare('SELECT code, order_code, used_at, prize FROM spin_codes ORDER BY created DESC LIMIT 100').all();
    return Response.json({ rows: results });
  }
  return Response.json({ prizes: PRIZES.map(p => p.l) });
}

export async function onRequestPost({ request, env }) {
  const b = await request.json().catch(() => ({}));

  if (b.act === 'gen') {
    if (!admin(request, env)) return err('PIN salah', 401);
    const order = String(b.order || '').slice(0, 30);
    for (let i = 0; i < 5; i++) {
      const code = 'SPIN-' + part() + '-' + part();
      try {
        await env.DB.prepare('INSERT INTO spin_codes (code, order_code, created) VALUES (?, ?, ?)').bind(code, order, Date.now()).run();
        return Response.json({ code });
      } catch (e) { /* kode bentrok, coba lagi */ }
    }
    return err('Gagal membuat kode', 500);
  }

  const code = String(b.code || '').trim().toUpperCase();
  if (!/^SPIN-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return err('Format kode salah', 400);
  const row = await env.DB.prepare('SELECT used_at FROM spin_codes WHERE code = ?').bind(code).first();
  if (!row) return err('Kode tidak valid', 404);
  if (row.used_at) return err('Kode sudah dipakai', 409);

  const idx = pick();
  // Klaim atomik: hanya satu permintaan yang bisa mengubah used_at dari NULL, jadi tidak bisa dipakai dua kali
  const r = await env.DB.prepare('UPDATE spin_codes SET used_at = ?, prize = ? WHERE code = ? AND used_at IS NULL')
    .bind(Date.now(), PRIZES[idx].l, code).run();
  if (!r.meta.changes) return err('Kode sudah dipakai', 409);
  return Response.json({ idx, prize: PRIZES[idx].l });
}
