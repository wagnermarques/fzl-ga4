import { LitElement, html, css } from 'lit'
import { PERIODS } from '../services/reports.js'
import { projectsStore } from '../services/projects-store.js'

/** Seletor de período (7 / 28 / 90 dias) — vale para todas as telas.
 *
 *  Botões nativos, não md-filter-chip: os chips do Material têm camadas
 *  posicionadas próprias que pintam por cima do drawer aberto (ver o
 *  comentário sobre main[inert] em appshell/src/webcomponents/app-shell.js). */
export class PeriodPicker extends LitElement {
  static properties = {
    _period: { state: true },
    _engine: { state: true },
    showEngine: { type: Boolean, attribute: 'show-engine' },
  }

  static styles = css`
    :host {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }
    .group {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .divider {
      width: 1px;
      height: 20px;
      background: var(--md-sys-color-outline-variant, var(--chart-grid));
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 32px;
      padding: 0 14px;
      border: 1px solid var(--md-sys-color-outline);
      border-radius: 8px;
      background: transparent;
      color: var(--md-sys-color-on-surface-variant);
      font: inherit;
      font-size: 0.85rem;
      cursor: pointer;
    }
    button:hover {
      background: color-mix(in srgb, var(--md-sys-color-on-surface) 6%, transparent);
    }
    button:focus-visible {
      outline: 2px solid var(--md-sys-color-primary);
      outline-offset: 2px;
    }
    button[aria-pressed='true'] {
      border-color: transparent;
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
      padding-left: 8px;
    }
    md-icon {
      --md-icon-size: 18px;
    }
  `

  constructor() {
    super()
    this.showEngine = true
  }

  connectedCallback() {
    super.connectedCallback()
    this._unsub = projectsStore.subscribe(({ period, chartEngine }) => {
      this._period = period
      this._engine = chartEngine
    })
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._unsub?.()
  }

  render() {
    const engines = [
      { id: 'plotly', label: 'Plotly' },
      { id: 'svg', label: 'SVG Leve' },
    ]
    return html`<div class="group" role="group" aria-label="Período">
        ${PERIODS.map((days) => {
          const on = days === this._period
          return html`<button aria-pressed=${on} @click=${() => projectsStore.setPeriod(days)}>
            ${on ? html`<md-icon aria-hidden="true">check</md-icon>` : ''}Últimos ${days} dias
          </button>`
        })}
      </div>
      ${this.showEngine
        ? html`<span class="divider" aria-hidden="true"></span>
            <div class="group" role="group" aria-label="Motor de gráfico">
              ${engines.map((eng) => {
                const on = eng.id === this._engine
                return html`<button aria-pressed=${on} @click=${() => projectsStore.setChartEngine(eng.id)}>
                  ${on ? html`<md-icon aria-hidden="true">check</md-icon>` : ''}${eng.label}
                </button>`
              })}
            </div>`
        : ''}`
  }
}

customElements.define('period-picker', PeriodPicker)
