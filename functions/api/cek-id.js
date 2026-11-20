// Cek nickname pemain lewat API provider.
// Atur di Cloudflare Pages > Settings > Variables and Secrets:
//   CEKID_URL = URL endpoint provider, pakai penanda {game} {id} {zone}
//               contoh: https://api.provider.com/cek?game={game}&id={id}&zone={zone}
//   CEKID_KEY = API key provider (opsional, dikirim sebagai Bearer token)
// Nama game yang dikirim ke provider bisa diubah di GAME di bawah sesuai dokumentasi provider.
const GAME = { ml: 'mobile-legends', pubg: 'pubg-mobile', ff: 'free-fire' };

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const g = q.get('g') || '', uid = q.get('uid') || '', srv = q.get('srv') || '';

  if (!GAME[g] || !/^\d{5,12}$/.test(uid) || !/^\d{0,6}$/.test(srv))
    return Response.json({ error: 'Input tidak valid' }, { status: 400 });
  if (!env.CEKID_URL)
    return Response.json({ error: 'Cek ID belum diaktifkan' }, { status: 501 });

  const url = env.CEKID_URL
    .replace('{game}', encodeURIComponent(GAME[g]))
    .replace('{id}', encodeURIComponent(uid))
    .replace('{zone}', encodeURIComponent(srv));

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 7000);
  try {
    const r = await fetch(url, {
      signal: ac.signal,
      headers: env.CEKID_KEY ? { Authorization: 'Bearer ' + env.CEKID_KEY } : {}
    });
    const j = await r.json().catch(() => ({}));
    const d = j.data || j.result || j;
    // Sesuaikan nama field di bawah dengan respons provider kamu
    const nick = d.nickname || d.nick || d.username || d.name || '';
    if (!r.ok || !nick) return Response.json({ error: 'ID tidak ditemukan' }, { status: 404 });
    return Response.json({ nick: String(nick).slice(0, 40) });
  } catch (e) {
    return Response.json({ error: 'Layanan cek ID gangguan' }, { status: 502 });
  } finally {
    clearTimeout(t);
  }
}
