import { invoke } from '@tauri-apps/api/core'

/** Igual que `MAX_OFFSET_MS` en `src-tauri/src/settings.rs`, donde se valida de verdad. */
export const MAX_OFFSET_MS = 300

/**
 * Cuánto mueve un click del control.
 *
 * 5ms y no 1: por debajo de eso el cambio no se percibe —un frame a 60fps son
 * 16.7ms— y un control que hay que apretar sesenta veces para llegar al valor
 * útil es un control que nadie usa.
 */
export const OFFSET_STEP_MS = 5

export type Settings = {
  version: number
  /**
   * Calibración de latencia. Se le resta a la confirmación antes de juzgarla.
   * Positivo = el jugador confirma tarde, que es el caso normal.
   */
  offsetMs: number
}

export function loadSettings(): Promise<Settings> {
  return invoke<Settings>('load_settings')
}

/**
 * Guarda y devuelve **lo que quedó en el disco**, que puede no ser lo que se
 * pidió: el backend recorta el ajuste a su rango válido.
 */
export function saveSettings(settings: Settings): Promise<Settings> {
  return invoke<Settings>('save_settings', { settings })
}
