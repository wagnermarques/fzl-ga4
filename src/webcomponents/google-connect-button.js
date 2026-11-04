import { LitElement, html, css } from 'lit'
import { googleAuth } from '../services/google-auth-service.js'

/** Ação do cabeçalho: conecta/desconecta a conta Google usada para ler o GA4. */
export class GoogleConnectButton extends LitElement {
  static properties = { _state: { state: true }, _busy: { state: true } }

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
    }
    md-icon-button.connected {
      --md-icon-button-icon-color: var(--md-sys-color-primary);
    }
  `

  connectedCallback() {
    super.connectedCallback()
    this._unsub = googleAuth.subscribe((s) => (this._state = s))
    // O token expira sozinho (~1h) sem nenhum evento: reavalia de tempos em tempos.
    this._timer = setInterval(() => (this._state = googleAuth.getState()), 30_000)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._unsub?.()
    clearInterval(this._timer)
  }

  async _connect() {
    this._busy = true
    try {
      await googleAuth.connect()
    } catch (err) {
      this.dispatchEvent(new CustomEvent('ga4-error', { detail: err, bubbles: true, composed: true }))
      console.warn(err)
    } finally {
      this._busy = false
    }
  }

  render() {
    if (!this._state?.configured) {
      return html`<md-icon-button href="#/projetos" title="OAuth do Google não configurado" aria-label="OAuth do Google não configurado">
        <md-icon>link_off</md-icon>
      </md-icon-button>`
    }
    if (this._state.connected) {
      return html`<md-icon-button
        class="connected"
        title="Conectado ao Google Analytics — clique para desconectar"
        aria-label="Desconectar do Google Analytics"
        @click=${() => googleAuth.disconnect()}
      >
        <md-icon>cloud_done</md-icon>
      </md-icon-button>`
    }
    return html`<md-icon-button
      title="Conectar ao Google Analytics"
      aria-label="Conectar ao Google Analytics"
      ?disabled=${this._busy}
      @click=${this._connect}
    >
      <md-icon>cloud_off</md-icon>
    </md-icon-button>`
  }
}

customElements.define('google-connect-button', GoogleConnectButton)
