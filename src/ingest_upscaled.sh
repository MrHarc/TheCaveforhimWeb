#!/bin/zsh
# Ingest AI-enhanced masters from upscale_batch/upscaled/ back into the site.
# Accepts png/jpg/jpeg/webp with the same numbered names as the batch folder.
# Then re-derives every crop + srcset and rebuilds the HTML.
set -e
cd "$(dirname "$0")/.."
UP=upscale_batch/upscaled
typeset -A MAP
MAP=(
  01-hero-interior      ig_DCPO5U6M1sN.jpg
  02-skin-fade-profile  ig_DXYl5lyDNCD.jpg
  03-scissor-crop-back  ig_DXbLr1GjFh6.jpg
  04-textured-fringe    ig_DWHkomCDPGq.jpg
  05-curls-taper        ig_DVftsnsjG00.jpg
  06-textured-crop-beard ig_DVbU0tXjA6b.jpg
  07-razor-shave        video-poster.jpg
  08-crop-back          ig_DVbUyRGjHqr.jpg
)
found=0
for key target in ${(kv)MAP}; do
  src=""
  for ext in png jpg jpeg webp; do
    [ -f "$UP/$key.$ext" ] && src="$UP/$key.$ext" && break
  done
  if [ -z "$src" ]; then
    echo "  skip  $key (no file in $UP)"
    continue
  fi
  # Sanity: warn if the enhanced file is not actually bigger than the current master.
  cur_w=$(sips -g pixelWidth "assets/img/$target" | awk '/pixelWidth/{print $2}')
  new_w=$(sips -g pixelWidth "$src" | awk '/pixelWidth/{print $2}')
  if [ "$new_w" -le "$cur_w" ]; then
    echo "  WARN  $key: new width $new_w <= current $cur_w — ingesting anyway"
  fi
  ffmpeg -hide_banner -loglevel error -y -i "$src" -q:v 1 "assets/img/$target"
  echo "  ok    $key ($new_w px) -> assets/img/$target"
  found=$((found+1))
done
if [ "$found" -eq 0 ]; then
  echo "Nothing to ingest. Put enhanced images into $UP first."
  exit 1
fi
echo "== re-deriving crops + srcsets =="
./src/process-images.sh
echo "== rebuilding site =="
python3 src/build.py
echo "INGEST DONE ($found masters replaced). Reload http://localhost:4780 and eyeball:"
echo "  - cape logo text in the hero/interior (AI can garble blackletter)"
echo "  - faces/moles unchanged in every cut photo"
echo "  - razor scene still dark and moody"
