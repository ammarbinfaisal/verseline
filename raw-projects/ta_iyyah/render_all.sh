#!/bin/bash
set -e

cd "$(dirname "$0")"
mkdir -p final

VERSELINE=~/Documents/codes/verseline/verseline
CONCAT=final/concat.txt

> "$CONCAT"

for i in $(seq 1 7); do
  part=$(printf "part_%02d" "$i")
  out="final/${part}.mp4"
  echo "=== Rendering $part ==="
  "$VERSELINE" render "parts/${part}/project.json" -o "$out"
  echo "file '${part}.mp4'" >> "$CONCAT"
done

echo "=== Merging ==="
ffmpeg -y -f concat -safe 0 -i "$CONCAT" -c copy final/full_v1.mp4

echo "=== Done: final/full_v2.mp4 ==="
