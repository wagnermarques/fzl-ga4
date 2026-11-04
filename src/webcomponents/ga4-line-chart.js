import { LitElement, html, svg, css, nothing } from 'lit'
import { day, fullDay, integer, niceTicks } from '../format.js'

const M = { top: 12, right: 16, bottom: 28, left: 48 }
const END_LABEL_W = 110
const LABEL_MIN_GAP = 14

/**
 * Gráfico de linhas diário (SVG, sem biblioteca).
 *
 *   .dates  = [Date, ...]
 *   .series = [{ label, color: 'var(--series-1)', values: [n, ...] }, ...]
 *   .format = (n) => string  (tooltip e tabela; eixo usa inteiros)
 *
 * Uma série: área em 10% + sem legenda (o título do cartão diz o que é).
 * Duas ou mais: legenda sempre, rótulos no fim da linha quando são até 4 e
 * não colidem. Hover/teclado (←/→) mostram crosshair + tooltip com todas as
 * séries do dia. "Ver tabela" mostra os mesmos números sem depender de cor.
 */
export class Ga4LineChart extends LitElement {
  static properties = {
    dates: { attribute: false },
    series: { attribute: false },
    format: { attribute: false },
    height: { type: Number },
    label: {},
    _width: { state: true },
    _hover: { state: true },
    _table: { state: true },
  }

  static styles = css`
    :host {
      display: block;
      position: relative;
    }
    svg {
      display: block;
      overflow: visible;
      outline: none;
      touch-action: pan-y;
    }
    svg:focus-visible {
      outline: 2px solid var(--md-sys-color-primary);
      outline-offset: 4px;
      border-radius: 4px;
    }
    .grid {
      stroke: var(--chart-grid);
      stroke-width: 1;
    }
    .baseline {
      stroke: var(--chart-axis);
      stroke-width: 1;
    }
    .tick {
      fill: var(--chart-muted);
      font-size: 11px;
      font-variant-numeric: tabular-nums;
    }
    .line {
      fill: none;
      stroke-width: 2;
      stroke-linejoin: round;
      stroke-linecap: round;
    }
    .area {
      opacity: 0.1;
    }
    .dot {
      stroke: var(--md-sys-color-surface);
      stroke-width: 2;
    }
    .end-label {
      fill: var(--md-sys-color-on-surface-variant);
      font-size: 12px;
    }
    .crosshair {
      stroke: var(--chart-muted);
      stroke-width: 1;
    }
    .tooltip {
      position: absolute;
      top: 0;
      pointer-events: none;
      min-width: 140px;
      max-width: 240px;
      padding: 8px 10px;
      border-radius: 8px;
      background: var(--md-sys-color-inverse-surface);
      color: var(--md-sys-color-inverse-on-surface);
      font-size: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      z-index: 1;
    }
    .tooltip .date {
      opacity: 0.8;
      margin-bottom: 4px;
    }
    .tooltip .row {
      display: grid;
      grid-template-columns: 12px auto 1fr;
      align-items: center;
      gap: 6px;
    }
    .tooltip .key {
      height: 2px;
      border-radius: 1px;
    }
    .tooltip strong {
      font-variant-numeric: tabular-nums;
    }
    .tooltip .name {
      opacity: 0.85;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px 16px;
      margin-top: 8px;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      font-size: 12px;
      color: var(--md-sys-color-on-surface-variant);
    }
    .legend span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .legend i {
      width: 14px;
      height: 2px;
      border-radius: 1px;
    }
    button.link {
      background: none;
      border: none;
      padding: 4px 0;
      color: var(--md-sys-color-primary);
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .table-wrap {
      overflow-x: auto;
      max-height: 320px;
      margin-top: 8px;
    }
    table {
      border-collapse: collapse;
      font-size: 12px;
      width: 100%;
    }
    th,
    td {
      padding: 4px 8px;
      text-align: right;
      border-bottom: 1px solid var(--chart-grid);
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    th:first-child,
    td:first-child {
      text-align: left;
    }
    th {
      position: sticky;
      top: 0;
      background: var(--md-sys-color-surface);
      color: var(--md-sys-color-on-surface-variant);
      font-weight: 500;
    }
  `

  constructor() {
    super()
    this.dates = []
    this.series = []
    this.format = integer
    this.height = 220
    this.label = 'Gráfico'
    this._width = 0
    this._hover = null
    this._table = false
  }

  connectedCallback() {
    super.connectedCallback()
    this._ro = new ResizeObserver(([entry]) => (this._width = Math.floor(entry.contentRect.width)))
    this._ro.observe(this)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._ro?.disconnect()
  }

  _geometry() {
    const n = this.dates.length
    const max = Math.max(0, ...this.series.flatMap((s) => s.values))
    const ticks = niceTicks(max)
    const top = ticks.at(-1)
    const endLabels = this._endLabels(top)
    const right = M.right + (endLabels ? END_LABEL_W : 0)
    const innerW = Math.max(40, this._width - M.left - right)
    const innerH = this.height - M.top - M.bottom
    const x = (i) => M.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
    const y = (v) => M.top + innerH - (v / top) * innerH
    return { n, ticks, top, x, y, innerW, innerH, endLabels }
  }

  /** Rótulos no fim da linha só para 2–4 séries e se couberem sem colidir;
   *  senão, legenda + tooltip bastam (nunca empilhar rótulos soltos). */
  _endLabels(top) {
    if (this.series.length < 2 || this.series.length > 4 || this._width < 480) return null
    const innerH = this.height - M.top - M.bottom
    const ys = this.series.map((s) => M.top + innerH - ((s.values.at(-1) ?? 0) / top) * innerH).sort((a, b) => a - b)
    for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] < LABEL_MIN_GAP) return null
    return true
  }

  _indexAt(clientX, g) {
    const rect = this.renderRoot.querySelector('svg').getBoundingClientRect()
    const rel = (clientX - rect.left - M.left) / g.innerW
    return Math.max(0, Math.min(g.n - 1, Math.round(rel * (g.n - 1))))
  }

  _onKey(e, g) {
    if (!g.n) return
    const cur = this._hover ?? g.n - 1
    if (e.key === 'ArrowLeft') this._hover = Math.max(0, cur - 1)
    else if (e.key === 'ArrowRight') this._hover = Math.min(g.n - 1, cur + 1)
    else if (e.key === 'Home') this._hover = 0
    else if (e.key === 'End') this._hover = g.n - 1
    else if (e.key === 'Escape') this._hover = null
    else return
    e.preventDefault()
  }

  render() {
    if (!this._width || !this.dates.length) return html`<div style="height:${this.height}px"></div>`
    const g = this._geometry()
    const xTickEvery = Math.max(1, Math.ceil(g.n / Math.max(2, Math.floor(g.innerW / 72))))
    const single = this.series.length === 1

    return html`
      <svg
        width=${this._width}
        height=${this.height}
        role="img"
        aria-label=${this.label}
        tabindex="0"
        @pointermove=${(e) => (this._hover = this._indexAt(e.clientX, g))}
        @pointerleave=${() => (this._hover = null)}
        @keydown=${(e) => this._onKey(e, g)}
        @blur=${() => (this._hover = null)}
      >
        ${g.ticks.map(
          (t, i) => svg`
            <line class=${i === 0 ? 'baseline' : 'grid'} x1=${M.left} x2=${M.left + g.innerW} y1=${g.y(t)} y2=${g.y(t)}></line>
            <text class="tick" x=${M.left - 8} y=${g.y(t)} dy="0.32em" text-anchor="end">${integer(t)}</text>
          `,
        )}
        ${this.dates.map((d, i) =>
          (g.n - 1 - i) % xTickEvery === 0
            ? svg`<text class="tick" x=${g.x(i)} y=${this.height - 8} text-anchor="middle">${day(d)}</text>`
            : nothing,
        )}
        ${single
          ? svg`<path class="area" fill=${this.series[0].color} d=${this._area(this.series[0].values, g)}></path>`
          : nothing}
        ${this.series.map((s) => svg`<path class="line" stroke=${s.color} d=${this._line(s.values, g)}></path>`)}
        ${this._hover === null
          ? this.series.map(
              (s) => svg`<circle class="dot" r="4" fill=${s.color} cx=${g.x(g.n - 1)} cy=${g.y(s.values.at(-1) ?? 0)}></circle>`,
            )
          : svg`
              <line class="crosshair" x1=${g.x(this._hover)} x2=${g.x(this._hover)} y1=${M.top} y2=${M.top + g.innerH}></line>
              ${this.series.map(
                (s) => svg`<circle class="dot" r="4" fill=${s.color} cx=${g.x(this._hover)} cy=${g.y(s.values[this._hover] ?? 0)}></circle>`,
              )}
            `}
        ${g.endLabels
          ? this.series.map(
              (s) => svg`<text class="end-label" x=${g.x(g.n - 1) + 10} y=${g.y(s.values.at(-1) ?? 0)} dy="0.32em">${truncate(s.label, 16)}</text>`,
            )
          : nothing}
      </svg>
      ${this._hover !== null ? this._renderTooltip(g) : nothing}
      <div class="footer">
        ${single
          ? html`<span></span>`
          : html`<div class="legend">
              ${this.series.map((s) => html`<span><i style="background:${s.color}"></i>${s.label}</span>`)}
            </div>`}
        <button class="link" @click=${() => (this._table = !this._table)}>${this._table ? 'Ocultar tabela' : 'Ver tabela'}</button>
      </div>
      ${this._table ? this._renderTable() : nothing}
    `
  }

  _line(values, g) {
    return values.map((v, i) => `${i ? 'L' : 'M'}${g.x(i).toFixed(1)},${g.y(v).toFixed(1)}`).join('')
  }

  _area(values, g) {
    const base = g.y(0).toFixed(1)
    return `${this._line(values, g)}L${g.x(values.length - 1).toFixed(1)},${base}L${g.x(0).toFixed(1)},${base}Z`
  }

  _renderTooltip(g) {
    const i = this._hover
    const px = g.x(i)
    const flip = px > this._width / 2
    const style = flip ? `right:${this._width - px + 12}px` : `left:${px + 12}px`
    const rows = [...this.series].sort((a, b) => (b.values[i] ?? 0) - (a.values[i] ?? 0))
    return html`
      <div class="tooltip" style=${style} role="status">
        <div class="date">${fullDay(this.dates[i])}</div>
        ${rows.map(
          (s) => html`<div class="row">
            <span class="key" style="background:${s.color}"></span><strong>${this.format(s.values[i] ?? 0)}</strong
            ><span class="name">${s.label}</span>
          </div>`,
        )}
      </div>
    `
  }

  _renderTable() {
    return html`
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Dia</th>
              ${this.series.map((s) => html`<th>${s.label}</th>`)}
            </tr>
          </thead>
          <tbody>
            ${[...this.dates.keys()].reverse().map(
              (i) => html`<tr>
                <td>${fullDay(this.dates[i])}</td>
                ${this.series.map((s) => html`<td>${this.format(s.values[i] ?? 0)}</td>`)}
              </tr>`,
            )}
          </tbody>
        </table>
      </div>
    `
  }
}

function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

customElements.define('ga4-line-chart', Ga4LineChart)
