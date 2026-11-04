import { describe, expect, it } from 'vitest'
import {
  DIMENSION_REPORTS,
  categoryRequests,
  dateRanges,
  delta,
  periodDates,
  readDaily,
  readKpis,
  readProperties,
  readTop,
  toIsoDate,
} from './reports.js'

describe('dateRanges', () => {
  it('período atual termina ontem e o anterior tem o mesmo tamanho, logo antes', () => {
    expect(dateRanges(7)).toEqual([
      { startDate: '7daysAgo', endDate: 'yesterday', name: 'current' },
      { startDate: '14daysAgo', endDate: '8daysAgo', name: 'previous' },
    ])
  })
})

describe('periodDates', () => {
  it('lista os N dias até ontem, em ordem', () => {
    expect(periodDates(3, new Date(2026, 2, 2))).toEqual(['20260227', '20260228', '20260301'])
  })
})

describe('readKpis', () => {
  it('separa os períodos pela dimensão dateRange e zera o que falta', () => {
    const report = {
      dimensionHeaders: [{ name: 'dateRange' }],
      metricHeaders: [{ name: 'activeUsers' }, { name: 'sessions' }],
      rows: [{ dimensionValues: [{ value: 'current' }], metricValues: [{ value: '10' }, { value: '15' }] }],
    }
    const k = readKpis(report)
    expect(k.current.activeUsers).toBe(10)
    expect(k.current.sessions).toBe(15)
    expect(k.previous.activeUsers).toBe(0)
  })

  it('resposta sem rows (propriedade sem tráfego) vira zeros', () => {
    expect(readKpis({}).current.activeUsers).toBe(0)
  })
})

describe('readDaily', () => {
  it('preenche com 0 os dias sem linha', () => {
    const report = {
      dimensionHeaders: [{ name: 'date' }],
      metricHeaders: [{ name: 'activeUsers' }],
      rows: [{ dimensionValues: [{ value: '20260102' }], metricValues: [{ value: '5' }] }],
    }
    expect(readDaily(report, ['20260101', '20260102', '20260103'], 'activeUsers')).toEqual([0, 5, 0])
  })
})

describe('readTop', () => {
  it('rotula valor vazio como (não definido) e traduz State of', () => {
    const report = {
      dimensionHeaders: [{ name: 'region' }],
      metricHeaders: [{ name: 'activeUsers' }],
      rows: [
        { dimensionValues: [{ value: '' }], metricValues: [{ value: '3' }] },
        { dimensionValues: [{ value: 'State of São Paulo' }], metricValues: [{ value: '42' }] },
      ],
    }
    expect(readTop(report, 'region', 'activeUsers')).toEqual([
      { label: '(não definido)', value: 3 },
      { label: 'Estado de São Paulo', value: 42 },
    ])
  })
})

describe('toIsoDate & categoryRequests', () => {
  it('converte YYYYMMDD para YYYY-MM-DD', () => {
    expect(toIsoDate('20261104')).toBe('2026-11-04')
  })

  it('gera um request por dimensão da categoria', () => {
    const reqs = categoryRequests('geographic', 28, 15)
    expect(reqs).toHaveLength(DIMENSION_REPORTS.geographic.dimensions.length)
    expect(reqs[0].dimensions[0].name).toBe('country')
    expect(reqs[0].limit).toBe(15)
  })
})

describe('delta', () => {
  it('é relativo ao anterior e null sem base', () => {
    expect(delta(15, 10)).toBe(0.5)
    expect(delta(5, 0)).toBeNull()
  })
})

describe('readProperties', () => {
  it('achata contas e propriedades de todas as páginas', () => {
    const pages = [
      { accountSummaries: [{ displayName: 'FzlSoft', propertySummaries: [{ property: 'properties/123', displayName: 'Site' }] }] },
      { accountSummaries: [{ displayName: 'Outra', propertySummaries: [{ property: 'properties/9', displayName: 'App' }] }] },
    ]
    expect(readProperties(pages)).toEqual([
      { propertyId: '123', displayName: 'Site', account: 'FzlSoft' },
      { propertyId: '9', displayName: 'App', account: 'Outra' },
    ])
  })
})
