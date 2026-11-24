# Cómo poner el demo en línea (≈ 25 minutos)

Al terminar tendrás un enlace `https://TU-USUARIO.github.io/reap-asistencia/` que se abre en el celular
(se instala como app) y en la laptop (panel), **compartiendo los mismos datos en tiempo real**.

> Sin estos pasos el demo igual funciona en **modo demostración** (`npm run dev`), pero celular y laptop no se ven entre sí.

---

## 1. Supabase — la base de datos (10 min)

1. Entra a [supabase.com](https://supabase.com) → **New project**.
   - Nombre: `reap-asistencia` · Región: **South America (São Paulo)** (la más cercana a Lima).
   - Guarda la contraseña de la base de datos en un lugar seguro (no la necesitaremos para el demo).
2. Menú izquierdo → **SQL Editor** → **New query** → pega TODO el archivo `supabase/schema.sql` → **Run**.
   Debe decir *Success. No rows returned*.
3. **Authentication → Users → Add user → Create new user**: tu correo y una contraseña,
   marca **Auto Confirm User**. Con eso entras al panel.
4. **Authentication → Sign In / Providers → Email**: desactiva **Allow new users to sign up**
   (así nadie más puede crearse una cuenta de administrador).
5. **Project Settings → API**: copia **Project URL** y la clave **anon public**.

## 2. Probar en tu laptop conectado a Supabase (3 min)

1. En la carpeta del proyecto, copia `.env.example` como `.env.local` y pega la URL y la clave.
2. Ejecuta `npm run dev` y abre `http://localhost:5173/#/admin`.
3. Ingresa con el usuario del paso 1.3 → **Configuración → Regenerar datos de demostración**.

## 3. GitHub Pages — el enlace público (10 min)

1. [github.com/new](https://github.com/new) → nombre `reap-asistencia` → **Public** → sin README → *Create repository*.
2. En el repositorio: **Settings → Pages → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions → pestaña Variables → New repository variable** (dos veces):
   - `VITE_SUPABASE_URL` = la Project URL
   - `VITE_SUPABASE_ANON_KEY` = la clave anon public
4. En PowerShell, dentro de la carpeta del proyecto:
   ```powershell
   git remote add origin https://github.com/TU-USUARIO/reap-asistencia.git
   git push -u origin main
   ```
   (Se abre el navegador para iniciar sesión en GitHub la primera vez.)
5. Pestaña **Actions**: espera el check verde (~2 min). El enlace aparece en *Settings → Pages*.

> Cada vez que se guarde un cambio con `git push`, el sitio se actualiza solo.

## 4. En el celular

1. Abre el enlace (o escanea el QR del panel: botón **App en el celular**).
2. **App del trabajador** → Android: menú ⋮ → *Instalar app*. iPhone (Safari): *Compartir → Agregar a inicio*.
3. Acepta los permisos de **cámara** y **ubicación**.

---

### Notas de seguridad
- La clave *anon* es pública por diseño; lo que protege los datos son las reglas RLS del `schema.sql`:
  el celular solo puede listar empresas y llamar a las funciones `app_*`; el panel exige usuario.
- Las fotos van a un almacenamiento **privado** (solo el panel las ve, con enlaces temporales).
- La plantilla biométrica **nunca** sale del servidor: la comparación facial se hace dentro de la base de datos.
- Para producción (después del demo): autenticación por trabajador, auditoría y dominio propio.
