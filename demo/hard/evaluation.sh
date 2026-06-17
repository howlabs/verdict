#!/usr/bin/env bash
# docs.md §5② — bash + exit code verifier (visible tests)
set -euo pipefail
cd "$(dirname "$0")"
python3 -m pytest tests/ -q