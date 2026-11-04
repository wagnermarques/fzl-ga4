import { LitElement, html, css, nothing } from 'lit'
import { METRIC_LABELS, dateTime, integer, metricValue } from '../format.js'
import { ga4Client } from '../services/ga4-client.js'
import { googleAuth } from '../services/google-auth-service.js'
import { projectsStore } from '../services/projects-store.js'
import {
  DIMENSION_REPORTS,
  KPI_METRICS,
  categoryRequests,
  delta,
  detailRequests,
  fromGaDate,
  periodDates,
  readDaily,
  readKpis,
  readTop,
  toIsoDate,
} from '../services/reports.js'
import { accessNotice } from './access-notice.js'
import { viewStyles } from './shared-styles.js'

const TOPS = [
  { key: 'pages', title: 'Páginas mais vistas', dim: 'pagePath', metric: 'screenPageViews' },
  { key: 'channels', title: 'Origem do tráfego (sessões)', dim: 'sessionDefaultChannelGroup', metric: 'sessions' },
  { key: 'countries', title: 'Países (usuários)', dim: 'country', metric: 'activeUsers' },
  { key: 'devices', title: 'Dispositivos (usuários)', dim: 'deviceCategory', metric: 'activeUsers' },
  { key: 'events', title: 'Eventos', dim: 'eventName', metric: 'eventCount' },
]

const CATEGORY_KEYS = Object.keys(DIMENSION_REPORTS)

/** #/projeto/:id — o detalhe de uma propriedade GA4. */
export class ProjectDetailView extends LitElement {
  static properties = {
    propertyId: {},
    _project: { state: true },
    _period: { state: true },
    _engine: { state: true },
    _auth: { state: true },
    _data: { state: true },
    _busy: { state: true },
    _error: { state: true },
    _activeCategory: { state: true },
    _activeDim: { state: true },
    _catData: { state: true },
    _catBusy: { state: true },
  }

  static styles = [
    viewStyles,
    css`
      .head {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 4px 12px;
      }
      .tops {
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      }
      .live b {
        font-variant-numeric: tabular-nums;
      }
      .explorer-toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
      }
      .pills {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .pills button {
        height: 30px;
        padding: 0 12px;
        border: 1px solid var(--md-sys-color-outline);
        border-radius: 8px;
        background: transparent;
        color: var(--md-sys-color-on-surface-variant);
        font: inherit;
        font-size: 0.8rem;
        cursor: pointer;
      }
      .pills button:hover {
        background: color-mix(in srgb, var(--md-sys-color-on-surface) 6%, transparent);
      }
      .pills button[aria-pressed='true'] {
        border-color: transparent;
        background: var(--md-sys-color-secondary-container, var(--md-sys-color-primary-container));
        color: var(--md-sys-color-on-secondary-container, var(--md-sys-color-on-primary-container));
        font-weight: 500;
      }
    `,
  ]

  constructor() {
    super()
    this._loadId = 0
    this._catLoadId = 0
    this._activeCategory = 'geographic'
    this._activeDim = DIMENSION_REPORTS.geographic.dimensions[0].key
    this._catData = {}
    this._catBusy = false
  }

  connectedCallback() {
    super.connectedCallback()
    this._unsubs = [
      projectsStore.subscribe(({ period, chartEngine }) => {
        const periodChanged = this._period !== period
        this._period = period
        this._engine = chartEngine
        this._project = projectsStore.find(this.propertyId)
        if (periodChanged) {
          this._catData = {}
          this._load()
          this._loadCategory(this._activeCategory)
        }
      }),
      googleAuth.subscribe((auth) => {
        const becameConnected = auth.connected && !this._auth?.connected
        this._auth = auth
        if (becameConnected) {
          this._catData = {}
          this._load()
          this._loadCategory(this._activeCategory)
        }
      }),
    ]
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._unsubs.forEach((fn) => fn())
  }

  updated(changed) {
    // A mesma instância é reaproveitada ao navegar de um projeto para outro.
    if (changed.has('propertyId') && changed.get('propertyId') !== undefined) {
      this._project = projectsStore.find(this.propertyId)
      this._data = null
      this._catData = {}
      this._load()
      this._loadCategory(this._activeCategory)
    }
  }

  async _load() {
    if (!this.propertyId || this._period === undefined) return
    const id = ++this._loadId
    const days = this._period
    const dates = periodDates(days)
    const [first, second] = detailRequests(days)
    this._busy = true
    this._error = null
    try {
      const [a, b, realtime] = await Promise.all([
        ga4Client.batch(this.propertyId, first),
        ga4Client.batch(this.propertyId, second),
        ga4Client.realtimeUsers(this.propertyId),
      ])
      if (id !== this._loadId) return
      const reports = { pages: a.data[2], channels: a.data[3], countries: a.data[4], devices: b.data[0], events: b.data[1] }
      this._data = {
        dates: dates.map(fromGaDate),
        isoDates: dates.map(toIsoDate),
        kpis: readKpis(a.data[0]),
        daily: ['activeUsers', 'sessions', 'screenPageViews'].map((m) => ({ metric: m, values: readDaily(a.data[1], dates, m) })),
        tops: Object.fromEntries(TOPS.map((t) => [t.key, readTop(reports[t.key], t.dim, t.metric)])),
        fetchedAt: Math.min(a.fetchedAt, b.fetchedAt),
        stale: a.stale || b.stale,
        realtime: a.stale ? null : realtime,
      }
    } catch (err) {
      if (id !== this._loadId) return
      this._error = err.needsAuth ? null : err.message
    } finally {
      if (id === this._loadId) this._busy = false
    }
  }

  async _loadCategory(categoryKey) {
    if (!this.propertyId || this._period === undefined) return
    if (this._catData[categoryKey]) return
    const id = ++this._catLoadId
    const cat = DIMENSION_REPORTS[categoryKey]
    if (!cat) return
    this._catBusy = true
    try {
      const reqs = categoryRequests(categoryKey, this._period, 15)
      const res = await ga4Client.batch(this.propertyId, reqs)
      if (id !== this._catLoadId) return
      const byDim = Object.fromEntries(
        cat.dimensions.map((d, i) => [d.key, readTop(res.data[i], d.key, d.metric || cat.metric)]),
      )
      this._catData = { ...this._catData, [categoryKey]: byDim }
    } catch {
      // Silencioso: o erro principal já aparece no topo da view
    } finally {
      if (id === this._catLoadId) this._catBusy = false
    }
  }

  _selectCategory(catKey) {
    this._activeCategory = catKey
    this._activeDim = DIMENSION_REPORTS[catKey].dimensions[0].key
    this._loadCategory(catKey)
  }

  render() {
    const name = this._project?.displayName ?? `Propriedade ${this.propertyId}`
    const d = this._data
    return html`
      <div class="head">
        <h1>${name}</h1>
        <span class="meta">${this._project?.account ?? ''} · propriedade ${this.propertyId}</span>
        <a class="meta" href="https://analytics.google.com/analytics/web/#/p${this.propertyId}/reports/intelligenthome" target="_blank" rel="noopener">Abrir no GA4 ↗</a>
      </div>
      <div class="toolbar">
        <period-picker></period-picker>
        <span class="spacer"></span>
        ${d?.realtime !== null && d?.realtime !== undefined
          ? html`<span class="meta live"><b>${integer(d.realtime)}</b> usuários agora</span>`
          : nothing}
        ${d ? html`<span class="meta">${d.stale ? 'Offline — dados salvos em' : 'Dados de'} ${dateTime(d.fetchedAt)}</span>` : nothing}
        <md-icon-button
          aria-label="Atualizar"
          title="Atualizar"
          ?disabled=${this._busy}
          @click=${() => {
            this._catData = {}
            this._load()
            this._loadCategory(this._activeCategory)
          }}
        >
          <md-icon>refresh</md-icon>
        </md-icon-button>
      </div>
      ${this._busy ? html`<md-linear-progress indeterminate></md-linear-progress>` : nothing}
      ${this._error ? html`<div class="notice error"><md-icon>error</md-icon><p>${this._error}</p></div>` : nothing}
      ${accessNotice(this, this._auth, [], { needProjects: false })}
      ${d ? this._renderData(d) : nothing}
    `
  }

  _renderData(d) {
    const series = d.daily.map((s, i) => ({ label: METRIC_LABELS[s.metric], color: `var(--series-${i + 1})`, values: s.values }))
    return html`<div class="grid loading" ?data-busy=${this._busy}>
      <section class="card kpis">
        ${KPI_METRICS.map(
          (m, i) => html`<ga4-stat-tile
            ?hero=${i === 0}
            label=${METRIC_LABELS[m]}
            value=${metricValue(m, d.kpis.current[m])}
            .delta=${delta(d.kpis.current[m], d.kpis.previous[m])}
          ></ga4-stat-tile>`,
        )}
      </section>
      <section class="card">
        <h2>Tráfego por dia (Resumo Geral)</h2>
        ${this._engine === 'plotly' ? this._renderPlotlyDaily(d) : html`<ga4-line-chart label="Usuários, sessões e visualizações por dia" .dates=${d.dates} .series=${series}></ga4-line-chart>`}
      </section>
      ${this._renderDimensionExplorer()}
      <div class="grid tops">
        ${TOPS.map(
          (t) => html`<section class="card">
            <h2>${t.title}</h2>
            <ga4-bar-list .items=${d.tops[t.key]}></ga4-bar-list>
          </section>`,
        )}
      </div>
    </div>`
  }

  /** Gráfico estilo `bi_static_dashboards` (`resumo-geral`): linha para Usuários + barras para Sessões + linha para Visualizações. */
  _renderPlotlyDaily(d) {
    const byMetric = Object.fromEntries(d.daily.map((s) => [s.metric, s.values]))
    const plotData = [
      {
        x: d.isoDates,
        y: byMetric.sessions ?? [],
        name: 'Sessões (Acessos)',
        type: 'bar',
        marker: { color: 'var(--series-2)', opacity: 0.45 },
        hovertemplate: '<b>%{x}</b><br>Sessões: %{y:,.0f}<extra></extra>',
      },
      {
        x: d.isoDates,
        y: byMetric.activeUsers ?? [],
        name: 'Usuários ativos',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: 'var(--series-1)', width: 2.5, shape: 'spline' },
        marker: { color: 'var(--series-1)', size: 6 },
        hovertemplate: '<b>%{x}</b><br>Usuários ativos: %{y:,.0f}<extra></extra>',
      },
      {
        x: d.isoDates,
        y: byMetric.screenPageViews ?? [],
        name: 'Visualizações',
        type: 'scatter',
        mode: 'lines',
        line: { color: 'var(--series-3)', width: 2, dash: 'dot' },
        hovertemplate: '<b>%{x}</b><br>Visualizações: %{y:,.0f}<extra></extra>',
      },
    ]
    return html`<ga4-plotly-chart
      label="Usuários, sessões e visualizações por dia"
      .data=${plotData}
      .height=${340}
    ></ga4-plotly-chart>`
  }

  /** Explorador de dimensões estilo `bi_static_dashboards` (Geográfico, Dispositivos, Tráfego, Páginas/Telas). */
  _renderDimensionExplorer() {
    const cat = DIMENSION_REPORTS[this._activeCategory]
    const dimMeta = cat.dimensions.find((dim) => dim.key === this._activeDim) ?? cat.dimensions[0]
    const items = this._catData[this._activeCategory]?.[dimMeta.key] ?? []

    return html`<section class="card">
      <h2>Explorador de Dimensões — ${cat.title}</h2>
      <div class="explorer-toolbar">
        <div class="pills" role="group" aria-label="Categoria de relatório">
          ${CATEGORY_KEYS.map(
            (key) => html`<button
              aria-pressed=${key === this._activeCategory}
              @click=${() => this._selectCategory(key)}
            >
              ${DIMENSION_REPORTS[key].title}
            </button>`,
          )}
        </div>
        <div class="pills" role="group" aria-label="Selecione a Dimensão">
          ${cat.dimensions.map(
            (dim) => html`<button
              aria-pressed=${dim.key === dimMeta.key}
              @click=${() => (this._activeDim = dim.key)}
            >
              ${dim.label}
            </button>`,
          )}
        </div>
      </div>
      ${this._catBusy && !items.length
        ? html`<md-linear-progress indeterminate></md-linear-progress>`
        : this._engine === 'plotly'
          ? this._renderPlotlyHorizontalBar(items, dimMeta.label)
          : html`<ga4-bar-list .items=${items}></ga4-bar-list>`}
    </section>`
  }

  _renderPlotlyHorizontalBar(items, dimLabel) {
    if (!items.length) {
      return html`<p class="meta">Sem dados para ${dimLabel} no período.</p>`
    }
    const topN = [...items].slice(0, 15).reverse()
    const plotData = [
      {
        x: topN.map((i) => i.value),
        y: topN.map((i) => i.label),
        type: 'bar',
        orientation: 'h',
        marker: { color: 'var(--series-1)' },
        text: topN.map((i) => integer(i.value)),
        textposition: 'auto',
        hovertemplate: '<b>%{y}</b><br>Quantidade: %{x:,.0f}<extra></extra>',
      },
    ]
    const layout = {
      margin: { l: 180, r: 32, t: 16, b: 40 },
      hovermode: 'closest',
      xaxis: { title: 'Quantidade' },
    }
    const dynamicHeight = Math.max(240, topN.length * 28 + 72)
    return html`<ga4-plotly-chart
      label="Top ${topN.length} por ${dimLabel}"
      .data=${plotData}
      .layout=${layout}
      .height=${dynamicHeight}
    ></ga4-plotly-chart>`
  }
}

customElements.define('project-detail-view', ProjectDetailView)
