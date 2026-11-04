/**
 * Chamadas às APIs do GA4 (Admin para listar propriedades, Data para os
 * relatórios), com o token do google-auth-service.
 *
 * Cada resposta bem-sucedida é guardada em localStorage. Sem rede (PWA
 * aberto offline) ou sem token válido, as telas mostram a última resposta
 * guardada, com a hora em que foi obtida — um painel de números "de ontem"
 * é mais útil que uma tela vazia.
 */
import { googleAuth } from './google-auth-service.js'
import { readProperties } from './reports.js'

const ADMIN = 'https://analyticsadmin.googleapis.com/v1beta'
const DATA = 'https://analyticsdata.googleapis.com/v1beta'
const CACHE_PREFIX = `${__APP_STORAGE_PREFIX__}:ga4-cache:`

export class Ga4Error extends Error {
  constructor(message, { status, needsAuth = false } = {}) {
    super(message)
    this.status = status
    this.needsAuth = needsAuth
  }
}

function cacheRead(key) {
  try {
    return JSON.parse(localStorage.getItem(CACHE_PREFIX + key) ?? 'null')
  } catch {
    return null
  }
}

function cacheWrite(key, data) {
  const entry = { data, fetchedAt: Date.now() }
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry))
  } catch {
    // Cota do localStorage estourada: limpa o cache inteiro e segue — é só cache.
    clearCache()
  }
  return entry
}

export function clearCache() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(CACHE_PREFIX)) localStorage.removeItem(key)
  }
}

async function call(url, { method = 'GET', body } = {}) {
  const token = googleAuth.getAccessToken()
  if (!token) throw new Ga4Error('Conecte sua conta Google para carregar os dados.', { needsAuth: true })

  let res
  try {
    res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Ga4Error('Sem conexão com o Google Analytics.')
  }

  if (res.status === 401) {
    googleAuth.invalidate()
    throw new Ga4Error('A sessão do Google expirou — conecte de novo.', { status: 401, needsAuth: true })
  }
  if (!res.ok) {
    const payload = await res.json().catch(() => null)
    throw new Ga4Error(payload?.error?.message || `Erro ${res.status} do Google Analytics.`, { status: res.status })
  }
  return res.json()
}

/** Busca com fallback para o cache. Devolve { data, fetchedAt, stale, error }.
 *  stale = true quando o dado veio do cache porque a busca falhou. Sem cache
 *  e com falha, lança o erro. */
async function cached(key, fetcher) {
  try {
    return { ...cacheWrite(key, await fetcher()), stale: false, error: null }
  } catch (error) {
    const hit = cacheRead(key)
    if (hit) return { ...hit, stale: true, error }
    throw error
  }
}

export const ga4Client = {
  /** Todas as propriedades GA4 que a conta conectada enxerga. */
  async listProperties() {
    const pages = []
    let pageToken = ''
    do {
      const qs = new URLSearchParams({ pageSize: '200', ...(pageToken ? { pageToken } : {}) })
      const page = await call(`${ADMIN}/accountSummaries?${qs}`)
      pages.push(page)
      pageToken = page.nextPageToken ?? ''
    } while (pageToken)
    return readProperties(pages)
  },

  /** Até 5 relatórios de uma propriedade numa só chamada -> { data: [report...] }. */
  batch(propertyId, requests) {
    const key = `batch:${propertyId}:${JSON.stringify(requests)}`
    return cached(key, async () => {
      const res = await call(`${DATA}/properties/${propertyId}:batchRunReports`, { method: 'POST', body: { requests } })
      return res.reports ?? []
    })
  },

  /** Usuários ativos nos últimos 30 minutos. Nunca vem do cache: um
   *  "tempo real" antigo seria enganoso. null quando indisponível. */
  async realtimeUsers(propertyId) {
    try {
      const res = await call(`${DATA}/properties/${propertyId}:runRealtimeReport`, {
        method: 'POST',
        body: { metrics: [{ name: 'activeUsers' }] },
      })
      return Number(res.rows?.[0]?.metricValues?.[0]?.value ?? 0)
    } catch {
      return null
    }
  },
}
