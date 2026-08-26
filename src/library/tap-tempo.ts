/**
 * Tempo a golpe de tecla.
 *
 * Existe porque la detección automática tocó techo: acierta 10 de 17 en el
 * corpus, y lo que falla lo hace por elegir mal el nivel métrico —un problema
 * que la autocorrelación **no puede** resolver, porque en una señal de período
 * P la periodicidad en 2P es igual de fuerte—. El oído humano sí lo resuelve
 * sin esfuerzo. Así que en vez de seguir peleando con el estimador, se le
 * pregunta al jugador, que tarda cinco segundos.
 */

import { BPM_LIMITS } from '../game/constants'

/**
 * Silencio máximo entre dos golpes para que sigan siendo la misma medición.
 *
 * 2.5s son 24 BPM: por debajo de eso ya no hay tempo que valga, así que un
 * hueco más largo solo puede significar que el jugador paró. Continuar la serie
 * ahí metería la duración de la pausa como si fuera un intervalo musical.
 */
export const TAP_RESET_MS = 2500

/**
 * Intervalos mínimos —o sea un golpe más que esto— para dar un número.
 *
 * Con menos, la mediana no tiene de dónde descartar un golpe torcido, que es
 * justamente para lo que está.
 */
export const MIN_TAP_INTERVALS = 4

/** Suma un golpe a la serie, o arranca una nueva si venía de un silencio. */
export function addTap(taps: readonly number[], atMs: number): number[] {
  const last = taps[taps.length - 1]
  if (last !== undefined && atMs - last > TAP_RESET_MS) return [atMs]
  return [...taps, atMs]
}

/**
 * Tempo de una serie de golpes, o `null` si todavía no alcanza para afirmarlo.
 *
 * Usa la **mediana** de los intervalos y no el promedio, y esa es toda la
 * diferencia entre que sirva y que no: el error típico no es temblar un poco,
 * es saltearse un golpe. Ese intervalo sale al doble y el promedio se lo lleva
 * puesto —cinco golpes a 500ms con uno salteado dan 600ms, o sea 100 BPM en vez
 * de 120—, mientras que a la mediana no la mueve.
 */
export function tapBpm(taps: readonly number[]): number | null {
  if (taps.length <= MIN_TAP_INTERVALS) return null

  const intervals = taps.slice(1).map((tap, i) => tap - taps[i])
  const sorted = [...intervals].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]

  // Cero pasa de verdad: con el contexto de audio suspendido `nowMs()` no
  // avanza y todos los golpes leen el mismo instante.
  if (median <= 0) return null

  const bpm = 60_000 / median
  return Math.min(BPM_LIMITS.max, Math.max(BPM_LIMITS.min, bpm))
}
