# Cómo poner el demo en línea (≈ 20 minutos)

Al terminar tendrás un enlace `https://TU-USUARIO.github.io/reap-asistencia/` que se abre en el celular
(se instala como app) y en la laptop (panel), **compartiendo los mismos datos en tiempo real**.

> Sin estos pasos el demo igual funciona en **modo demostración** (`npm run dev`), pero celular y laptop no se ven entre sí.

---

## 1. Supabase — la base de datos (10 min)

1. Entra a [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
   - Nombre: `reap-asistencia` · Región: **South America (São Paulo)**, la más cercana a Lima
     (si solo aparece "Americas", déjala así).
   - Contraseña de la base de datos: usa **Generate a password** y guárdala (no la necesitaremos para el demo).
   - Deja marcadas las opciones de seguridad que vienen por defecto → **Create new project** (tarda ~2 min).
2. Copia el script al portapapeles ejecutando esto en PowerShell:
   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\Jordan\Claude code\reap-asistencia\supabase\schema.sql" | Set-Clipboard
   ```
   Menú izquierdo → **SQL Editor** → **New query** → pega (Ctrl+V) → **Run**.
   Si avisa de *destructive operations*, confirma con **Run this query** (solo borra reglas viejas para recrearlas).
   Debe terminar en *Success. No rows returned*.
3. **Authentication → Users → Add user → Create new user**: tu correo y una contraseña,
   con **Auto Confirm User** marcado. Con eso entras al panel.
4. **Authentication → Sign In / Providers**: desactiva **Allow new users to sign up** → **Save**
   (así nadie más puede crearse una cuenta de administrador).
5. **Project Settings → API Keys**: copia la **Publishable key** (empieza con `sb_publishable_`).
   Si solo ves la pestaña *Legacy*, copia la **anon public**.
   La **Project URL** es `https://<id>.supabase.co`, donde `<id>` es lo que aparece en la barra de direcciones
   después de `/project/`.
   > ⚠️ **Nunca** compartas la *Secret key* ni la *service_role*: esas sí dan acceso total.

## 2. GitHub — el enlace público (5 min)

1. [github.com/new](https://github.com/new) → nombre `reap-asistencia` → **Public** → sin README ni .gitignore → **Create repository**.
2. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## 3. Conectar y publicar

Con la Project URL, la Publishable key y el enlace del repositorio:

1. Se guardan en `.env.local` (para la laptop) y en `.env.production` (para el sitio publicado).
   La clave publicable es pública por diseño: va dentro del sitio igual que en cualquier app de Supabase.
2. `npm run dev` → `http://localhost:5173/#/admin` → ingresar con el usuario del paso 1.3 →
   **Configuración → Regenerar datos de demostración**.
3. Subir el código:
   ```powershell
   git remote add origin https://github.com/TU-USUARIO/reap-asistencia.git
   ```
   ```powershell
   git push -u origin main
   ```
   La primera vez se abre una ventana para iniciar sesión en GitHub.
4. Pestaña **Actions** del repositorio: esperar el check verde (~2 min). El enlace aparece en *Settings → Pages*.

> Cada vez que se guarde un cambio con `git push`, el sitio se actualiza solo.

## 4. En el celular

1. Abre el enlace (o escanea el QR del panel: botón **App en el celular**).
2. **App del trabajador** → Android: menú ⋮ → *Instalar app*. iPhone (Safari): *Compartir → Agregar a inicio*.
3. Acepta los permisos de **cámara** y **ubicación**.

---

### Notas de seguridad
- La clave publicable (*anon*) es pública por diseño; lo que protege los datos son los permisos y reglas RLS del
  `schema.sql`: el celular solo puede listar empresas y llamar a las funciones `app_*` (no puede leer tablas);
  el panel exige usuario y contraseña.
- Las fotos van a un almacenamiento **privado** (solo el panel las ve, con enlaces temporales).
- La plantilla biométrica **nunca** sale del servidor: la comparación facial se hace dentro de la base de datos.
- El plan gratuito de Supabase **pausa el proyecto tras 7 días sin uso**: entra al panel unos días antes de cada
  presentación. Para el cliente real se usa un plan pagado (sin pausas y con copias de seguridad diarias).
- Para producción (después del demo): autenticación por trabajador, auditoría y dominio propio.
