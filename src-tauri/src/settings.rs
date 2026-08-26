//! Ajustes de la app.
//!
//! Hoy hay uno solo: la calibración de latencia. Vive aparte del ranking y de
//! la biblioteca porque no es contenido del jugador sino **una propiedad de la
//! máquina**: el mismo equipo con los mismos auriculares necesita el mismo
//! número para cualquier canción y cualquier modo.
//!
//! Dominio puro más lectura/escritura. Los comandos de Tauri solo delegan aquí.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::jsonstore::StoreError;

/// Versión del esquema. Va desde el día uno: migrar después sale mucho más caro.
pub const SCHEMA_VERSION: u32 = 1;

/// Tope del ajuste, en milisegundos, para los dos lados.
///
/// 300 no es un número redondo elegido al azar: unos auriculares Bluetooth con
/// un códec lento se acercan a eso. Más que eso ya no es latencia, es un valor
/// mal puesto, y dejar entrar un ajuste de varios segundos convierte el juego
/// en algo imposible de jugar sin ninguna pista de por qué.
pub const MAX_OFFSET_MS: i32 = 300;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub version: u32,
    /// Cuánto se le resta a la confirmación del jugador antes de juzgarla.
    /// Positivo es el caso normal: se percibe tarde y se confirma tarde.
    pub offset_ms: i32,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            version: SCHEMA_VERSION,
            // Cero y no un valor adivinado del sistema: un ajuste automático
            // equivocado es peor que ninguno, porque el jugador no tiene forma
            // de saber que el juego le está corriendo el momento de confirmar.
            offset_ms: 0,
        }
    }
}

pub fn clamp_offset(ms: i32) -> i32 {
    ms.clamp(-MAX_OFFSET_MS, MAX_OFFSET_MS)
}

pub fn settings_path(data_dir: &Path) -> PathBuf {
    data_dir.join("settings.json")
}

/// Lee los ajustes del disco. La atomicidad y el respaldo de corruptos viven en
/// `jsonstore`, compartidos con el ranking y la biblioteca.
///
/// Se recorta **al leer** y no solo al escribir: el archivo está en el disco del
/// usuario y se puede editar a mano, así que lo que viene de ahí es entrada no
/// confiable igual que cualquier otra.
pub fn read(path: &Path) -> Result<Settings, StoreError> {
    let stored: Settings = crate::jsonstore::read_or_default(path)?;
    Ok(Settings {
        offset_ms: clamp_offset(stored.offset_ms),
        ..stored
    })
}

/// Guarda los ajustes y devuelve lo que quedó guardado de verdad.
///
/// Devuelve el valor recortado en vez de `()` para que el frontend muestre lo
/// que hay en el disco y no lo que pidió: si pidió 900 y se guardó 300, la
/// pantalla tiene que decir 300.
pub fn write(path: &Path, settings: &Settings) -> Result<Settings, StoreError> {
    let saved = Settings {
        version: SCHEMA_VERSION,
        offset_ms: clamp_offset(settings.offset_ms),
    };
    crate::jsonstore::write_atomic(path, &saved)?;
    Ok(saved)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    fn tmp_dir(nombre: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("sxt-settings-{nombre}"));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn arranca_sin_ajuste() {
        let dir = tmp_dir("inexistente");
        let leido = read(&settings_path(&dir)).unwrap();

        assert_eq!(leido.offset_ms, 0);
        assert_eq!(leido.version, SCHEMA_VERSION);
    }

    #[test]
    fn ida_y_vuelta_por_disco() {
        let dir = tmp_dir("roundtrip");
        let path = settings_path(&dir);

        let guardado = write(
            &path,
            &Settings {
                version: SCHEMA_VERSION,
                offset_ms: 45,
            },
        )
        .unwrap();

        assert_eq!(guardado.offset_ms, 45);
        assert_eq!(read(&path).unwrap(), guardado);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn acepta_ajuste_negativo() {
        // Adelantarse es tan real como atrasarse: hay quien confirma antes por
        // costumbre, y la pantalla de resultados ya lo distingue.
        let dir = tmp_dir("negativo");
        let path = settings_path(&dir);

        assert_eq!(
            write(
                &path,
                &Settings {
                    version: SCHEMA_VERSION,
                    offset_ms: -60
                }
            )
            .unwrap()
            .offset_ms,
            -60
        );

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn recorta_al_guardar_para_los_dos_lados() {
        let dir = tmp_dir("recorta-guardar");
        let path = settings_path(&dir);

        let alto = write(
            &path,
            &Settings {
                version: SCHEMA_VERSION,
                offset_ms: 9_000,
            },
        )
        .unwrap();
        assert_eq!(alto.offset_ms, MAX_OFFSET_MS);

        let bajo = write(
            &path,
            &Settings {
                version: SCHEMA_VERSION,
                offset_ms: -9_000,
            },
        )
        .unwrap();
        assert_eq!(bajo.offset_ms, -MAX_OFFSET_MS);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn recorta_un_archivo_editado_a_mano() {
        // El archivo vive en el disco del usuario: lo que sale de ahí es entrada
        // no confiable, aunque la app sea de un solo jugador.
        let dir = tmp_dir("editado");
        fs::create_dir_all(&dir).unwrap();
        let path = settings_path(&dir);
        fs::write(&path, r#"{"version":1,"offsetMs":99999}"#).unwrap();

        assert_eq!(read(&path).unwrap().offset_ms, MAX_OFFSET_MS);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn un_archivo_corrupto_no_deja_la_app_sin_arrancar() {
        let dir = tmp_dir("corrupto");
        fs::create_dir_all(&dir).unwrap();
        let path = settings_path(&dir);
        fs::write(&path, "{ esto no es json").unwrap();

        assert_eq!(read(&path).unwrap().offset_ms, 0);
        // El original no se descarta en silencio: queda con otro nombre.
        assert!(path.with_extension("corrupt.json").exists());

        let _ = fs::remove_dir_all(&dir);
    }
}
