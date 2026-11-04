import { LitElement, html, css, nothing } from 'lit'
import { compact, dateTime, integer, percent } from '../format.js'
import { ga4Client } from '../services/ga4-client.js'
import { googleAuth } from '../services/google-auth-service.js'
import { projectsStore } from '../services/projects-store.js'
import { delta, fromGaDate, overviewRequests, periodDates, readDaily, readKpis, toIsoDate } from '../services/reports.js'
import { accessNotice } from './access-notice.js'
import { viewStyles } from './shared-styles.js'

/** Home: todos os projetos lado a lado no mesmo período. */
export class OverviewView extends LitElement {
  static properties = {
    _projects: { state: true },
    _period: { state: true },
    _engine: { state: true },
    _auth: { state: true },
    _results: { state: true },
    _busy: { state: true },
    _error: { state: true },
  }

  static styles = [
    viewStyles,
    css`
      .totals {
        display: grid;
        grid-template-columns: minmax(200px, 1.3fr) repeat(auto-fit, minmax(140px, 1fr));
        gap: 16px;
        align-items: end;
      }
      .projects {
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      }
      .project-head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      }
      .project-head a {
        flex: 1;
        min-width: 0;
        color: var(--md-sys-color-on-surface);
        font-weight: 500;
        text-decoration: none;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .project-head a:hover {
        text-decoration: underline;
      }
      .swatch {
        flex: none;
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }
      .live {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75rem;
        color: var(--md-sys-color-on-surface-variant);
      }
      .live b {
        color: var(--md-sys-color-on-surface);
        font-variant-numeric: tabular-nums;
      }
      .live .pulse {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #0ca30c;
      }
      .small-kpis {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--chart-grid);
      }
      .small-kpis div {
        min-width: 0;
      }
      .small-kpis span {
        display: block;
        font-size: 0.72rem;
        color: var(--md-sys-color-on-surface-variant);
      }
      .small-kpis b {
        font-weight: 600;
      }
      .card-error {
        font-size: 0.85rem;
        color: var(--md-sys-color-error);
      }
      .stale {
        font-size: 0.72rem;
        color: var(--md-sys-color-on-surface-variant);
        margin-top: 8px;
      }
    `,
  ]

  constructor() {
    super()
    this._projects = []
    this._results = {}
    this._loadId = 0
  }

  connectedCallback() {
    super.connectedCallback()
    this._unsubs = [
      projectsStore.subscribe(({ projects, period, chartEngine }) => {
        const changedData = this._projects !== projects || this._period !== period
        this._projects = projects
        this._period = period
        this._engine = chartEngine
        if (changedData) this._load()
      }),
      googleAuth.subscribe((auth) => {
        const becameConnected = auth.connected && !this._auth?.connected
        this._auth = auth
        if (becameConnected) this._load()
      }),
    ]
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._unsubs.forEach((fn) => fn())
  }

  async _load() {
    if (!this._projects.length || this._period === undefined) return
    const id = ++this._loadId
    const days = this._period
    const dates = periodDates(days)
    this._busy = true
    this._error = null

    const entries = await Promise.all(
      this._projects.map(async (p) => {
        try {
          const [res, realtime] = await Promise.all([ga4Client.batch(p.propertyId, overviewRequests(days)), ga4Client.realtimeUsers(p.propertyId)])
          return [
            p.propertyId,
            {
              kpis: readKpis(res.data[0]),
              daily: readDaily(res.data[1], dates, 'activeUsers'),
              fetchedAt: res.fetchedAt,
              stale: res.stale,
              realtime: res.stale ? null : realtime,
            },
          ]
        } catch (error) {
          return [p.propertyId, { error }]
        }
      }),
    )
    if (id !== this._loadId) return // período/projetos mudaram no meio — descarta
    this._results = Object.fromEntries(entries)
    this._dates = dates.map(fromGaDate)
    this._isoDates = dates.map(toIsoDate)
    this._busy = false
  }

  render() {
    const notice = accessNotice(this, this._auth, this._projects)
    const ok = this._projects.map((p) => ({ p, r: this._results[p.propertyId] })).filter(({ r }) => r && !r.error)
    const oldest = ok.length ? Math.min(...ok.map(({ r }) => r.fetchedAt)) : null

    return html`
      <h1>Visão geral</h1>
      <div class="toolbar">
        <period-picker></period-picker>
        <span class="spacer"></span>
        ${oldest ? html`<span class="meta">Dados de ${dateTime(oldest)}</span>` : nothing}
        <md-icon-button aria-label="Atualizar" title="Atualizar" ?disabled=${this._busy} @click=${() => this._load()}>
          <md-icon>refresh</md-icon>
        </md-icon-button>
      </div>
      ${this._busy ? html`<md-linear-progress indeterminate></md-linear-progress>` : nothing}
      ${this._error ? html`<div class="notice error"><md-icon>error</md-icon><p>${this._error}</p></div>` : nothing}
      ${notice}
      ${ok.length
        ? html`<div class="grid loading" ?data-busy=${this._busy}>
            ${this._renderTotals(ok)} ${this._renderComparison(ok)}
            <div class="grid projects">${this._projects.map((p) => this._renderProject(p))}</div>
          </div>`
        : this._projects.length && this._auth?.connected && !this._busy
          ? html`<div class="grid projects">${this._projects.map((p) => this._renderProject(p))}</div>`
          : nothing}
    `
  }

  _renderTotals(ok) {
    const sum = (range, m) => ok.reduce((acc, { r }) => acc + r.kpis[range][m], 0)
    const realtime = ok.map(({ r }) => r.realtime).filter((v) => v !== null)
    return html`<section class="card">
      <div class="totals">
        <ga4-stat-tile
          hero
          label="Usuários ativos — soma de ${ok.length} projeto${ok.length > 1 ? 's' : ''}"
          value=${compact(sum('current', 'activeUsers'))}
          .delta=${delta(sum('current', 'activeUsers'), sum('previous', 'activeUsers'))}
        ></ga4-stat-tile>
        <ga4-stat-tile
          label="Sessões"
          value=${compact(sum('current', 'sessions'))}
          .delta=${delta(sum('current', 'sessions'), sum('previous', 'sessions'))}
        ></ga4-stat-tile>
        <ga4-stat-tile
          label="Visualizações"
          value=${compact(sum('current', 'screenPageViews'))}
          .delta=${delta(sum('current', 'screenPageViews'), sum('previous', 'screenPageViews'))}
        ></ga4-stat-tile>
        <ga4-stat-tile
          label="Agora (últimos 30 min)"
          value=${realtime.length ? integer(realtime.reduce((a, b) => a + b, 0)) : '—'}
        ></ga4-stat-tile>
      </div>
    </section>`
  }

  /** Uma linha por projeto, na cor fixa do projeto. Do 9º em diante, soma
   *  numa série "Demais projetos" (cinza) — cor a mais não identifica nada. */
  _renderComparison(ok) {
    const shown = ok.filter(({ p }) => projectsStore.colorOf(p.propertyId))
    const rest = ok.filter(({ p }) => !projectsStore.colorOf(p.propertyId))
    const series = shown.map(({ p, r }) => ({ label: p.displayName, color: projectsStore.colorOf(p.propertyId), values: r.daily }))
    if (rest.length) {
      series.push({
        label: `Demais projetos (${rest.length})`,
        color: 'var(--series-other)',
        values: this._dates.map((_, i) => rest.reduce((acc, { r }) => acc + (r.daily[i] ?? 0), 0)),
      })
    }

    if (this._engine === 'plotly') {
      const plotData = series.map((s) => ({
        x: this._isoDates,
        y: s.values,
        name: s.label,
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: s.color, width: 2.5, shape: 'spline' },
        marker: { color: s.color, size: 6 },
        hovertemplate: `<b>%{x}</b><br>${s.label}: %{y:,.0f}<extra></extra>`,
      }))
      return html`<section class="card">
        <h2>Usuários ativos por dia</h2>
        <ga4-plotly-chart
          label="Usuários ativos por dia, por projeto"
          .data=${plotData}
          .height=${320}
        ></ga4-plotly-chart>
      </section>`
    }

    return html`<section class="card">
      <h2>Usuários ativos por dia</h2>
      <ga4-line-chart label="Usuários ativos por dia, por projeto" .dates=${this._dates} .series=${series}></ga4-line-chart>
    </section>`
  }

  _renderProject(p) {
    const r = this._results[p.propertyId]
    const color = projectsStore.colorOf(p.propertyId) ?? 'var(--series-other)'
    const head = html`<div class="project-head">
      <span class="swatch" style="background:${color}"></span>
      <a href="#/projeto/${p.propertyId}" title=${p.displayName}>${p.displayName}</a>
      ${r?.realtime !== null && r?.realtime !== undefined
        ? html`<span class="live" title="Usuários nos últimos 30 minutos"><span class="pulse"></span><b>${integer(r.realtime)}</b> agora</span>`
        : nothing}
    </div>`

    if (!r) return html`<article class="card">${head}<p class="meta">Carregando…</p></article>`
    if (r.error) return html`<article class="card">${head}<p class="card-error">${r.error.message}</p></article>`

    const { current, previous } = r.kpis
    return html`<article class="card">
      ${head}
      <ga4-stat-tile
        label="Usuários ativos"
        value=${compact(current.activeUsers)}
        .delta=${delta(current.activeUsers, previous.activeUsers)}
        .trend=${r.daily}
      ></ga4-stat-tile>
      <div class="small-kpis">
        <div><span>Sessões</span><b>${compact(current.sessions)}</b></div>
        <div><span>Visualizações</span><b>${compact(current.screenPageViews)}</b></div>
        <div><span>Engajamento</span><b>${percent(current.engagementRate)}</b></div>
      </div>
      ${r.stale ? html`<div class="stale">Offline — dados salvos em ${dateTime(r.fetchedAt)}</div>` : nothing}
    </article>`
  }
}

customElements.define('overview-view', OverviewView)
