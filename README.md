# TulS

Sitio estático (HTML + CSS + JS, sin build) para la plataforma de herramientas experimentales **TulS**.
El diseño reproduce el frame de referencia: tres columnas, tipografía ABC Areal Semi-Mono / Normal,
tarjetas grises y una barra de créditos fija abajo.

## Archivos

```
index.html      Estructura: cabecera, manifiesto, grid de tools y footer
styles.css      Estilos y @font-face (tamaños, columnas, responsive)
tools.js        ← lista de herramientas (aquí se agregan más bloques)
app.js          Renderiza las tarjetas a partir de tools.js
fonts/          Coloca aquí los archivos de ABC Areal (ver fonts/README.md)
README.md       Este archivo
```

## 1. Tipografía (importante)

La fuente **no** viene incluida (es comercial). Copia tus archivos dentro de `fonts/` con estos nombres:

```
fonts/ABCArealSemiMono-Regular.woff2
fonts/ABCArealSemiMono-Bold.woff2
fonts/ABCAreal-Regular.woff2
fonts/ABCAreal-Bold.woff2
```

- Si tus archivos son `.otf` o `.ttf`, puedes usarlos tal cual con esos nombres
  (`ABCArealSemiMono-Regular.otf`, etc.): el CSS ya incluye esas rutas.
- Si tus nombres son distintos, o renombras los archivos o cambias las rutas en el bloque
  `@font-face` al inicio de `styles.css`.
- Si falta algún archivo, el navegador salta a la siguiente fuente y termina en una monoespaciada
  del sistema, así que la web nunca se rompe.
- `.woff2` es lo recomendado para web (pesa mucho menos). Puedes convertir con
  [fonttools](https://github.com/fonttools/fonttools) o cualquier conversor local.
- La licencia de ABC Areal es de Dinamo; para publicar necesitas una licencia web que permita
  self-hosting. No subas la fuente al repo si tu licencia no lo permite (en ese caso usa
  `fonts/README.md` para documentarlo y sirve la fuente desde otro origen).

Todo el texto usa Semi-Mono por defecto. Si quieres usar la versión **Normal** en algo,
añade la clase `font-normal` o cambia `--font` en `styles.css`:

```css
.min-clase { font-family: var(--font-normal); }
```

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

## 3. Ver la web en local

No necesita instalación ni dependencias:

```bash
python3 -m http.server 3000
# abre http://localhost:3000
```

También funciona abriendo `index.html` directamente (no hay `fetch`, los datos van en `tools.js`).

## 4. Subir a GitHub / publicar

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
