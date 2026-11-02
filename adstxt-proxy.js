// Vite plugin that exposes GET /api/adstxt?domain=example.com&file=ads.txt.
// The browser can't fetch other sites' ads.txt because of CORS, so the dev /
// preview server downloads it and hands back the body as JSON.
// `file` is ads.txt (default) or app-ads.txt.

const TIMEOUT_MS = 15000
const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z][a-z0-9-]+$/
const FILES = ['ads.txt', 'app-ads.txt']
const USER_AGENT = 'Mozilla/5.0 (compatible; ads-txt-validator/1.0)'

function describeError(err) {
  if (err?.name === 'TimeoutError') return `Timeout (${TIMEOUT_MS / 1000}s)`
  const code = err?.cause?.code
  if (code === 'ENOTFOUND') return 'El dominio no resuelve (DNS)'
  if (code === 'ECONNREFUSED') return 'Conexión rechazada'
  if (code === 'ECONNRESET') return 'Conexión cortada por el servidor'
  return code || err?.message || 'Error desconocido'
}

async function fetchAdsTxt(domain, file) {
  let lastError
  // Only fall back to http when https fails at the network level; an HTTP
  // error status over https is already a definitive answer.
  for (const proto of ['https', 'http']) {
    try {
      const res = await fetch(`${proto}://${domain}/${file}`, {
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/plain,*/*' },
      })
      if (!res.ok) return { ok: false, status: res.status, url: res.url, error: `HTTP ${res.status}` }
      const body = await res.text()
      // Many sites answer a missing ads.txt with their HTML homepage and a 200.
      if (body.trimStart().startsWith('<')) {
        return { ok: false, status: res.status, url: res.url, error: 'Devolvió HTML en vez de un ads.txt' }
      }
      return { ok: true, status: res.status, url: res.url, body }
    } catch (err) {
      lastError = err
    }
  }
  return { ok: false, error: describeError(lastError) }
}

async function handler(req, res, next) {
  const url = new URL(req.url, 'http://localhost')
  if (url.pathname !== '/api/adstxt') return next()

  const domain = (url.searchParams.get('domain') || '').trim().toLowerCase()
  const file = url.searchParams.get('file') || 'ads.txt'
  let result
  if (!FILES.includes(file)) result = { ok: false, error: 'Archivo inválido' }
  else if (!DOMAIN_RE.test(domain)) result = { ok: false, error: 'Dominio inválido' }
  else result = await fetchAdsTxt(domain, file)

  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ domain, file, ...result }))
}

export default function adsTxtProxy() {
  return {
    name: 'adstxt-proxy',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}
