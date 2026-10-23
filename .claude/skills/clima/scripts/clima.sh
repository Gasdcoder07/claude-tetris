#!/usr/bin/env bash
# Consulta el clima usando Open-Meteo (sin API key).
# Uso: clima.sh [ciudad] [--dias N] [--json]
set -euo pipefail

CIUDAD=""
DIAS=3
MODO_JSON=0

while [ $# -gt 0 ]; do
  case "$1" in
    --dias) DIAS="${2:-3}"; shift 2 ;;
    --json) MODO_JSON=1; shift ;;
    -h|--help) sed -n '2,4p' "$0"; exit 0 ;;
    *) CIUDAD="${CIUDAD:+$CIUDAD }$1"; shift ;;
  esac
done

[ -z "$CIUDAD" ] && CIUDAD="${CLIMA_CIUDAD:-}"

fallar() { echo "Error: $1" >&2; exit 1; }

if [ -n "$CIUDAD" ]; then
  # Geocodificacion por nombre de ciudad.
  GEO=$(curl -sf --max-time 15 --get \
    --data-urlencode "name=$CIUDAD" \
    --data "count=1&language=es&format=json" \
    "https://geocoding-api.open-meteo.com/v1/search") \
    || fallar "no se pudo contactar el servicio de geocodificacion (revisa tu conexion)."
  LAT=$(echo "$GEO" | jq -r '.results[0].latitude // empty')
  LON=$(echo "$GEO" | jq -r '.results[0].longitude // empty')
  [ -z "$LAT" ] && fallar "no se encontro la ciudad \"$CIUDAD\". Prueba con \"Ciudad, Pais\"."
  NOMBRE=$(echo "$GEO" | jq -r '[.results[0].name, .results[0].admin1, .results[0].country] | map(select(. != null)) | join(", ")')
else
  # Sin ciudad: se deduce la ubicacion a partir de la IP publica.
  IPINFO=$(curl -sf --max-time 10 "https://ipinfo.io/json") \
    || fallar "no se pudo detectar tu ubicacion. Pasa la ciudad como argumento."
  LAT=$(echo "$IPINFO" | jq -r '.loc // empty' | cut -d, -f1)
  LON=$(echo "$IPINFO" | jq -r '.loc // empty' | cut -d, -f2)
  [ -z "$LAT" ] && fallar "la deteccion por IP no devolvio coordenadas. Pasa la ciudad como argumento."
  NOMBRE=$(echo "$IPINFO" | jq -r '[.city, .region, .country] | map(select(. != null)) | join(", ")')
fi

DATOS=$(curl -sf --max-time 20 \
  "https://api.open-meteo.com/v1/forecast?latitude=$LAT&longitude=$LON&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=$DIAS") \
  || fallar "no se pudo obtener el pronostico de Open-Meteo."

if [ "$MODO_JSON" = "1" ]; then
  echo "$DATOS" | jq --arg lugar "$NOMBRE" '. + {lugar: $lugar}'
  exit 0
fi

# Traduce el codigo WMO a texto. Agrupado por familias para no listar los 100 codigos.
descripcion() {
  case "$1" in
    0) echo "despejado" ;;
    1) echo "mayormente despejado" ;;
    2) echo "parcialmente nublado" ;;
    3) echo "nublado" ;;
    45|48) echo "niebla" ;;
    51|53|55) echo "llovizna" ;;
    56|57) echo "llovizna helada" ;;
    61|63|65) echo "lluvia" ;;
    66|67) echo "lluvia helada" ;;
    71|73|75|77) echo "nieve" ;;
    80|81|82) echo "chubascos" ;;
    85|86) echo "chubascos de nieve" ;;
    95) echo "tormenta electrica" ;;
    96|99) echo "tormenta con granizo" ;;
    *) echo "condicion desconocida ($1)" ;;
  esac
}

read -r HORA TEMP SENS HUM PREC VIENTO CODIGO <<<"$(echo "$DATOS" | jq -r '.current | [.time, .temperature_2m, .apparent_temperature, .relative_humidity_2m, .precipitation, .wind_speed_10m, .weather_code] | @tsv')"

echo "$NOMBRE — $(descripcion "$CODIGO")"
echo "Temperatura: ${TEMP}°C (sensacion ${SENS}°C)"
echo "Humedad: ${HUM}%  ·  Viento: ${VIENTO} km/h  ·  Precipitacion: ${PREC} mm"
echo "Actualizado: ${HORA/T/ } (hora local)"
echo
echo "Pronostico:"
echo "$DATOS" | jq -r '.daily | [.time, .temperature_2m_min, .temperature_2m_max, .precipitation_probability_max, .weather_code] | transpose[] | @tsv' |
while IFS=$'\t' read -r FECHA MIN MAX PROB COD; do
  printf '  %s  %s°C a %s°C  ·  lluvia %s%%  ·  %s\n' "$FECHA" "$MIN" "$MAX" "${PROB:-0}" "$(descripcion "$COD")"
done
