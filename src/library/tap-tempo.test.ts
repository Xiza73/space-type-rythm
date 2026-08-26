import { describe, expect, it } from 'vitest'

import { BPM_LIMITS } from '../game/constants'
import { addTap, MIN_TAP_INTERVALS, TAP_RESET_MS, tapBpm } from './tap-tempo'

/** Serie de taps perfecta al intervalo pedido. */
const evenTaps = (intervalMs: number, count: number) =>
  Array.from({ length: count }, (_, i) => i * intervalMs)

describe('addTap', () => {
  it('acumula mientras el jugador siga en tempo', () => {
    expect(addTap([0, 500], 1000)).toEqual([0, 500, 1000])
  })

  it('empieza de cero después de un silencio largo', () => {
    // Volver a tapear después de parar es empezar de nuevo, no continuar una
    // serie vieja: el intervalo entre las dos no es un tempo, es una pausa.
    expect(addTap([0, 500], 500 + TAP_RESET_MS + 1)).toEqual([500 + TAP_RESET_MS + 1])
  })

  it('el borde de la ventana todavía cuenta como el mismo tempo', () => {
    expect(addTap([0], TAP_RESET_MS)).toEqual([0, TAP_RESET_MS])
  })

  it('el primer tap arranca la serie', () => {
    expect(addTap([], 1234)).toEqual([1234])
  })
})

describe('tapBpm', () => {
  it('no arriesga un número con pocos taps', () => {
    // Dos golpes dan un intervalo, y un intervalo no es un tempo: es un dato.
    expect(tapBpm(evenTaps(500, MIN_TAP_INTERVALS))).toBeNull()
    expect(tapBpm([])).toBeNull()
    expect(tapBpm([0])).toBeNull()
  })

  it('con taps parejos da el tempo exacto', () => {
    // 500ms entre golpes son 120 pulsos por minuto.
    expect(tapBpm(evenTaps(500, MIN_TAP_INTERVALS + 1))).toBeCloseTo(120)
    expect(tapBpm(evenTaps(400, MIN_TAP_INTERVALS + 1))).toBeCloseTo(150)
  })

  it('un golpe salteado no arruina la medición', () => {
    // Este es EL caso real: te distraés y perdés un beat, así que un intervalo
    // sale al doble. Con el promedio ese intervalo arrastra el resultado
    // —600ms, o sea 100 BPM—; con la mediana no lo mueve nada.
    const taps = [0, 500, 1000, 2000, 2500, 3000]

    expect(tapBpm(taps)).toBeCloseTo(120)
  })

  it('aguanta el temblor normal de una mano', () => {
    const taps = [0, 510, 990, 1505, 1995, 2500]
    const bpm = tapBpm(taps)

    expect(bpm).not.toBeNull()
    expect(bpm as number).toBeGreaterThan(115)
    expect(bpm as number).toBeLessThan(125)
  })

  it('no devuelve nada si los taps caen en el mismo instante', () => {
    // Pasa de verdad: con el contexto de audio suspendido `nowMs()` no avanza y
    // todos los taps leen el mismo número. Sin esto, sería dividir por cero.
    expect(tapBpm([100, 100, 100, 100, 100, 100])).toBeNull()
  })

  it('se queda dentro de los límites editables', () => {
    // Tapear cada 2.4s daría 25 BPM, que el backend no acepta. El intervalo se
    // elige dentro de la ventana de `addTap`, así que es una serie alcanzable.
    const lentisimo = evenTaps(2400, MIN_TAP_INTERVALS + 1)
    expect(tapBpm(lentisimo)).toBe(BPM_LIMITS.min)

    const rapidisimo = evenTaps(100, MIN_TAP_INTERVALS + 1)
    expect(tapBpm(rapidisimo)).toBe(BPM_LIMITS.max)
  })
})
