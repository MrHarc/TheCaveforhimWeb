#!/bin/zsh
# The Cave — image derivation pipeline (resolution-agnostic).
# Sources: first-party Wix assets + owner/AI-enhanced exports of the official
# Instagram photography. Crops are expressed as fractions of the source frame,
# so 720px interim masters and 4K enhanced masters both work unchanged —
# PROVIDED the aspect ratio of each source stays the same.
# Derives all §7b slots, then responsive AVIF/WebP/JPEG variants + a manifest.
set -e
cd "$(dirname "$0")/.."
IMG=assets/img
ff() { ffmpeg -hide_banner -loglevel error -y "$@"; }

# Light unifying grade for photography (very subtle: slight desaturation + warm midtones).
GRADE="eq=saturation=0.92,colorbalance=rm=0.025:gm=0.005:bm=-0.02"
E="trunc(iw*%s/2)*2:trunc(ih*%s/2)*2:trunc(iw*%s/2)*2:trunc(ih*%s/2)*2"  # (unused template, kept for reference)

echo "== masters =="
# IMG-HERO 16:9 band from the interior frame (source aspect 9:16)
# scale floor 1600 keeps the desktop hero usable while the master is still the
# 720px interim export; a 4K enhanced master caps at 2000 instead.
ff -i $IMG/ig_DCPO5U6M1sN.jpg -vf "crop=trunc(iw/2)*2:trunc(ih*405/1280/2)*2:0:trunc(ih*430/1280/2)*2,$GRADE,scale='max(min(iw,2000),1600)':-2:flags=lanczos,unsharp=5:5:0.25:5:5:0.0" -q:v 2 $IMG/cave-hero.jpg
# IMG-HERO-MOBILE 4:5
ff -i $IMG/ig_DCPO5U6M1sN.jpg -vf "crop=trunc(iw/2)*2:trunc(ih*900/1280/2)*2:0:trunc(ih*330/1280/2)*2,$GRADE,scale='min(iw,1440)':-2:flags=lanczos" -q:v 2 $IMG/cave-hero-mobile.jpg
# IMG-SVC-CUT 3:4 — skin fade profile (full frame)
ff -i $IMG/ig_DXYl5lyDNCD.jpg -vf "$GRADE,scale='min(iw,1440)':-2:flags=lanczos" -q:v 2 $IMG/svc-cut.jpg
# IMG-SVC-BEARD 3:4 — tight jaw/beard crop (fractions of 720x960 framing)
ff -i $IMG/ig_DVbU0tXjA6b.jpg -vf "crop=trunc(iw*0.75/2)*2:trunc(ih*0.75/2)*2:trunc(iw*0.25/2)*2:trunc(ih*0.225/2)*2,$GRADE,scale='min(iw,1080)':-2:flags=lanczos" -q:v 2 $IMG/svc-beard.jpg
# IMG-SVC-SHAVE 3:4 — razor poster, watermark region cropped out (fractions of 512x640)
ff -i $IMG/video-poster.jpg -vf "crop=trunc(iw*0.78125/2)*2:trunc(ih*0.8328125/2)*2:trunc(iw*0.109375/2)*2:0,$GRADE,scale='min(iw,1200)':-2:flags=lanczos" -q:v 2 $IMG/svc-shave.jpg
# IMG-SVC-COMBO 3:4 — cut and beard in one sitting (source aspect 9:16, crop
# keeps the signage, the finished fade and the beard line in one frame)
ff -i $IMG/svc-combo-src.jpg -vf "crop=trunc(iw/2)*2:trunc(iw*4/3/2)*2:0:trunc(ih*0.18/2)*2,$GRADE,scale='min(iw,1080)':-2:flags=lanczos" -q:v 2 $IMG/svc-combo.jpg
# IMG-SVC-DETAIL 3:4 — nape/neckline crop
ff -i $IMG/ig_DXbLr1GjFh6.jpg -vf "crop=trunc(iw*0.75/2)*2:trunc(ih*0.75/2)*2:trunc(iw*0.1666667/2)*2:trunc(ih*0.225/2)*2,$GRADE,scale='min(iw,1080)':-2:flags=lanczos" -q:v 2 $IMG/svc-detail.jpg
# IMG-EXP-01 4:5 — the chair before the cut (source aspect 3:4; crop tightens
# onto the three of them and drops the empty sky above)
ff -i $IMG/exp-consult-src.jpg -vf "crop=trunc(iw*0.78125/2)*2:trunc(iw*0.9765625/2)*2:trunc(iw*0.18229/2)*2:trunc(ih*0.26758/2)*2,$GRADE,scale='min(iw,1440)':-2:flags=lanczos" -q:v 2 $IMG/experience-consult.jpg
# IMG-EXP-02 3:2 — the room, chairs band
ff -i $IMG/ig_DCPO5U6M1sN.jpg -vf "crop=trunc(iw/2)*2:trunc(ih*480/1280/2)*2:0:trunc(ih*460/1280/2)*2,$GRADE,scale='min(iw,1440)':-2:flags=lanczos" -q:v 2 $IMG/experience-room.jpg
# IMG-BREAK 21:9 — storefront/mural band (static 2050x780 first-party source)
ff -i $IMG/brand-shop.png -vf "crop=1820:780:230:0" -q:v 3 $IMG/visual-break.jpg
# IMG-STOREFRONT 3:2 — directional sign side
ff -i $IMG/brand-shop.png -vf "crop=1170:780:0:0" -q:v 3 $IMG/storefront.jpg
# THE WORK 01–05 (full frames); 06 has no unique source yet -> placeholder in HTML
ff -i $IMG/ig_DXYl5lyDNCD.jpg -vf "$GRADE,scale='min(iw,1440)':-2:flags=lanczos" -q:v 2 $IMG/work-01.jpg
ff -i $IMG/ig_DVbU0tXjA6b.jpg -vf "$GRADE,scale='min(iw,1440)':-2:flags=lanczos" -q:v 2 $IMG/work-02.jpg
ff -i $IMG/ig_DWHkomCDPGq.jpg -vf "$GRADE,scale='min(iw,1440)':-2:flags=lanczos" -q:v 2 $IMG/work-03.jpg
ff -i $IMG/ig_DVftsnsjG00.jpg -vf "$GRADE,scale='min(iw,1440)':-2:flags=lanczos" -q:v 2 $IMG/work-04.jpg
ff -i $IMG/ig_DXbLr1GjFh6.jpg -vf "$GRADE,scale='min(iw,1440)':-2:flags=lanczos" -q:v 2 $IMG/work-05.jpg
# WORK-06 — carousel sibling photo from the verified account (back angle of the textured crop)
ff -i $IMG/ig_DVbUyRGjHqr.jpg -vf "$GRADE,scale='min(iw,1440)':-2:flags=lanczos" -q:v 2 $IMG/work-06.jpg

echo "== og image =="
if [ -f $IMG/og-source.jpg ]; then
  # Glow frame from the ink-sketch hero film — already carries the brand lettering.
  ff -i $IMG/og-source.jpg -vf "scale=1200:675:flags=lanczos,crop=1200:630:0:22" -q:v 3 $IMG/og-image.jpg
else
  ff -i $IMG/cave-hero.jpg -i $IMG/logo.png -filter_complex "[0:v]scale=1200:675:flags=lanczos,crop=1200:630:0:22,eq=brightness=-0.28:saturation=0.85[bg];[1:v]scale=560:-1[lg];[bg][lg]overlay=(W-w)/2:(H-h)/2-14" -q:v 3 $IMG/og-image.jpg
fi

echo "== favicons =="
sips -z 32 32 $IMG/favicon-src.png --out $IMG/favicon-32.png >/dev/null
sips -z 192 192 $IMG/favicon-src.png --out $IMG/favicon-192.png >/dev/null
sips -z 180 180 $IMG/favicon-src.png --out $IMG/apple-touch-icon.png >/dev/null

echo "== ambient video (desktop only, muted, <3MB, watermark cropped, 20s loop) =="
ff -ss 4 -t 20 -i assets/video/cave-ambient.mp4 -vf "crop=400:532:56:0,scale=480:638:flags=lanczos" -an -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -movflags +faststart assets/video/cave-ambient-web.mp4

echo "== responsive variants =="
python3 - << 'PYEOF'
import subprocess, os, json
IMG = "assets/img"
# slot -> candidate widths; only widths <= the master's width are emitted,
# so low-res interim masters and 4K enhanced masters use the same plan.
plan = {
  "cave-hero":        [480, 768, 1200, 1600, 2000],
  "cave-hero-mobile": [480, 720, 1080, 1440],
  "svc-cut":          [480, 720, 1080, 1440],
  "svc-beard":        [480, 540, 810, 1080],
  "svc-shave":        [400, 800, 1200],
  "svc-detail":       [480, 540, 810, 1080],
  "svc-combo":        [480, 540, 810, 1080],
  "experience-room":  [480, 720, 1080, 1440],
  "experience-consult": [480, 720, 1080, 1440],
  "visual-break":     [768, 1200, 1820],
  "storefront":       [480, 768, 1170],
  "work-01":          [480, 720, 1080, 1440],
  "work-02":          [480, 720, 1080, 1440],
  "work-03":          [480, 720, 1080, 1440],
  "work-04":          [480, 720, 1080, 1440],
  "work-05":          [480, 720, 1080, 1440],
  "work-06":          [480, 720, 1080, 1440],
}
manifest = {}
def dims(p):
    out = subprocess.run(["sips","-g","pixelWidth","-g","pixelHeight",p],capture_output=True,text=True).stdout
    w = int(out.split("pixelWidth:")[1].split()[0]); h = int(out.split("pixelHeight:")[1].split()[0])
    return w,h
for slot, widths in plan.items():
    src = f"{IMG}/{slot}.jpg"
    if not os.path.exists(src): print("MISSING", src); continue
    W,H = dims(src)
    emitted = []
    for w in widths:
        if w > W: continue
        h = round(H * w / W / 2) * 2
        base = f"{IMG}/{slot}-{w}"
        subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",src,"-vf",f"scale={w}:{h}:flags=lanczos",
                        "-c:v","libaom-av1","-still-picture","1","-crf","34","-b:v","0","-cpu-used","7",f"{base}.avif"],check=True)
        subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",src,"-vf",f"scale={w}:{h}:flags=lanczos",
                        "-c:v","libwebp","-q:v","78",f"{base}.webp"],check=True)
        subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",src,"-vf",f"scale={w}:{h}:flags=lanczos",
                        "-q:v","4",f"{base}.jpg"],check=True)
        emitted.append({"w":w,"h":h})
    manifest[slot] = {"master_w":W,"master_h":H,"widths":emitted}
json.dump(manifest, open("data/images.json","w"), indent=1)
print("manifest ->", "data/images.json")
PYEOF
echo "DONE"
