import { useEffect, useRef, useState } from 'react'

import { nowMs, resumeAudio } from '../audio/context'
import { CALIBRATION } from '../game/constants'
import { meanOffsetMs, type GameState } from '../game/engine'
import { startGameLoop, type Loop } from '../game/loop'
import type { RhythmSource } from '../game/rhythm'
import { isPlainKey } from '../window'

type Props = {
  /** Ajuste medido, en ms, listo para guardar. */
  onApply: (offsetMs: number) => void
  onCancel: () => void
}

/** Colchón antes de la primera pasada. La primera es de anticipo, así que alcanza. */
const LEAD_MS = 1200

/**
 * Mide la calibración de latencia jugando **el juego sin la parte de tipear**.
 *
 * Es el mismo motor, el mismo riel y la misma zona: si midiera con otro dibujo,
 * mediría otra cosa. Lo único que cambia es que la secuencia viene vacía, así
 * que solo hay que confirmar cuando el marcador cruza la zona.
 *
 * Por qué no alcanza con el desvío que ya reporta la pantalla de resultados:
 * ahí el número viene contaminado por el tipeo. En una ronda difícil terminás
 * de escribir tarde y confirmás tarde, y eso entra al promedio como si fuera
 * latencia. Sacando la secuencia, lo que queda es percepción y reflejo.
 */
export function CalibrationRun({ onApply, onCancel }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const loopRef = useRef<Loop | null>(null)

  const [result, setResult] = useState<GameState | null>(null)
  // Cambiarlo remonta el loop entero. Un solo camino de reinicio es un solo
  // camino que puede fallar.
  const [run, setRun] = useState(0)

  useEffect(() => {
    let cancelled = false
    let onKeyDown: ((event: KeyboardEvent) => void) | null = null

    async function boot() {
      const canvas = ref.current
      if (canvas === null) return

      // Todo el timing sale del reloj de audio, incluso sin música sonando.
      await resumeAudio()
      if (cancelled) return

      const totalDurationMs =
        CALIBRATION.rounds * (CALIBRATION.roundDurationMs + CALIBRATION.interRoundPauseMs)

      // Ritmo fijo, escrito acá y no en `rhythm.ts`: esto no es un modo de
      // juego y no tiene por qué aparecer entre los que sí lo son.
      const rhythm: RhythmSource = {
        roundDurationMs: () => CALIBRATION.roundDurationMs,
        sequenceLength: () => 0,
        totalDurationMs,
        interRoundPauseMs: CALIBRATION.interRoundPauseMs,
        roundStartMs: (at) => at,
      }

      const loop = startGameLoop({
        canvas,
        config: {
          lives: null,
          durationMs: totalDurationMs,
          startsAtMs: nowMs() + LEAD_MS,
          // **Cero, no el ajuste vigente.** La medición tiene que ser absoluta:
          // si corrigiera con lo que ya hay guardado, mediría el resto y habría
          // que sumarlo a mano, que es justo lo que esta pantalla viene a
          // sacarse de encima.
          offsetMs: 0,
        },
        // Sin chiptune: lo que se mide es la barra. Música de fondo sería un
        // segundo pulso compitiendo con ella y ensuciaría la medición.
        bpm: null,
        rhythm,
        nextSequence: () => [],
        track: null,
        visualSeed: null,
        onGameOver: setResult,
      })
      loopRef.current = loop

      onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onCancel()
          return
        }
        if (!isPlainKey(event)) return
        if (event.key === ' ') event.preventDefault()
        loop.handleKey(event.key)
      }
      window.addEventListener('keydown', onKeyDown)
    }

    void boot()

    return () => {
      cancelled = true
      if (onKeyDown !== null) window.removeEventListener('keydown', onKeyDown)
      loopRef.current?.stop()
      loopRef.current = null
    }
  }, [run, onCancel])

  const measured = result === null ? null : meanOffsetMs(result.stats)
  const samples = result?.stats.offsetCount ?? 0
  const enough = measured !== null && samples >= CALIBRATION.minSamples

  return (
    <>
      <canvas ref={ref} className="block h-full w-full" />

      {/*
        El bloque de instrucciones va **debajo** del HUD, no encima. El canvas
        dibuja SCORE/COMBO/MULT/TIEMPO entre los 30 y los 90 píxeles de altura,
        así que a `top-8` le caía justo arriba y los dos textos quedaban
        ilegibles. Se vio al correrlo: en los tests no aparece, porque nadie
        testea el canvas pixel a pixel y no habría que empezar por esto.
      */}
      {result === null && (
        <div className="pointer-events-none fixed inset-x-0 top-28 flex flex-col items-center gap-1 text-center">
          <p className="text-[11px] font-bold tracking-[6px] text-ink-muted">CALIBRANDO</p>
          <p className="max-w-[520px] px-6 text-[13px] text-ink-soft">
            No hay nada que tipear. Confirmá con <b className="text-gold">ESPACIO</b> cuando el
            marcador cruce la zona clara, tal como jugarías. La primera pasada es de práctica.
          </p>
          <p className="text-[12px] text-ink-muted">ESC para salir</p>
        </div>
      )}

      {result !== null && (
        <div className="fixed inset-0 grid place-content-center justify-items-center gap-6 overflow-y-auto bg-night px-6 py-10 text-center">
          <h2 className="chrome font-display text-4xl leading-none">MEDICIÓN</h2>

          {enough ? (
            <>
              <div className="flex flex-col items-center gap-0.5">
                <span className="font-display text-5xl text-cyan">
                  {measured > 0 ? '+' : ''}
                  {Math.round(measured)}
                  <span className="text-2xl"> ms</span>
                </span>
                <span className="text-[11px] font-bold tracking-[3px] text-ink-muted">
                  SOBRE {samples} CONFIRMACIONES
                </span>
              </div>

              <p className="max-w-[420px] text-[13px] leading-relaxed text-ink-soft">
                {Math.abs(measured) < 15
                  ? 'Estás prácticamente centrado. Guardarlo no te va a cambiar nada, y eso es una buena noticia.'
                  : measured > 0
                    ? 'Confirmás después de la zona. Guardarlo corre tus teclas hacia atrás esa misma cantidad.'
                    : 'Confirmás antes de la zona. Guardarlo corre tus teclas hacia adelante esa misma cantidad.'}
              </p>
            </>
          ) : (
            <p className="max-w-[420px] text-[13px] leading-relaxed text-ink-soft">
              Quedaron {samples} confirmaciones válidas y hacen falta{' '}
              {CALIBRATION.minSamples}. Un promedio de dos teclas es ruido con forma de número:
              aplicarlo descalibraría lo que ya estaba bien. Probá de nuevo confirmando en todas
              las pasadas, aunque llegues justo.
            </p>
          )}

          <div className="flex flex-wrap justify-center gap-3">
            {enough && (
              <button
                onClick={() => onApply(Math.round(measured))}
                className="cursor-pointer rounded-xl bg-linear-to-b from-gold-light to-gold-dark px-8 py-3 font-display text-lg text-night"
              >
                GUARDAR
              </button>
            )}
            <button
              onClick={() => {
                setResult(null)
                setRun((n) => n + 1)
              }}
              className="cursor-pointer rounded-xl border-2 border-line px-6 py-3 font-bold text-ink-soft hover:border-ink-muted"
            >
              REPETIR
            </button>
            <button
              onClick={onCancel}
              className="cursor-pointer rounded-xl border-2 border-line px-6 py-3 font-bold text-ink-soft hover:border-ink-muted"
            >
              SALIR
            </button>
          </div>
        </div>
      )}
    </>
  )
}
