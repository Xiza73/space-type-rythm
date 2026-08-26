import { invoke } from '@tauri-apps/api/core'

import { getAudioContext, musicOut } from './context'

/**
 * Reproducción de una canción de la biblioteca.
 *
 * Se usa `AudioBufferSourceNode` y no un `<audio>`: `start(when)` agenda contra
 * el mismo reloj del que sale `nowMs()`, así que el audio y el juego comparten
 * base de tiempo. Un elemento `<audio>` tiene su propio reloj y deriva.
 */
export type SongPlayback = {
  /**
   * Cuándo arrancó —o habría arrancado— el **segundo cero** del audio, en la
   * misma escala que `nowMs()`.
   *
   * Con `offsetSec` la reproducción empieza más adelante, pero este valor sigue
   * apuntando al cero de la canción. Es lo que hace que la grilla del beatmap
   * siga siendo válida: `firstBeatMs` se mide desde el arranque del archivo, no
   * desde donde se lo empezó a escuchar.
   */
  startedAtMs: number
  stop(): void
}

/** Colchón antes de arrancar: da tiempo a agendar sin llegar tarde. */
const LEAD_SEC = 0.25

/**
 * Trae el audio por IPC y lo decodifica.
 *
 * `decodeAudioData` **consume** el ArrayBuffer, así que este buffer no se puede
 * reusar; lo que se cachea es el `AudioBuffer` que sale.
 */
export async function loadSong(id: string): Promise<AudioBuffer> {
  const bytes = await invoke<ArrayBuffer>('song_audio', { id })
  return await getAudioContext().decodeAudioData(bytes)
}

/**
 * `offsetSec` es desde qué punto del archivo se escucha. La partida siempre
 * arranca en cero; lo usa la escucha previa de la biblioteca, para caer donde
 * ya hay ritmo en vez de en una intro que puede no tener nada.
 */
export function playSong(buffer: AudioBuffer, offsetSec = 0): SongPlayback {
  const ctx = getAudioContext()
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(musicOut())

  const startAt = ctx.currentTime + LEAD_SEC
  source.start(startAt, offsetSec)

  let stopped = false
  return {
    // Se descuenta el salto: el cero de la canción quedó en el pasado.
    startedAtMs: (startAt - offsetSec) * 1000,
    stop() {
      if (stopped) return
      stopped = true
      // Parar un source que ya terminó tira; no es un error que importe.
      try {
        source.stop()
      } catch {
        /* ya había terminado */
      }
      source.disconnect()
    },
  }
}
