/**
 * Acesso de leitura ao GA4 com a conta Google do próprio usuário, feito
 * 100% no navegador via Google Identity Services (modelo de *token*).
 *
 * Por que assim e não um backend com service account: o app é estático
 * (GitHub Pages) e quem o usa é o próprio dono das propriedades — ele já
 * tem acesso a elas no GA4. O token pedido é só analytics.readonly, vale
 * ~1h e fica em sessionStorage (morre com a aba); nada é gravado em disco
 * nem enviado a outro servidor além das APIs do Google.
 *
 * Expirado o token, o próximo clique em "Conectar" renova sem pedir
 * consentimento de novo (prompt: '' — o Google só mostra a tela se for
 * preciso).
 */

const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'
const GSI_SRC = 'https://accounts.google.com/gsi/client'
const TOKEN_KEY = `${__APP_STORAGE_PREFIX__}:google:token`
// Folga para não usar um token que expira no meio de um lote de relatórios.
const EXPIRY_MARGIN_MS = 60_000

const listeners = new Set()
let gsiPromise = null
let tokenClient = null
let pending = null

function readToken() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? 'null')
    return saved && saved.expiresAt - EXPIRY_MARGIN_MS > Date.now() ? saved : null
  } catch {
    return null
  }
}

let current = readToken()

function setToken(value) {
  current = value
  if (value) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(value))
  else sessionStorage.removeItem(TOKEN_KEY)
  listeners.forEach((fn) => fn(googleAuth.getState()))
}

function loadGsi() {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve()
  gsiPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      gsiPromise = null
      reject(new Error('Não foi possível carregar o login do Google (sem conexão?).'))
    }
    document.head.appendChild(script)
  })
  return gsiPromise
}

export const googleAuth = {
  clientId() {
    return import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID ?? ''
  },

  isConfigured() {
    return !!this.clientId()
  },

  /** { configured, connected, expiresAt } */
  getState() {
    if (current && current.expiresAt - EXPIRY_MARGIN_MS <= Date.now()) current = null
    return { configured: this.isConfigured(), connected: !!current, expiresAt: current?.expiresAt ?? null }
  },

  /** Chama já com o estado atual e depois a cada mudança. */
  subscribe(callback) {
    listeners.add(callback)
    callback(this.getState())
    return () => listeners.delete(callback)
  },

  /** Token válido ou null — nunca abre popup (para uso nas chamadas de API). */
  getAccessToken() {
    return this.getState().connected ? current.accessToken : null
  },

  /** Abre o fluxo do Google. Precisa ser chamado a partir de um clique:
   *  navegadores bloqueiam o popup fora de um gesto do usuário. */
  async connect() {
    if (!this.isConfigured()) {
      throw new Error('VITE_GOOGLE_OAUTH_CLIENT_ID não está definido — veja o README.')
    }
    await loadGsi()
    if (pending) return pending

    pending = new Promise((resolve, reject) => {
      tokenClient ??= google.accounts.oauth2.initTokenClient({
        client_id: this.clientId(),
        scope: SCOPE,
        callback: () => {},
      })
      tokenClient.callback = (response) => {
        pending = null
        if (response.error) {
          reject(new Error(response.error_description || response.error))
          return
        }
        if (!google.accounts.oauth2.hasGrantedAllScopes(response, SCOPE)) {
          reject(new Error('A permissão de leitura do Google Analytics não foi concedida.'))
          return
        }
        setToken({ accessToken: response.access_token, expiresAt: Date.now() + Number(response.expires_in) * 1000 })
        resolve()
      }
      tokenClient.error_callback = (err) => {
        pending = null
        reject(new Error(err?.type === 'popup_closed' ? 'Janela do Google fechada antes de concluir.' : err?.message || 'Falha no login do Google.'))
      }
      tokenClient.requestAccessToken({ prompt: '' })
    })
    return pending
  },

  /** Esquece o token local e o revoga no Google. */
  disconnect() {
    const token = current?.accessToken
    setToken(null)
    if (token && globalThis.google?.accounts?.oauth2) google.accounts.oauth2.revoke(token, () => {})
  },

  /** Usado pelo cliente da API quando o Google responde 401. */
  invalidate() {
    setToken(null)
  },
}
