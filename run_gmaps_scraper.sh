#!/usr/bin/env bash
# run_gmaps_scraper.sh
# Unbuffered execution script for LeadHunter Google Maps Scraper

export PYTHONUNBUFFERED=1

DEFAULT_URL="https://www.google.com/maps/search/dine+in+restaurant+sri+lanka/@6.8607995,79.8785902,14z/data=!4m2!2m1!6e5?entry=ttu&g_ep=EgoyMDI2MDgyMy4wIKXMDSoASAFQAw%3D%3D"
RAW_URL="$1"

# Fix shell typo if 'cd main' got injected into query string
if [[ "$RAW_URL" == *"cd main"* || -z "$RAW_URL" ]]; then
    MAPS_URL="$DEFAULT_URL"
else
    MAPS_URL="$RAW_URL"
fi

OUTPUT_FILE="${2:-places_test2_campaign.json}"

echo "=================================================="
echo "🚀 LeadHunter Google Maps Scraper Launcher"
echo "📍 Target Maps URL: ${MAPS_URL}"
echo "📁 Output File    : ${OUTPUT_FILE}"
echo "=================================================="

PYTHON_BIN="/home/kasr/Storage/Study_Dir/venvs/vz_rag/bin/python3"
if [ ! -f "$PYTHON_BIN" ]; then
    PYTHON_BIN="python3"
fi

"${PYTHON_BIN}" -u full_lead_processing/main.py "${MAPS_URL}" "${OUTPUT_FILE}"
