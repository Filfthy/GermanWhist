# tools/build-zip.py - packs the game for itch.io: dist/germanwhist-itch.zip, index.html at the top.
# Takes the files git tracks, minus the tools, the repo's own files and the old recordings no longer used.
import os, subprocess, zipfile
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SKIP_DIRS = ("tools/", "dist/")
SKIP = {".gitignore", ".nojekyll", "card-place-2.ogg", "card-shove-2.ogg", "trick.png"}
files = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.split()
files = [f for f in files if not f.startswith(SKIP_DIRS) and f not in SKIP]
out = os.path.join(ROOT, "dist", "germanwhist-itch.zip")
os.makedirs(os.path.dirname(out), exist_ok=True)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(os.path.join(ROOT, f), f)
print(len(files), "files ->", out, os.path.getsize(out) // 1024, "KB")
