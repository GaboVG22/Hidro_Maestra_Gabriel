# HidroSed Maestra

Aplicación estática para análisis preliminar de hidráulica fluvial, transporte de sedimentos, granulometría, lecho móvil y socavación generalizada.

## Características principales

- Funciona en GitHub Pages, sin npm, sin Vite y sin proceso de compilación.
- Permite crear N secciones transversales y definir separación entre secciones.
- Permite marcar tramos en curva de río y aplicar factor preliminar de curva.
- Digitalizador de secciones con lápiz, puntos o imagen de fondo.
- Cálculo de propiedades hidráulicas: área, perímetro mojado, radio hidráulico, velocidad, Froude y tensión de fondo.
- Granulometría: D10, D16, D30, D50, D60, D84, D90/Ds90, Dm, Cu y Cc.
- Transporte de sedimentos: Meyer-Peter-Müller para capacidad potencial de arrastre de fondo.
- Socavación general: Lischtvan-Levediev con ajuste preliminar por curva.
- Lecho móvil simplificado: continuidad sólida tipo Exner por tramos.
- Exportación CSV, JSON y reporte HTML imprimible.
- Tutorial integrado dentro de la aplicación.

## Archivos

- `index.html`: interfaz principal.
- `styles.css`: estilos.
- `app.js`: lógica de cálculo y dibujo.
- `manifest.json`: configuración instalable PWA.
- `sw.js`: caché offline básico.
- `assets/icon.svg`: ícono de la aplicación.
- `.nojekyll`: evita problemas de publicación en GitHub Pages.

## Instalación en GitHub Pages

1. Cree un repositorio nuevo en GitHub.
2. Suba todos los archivos de esta carpeta a la raíz del repositorio.
3. Entre a **Settings > Pages**.
4. En **Build and deployment**, seleccione **Deploy from a branch**.
5. Elija la rama `main` y carpeta `/root`.
6. Guarde y espere a que GitHub entregue la URL pública.

## Flujo de uso recomendado

1. Complete los datos del proyecto y caudal de diseño.
2. Genere N secciones con separación preliminar.
3. Edite manualmente cada sección o digitalice desde imagen/dibujo.
4. Ingrese la curva granulométrica y aplique los diámetros a las secciones.
5. Revise parámetros físicos y metodologías.
6. Ejecute el cálculo integrado.
7. Revise alertas, tabla de resultados y perfiles.
8. Exporte CSV, JSON o reporte HTML.

## Advertencia técnica

Esta herramienta es de apoyo y predimensionamiento. Los resultados deben validarse con levantamiento topográfico, hidrología, inspección de rugosidad, caracterización de sedimentos, modelación hidráulica y juicio profesional.
