#!/usr/bin/env bash
# Subset the two faces the boot overlay needs, into a plugin-sized payload.
set -euo pipefail
SRC="/mnt/c/deepseek harness/dexui-boot/assets/fonts"
DST="/mnt/c/deepseek harness/dsh-boot-plugin/build/fonts"
mkdir -p "$DST"

# Fira Mono: printable ASCII only (the boot log is pure ASCII)
python3 -m fontTools.subset "$SRC/fira_mono.woff2" \
  --flavor=woff2 --layout-features='' --no-hinting --desubroutinize \
  --unicodes="U+0020-007E" \
  --output-file="$DST/fira-mono-ascii.woff2"

# United Sans Medium: the title is DEEPSEEK, so caps + digits + a few marks
python3 -m fontTools.subset "$SRC/united_sans_medium.woff2" \
  --flavor=woff2 --layout-features='' --no-hinting --desubroutinize \
  --unicodes="U+0020-005A,U+00B7,U+2014" \
  --output-file="$DST/united-sans-caps.woff2"

for f in "$DST"/*.woff2; do
  printf '%-26s %6s bytes\n' "$(basename "$f")" "$(stat -c%s "$f")"
done
