/**
 * Os "projetos" do painel: propriedades GA4 escolhidas pelo usuário, na
 * ordem em que ele as escolheu, e o período selecionado. Ficam em
 * localStorage (sobrevivem ao fechar o app, ao contrário do token).
 *
 * A cor de cada projeto nos gráficos segue a posição *nesta lista*, nunca a
 * ordenação de um relatório: se um projeto sai ou o ranking muda, os demais
 * mantêm a cor.
 */
import { DEFAULT_PERIOD, PERIODS } from './reports.js'

const PROJECTS_KEY = `${__APP_STORAGE_PREFIX__}:projects`
const PERIOD_KEY = `${__APP_STORAGE_PREFIX__}:period`
const ENGINE_KEY = `${__APP_STORAGE_PREFIX__}:chart-engine`

export const CHART_ENGINES = ['plotly', 'svg']
export const DEFAULT_ENGINE = 'plotly'

/** Categóricos disponíveis (ver styles/charts.css). Mais que isso e a
 *  cor deixa de identificar — os excedentes vão para "demais". */
export const SERIES_SLOTS = 8

const listeners = new Set()

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback
  } catch {
    return fallback
  }
}

let projects = read(PROJECTS_KEY, [])
let period = PERIODS.includes(read(PERIOD_KEY, DEFAULT_PERIOD)) ? read(PERIOD_KEY, DEFAULT_PERIOD) : DEFAULT_PERIOD
let chartEngine = CHART_ENGINES.includes(read(ENGINE_KEY, DEFAULT_ENGINE))
  ? read(ENGINE_KEY, DEFAULT_ENGINE)
  : DEFAULT_ENGINE

function emit() {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
  localStorage.setItem(PERIOD_KEY, JSON.stringify(period))
  localStorage.setItem(ENGINE_KEY, JSON.stringify(chartEngine))
  listeners.forEach((fn) => fn(projectsStore.get()))
}

window.addEventListener('storage', (e) => {
  if (e.key === PROJECTS_KEY || e.key === PERIOD_KEY || e.key === ENGINE_KEY) {
    projects = read(PROJECTS_KEY, [])
    period = read(PERIOD_KEY, DEFAULT_PERIOD)
    chartEngine = read(ENGINE_KEY, DEFAULT_ENGINE)
    listeners.forEach((fn) => fn(projectsStore.get()))
  }
})

export const projectsStore = {
  get() {
    return { projects, period, chartEngine }
  },

  subscribe(callback) {
    listeners.add(callback)
    callback(this.get())
    return () => listeners.delete(callback)
  },

  find(propertyId) {
    return projects.find((p) => p.propertyId === propertyId) ?? null
  },

  /** CSS var da cor do projeto, ou null além do 8º. */
  colorOf(propertyId) {
    const i = projects.findIndex((p) => p.propertyId === propertyId)
    return i >= 0 && i < SERIES_SLOTS ? `var(--series-${i + 1})` : null
  },

  toggle(property) {
    projects = this.find(property.propertyId)
      ? projects.filter((p) => p.propertyId !== property.propertyId)
      : [...projects, { propertyId: property.propertyId, displayName: property.displayName, account: property.account }]
    emit()
  },

  move(propertyId, offset) {
    const i = projects.findIndex((p) => p.propertyId === propertyId)
    const j = i + offset
    if (i < 0 || j < 0 || j >= projects.length) return
    const next = [...projects]
    ;[next[i], next[j]] = [next[j], next[i]]
    projects = next
    emit()
  },

  setPeriod(days) {
    if (!PERIODS.includes(days)) return
    period = days
    emit()
  },

  setChartEngine(engine) {
    if (!CHART_ENGINES.includes(engine)) return
    chartEngine = engine
    emit()
  },
}
