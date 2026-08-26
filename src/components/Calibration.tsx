import { MAX_OFFSET_MS, OFFSET_STEP_MS, type Settings } from '../settings/client'

type Props = {
  settings: Settings
  onChange: (offsetMs: number) => void
  /** Abre la medición, que es el camino recomendado. */
  onMeasure: () => void
  /** Por qué no se pudo guardar. Sin esto, el control no responde y no explica nada. */
  error?: string | null
}

/**
 * Ajuste de latencia.
 *
 * Es una perilla sola porque el problema es uno solo visto desde el jugador:
 * lo que percibe llega después de lo que el reloj agendó. De dónde salen esos
 * milisegundos —el buffer de la placa, el Bluetooth, la pantalla, el teclado—
 * no le sirve de nada saberlo, y separarlos pediría medir cada uno.
 *
 * El número que hay que poner acá lo dice la pantalla de resultados: si termina
 * diciendo "+40ms, presionas DESPUÉS", el ajuste es 40.
 */
export function Calibration({ settings, onChange, onMeasure, error = null }: Props) {
  const { offsetMs } = settings
  const move = (delta: number) =>
    onChange(Math.max(-MAX_OFFSET_MS, Math.min(MAX_OFFSET_MS, offsetMs + delta)))

  return (
    <div className="flex w-[min(420px,86vw)] flex-col gap-4 text-left">
      <p className="text-[13px] leading-relaxed text-ink-soft">
        Entre que el juego agenda un sonido y lo escuchás pasa un rato. Con auriculares
        Bluetooth son cientos de milisegundos. Como reaccionás a lo que percibís, confirmás
        tarde <b className="text-ink">siempre</b>, y el juego te lo cobra.
      </p>

      <button
        onClick={onMeasure}
        className="cursor-pointer rounded-xl bg-linear-to-b from-magenta-light to-magenta-dark px-8 py-3 font-display text-lg text-white"
      >
        MEDIRLO
      </button>

      <p className="text-[12px] leading-relaxed text-ink-muted">
        Diez pasadas de la barra, sin nada que tipear: solo confirmás en la zona. Sacar la
        secuencia es lo que hace que el número sirva — jugando, lo que tardás en terminar de
        escribir entra al promedio como si fuera latencia, y no lo es.
      </p>

      <div className="h-px bg-line-card" />

      <span className="text-[11px] font-bold tracking-[3px] text-ink-muted">A MANO</span>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => move(-OFFSET_STEP_MS)}
          disabled={offsetMs <= -MAX_OFFSET_MS}
          aria-label={`Restar ${OFFSET_STEP_MS} milisegundos`}
          className="cursor-pointer rounded-lg border-2 border-line px-4 py-2 font-bold text-ink-muted hover:border-cyan hover:text-cyan disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>

        <div className="flex min-w-[130px] flex-col items-center">
          <span className="font-display text-3xl text-cyan">
            {offsetMs > 0 ? '+' : ''}
            {offsetMs}
            <span className="text-lg"> ms</span>
          </span>
          <span className="text-[11px] font-bold tracking-[3px] text-ink-muted">AJUSTE</span>
        </div>

        <button
          onClick={() => move(OFFSET_STEP_MS)}
          disabled={offsetMs >= MAX_OFFSET_MS}
          aria-label={`Sumar ${OFFSET_STEP_MS} milisegundos`}
          className="cursor-pointer rounded-lg border-2 border-line px-4 py-2 font-bold text-ink-muted hover:border-cyan hover:text-cyan disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </div>

      {/*
        El desvío que reporta el resultado ya viene **corregido** por el ajuste
        vigente, así que se SUMA, no se reemplaza. Decir "poné el número que te
        muestra" es correcto la primera vez y falso todas las siguientes: con
        +40 puesto y un desvío de +10, lo que hay que dejar es 50, no 10.
      */}
      <p className="text-[12px] leading-relaxed text-ink-muted">
        {offsetMs === 0 ? (
          <>Sin ajuste. Nada cambia respecto de cómo venías jugando.</>
        ) : (
          <>
            El <b>desvío medio</b> que muestra el resultado de una partida viene{' '}
            <b className="text-ink">ya corregido</b> por estos {offsetMs > 0 ? '+' : ''}
            {offsetMs}ms, así que para afinar hay que <b className="text-ink">sumárselo</b> a este
            valor, no reemplazarlo. Si te da cerca de cero, quedó bien.
          </>
        )}
      </p>

      {error !== null && <p className="text-[13px] text-red">No se pudo guardar: {error}</p>}

      <div className="flex justify-end">
        <button
          onClick={() => onChange(0)}
          disabled={offsetMs === 0}
          className="cursor-pointer rounded-lg px-3 py-1.5 text-[13px] text-ink-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          Volver a cero
        </button>
      </div>
    </div>
  )
}
