---
name: clima
description: Consulta el clima actual y el pronóstico de los próximos días desde la terminal, sin API key, usando Open-Meteo. Úsala siempre que el usuario pregunte por el clima, el tiempo, la temperatura, si va a llover, cuánto calor o frío hace, el pronóstico de hoy o de la semana — ya sea de su ciudad (detectada automáticamente por IP) o de cualquier otra que nombre. Úsala aunque la pregunta sea casual ("¿cómo está el clima?", "¿hace frío afuera?", "¿llueve mañana en CDMX?") y aunque parezca que podrías responder de memoria: los datos meteorológicos cambian cada hora y tu entrenamiento no los tiene.
---

# Clima

Esta skill obtiene datos meteorológicos reales ejecutando un script local. No inventes
temperaturas ni pronósticos: si el script falla, dilo y explica por qué, porque un dato
de clima equivocado es peor que ninguno.

## Cómo consultarlo

```bash
.claude/skills/clima/scripts/clima.sh                        # ciudad detectada por IP
.claude/skills/clima/scripts/clima.sh "Guadalajara, Mexico"  # ciudad específica
.claude/skills/clima/scripts/clima.sh "Madrid" --dias 7      # pronóstico extendido (1–16)
.claude/skills/clima/scripts/clima.sh --json                 # JSON crudo de Open-Meteo
```

Sin argumento, el script deduce la ubicación a partir de la IP pública (`ipinfo.io`).
Eso acierta la ciudad en la mayoría de los casos, pero con VPN puede fallar: si el lugar
que imprime no cuadra con lo que el usuario espera, pásale la ciudad explícitamente.

Para fijar una ciudad por defecto sin escribirla cada vez, exporta `CLIMA_CIUDAD`:

```bash
export CLIMA_CIUDAD="Colima, Mexico"
```

El argumento de la línea de comandos siempre gana sobre `CLIMA_CIUDAD`.

## Cómo responder

La salida del script ya viene en español y legible. Preséntala tal cual o resúmela según
lo que preguntó el usuario — el criterio es contestar la pregunta hecha, no volcar todo:

- "¿qué temperatura hace?" → una línea: lugar, temperatura, sensación térmica y condición.
- "¿me llevo paraguas?" → la probabilidad de lluvia de hoy y la condición, con una
  recomendación directa.
- "¿cómo está la semana?" → el bloque de pronóstico, con `--dias 7`.

Menciona la hora de actualización solo si el usuario pregunta por datos muy recientes o si
los datos tienen más de una hora.

Usa `--json` cuando necesites un campo que la salida de texto no imprime (presión, ráfagas,
datos por hora) y construye tú la respuesta a partir del JSON. Los parámetros disponibles
están documentados en <https://open-meteo.com/en/docs>.

## Detalles que importan

- **Sin API key ni cuenta.** Open-Meteo es gratuito para uso no comercial y la
  geocodificación viene del mismo proveedor, así que no hay nada que configurar.
- **Requiere internet.** Si no hay red, el script falla con un mensaje claro y código de
  salida 1. No reintentes en bucle; reporta el fallo.
- **Dependencias:** `curl` y `jq`, ambos ya presentes en macOS moderno. Si falta `jq`,
  instálalo con `brew install jq`.
- **Unidades:** grados Celsius, km/h y milímetros. Para °F, agrega
  `&temperature_unit=fahrenheit` a la URL del script.
- **Ciudades ambiguas:** la geocodificación toma la primera coincidencia, así que
  "Córdoba" puede caer en España o Argentina. Incluye el país cuando haya duda.
