"""Render FOLD's exported SVG pages as a vector PDF; no separate net layout logic."""
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from reportlab.lib.colors import toColor
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

folder = Path(sys.argv[1] if len(sys.argv) > 1 else '../outputs/gundam-head')
output = Path(sys.argv[2] if len(sys.argv) > 2 else '../output/pdf/gundam-head.pdf')
font = Path(sys.argv[3] if len(sys.argv) > 3 else '/System/Library/Fonts/Supplemental/Arial Unicode.ttf')
if not font.exists():
    raise SystemExit('Supply a Japanese TrueType font as argument 3.')
pdfmetrics.registerFont(TTFont('CraftJapanese', str(font)))
net = json.loads((folder / 'net.json').read_text())
width, height = net['width'], net['height']
output.parent.mkdir(parents=True, exist_ok=True)
c = canvas.Canvas(str(output), pagesize=(width * mm, height * mm))
c.setTitle('FOLD - full-size nets')
c.setAuthor('FOLD Studio')

for page in range(net['pages']):
    root = ET.parse(folder / f'net-{page + 1}.svg').getroot()
    for element in root:
        tag = element.tag.rsplit('}', 1)[-1]
        a = element.attrib
        if tag == 'rect':
            continue  # PDF paper is already white.
        if tag == 'polygon':
            points = [tuple(map(float, p.split(','))) for p in a['points'].split()]
            path = c.beginPath()
            path.moveTo(points[0][0] * mm, (height - points[0][1]) * mm)
            for x, y in points[1:]:
                path.lineTo(x * mm, (height - y) * mm)
            path.close()
            c.setFillColor(toColor(a['fill']))
            c.drawPath(path, fill=1, stroke=0)
        elif tag == 'line':
            c.setStrokeColor(toColor(a['stroke']))
            c.setLineWidth(float(a['stroke-width']) * mm)
            c.setLineCap(1)
            c.line(float(a['x1']) * mm, (height - float(a['y1'])) * mm,
                   float(a['x2']) * mm, (height - float(a['y2'])) * mm)
        elif tag == 'text':
            c.setFillColor(toColor(a['fill']))
            c.setFont('CraftJapanese', float(a['font-size']) * mm)
            draw = {'middle': c.drawCentredString, 'end': c.drawRightString}.get(a.get('text-anchor'), c.drawString)
            draw(float(a['x']) * mm, (height - float(a['y'])) * mm, element.text or '')
        else:
            raise ValueError(f'Unsupported SVG element: {tag}')
    c.showPage()
c.save()
print(output.resolve())
