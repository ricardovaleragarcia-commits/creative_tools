# Fuentes — ABC Areal

En esta carpeta ya están los dos webfonts que usa el diseño:

| Archivo | Dónde se usa |
| --- | --- |
| `ABCArealSemiMono-Regular.woff2` | todo el texto de la página |
| `ABCAreal-Bold.woff2` | solo el logo "TulS" |

Son las instancias estáticas de tu licencia (`ABCArealSemiMono-Regular.ttf` y
`ABCAreal-Bold.ttf`), subconjuntadas al rango latino y comprimidas a WOFF2:

- 185 KB → 24 KB (Semi-Mono Regular)
- 195 KB → 25 KB (Areal Bold)

Cobertura del subset: Basic Latin, Latin-1 Supplement, Latin Extended-A,
puntuación general y símbolos de moneda. Si algún día escribes texto con otros
alfabetos (griego, cirílico…) hay que regenerar los `.woff2` añadiendo esos
rangos a `unicodes` en el comando de abajo.

## Regenerar

Con `fonttools` y `brotli` instalados:

```bash
python3 -m pip install fonttools brotli
python3 - <<'EOF'
from fontTools.subset import Subsetter, Options
from fontTools.ttLib import TTFont
import os

unicodes = (list(range(0x0020, 0x007F)) + list(range(0x00A0, 0x0180)) +
            list(range(0x2000, 0x2070)) + list(range(0x20A0, 0x20C0)))

for src, dst in [
    ("~/Library/Fonts/ABCArealSemiMono-Regular.ttf", "fonts/ABCArealSemiMono-Regular.woff2"),
    ("~/Library/Fonts/ABCAreal-Bold.ttf", "fonts/ABCAreal-Bold.woff2"),
]:
    font = TTFont(os.path.expanduser(src))
    opts = Options(); opts.flavor = "woff2"; opts.desubroutinize = True
    sub = Subsetter(options=opts); sub.populate(unicodes=unicodes); sub.subset(font)
    font.flavor = "woff2"; font.save(dst); font.close()
EOF
```

## Nota sobre la variable superfamily

`ABCArealSuperfamilyVariable.ttf` tiene los ejes `MONO` (0–100, Semi-Mono = 50),
`wght` (400–700), `slnt` y `DRKM`. No se usa aquí: pesa 857 KB y con los dos
estáticos ya se cubren los dos estilos del diseño.

## Licencia y crédito

**ABC Areal © Dinamo** — <https://abcdinamo.com/typefaces/areal>, publicada como fuente
gratuita. Se incluye aquí para que el sitio sea autocontenido y no dependa de un CDN
externo.

Si algún día quieres volver a los WOFF2 oficiales de la descarga de Dinamo, sustitúyelos
con el mismo nombre de archivo y todo sigue funcionando.
