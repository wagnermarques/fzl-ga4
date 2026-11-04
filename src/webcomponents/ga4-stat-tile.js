import { LitElement, html, svg, css, nothing } from 'lit'
import { signedPercent } from '../format.js'

/**
 * Número de KPI: rótulo · valor · variação vs período anterior · tendência.
 *
 *   label, value (já formatado), delta (fração, ex.: 0.12; null = sem base;
 *   ausente = não mostra variação),
 *   trend (números, opcional), hero (valor grande — um por tela).
 *
 * A cor da variação diz se foi bom ou ruim (subir é bom para todas as
 * métricas deste painel) e vem sempre com seta + texto, nunca só cor.
 */
export class Ga4StatTile extends LitElement {
  static properties = {
    label: {},
    value: {},
    delta: { type: Number },
    trend: { attribute: false },
    hero: { type: Boolean, reflect: true },
  }

  static styles = css`
    :host {
      display: block;
      min-width: 0;
    }
    .label {
      font-size: 0.8rem;
      color: var(--md-sys-color-on-surface-variant);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .value {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--md-sys-color-on-surface);
      line-height: 1.25;
    }
    :host([hero]) .value {
      font-size: 3rem;
      line-height: 1.1;
    }
    .delta {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-size: 0.8rem;
      font-weight: 500;
    }
    .delta md-icon {
      --md-icon-size: 16px;
    }
    .up {
      color: var(--delta-up);
    }
    .down {
      color: var(--delta-down);
    }
    .flat {
      color: var(--chart-muted);
    }
    .vs {
      color: var(--chart-muted);
      font-weight: 400;
      margin-left: 4px;
    }
    svg {
      display: block;
      margin-top: 6px;
      width: 100%;
      height: 28px;
    }
    polyline {
      fill: none;
      stroke: var(--chart-muted);
      stroke-width: 1.5;
      stroke-linejoin: round;
      stroke-linecap: round;
    }
    circle {
      fill: var(--series-1);
    }
  `

  constructor() {
    super()
    this.delta = undefined
    this.trend = null
  }

  render() {
    return html`
      <div class="label">${this.label}</div>
      <div class="value">${this.value}</div>
      ${this._renderDelta()} ${this.trend?.length > 1 ? this._renderTrend() : nothing}
    `
  }

  _renderDelta() {
    if (this.delta === undefined) return nothing
    if (this.delta === null || Number.isNaN(this.delta)) {
      return html`<div class="delta flat">— <span class="vs">sem período anterior</span></div>`
    }
    const dir = Math.abs(this.delta) < 0.005 ? 'flat' : this.delta > 0 ? 'up' : 'down'
    const icon = { up: 'arrow_upward', down: 'arrow_downward', flat: 'arrow_forward' }[dir]
    return html`<div class="delta ${dir}">
      <md-icon aria-hidden="true">${icon}</md-icon>${signedPercent(this.delta)}<span class="vs">vs anterior</span>
    </div>`
  }

  _renderTrend() {
    const values = this.trend
    const max = Math.max(...values) || 1
    const W = 100
    const H = 28
    const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 3 - (v / max) * (H - 6)])
    const [lx, ly] = pts.at(-1)
    return html`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      ${svg`<polyline vector-effect="non-scaling-stroke" points=${pts.map((p) => p.join(',')).join(' ')}></polyline>`}
      ${svg`<circle cx=${lx} cy=${ly} r="2.5" vector-effect="non-scaling-stroke"></circle>`}
    </svg>`
  }
}

customElements.define('ga4-stat-tile', Ga4StatTile)
