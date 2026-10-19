# TulS

Sitio estático (HTML + CSS + JS, sin build) para la plataforma de herramientas experimentales **TulS**.
El diseño reproduce el frame de referencia: tres columnas, tipografía ABC Areal Semi-Mono Regular en
todo el texto (el logo "TulS" va en ABC Areal Bold), tarjetas grises y una barra de créditos fija abajo.

## Archivos

```
index.html      Estructura: cabecera, manifiesto, grid de tools y footer
styles.css      Estilos y @font-face (tamaños, columnas, responsive)
tools.js        ← lista de herramientas (aquí se agregan más bloques)
app.js          Renderiza las tarjetas a partir de tools.js
fonts/          Webfonts incluidos (ABC Areal, ver fonts/README.md)
README.md       Este archivo
```

## 1. Tipografía

ABC Areal es **gratis** (Dinamo lo publicó para todo el mundo). Los dos webfonts que usa el
diseño ya vienen incluidos, subconjuntados a latino y en WOFF2:

```
fonts/ABCArealSemiMono-Regular.woff2   24 KB   → todo el texto
fonts/ABCAreal-Bold.woff2              25 KB   → solo el logo "TulS"
```

Se generaron desde los estáticos de la licencia (`Semi Mono Regular` y `Areal Bold`); en
[`fonts/README.md`](fonts/README.md) está el comando para regenerarlos si añades glifos fuera
del rango latino. La variable superfamily no se usa: pesa 857 KB y no aporta nada aquí.

Todo el texto va en **Semi-Mono Regular** (400) y solo el logo en **Areal Bold** (700).
Si necesitas cambiar un bloque de familia hay dos variables en `styles.css`:

```css
--font-semi-mono: "ABC Areal Semi-Mono", ...;
--font-normal:    "ABC Areal", ...;
```

**ABC Areal © Dinamo** (<https://abcdinamo.com/typefaces/areal>), fuente gratuita. Se incluye
en el repo para que el sitio sea autocontenido; los webfonts se pueden sustituir por los
oficiales con el mismo nombre de archivo.

## 2. Agregar más bloques de tools

Abre `tools.js` y añade un objeto al array `window.TOOLS` (el orden del array es el orden en pantalla):

```js
{
  title: "Tool number seven",
  description: "Texto corto debajo de la tarjeta.",
  image: "images/tool-seven.jpg",   // opcional (vacío = bloque gris)
  href: "tools/tool-seven/",        // opcional (vacío = tarjeta no clicable)
}
```

Guarda y recarga: la página crece y se puede seguir scrolleando hacia abajo.
Con `image` la tarjeta muestra la imagen recortada a la proporción 490:415; sin `image` queda el
bloque gris del diseño. Puedes usar `imageAlt` para el texto alternativo.

El grid es de 3 columnas en escritorio, 2 en tablet y 1 en móvil. El footer de créditos es fijo
(se superpone al contenido, como en la referencia); en móvil pasa a estático para no tapar nada.

## 3. Cronómetro y número de tools

Arriba a la derecha hay dos líneas:

- **`#site-timer`** — cronómetro `on site 00:00:00`. Cuenta desde que se carga la página; no se
guarda entre visitas.
- **`#tools-count`** — cuántas tools hay publicadas: `Currently 6 tools on`.

Las dos funcionan solas. El cronómetro arranca al cargar y el contador se calcula a partir de
`tools.js`, así que **se actualiza al añadir o quitar tools**: no hay nada que mantener a mano ni
peticiones de red, y la página sigue funcionando con `file://`.

## 4. Ver la web en local

No necesita instalación ni dependencias:

```bash
python3 -m http.server 3000
# abre http://localhost:3000
```

También funciona abriendo `index.html` directamente: los datos van en `tools.js` y el cronómetro
no necesita red.

## 5. Subir a GitHub / publicar

```bash
git init
git add .
git commit -m "TulS site"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TulS.git
git push -u origin main
```

Para publicarla gratis con **GitHub Pages**: repo → *Settings* → *Pages* → *Source: Deploy from a
branch* → `main` / `root`. Queda en `https://TU-USUARIO.github.io/TulS/`.
Al ser rutas relativas, funciona igual en la raíz de un dominio o en un subdirectorio.

## Créditos del diseño

Texto del footer y copy tomados de la referencia del proyecto. Contacto:
ricardo.valera.garcia@gmail.com.
