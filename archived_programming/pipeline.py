"""
pipeline.py
───────────
Runs the full scraping pipeline end-to-end:
  Step 1: parse_restaurants.py  → raw text  → parsed JSON
  Step 2: enrich_restaurants.py → parsed JSON → enriched JSON (+ contacts)

Usage:
  python3 pipeline.py raw_data.txt
  python3 pipeline.py raw_data.txt final_output.json
"""

import sys
import subprocess
from pathlib import Path

def run(script, args):
    cmd = ['python3', script] + args
    print(f"\n{'═'*55}")
    print(f"  Running: {' '.join(cmd)}")
    print(f"{'═'*55}\n")
    result = subprocess.run(cmd, check=True)
    return result

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 pipeline.py <raw_data.txt> [final_output.json]")
        sys.exit(1)

    raw_file    = sys.argv[1]
    final_file  = sys.argv[2] if len(sys.argv) > 2 else 'final_leads.json'
    parsed_file = '_parsed_temp.json'

    print(f"\n🚀 Starting pipeline")
    print(f"   Input  : {raw_file}")
    print(f"   Output : {final_file}\n")

    # Step 1 — Parse
    run('parse_restaurants.py', [raw_file, parsed_file])

    # Step 2 — Enrich
    run('enrich_restaurants.py', [parsed_file, final_file])

    # Clean up temp file
    Path(parsed_file).unlink(missing_ok=True)

    print(f"\n🎯 Pipeline complete → {final_file}")
