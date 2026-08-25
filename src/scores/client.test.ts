import { describe, expect, it } from 'vitest'

import { bestOf, modeKey, newEntryAt, type ModeChoice, type ScoreEntry } from './client'

const choice = (over: Partial<ModeChoice> = {}): ModeChoice => ({
  sequenceType: 'arrows',
  language: 'es',
  rhythmMode: 'arcade',
  speed: 'normal',
  songId: null,
  ...over,
})

describe('modeKey', () => {
  it('separa arcade de canción', () => {
    // Un puntaje de arcade infinito no puede competir contra uno de dos
    // minutos: si comparten tabla, arcade la gana siempre y el top 5 no sirve.
    expect(modeKey(choice({ rhythmMode: 'arcade' }))).not.toBe(
      modeKey(choice({ rhythmMode: 'song' })),
    )
  })

  it('separa por velocidad, que cambia la dificultad', () => {
    expect(modeKey(choice({ rhythmMode: 'song', speed: 'calma' }))).not.toBe(
      modeKey(choice({ rhythmMode: 'song', speed: 'extremo' })),
    )
  })

  it('separa por idioma: tipear en español y en inglés no cuesta igual', () => {
    expect(modeKey(choice({ sequenceType: 'words', language: 'es' }))).not.toBe(
      modeKey(choice({ sequenceType: 'words', language: 'en' })),
    )
  })

  it('ignora la velocidad en arcade, donde no se elige', () => {
    expect(modeKey(choice({ speed: 'calma' }))).toBe(modeKey(choice({ speed: 'extremo' })))
  })

  it('ignora el idioma con flechas, donde no se usa', () => {
    expect(modeKey(choice({ language: 'es' }))).toBe(modeKey(choice({ language: 'en' })))
  })

  it('da una tabla por canción: dos canciones no se comparan', () => {
    // Duran distinto y tienen otro tempo. Un top 5 compartido lo gana la
    // canción más larga, que es la que más rondas deja jugar.
    expect(modeKey(choice({ rhythmMode: 'song', songId: 'dQw4w9WgXcQ' }))).not.toBe(
      modeKey(choice({ rhythmMode: 'song', songId: 'kJQP7kiw5Fk' })),
    )
  })

  it('una canción real no cae en la tabla de la simulada', () => {
    // Este era el bug: al elegir una canción, `speed` seguía valiendo lo que
    // hubiera quedado en el menú, así que TODAS las canciones reales caían en
    // la tabla del chiptune de ese preset.
    expect(modeKey(choice({ rhythmMode: 'song', songId: 'dQw4w9WgXcQ' }))).not.toBe(
      modeKey(choice({ rhythmMode: 'song', songId: null })),
    )
  })

  it('con una canción real el preset ya no entra en la clave', () => {
    // El control de BPM ni se muestra: el tempo sale de la canción.
    expect(modeKey(choice({ rhythmMode: 'song', songId: 'abc', speed: 'calma' }))).toBe(
      modeKey(choice({ rhythmMode: 'song', songId: 'abc', speed: 'extremo' })),
    )
  })

  it('ignora la canción en arcade, donde no suena ninguna', () => {
    expect(modeKey(choice({ songId: 'abc' }))).toBe(modeKey(choice({ songId: null })))
  })

  it('produce claves legibles', () => {
    expect(modeKey(choice())).toBe('arrows/arcade')
    expect(
      modeKey(
        choice({ sequenceType: 'words', language: 'en', rhythmMode: 'song', speed: 'rapido' }),
      ),
    ).toBe('words-en/song-rapido')
    // Separador distinto al del preset a propósito: un id de video no puede
    // colisionar con `song-calma` ni con ninguno de los otros.
    expect(modeKey(choice({ rhythmMode: 'song', songId: 'dQw4w9WgXcQ' }))).toBe(
      'arrows/song:dQw4w9WgXcQ',
    )
  })
})

describe('bestOf', () => {
  const entry = (score: number): ScoreEntry => ({
    name: 'X',
    score,
    maxCombo: 0,
    mode: 'arrows/arcade',
    at: score,
  })

  it('devuelve la primera entrada, que el backend ya dejó ordenada', () => {
    expect(bestOf([entry(500), entry(300), entry(100)])?.score).toBe(500)
  })

  it('una tabla vacía no tiene mejor puntaje', () => {
    // No es un error: es lo que hay que mostrar en una canción sin jugar.
    expect(bestOf([])).toBeNull()
  })
})

describe('newEntryAt', () => {
  const entry = (at: number, score: number): ScoreEntry => ({
    name: 'X',
    score,
    maxCombo: 0,
    mode: 'arrows/arcade',
    at,
  })

  it('encuentra la entrada recién guardada', () => {
    const antes = [entry(10, 500), entry(20, 300)]
    const despues = [entry(10, 500), entry(99, 400), entry(20, 300)]

    expect(newEntryAt(antes, despues)).toBe(99)
  })

  it('devuelve null cuando el puntaje no entró al top', () => {
    // No es un error: es la respuesta que hay que mostrarle al jugador.
    const tabla = [entry(10, 500), entry(20, 300)]
    expect(newEntryAt(tabla, tabla)).toBeNull()
  })

  it('estrena una tabla vacía', () => {
    expect(newEntryAt([], [entry(7, 100)])).toBe(7)
  })

  it('no se confunde con dos entradas del mismo nombre y puntaje', () => {
    // La identidad es el `at`, que lo pone el backend. Comparar por nombre y
    // puntaje marcaría la vieja cuando alguien repite exactamente su marca.
    const antes = [entry(10, 500)]
    const despues = [entry(10, 500), entry(11, 500)]

    expect(newEntryAt(antes, despues)).toBe(11)
  })
})
