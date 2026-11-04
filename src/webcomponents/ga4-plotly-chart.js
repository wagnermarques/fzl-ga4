import { LitElement, html, css } from 'lit'

let plotlyPromise = null

function loadPlotly() {
  if (!plotlyPromise) {
    plotlyPromise = import('plotly.js-dist-min').then((m) => m.default ?? m)
  }
  return plotlyPromise
}

function resolveCssVar(value, el) {
  if (typeof value !== 'string') return value
  const match = value.match(/^var\((--[^,)]+)\)$/)
  if (!match) return value
  const computed = getComputedStyle(el || document.documentElement)
    .getPropertyValue(match[1])
    .trim()
  return computed || value
}

/**
 * Interactive Plotly.js chart Web Component inspired by `bi_static_dashboards`.
 *
 * Uses Light DOM for the inner plot container so Plotly's SVG/canvas and
 * modebar styles render without Shadow DOM clipping issues, while keeping
 * component encapsulation and automatic theme/resize reactivity.
 */
export class Ga4PlotlyChart extends LitElement {
  static properties = {
    data: { attribute: false },
    layout: { attribute: false },
    config: { attribute: false },
    height: { type: Number },
    label: { type: String },
    _loading: { state: true },
  }

  static styles = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
    }
    .plotly-host {
      width: 100%;
      border-radius: 8px;
      overflow: hidden;
    }
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--md-sys-color-on-surface-variant);
      font-size: 0.85rem;
    }
  `

  constructor() {
    super()
    this.data = []
    this.layout = {}
    this.config = {}
    this.height = 380
    this.label = 'Gráfico interativo'
    this._loading = true
    this._plotly = null
  }

  connectedCallback() {
    super.connectedCallback()
    this._ro = new ResizeObserver(() => {
      if (this._plotly && this._plotEl) {
        this._plotly.Plots.resize(this._plotEl)
      }
    })
    this._ro.observe(this)

    this._mo = new MutationObserver(() => this._renderPlot())
    this._mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style'],
    })

    this._mq = window.matchMedia('(prefers-color-scheme: dark)')
    this._onMq = () => this._renderPlot()
    this._mq.addEventListener('change', this._onMq)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._ro?.disconnect()
    this._mo?.disconnect()
    this._mq?.removeEventListener('change', this._onMq)
    if (this._plotly && this._plotEl) {
      this._plotly.purge(this._plotEl)
    }
  }

  firstUpdated() {
    this._plotEl = this.renderRoot.querySelector('.plotly-host')
    loadPlotly().then((Plotly) => {
      this._plotly = Plotly
      this._loading = false
      this._renderPlot()
    })
  }

  updated(changed) {
    if (changed.has('data') || changed.has('layout') || changed.has('config') || changed.has('height')) {
      this._renderPlot()
    }
  }

  _isMobile() {
    return typeof window !== 'undefined' && window.innerWidth < 680
  }

  _resolveTraceColors(trace) {
    const out = { ...trace }
    if (out.line) {
      out.line = { ...out.line, color: resolveCssVar(out.line.color, this) }
    }
    if (out.marker) {
      out.marker = { ...out.marker, color: resolveCssVar(out.marker.color, this) }
    }
    if (out.fillcolor) {
      out.fillcolor = resolveCssVar(out.fillcolor, this)
    }
    return out
  }

  _renderPlot() {
    if (!this._plotly || !this._plotEl || !this.data) return

    const style = getComputedStyle(document.documentElement)
    const textColor = style.getPropertyValue('--md-sys-color-on-surface').trim() || '#1c1b1f'
    const mutedColor = style.getPropertyValue('--chart-muted').trim() || '#79747e'
    const gridColor = style.getPropertyValue('--chart-grid').trim() || '#e7e0ec'
    const axisColor = style.getPropertyValue('--chart-axis').trim() || '#c9c4d0'
    const fontFamily = style.getPropertyValue('--a11y-font-family').trim() || 'system-ui, sans-serif'
    const mobile = this._isMobile()

    const traces = this.data.map((t) => this._resolveTraceColors(t))

    const baseLayout = {
      height: this.height,
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { family: fontFamily, color: textColor, size: 12 },
      separators: ',.',
      margin: { t: 24, r: 24, b: 44, l: 56, ...(this.layout?.margin || {}) },
      hovermode: mobile ? 'closest' : this.layout?.hovermode || 'x unified',
      dragmode: mobile ? false : this.layout?.dragmode ?? 'zoom',
      legend: {
        orientation: 'h',
        yanchor: 'bottom',
        y: 1.02,
        xanchor: 'left',
        x: 0,
        font: { color: mutedColor, size: 12 },
        ...(this.layout?.legend || {}),
      },
      xaxis: {
        gridcolor: gridColor,
        linecolor: axisColor,
        tickfont: { color: mutedColor, size: 11 },
        fixedrange: mobile,
        automargin: true,
        ...(this.layout?.xaxis || {}),
      },
      yaxis: {
        gridcolor: gridColor,
        linecolor: axisColor,
        tickfont: { color: mutedColor, size: 11 },
        fixedrange: mobile,
        automargin: true,
        zerolinecolor: axisColor,
        ...(this.layout?.yaxis || {}),
      },
    }

    const mergedLayout = {
      ...this.layout,
      ...baseLayout,
    }

    const mergedConfig = {
      responsive: true,
      displaylogo: false,
      displayModeBar: !mobile,
      scrollZoom: false,
      modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'],
      ...this.config,
    }

    this._plotly.react(this._plotEl, traces, mergedLayout, mergedConfig)
  }

  render() {
    return html`
      ${this._loading
        ? html`<div class="loading" style="height:${this.height}px">Carregando Plotly…</div>`
        : ''}
      <div
        class="plotly-host"
        role="img"
        aria-label=${this.label}
        style="min-height:${this.height}px"
      ></div>
    `
  }
}

customElements.define('ga4-plotly-chart', Ga4PlotlyChart)
