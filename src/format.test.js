import { describe, expect, it } from 'vitest'
import { duration, niceTicks } from './format.js'

describe('niceTicks', () => {
  it('arredonda o topo do eixo', () => {
    expect(niceTicks(237)).toEqual([0, 100, 200, 300])
    expect(niceTicks(0)).toEqual([0, 1])
  })
})

describe('duration', () => {
  it('formata segundos', () => {
    expect(duration(42)).toBe('42s')
    expect(duration(95)).toBe('1m 35s')
    expect(duration(3725)).toBe('1h 02m')
  })
})
