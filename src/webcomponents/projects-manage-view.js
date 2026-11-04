import { LitElement, html, css, nothing } from 'lit'
import '@fzl/webcomponents-lit/card-list'
import '@fzl/webcomponents-lit/button'
import { clearCache, ga4Client } from '../services/ga4-client.js'
import { googleAuth } from '../services/google-auth-service.js'
import { projectsStore } from '../services/projects-store.js'
import { accessNotice } from './access-notice.js'
import { viewStyles } from './shared-styles.js'

/** #/projetos — escolhe quais propriedades GA4 entram no painel e a ordem
 *  (a ordem define a cor de cada projeto nos gráficos).
 *  Utiliza `<fzl-lit-card-list>` e `<fzl-lit-button>` do submódulo `fzl-fund-ui`. */
export class ProjectsManageView extends LitElement {
  static properties = {
    _auth: { state: true },
    _projects: { state: true },
    _available: { state: true },
    _busy: { state: true },
    _error: { state: true },
    _filter: { state: true },
  }

  static styles = [
    viewStyles,
    css`
      :host {
        max-width: 960px;
      }
      .columns {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
        gap: 16px;
        align-items: start;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 48px;
        padding: 4px 0;
      }
      li .text {
        flex: 1;
        min-width: 0;
      }
      li .text div {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      li .text small {
        display: block;
        font-size: 0.75rem;
        line-height: 1.3;
        color: var(--md-sys-color-on-surface-variant);
      }
      label {
        cursor: pointer;
      }
      .account {
        margin: 12px 0 4px;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--md-sys-color-on-surface-variant);
      }
      md-outlined-text-field {
        width: 100%;
      }
      .empty {
        color: var(--md-sys-color-on-surface-variant);
        font-size: 0.9rem;
      }
    `,
  ]

  constructor() {
    super()
    this._available = null
    this._filter = ''
  }

  connectedCallback() {
    super.connectedCallback()
    this._unsubs = [
      projectsStore.subscribe(({ projects }) => (this._projects = projects)),
      googleAuth.subscribe((auth) => {
        const becameConnected = auth.connected && !this._auth?.connected
        this._auth = auth
        if (becameConnected) this._loadAvailable()
      }),
    ]
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._unsubs.forEach((fn) => fn())
  }

  async _loadAvailable() {
    this._busy = true
    this._error = null
    try {
      this._available = await ga4Client.listProperties()
    } catch (err) {
      if (!err.needsAuth) this._error = err.message
    } finally {
      this._busy = false
    }
  }

  _onReorder(e) {
    const { fromIndex, toIndex } = e.detail
    if (fromIndex === undefined || toIndex === undefined || fromIndex === toIndex) return
    const p = this._projects[fromIndex]
    if (!p) return
    projectsStore.move(p.propertyId, toIndex - fromIndex)
  }

  _onAction(e) {
    const { item } = e.detail
    const prop = projectsStore.find(item.id)
    if (prop) projectsStore.toggle(prop)
  }

  render() {
    return html`
      <h1>Projetos</h1>
      <p class="meta">Escolha as propriedades do GA4 que aparecem no painel e arraste (ou use ↑/↓) para reordenar. Só leitura — nada é alterado no Google Analytics.</p>
      ${this._busy ? html`<md-linear-progress indeterminate></md-linear-progress>` : nothing}
      ${this._error ? html`<div class="notice error"><md-icon>error</md-icon><p>${this._error}</p></div>` : nothing}
      ${accessNotice(this, this._auth, this._projects, { needProjects: false })}
      <div class="columns">${this._renderSelected()} ${this._renderAvailable()}</div>
    `
  }

  _renderSelected() {
    const list = this._projects
    const cardItems = list.map((p, i) => ({
      id: p.propertyId,
      title: p.displayName,
      category: p.account,
      status: i < 8 ? `Série #${i + 1}` : 'Demais projetos',
      description: `Propriedade ${p.propertyId}`,
      actionLabel: 'Remover',
    }))

    return html`<section class="card">
      <h2>No painel (${list.length})</h2>
      <fzl-lit-card-list
        layout="vertical"
        allow-reorder
        empty-text="Nenhum ainda — marque ao lado."
        .items=${cardItems}
        @fzl-cards-reorder=${(e) => this._onReorder(e)}
        @fzl-card-action=${(e) => this._onAction(e)}
      ></fzl-lit-card-list>
      ${list.length > 8 ? html`<p class="meta">Do 9º em diante, os projetos aparecem somados como "Demais projetos" no gráfico comparativo.</p>` : nothing}
      <div class="toolbar">
        <fzl-lit-button variant="secondary" size="sm" @fzl-click=${() => clearCache()}>Limpar dados salvos</fzl-lit-button>
      </div>
    </section>`
  }

  _renderAvailable() {
    if (!this._auth?.connected) return nothing
    if (!this._available) return html`<section class="card"><h2>Disponíveis na sua conta</h2><p class="empty">Carregando…</p></section>`

    const q = this._filter.trim().toLowerCase()
    const matches = this._available.filter(
      (p) => !q || p.displayName.toLowerCase().includes(q) || p.account.toLowerCase().includes(q) || p.propertyId.includes(q),
    )
    const byAccount = Map.groupBy(matches, (p) => p.account)

    return html`<section class="card">
      <h2>Disponíveis na sua conta (${this._available.length})</h2>
      ${this._available.length > 6
        ? html`<md-outlined-text-field
            label="Filtrar"
            .value=${this._filter}
            @input=${(e) => (this._filter = e.target.value)}
          ></md-outlined-text-field>`
        : nothing}
      ${!this._available.length
        ? html`<p class="empty">Esta conta Google não tem acesso a nenhuma propriedade GA4.</p>`
        : [...byAccount].map(
            ([account, props]) => html`<div class="account">${account}</div>
              <ul>
                ${props.map(
                  (p) => html`<li>
                    <label class="text" for="p${p.propertyId}"><div>${p.displayName}</div><small>${p.propertyId}</small></label>
                    <md-checkbox
                      id="p${p.propertyId}"
                      ?checked=${!!projectsStore.find(p.propertyId)}
                      @change=${() => projectsStore.toggle(p)}
                    ></md-checkbox>
                  </li>`,
                )}
              </ul>`,
          )}
    </section>`
  }
}

customElements.define('projects-manage-view', ProjectsManageView)
