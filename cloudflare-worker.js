/**
 * MangaLokal CORS proxy template for Cloudflare Workers.
 * GRATIS pada kuota gratis Cloudflare Workers, selama akun/kuota masih tersedia.
 *
 * PENTING: isi ALLOWED_HOSTS dengan domain situs komik dan CDN gambar yang memang
 * ingin kamu baca. Jangan biarkan proxy menjadi proxy publik terbuka.
 */
const ALLOWED_HOSTS = [
  'contoh-situs.com',
  'cdn.contoh-situs.com'
];

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== 'GET') {
      return json({ error: 'GET only' }, 405);
    }

    const requestUrl = new URL(request.url);
    const targetRaw = requestUrl.searchParams.get('url');
    if (!targetRaw) return json({ error: 'Missing ?url=' }, 400);

    let target;
    try { target = new URL(targetRaw); }
    catch { return json({ error: 'Invalid target URL' }, 400); }

    if (!['http:', 'https:'].includes(target.protocol)) {
      return json({ error: 'Unsupported protocol' }, 400);
    }
    if (!ALLOWED_HOSTS.includes(target.hostname)) {
      return json({ error: `Host not allowed: ${target.hostname}` }, 403);
    }

    const upstream = await fetch(target.toString(), {
      headers: {
        'Accept': request.headers.get('Accept') || '*/*',
        'Accept-Language': request.headers.get('Accept-Language') || 'en-US,en;q=0.8',
        'User-Agent': 'Mozilla/5.0 MangaLokalReader/2.0'
      },
      redirect: 'follow'
    });

    const headers = new Headers(upstream.headers);
    Object.entries(corsHeaders()).forEach(([k,v]) => headers.set(k,v));
    headers.delete('content-security-policy');
    headers.delete('content-security-policy-report-only');
    headers.delete('x-frame-options');
    headers.set('Cache-Control', 'public, max-age=300');

    return new Response(upstream.body, { status: upstream.status, headers });
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept'
  };
}

function json(data, status=200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' }
  });
}
