import { html, nothing } from 'lit'
import { googleAuth } from '../services/google-auth-service.js'

async function connect(host) {
  try {
    await googleAuth.connect()
  } catch (err) {
    host._error = err.message
  }
}

/** Aviso do que falta para a tela ter dados (config, login, projetos), ou
 *  nothing quando está tudo pronto. host é a view (recebe _error). */
export function accessNotice(host, auth, projects, { needProjects = true } = {}) {
  if (!auth?.configured) {
    return html`<div class="notice error">
      <md-icon>key_off</md-icon>
      <div>
        <p><strong>Falta configurar o acesso ao Google.</strong></p>
        <p>
          Defina <code>VITE_GOOGLE_OAUTH_CLIENT_ID</code> em <code>.env.local</code> (veja
          <code>.env.example</code> e o README) e reinicie o <code>npm run dev</code>.
        </p>
      </div>
    </div>`
  }
  if (!auth.connected) {
    return html`<div class="notice">
      <md-icon>cloud_off</md-icon>
      <div>
        <p>Conecte sua conta Google para ler o Google Analytics (somente leitura).
        ${projects.length ? 'Enquanto isso, você vê os últimos dados salvos.' : ''}</p>
        <md-filled-button @click=${() => connect(host)}>
          <md-icon slot="icon">login</md-icon>
          Conectar Google
        </md-filled-button>
      </div>
    </div>`
  }
  if (needProjects && !projects.length) {
    return html`<div class="notice">
      <md-icon>playlist_add</md-icon>
      <div>
        <p>Nenhum projeto escolhido ainda.</p>
        <md-filled-button href="#/projetos">Escolher projetos</md-filled-button>
      </div>
    </div>`
  }
  return nothing
}
