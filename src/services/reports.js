/**
 * Montagem dos pedidos à GA4 Data API e leitura das respostas — funções
 * puras (sem fetch, sem DOM), para poderem ser testadas em Node.
 *
 * Períodos: "últimos N dias" termina *ontem*, não hoje. Hoje é um dia
 * parcial; incluí-lo faria toda variação contra o período anterior (que é
 * completo) parecer queda. O "agora" fica por conta do relatório em tempo
 * real (usuários nos últimos 30 minutos).
 */

export const PERIODS = [7, 28, 90]
export const DEFAULT_PERIOD = 28

export const KPI_METRICS = ['activeUsers', 'sessions', 'screenPageViews', 'engagementRate', 'averageSessionDuration']

/** Categorias de dimensões inspiradas no `bi_static_dashboards`. */
export const DIMENSION_REPORTS = {
  geographic: {
    title: 'Distribuição Geográfica',
    metric: 'activeUsers',
    metricLabel: 'Usuários ativos',
    dimensions: [
      { key: 'country', label: 'País' },
      { key: 'region', label: 'Região / Estado' },
      { key: 'city', label: 'Cidade' },
      { key: 'language', label: 'Idioma' },
    ],
  },
  devices: {
    title: 'Dispositivos e Tecnologia',
    metric: 'activeUsers',
    metricLabel: 'Usuários ativos',
    dimensions: [
      { key: 'deviceCategory', label: 'Categoria de Dispositivo' },
      { key: 'browser', label: 'Navegador' },
      { key: 'operatingSystem', label: 'Sistema Operacional' },
      { key: 'screenResolution', label: 'Resolução de Tela' },
    ],
  },
  traffic: {
    title: 'Origem do Tráfego',
    metric: 'sessions',
    metricLabel: 'Sessões',
    dimensions: [
      { key: 'sessionDefaultChannelGroup', label: 'Grupo de Canais' },
      { key: 'sessionSource', label: 'Origem (Source)' },
      { key: 'sessionMedium', label: 'Mídia (Medium)' },
      { key: 'pageReferrer', label: 'Referenciador' },
    ],
  },
  pagescreen: {
    title: 'Páginas e Telas',
    metric: 'screenPageViews',
    metricLabel: 'Visualizações',
    dimensions: [
      { key: 'pagePath', label: 'Caminho da Página' },
      { key: 'pageTitle', label: 'Título da Página' },
      { key: 'hostname', label: 'Hostname' },
      { key: 'eventName', label: 'Eventos (eventCount)', metric: 'eventCount' },
    ],
  },
}

/** Período atual e o imediatamente anterior, de mesmo tamanho. */
export function dateRanges(days) {
  return [
    { startDate: `${days}daysAgo`, endDate: 'yesterday', name: 'current' },
    { startDate: `${days * 2}daysAgo`, endDate: `${days + 1}daysAgo`, name: 'previous' },
  ]
}

/** 'YYYYMMDD' dos N dias que terminam ontem, em ordem cronológica. */
export function periodDates(days, today = new Date()) {
  const out = []
  for (let i = days; i >= 1; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    out.push(toGaDate(d))
  }
  return out
}

export function toGaDate(d) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

export function fromGaDate(s) {
  return new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)))
}

/** 'YYYYMMDD' -> 'YYYY-MM-DD' (para eixos temporais do Plotly). */
export function toIsoDate(s) {
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

const metrics = (names) => names.map((name) => ({ name }))
const dims = (names) => names.map((name) => ({ name }))

/** Pedidos do cartão de um projeto na visão geral (um batchRunReports). */
export function overviewRequests(days) {
  const [current] = dateRanges(days)
  return [
    { dateRanges: dateRanges(days), metrics: metrics(KPI_METRICS) },
    {
      dateRanges: [current],
      dimensions: dims(['date']),
      metrics: metrics(['activeUsers']),
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: 400,
    },
  ]
}

export function topRequest(dimension, metric, days, limit = 15) {
  const [current] = dateRanges(days)
  return {
    dateRanges: [current],
    dimensions: dims([dimension]),
    metrics: metrics([metric]),
    orderBys: [{ metric: { metricName: metric }, desc: true }],
    limit,
  }
}

/** Pedidos de um grupo de dimensões (ex.: geographic, devices, traffic, pagescreen). */
export function categoryRequests(categoryKey, days, limit = 15) {
  const cat = DIMENSION_REPORTS[categoryKey]
  if (!cat) return []
  return cat.dimensions.map((d) => topRequest(d.key, d.metric || cat.metric, days, limit))
}

/** Pedidos da página de detalhe de um projeto — dois lotes, porque a API
 *  aceita no máximo 5 relatórios por batchRunReports. */
export function detailRequests(days) {
  const [current] = dateRanges(days)
  return [
    [
      { dateRanges: dateRanges(days), metrics: metrics(KPI_METRICS) },
      {
        dateRanges: [current],
        dimensions: dims(['date']),
        metrics: metrics(['activeUsers', 'sessions', 'screenPageViews']),
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        limit: 400,
      },
      topRequest('pagePath', 'screenPageViews', days, 10),
      topRequest('sessionDefaultChannelGroup', 'sessions', days, 10),
      topRequest('country', 'activeUsers', days, 10),
    ],
    [topRequest('deviceCategory', 'activeUsers', days, 5), topRequest('eventName', 'eventCount', days, 10)],
  ]
}

/** Resposta do Data API -> [{ dims: {nome: valor}, metrics: {nome: número} }]. */
export function readRows(report) {
  const dimNames = (report?.dimensionHeaders ?? []).map((h) => h.name)
  const metricNames = (report?.metricHeaders ?? []).map((h) => h.name)
  return (report?.rows ?? []).map((row) => ({
    dims: Object.fromEntries(dimNames.map((n, i) => [n, row.dimensionValues?.[i]?.value ?? ''])),
    metrics: Object.fromEntries(metricNames.map((n, i) => [n, Number(row.metricValues?.[i]?.value ?? 0)])),
  }))
}

/** Relatório de KPIs com dois períodos -> { current: {...}, previous: {...} }.
 *  Com mais de um dateRange a API acrescenta a dimensão 'dateRange' com o
 *  nome que demos a cada período. Período sem dados volta como zeros. */
export function readKpis(report) {
  const zero = Object.fromEntries(KPI_METRICS.map((m) => [m, 0]))
  const out = { current: { ...zero }, previous: { ...zero } }
  for (const row of readRows(report)) {
    const range = row.dims.dateRange ?? 'current'
    if (range in out) out[range] = { ...zero, ...row.metrics }
  }
  return out
}

/** Série diária completa: dias sem linha na resposta (sem tráfego) viram 0,
 *  para o gráfico não ligar pontos distantes como se fossem vizinhos. */
export function readDaily(report, dates, metric) {
  const byDate = new Map(readRows(report).map((r) => [r.dims.date, r.metrics[metric] ?? 0]))
  return dates.map((d) => byDate.get(d) ?? 0)
}

/** Relatório de ranking -> [{ label, value }]. Traduz 'State of ' para 'Estado de '. */
export function readTop(report, dimension, metric) {
  return readRows(report).map((r) => {
    let label = r.dims[dimension] || '(não definido)'
    if (typeof label === 'string') {
      label = label.replace(/^State of /, 'Estado de ')
    }
    return { label, value: r.metrics[metric] ?? 0 }
  })
}

/** Variação relativa; null quando não há base de comparação. */
export function delta(current, previous) {
  if (!previous) return null
  return (current - previous) / previous
}

/** Resposta do accountSummaries -> [{ propertyId, displayName, account }]. */
export function readProperties(pages) {
  const out = []
  for (const page of pages) {
    for (const acc of page.accountSummaries ?? []) {
      for (const prop of acc.propertySummaries ?? []) {
        out.push({
          propertyId: prop.property.replace(/^properties\//, ''),
          displayName: prop.displayName,
          account: acc.displayName,
        })
      }
    }
  }
  return out
}
