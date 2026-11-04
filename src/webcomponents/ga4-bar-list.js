import { LitElement, html, css } from 'lit'
import { integer, percent } from '../format.js'

/**
 * Ranking em barras horizontais (páginas, canais, países…): rótulo em
 * cima, barra fina com valor na ponta. Uma só cor — é magnitude, não
 * identidade. O valor está sempre escrito; o title de cada linha dá a
 * participação no total.
 *
 *   .items = [{ label, value }], .format = (n) => string
 */
export class Ga4BarList extends LitElement {
  static properties = {
    items: { attribute: false },
    format: { attribute: false },
    empty: {},
  }

  static styles = css`
    :host {
      display: block;
    }
    ol {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 10px;
    }
    li {
      display: grid;
      grid-template-columns: 1fr auto;
      column-gap: 12px;
      row-gap: 4px;
      border-radius: 4px;
    }
    li:hover .bar {
      opacity: 0.8;
    }
    .name {
      grid-column: 1 / -1;
      font-size: 0.85rem;
      color: var(--md-sys-color-on-surface);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .track {
      height: 8px;
      align-self: center;
    }
    .bar {
      height: 100%;
      min-width: 2px;
      background: var(--series-1);
      border-radius: 0 4px 4px 0;
    }
    .value {
      font-size: 0.8rem;
      font-variant-numeric: tabular-nums;
      color: var(--md-sys-color-on-surface-variant);
      min-width: 3.5em;
      text-align: right;
    }
    .empty {
      color: var(--md-sys-color-on-surface-variant);
      font-size: 0.85rem;
    }
  `

  constructor() {
    super()
    this.items = []
    this.format = integer
    this.empty = 'Sem dados no período.'
  }

  render() {
    if (!this.items.length) return html`<p class="empty">${this.empty}</p>`
    const max = Math.max(...this.items.map((i) => i.value)) || 1
    const total = this.items.reduce((sum, i) => sum + i.value, 0) || 1
    return html`<ol>
      ${this.items.map(
        (item) => html`<li title="${item.label}: ${this.format(item.value)} (${percent(item.value / total)} do exibido)">
          <span class="name">${item.label}</span>
          <span class="track"><div class="bar" style="width:${(item.value / max) * 100}%"></div></span>
          <span class="value">${this.format(item.value)}</span>
        </li>`,
      )}
    </ol>`
  }
}

customElements.define('ga4-bar-list', Ga4BarList)
