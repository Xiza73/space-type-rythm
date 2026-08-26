import { invoke } from '@tauri-apps/api/core'

import type { RhythmMode, SpeedId } from '../components/GameCanvas'
import type { Language, SequenceType } from '../game/sequence'

/** Igual que `MAX_NAME_LEN` en `src-tauri/src/scores.rs`. */
export const MAX_NAME_LEN = 10

export type ScoreEntry = {
  name: string
  score: number
  maxCombo: number
  mode: string
  at: number
}

export type NewScore = Omit<ScoreEntry, 'at'>

/** Todo lo que cambia la dificultad de una partida, o sea todo lo que separa una tabla de otra. */
export type ModeChoice = {
  sequenceType: SequenceType
  language: Language
  rhythmMode: RhythmMode
  speed: SpeedId
  /** Canción de la biblioteca, o `null` con el chiptune simulado. */
  songId: string | null
}

/**
 * Clave de la tabla. Cada configuración tiene la suya porque **los puntajes de
 * modos distintos no se comparan**: arcade es infinito y canción dura dos
 * minutos, así que un top 5 mezclado lo ganaría siempre arcade.
 *
 * El idioma entra en la clave: tipear en español y en inglés no cuesta igual.
 *
 * **Cada canción de la biblioteca tiene su propia tabla.** Por el mismo motivo
 * que las tienen los modos: duran distinto y van a otro tempo, así que un top 5
 * compartido lo gana siempre la canción más larga, que es la que más rondas
 * deja jugar. Antes la canción no entraba en la clave y todas caían en la del
 * chiptune del preset que hubiera quedado seleccionado en el menú — un preset
 * que con una canción real ni siquiera se muestra.
 *
 * El tempo corregido a mano **no** entra: es un arreglo de la detección, no una
 * palanca de dificultad. Si entrara, cada ajuste estrenaría una tabla vacía y
 * el récord anterior desaparecería de la vista.
 */
export function modeKey({
  sequenceType,
  language,
  rhythmMode,
  speed,
  songId,
}: ModeChoice): string {
  const seq = sequenceType === 'arrows' ? 'arrows' : `words-${language}`
  if (rhythmMode === 'arcade') return `${seq}/arcade`
  // Separador distinto al del preset: un id de video no puede colisionar con
  // `song-calma` ni con ninguno de los otros cuatro.
  return songId === null ? `${seq}/song-${speed}` : `${seq}/song:${songId}`
}

export function loadScores(mode: string): Promise<ScoreEntry[]> {
  return invoke<ScoreEntry[]>('load_scores', { mode })
}

export function saveScore(entry: NewScore): Promise<ScoreEntry[]> {
  return invoke<ScoreEntry[]>('save_score', { entry })
}

/**
 * Cuál de las entradas es la recién guardada, comparando la tabla de antes con
 * la de después. `null` si el puntaje no entró al top 5.
 *
 * Se resuelve así, y no devolviendo la posición desde Rust, porque el `at` lo
 * pone el backend al guardar: el frontend no lo conoce hasta que le contestan.
 * Y "no hay ninguna nueva" es justo la respuesta que hay que mostrar cuando el
 * puntaje no alcanzó — no un caso de error.
 */
export function newEntryAt(
  before: readonly ScoreEntry[],
  after: readonly ScoreEntry[],
): number | null {
  const previas = new Set(before.map((entry) => entry.at))
  return after.find((entry) => !previas.has(entry.at))?.at ?? null
}

/**
 * Mejor entrada de una tabla, o `null` si nadie puntuó todavía.
 *
 * Es la primera: el backend devuelve el top ya ordenado de mayor a menor, y
 * volver a ordenarlo aquí sería una segunda definición de "mejor" que puede
 * desincronizarse de la de `top_of`.
 */
export function bestOf(board: readonly ScoreEntry[]): ScoreEntry | null {
  return board[0] ?? null
}

/**
 * Último nombre usado, de cualquier modo. Para no obligar a reescribirlo.
 *
 * Se deduce del ranking en vez de guardarse aparte: un campo nuevo habría que
 * versionarlo, y un archivo más se puede desincronizar del que ya existe.
 */
export function lastScoreName(): Promise<string | null> {
  return invoke<string | null>('last_score_name')
}
