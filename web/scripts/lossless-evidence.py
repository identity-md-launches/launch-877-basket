"""Encode a browser PNG as lossless WebP and prove exact decoded RGBA equality.

Walk-only prerequisite: Python 3 with Pillow; no production or npm dependency.
"""
import hashlib
import json
import pathlib
import sys
from PIL import Image

source, destination = map(pathlib.Path, sys.argv[1:])
with Image.open(source) as original:
    assert original.format == "PNG", "Expected the untouched browser PNG"
    rgba = original.convert("RGBA")
    original.save(destination, format="WEBP", lossless=True, method=6, exact=True)
    with Image.open(destination) as encoded:
        assert encoded.format == "WEBP", "Expected WebP output"
        assert encoded.size == original.size, "Screenshot dimensions changed"
        assert encoded.convert("RGBA").tobytes() == rgba.tobytes(), "Screenshot pixels changed"
        assert encoded.info.get("icc_profile") == original.info.get("icc_profile"), "Color profile changed"
    print(json.dumps({"width": rgba.width, "height": rgba.height,
                      "rgbaSha256": hashlib.sha256(rgba.tobytes()).hexdigest(),
                      "pngSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                      "webpSha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
                      "pngBytes": source.stat().st_size, "webpBytes": destination.stat().st_size}))
