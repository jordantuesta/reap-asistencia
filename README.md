# REAP Asistencia (demo)

Control de asistencia para equipos en obra: **reconocimiento facial con prueba de vida**, **geolocalización**
(dónde se tomó la foto y dónde se envió), **4 marcas diarias**, **horas extra 25 % / 35 %**, **dos razones sociales**,
**renovación de contratos con firma facial** y reportes en Excel (destino OneDrive).

- `#/app` → app del trabajador (celular, instalable como PWA)
- `#/admin` → panel de administración (laptop)

## Comandos
```powershell
npm install          # una sola vez
npm run dev          # http://localhost:5173  (modo demostración si no hay .env.local)
npm run build        # versión de producción en dist/
npm run iconos       # regenera los íconos desde public/favicon.svg
node scripts/probar-sql.mjs   # prueba supabase/schema.sql en un PostgreSQL local
```

## Estructura
| Carpeta | Contenido |
|---|---|
| `src/worker/` | App del trabajador: ingreso, registro facial, marcar, mis horas, contrato, perfil |
| `src/admin/` | Panel: en vivo, alertas, marcaciones, horas extra, contratos, trabajadores, obras, reportes, configuración |
| `src/lib/` | Reglas: horas extra, geocerca, fechas en hora de Lima, datos demo, Excel, motor facial |
| `src/lib/api/` | Modo **local** (IndexedDB) y modo **Supabase** (en vivo) con la misma interfaz |
| `supabase/schema.sql` | Tablas, reglas de seguridad (RLS), funciones de marcación y fotos privadas |
| `docs/` | Guía de publicación y guion del demo |

## Marca
Identidad **provisional** (azul acero + ámbar de seguridad). Para cambiarla: colores en `src/index.css` (`@theme`)
y logo en `public/favicon.svg` + `npm run iconos`.

## Tecnología
React + TypeScript + Vite + Tailwind · PWA (funciona sin internet) · Human (reconocimiento facial en el
dispositivo) · Supabase (PostgreSQL, Storage, Realtime) · Leaflet + OpenStreetMap · ExcelJS.
