"""Static preview helper (dev only): strips SMIL so cairosvg renders faithfully."""
import re, sys, cairosvg, pathlib
src = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2]); scale = float(sys.argv[3]) if len(sys.argv) > 3 else 1
t = src.read_text()
t = re.sub(r'<animate(Transform)?\b[^>]*/>', '', t)
t = re.sub(r'<animate(Transform)?\b[^>]*>.*?</animate(Transform)?>', '', t, flags=re.S)
cairosvg.svg2png(bytestring=t.encode(), write_to=str(out), scale=scale)
