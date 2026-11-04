const LOCALE = 'pt-BR'

const compactFmt = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 })
const intFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })
const pctFmt = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 1 })
const signedPctFmt = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 0, signDisplay: 'exceptZero' })
const dayFmt = new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: 'short' })
const fullDayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/** 1.284 / 12,9 mil / 4,2 mi — para números em destaque. */
export const compact = (n) => (Math.abs(n) < 10_000 ? intFmt.format(n) : compactFmt.format(n))
export const integer = (n) => intFmt.format(n)
export const percent = (n) => pctFmt.format(n)
export const signedPercent = (n) => signedPctFmt.format(n)
export const day = (d) => dayFmt.format(d)
export const fullDay = (d) => fullDayFmt.format(d)
export const dateTime = (ms) => timeFmt.format(new Date(ms))

/** 95 -> "1m 35s" */
export function duration(seconds) {
  const s = Math.round(seconds)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

/** Formata um valor de KPI pelo nome da métrica. */
export function metricValue(metric, value) {
  if (metric === 'engagementRate') return percent(value)
  if (metric === 'averageSessionDuration') return duration(value)
  return compact(value)
}

export const METRIC_LABELS = {
  activeUsers: 'Usuários ativos',
  sessions: 'Sessões',
  screenPageViews: 'Visualizações',
  engagementRate: 'Taxa de engajamento',
  averageSessionDuration: 'Duração média da sessão',
  eventCount: 'Eventos',
}

/** Topo "redondo" do eixo e os ticks: 0, 250, 500… (nunca 0, 237, 474). */
export function niceTicks(max, count = 4) {
  if (!(max > 0)) return [0, 1]
  const rough = max / count
  const pow = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough)
  const top = Math.ceil(max / step) * step
  const ticks = []
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v)
  return ticks
}
