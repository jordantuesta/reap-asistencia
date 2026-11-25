-- =====================================================================================
-- REAP Asistencia · Esquema de base de datos para Supabase
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar TODO este archivo → Run.
-- Se puede ejecutar varias veces sin romper nada (es idempotente).
-- =====================================================================================

-- ---------------------------------------------------------------- Tablas
create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nombre_corto text not null,
  ruc text not null default '',
  color text not null default '#2A5580'
);

create table if not exists public.obras (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cliente text not null default '',
  direccion text not null default '',
  distrito text not null default '',
  lat double precision not null,
  lng double precision not null,
  radio_m integer not null default 150,
  activa boolean not null default true,
  demo boolean not null default false
);

create table if not exists public.trabajadores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  dni text not null,
  nombres text not null,
  apellidos text not null,
  cargo text not null default '',
  telefono text not null default '',
  obra_id uuid references public.obras(id) on delete set null,
  pareja_id uuid references public.trabajadores(id) on delete set null,
  remuneracion numeric(10,2) not null default 0,
  codigo_alta text not null default lpad((floor(random() * 900000) + 100000)::int::text, 6, '0'),
  embedding double precision[],                -- plantilla biométrica: NUNCA sale del servidor
  tiene_rostro boolean generated always as (embedding is not null) stored,
  enrolado_at timestamptz,
  foto_enrolamiento text,
  dispositivo_id text,
  consentimiento_at timestamptz,
  activo boolean not null default true,
  demo boolean not null default false,
  unique (empresa_id, dni)
);

create table if not exists public.contratos (
  id uuid primary key default gen_random_uuid(),
  trabajador_id uuid not null references public.trabajadores(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id),
  modalidad text not null,
  cargo text not null default '',
  fecha_inicio date not null,
  fecha_fin date,
  remuneracion numeric(10,2) not null default 0,
  demo boolean not null default false
);

create table if not exists public.adendas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  trabajador_id uuid not null references public.trabajadores(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id),
  numero integer not null default 1,
  fecha_fin_anterior date not null,
  nueva_fecha_fin date not null,
  enviada_at timestamptz not null default now(),
  vista_at timestamptz,
  estado text not null default 'enviada' check (estado in ('enviada', 'firmada', 'rechazada')),
  firmada_at timestamptz,
  firma_foto text,
  firma_similitud double precision,
  firma_lat double precision,
  firma_lng double precision,
  firma_dispositivo text,
  codigo_verificacion text,
  demo boolean not null default false
);

create table if not exists public.marcaciones (
  id uuid primary key default gen_random_uuid(),
  trabajador_id uuid not null references public.trabajadores(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id),
  obra_id uuid references public.obras(id) on delete set null,
  tipo text not null check (tipo in ('entrada', 'salida_refrigerio', 'regreso_refrigerio', 'salida')),
  hora_marca timestamptz not null,
  hora_servidor timestamptz not null default now(),
  hora_dispositivo timestamptz not null,
  lat_captura double precision,
  lng_captura double precision,
  prec_captura double precision,
  lat_subida double precision,
  lng_subida double precision,
  prec_subida double precision,
  distancia_m double precision,
  dentro_obra boolean,
  similitud double precision,
  vida double precision,
  foto text,
  dispositivo_id text,
  dispositivo_distinto boolean not null default false,
  sin_conexion boolean not null default false,
  estado text not null default 'valida' check (estado in ('valida', 'observada')),
  observaciones text[] not null default '{}',
  demo boolean not null default false
);
create index if not exists marcaciones_hora_idx on public.marcaciones (hora_marca);
create index if not exists marcaciones_trab_hora_idx on public.marcaciones (trabajador_id, hora_marca);

create table if not exists public.alertas (
  id uuid primary key default gen_random_uuid(),
  trabajador_id uuid not null references public.trabajadores(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id),
  obra_id uuid references public.obras(id) on delete set null,
  tipo text not null,
  fecha timestamptz not null default now(),
  foto text,
  lat double precision,
  lng double precision,
  similitud double precision,
  detalle text not null default '',
  estado text not null default 'nueva' check (estado in ('nueva', 'revisada', 'descartada')),
  demo boolean not null default false
);
create index if not exists alertas_fecha_idx on public.alertas (fecha);

create table if not exists public.aprobaciones (
  id uuid primary key default gen_random_uuid(),
  trabajador_id uuid not null references public.trabajadores(id) on delete cascade,
  fecha date not null,
  estado text not null check (estado in ('pendiente', 'aprobada', 'rechazada')),
  resuelto_at timestamptz,
  demo boolean not null default false,
  unique (trabajador_id, fecha)
);

create table if not exists public.configuracion (
  id integer primary key default 1 check (id = 1),
  datos jsonb not null default '{}'
);
insert into public.configuracion (id, datos) values (1, '{}') on conflict (id) do nothing;

insert into public.empresas (id, nombre, nombre_corto, ruc, color) values
  ('a0000000-0000-4000-8000-000000000001', 'Corporación REAP S.A.C.', 'Corporación REAP', '', '#2A5580'),
  ('a0000000-0000-4000-8000-000000000002', 'REAP Servicios Técnicos S.A.C.', 'REAP Servicios', '', '#D9860B')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- Funciones auxiliares
-- Misma fórmula que la librería de reconocimiento facial (Human / faceres) y que src/lib/util.ts
create or replace function public.similitud_facial(a double precision[], b double precision[])
returns double precision
language sql immutable
as $$
  with d as (
    select round((100 * 25 * sum((x - y) * (x - y)))::numeric) / 100 as dist
    from unnest(a, b) as t(x, y)
  )
  select (case
    when a is null or b is null or cardinality(a) <> cardinality(b) or cardinality(a) = 0 then 0
    when d.dist = 0 then 1
    else round(100 * greatest(least((1 - sqrt(d.dist) / 100 - 0.2) / 0.6, 1), 0)) / 100
  end)::double precision
  from d;
$$;

create or replace function public.distancia_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql immutable
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

create or replace function public.vector_desde_json(j jsonb)
returns double precision[]
language sql immutable
as $$
  select coalesce(array_agg(e::double precision order by i), '{}')
  from jsonb_array_elements_text(j) with ordinality as x(e, i);
$$;

create or replace function public.fecha_lima(t timestamptz)
returns date
language sql stable
as $$ select (t at time zone 'America/Lima')::date; $$;

-- ---------------------------------------------------------------- API de la app del trabajador
-- (security definer: corre con permisos del dueño; el celular nunca lee tablas directamente)

create or replace function public.app_perfil(p_empresa uuid, p_dni text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  t public.trabajadores;
begin
  select * into t from public.trabajadores where empresa_id = p_empresa and dni = trim(p_dni) and activo;
  if not found then return null; end if;
  return jsonb_build_object(
    'trabajador', to_jsonb(t) - 'embedding' - 'codigo_alta',
    'empresa', (select to_jsonb(e) from public.empresas e where e.id = t.empresa_id),
    'obra', (select to_jsonb(o) from public.obras o where o.id = t.obra_id),
    'pareja', (select jsonb_build_object('nombres', p.nombres, 'apellidos', p.apellidos) from public.trabajadores p where p.id = t.pareja_id),
    'contrato', (select to_jsonb(c) from public.contratos c where c.trabajador_id = t.id order by c.fecha_inicio desc limit 1),
    'adendas', coalesce((select jsonb_agg(to_jsonb(a) order by a.enviada_at desc) from public.adendas a where a.trabajador_id = t.id), '[]'::jsonb),
    'marcas_hoy', coalesce((select jsonb_agg(to_jsonb(m) order by m.hora_marca) from public.marcaciones m
                             where m.trabajador_id = t.id and fecha_lima(m.hora_marca) = fecha_lima(now())), '[]'::jsonb),
    'config', coalesce((select datos from public.configuracion where id = 1), '{}'::jsonb)
  );
end;
$$;

create or replace function public.app_enrolar(p_trabajador uuid, p_codigo text, p_embedding jsonb, p_foto text, p_dispositivo text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  t public.trabajadores;
  emb double precision[];
begin
  select * into t from public.trabajadores where id = p_trabajador and activo for update;
  if not found then return jsonb_build_object('ok', false, 'mensaje', 'Trabajador no encontrado.'); end if;
  if t.embedding is not null then
    return jsonb_build_object('ok', false, 'mensaje', 'Este trabajador ya tiene un rostro registrado. Pide a RR. HH. que lo reinicie.');
  end if;
  if t.codigo_alta <> trim(coalesce(p_codigo, '')) then
    return jsonb_build_object('ok', false, 'mensaje', 'Código de alta incorrecto. Pídelo a RR. HH.');
  end if;
  emb := vector_desde_json(p_embedding);
  if cardinality(emb) < 64 then return jsonb_build_object('ok', false, 'mensaje', 'La captura facial no es válida. Intenta de nuevo.'); end if;
  update public.trabajadores set
    embedding = emb, foto_enrolamiento = p_foto, dispositivo_id = p_dispositivo,
    enrolado_at = now(), consentimiento_at = now(), demo = false,
    codigo_alta = lpad((floor(random() * 900000) + 100000)::int::text, 6, '0')   -- el código es de un solo uso
  where id = t.id;
  return jsonb_build_object('ok', true, 'mensaje', 'Rostro registrado correctamente.');
end;
$$;

create or replace function public.app_marcar(
  p_trabajador uuid, p_embedding jsonb, p_real double precision, p_vida double precision, p_reto boolean,
  p_foto text, p_dispositivo text, p_hora_dispositivo timestamptz,
  p_lat_cap double precision, p_lng_cap double precision, p_prec_cap double precision,
  p_lat_sub double precision, p_lng_sub double precision, p_prec_sub double precision,
  p_sin_conexion boolean
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  t public.trabajadores;
  o public.obras;
  m public.marcaciones;
  cfg jsonb;
  emb double precision[];
  v_umbral double precision;
  v_umbral_vida double precision;
  v_bloquear boolean;
  v_hora timestamptz;
  v_vida double precision;
  v_sim double precision;
  v_hechas text[];
  v_tipo text;
  v_art text;
  v_nombre text;
  v_dist double precision;
  v_dentro boolean;
  v_dist_txt text;
  v_obs text[] := '{}';
  v_disp boolean;
begin
  select * into t from public.trabajadores where id = p_trabajador and activo;
  if not found then return jsonb_build_object('ok', false, 'mensaje', 'Trabajador no encontrado o inactivo.'); end if;
  if t.embedding is null then return jsonb_build_object('ok', false, 'motivo', 'sin_rostro', 'mensaje', 'Primero debes registrar tu rostro.'); end if;

  cfg := coalesce((select datos from public.configuracion where id = 1), '{}'::jsonb);
  v_umbral := coalesce((cfg ->> 'umbral_similitud')::double precision, 0.55);
  v_umbral_vida := coalesce((cfg ->> 'umbral_vida')::double precision, 0.35);
  v_bloquear := coalesce((cfg ->> 'bloquear_fuera_obra')::boolean, false);

  -- Hora oficial = servidor. Sin conexión: hora del celular (nunca futura) y la marca queda observada.
  v_hora := case when coalesce(p_sin_conexion, false) and p_hora_dispositivo is not null then least(p_hora_dispositivo, now()) else now() end;

  select * into o from public.obras where id = t.obra_id;
  if o.id is not null and p_lat_cap is not null then
    v_dist := round(distancia_m(p_lat_cap, p_lng_cap, o.lat, o.lng));
    v_dentro := v_dist <= o.radio_m;
    v_dist_txt := case when v_dist >= 1000 then to_char(v_dist / 1000, 'FM9990.0') || ' km' else v_dist::int || ' m' end;
  end if;

  select coalesce(array_agg(tipo), '{}') into v_hechas
  from public.marcaciones where trabajador_id = t.id and fecha_lima(hora_marca) = fecha_lima(v_hora);
  v_tipo := case
    when not ('entrada' = any(v_hechas)) then 'entrada'
    when not ('salida_refrigerio' = any(v_hechas)) then 'salida_refrigerio'
    when not ('regreso_refrigerio' = any(v_hechas)) then 'regreso_refrigerio'
    when not ('salida' = any(v_hechas)) then 'salida'
  end;
  v_art := case v_tipo when 'entrada' then 'la ENTRADA' when 'salida_refrigerio' then 'la SALIDA A REFRIGERIO'
                       when 'regreso_refrigerio' then 'el REGRESO DE REFRIGERIO' when 'salida' then 'la SALIDA' else 'una marca' end;
  v_nombre := case v_tipo when 'entrada' then 'Entrada' when 'salida_refrigerio' then 'Salida a refrigerio'
                          when 'regreso_refrigerio' then 'Regreso de refrigerio' else 'Salida' end;

  -- 1) Prueba de vida
  v_vida := least(coalesce(p_vida, 0), coalesce(p_real, 0));
  if not coalesce(p_reto, false) or v_vida < v_umbral_vida then
    insert into public.alertas (trabajador_id, empresa_id, obra_id, tipo, fecha, foto, lat, lng, similitud, detalle)
    values (t.id, t.empresa_id, t.obra_id, 'prueba_vida', v_hora, p_foto, p_lat_cap, p_lng_cap, null,
            'No superó la prueba de vida (posible foto o pantalla frente a la cámara).');
    return jsonb_build_object('ok', false, 'motivo', 'prueba_vida',
      'mensaje', 'No pudimos confirmar que eres una persona real frente a la cámara. Intenta de nuevo con buena luz.');
  end if;

  -- 2) Reconocimiento facial 1:1 contra la plantilla registrada
  emb := vector_desde_json(p_embedding);
  v_sim := similitud_facial(emb, t.embedding);
  if v_sim < v_umbral then
    insert into public.alertas (trabajador_id, empresa_id, obra_id, tipo, fecha, foto, lat, lng, similitud, detalle)
    values (t.id, t.empresa_id, t.obra_id, 'rostro_no_coincide', v_hora, p_foto, p_lat_cap, p_lng_cap, v_sim,
            format('Se intentó registrar %s con un rostro distinto al registrado (similitud %s%%).', v_art, round(v_sim * 100)));
    return jsonb_build_object('ok', false, 'motivo', 'rostro_no_coincide', 'similitud', v_sim,
      'mensaje', 'El rostro no coincide con el trabajador registrado. Este intento quedó registrado.');
  end if;

  if v_tipo is null then
    return jsonb_build_object('ok', false, 'motivo', 'jornada_completa', 'similitud', v_sim, 'mensaje', 'Ya registraste tus 4 marcas de hoy.');
  end if;

  -- 3) Geocerca
  if v_dentro = false and v_bloquear then
    insert into public.alertas (trabajador_id, empresa_id, obra_id, tipo, fecha, foto, lat, lng, similitud, detalle)
    values (t.id, t.empresa_id, t.obra_id, 'fuera_de_obra', v_hora, p_foto, p_lat_cap, p_lng_cap, v_sim,
            format('Intentó marcar a %s de %s. Marca bloqueada.', v_dist_txt, o.nombre));
    return jsonb_build_object('ok', false, 'motivo', 'fuera_de_obra', 'similitud', v_sim, 'distancia_m', v_dist, 'dentro_obra', false,
      'mensaje', format('Estás a %s de la obra. Debes estar dentro de %s m para marcar.', v_dist_txt, o.radio_m));
  end if;
  if v_dentro = false then
    v_obs := array_append(v_obs, 'Marcó fuera del radio de la obra');
    insert into public.alertas (trabajador_id, empresa_id, obra_id, tipo, fecha, foto, lat, lng, similitud, detalle)
    values (t.id, t.empresa_id, t.obra_id, 'fuera_de_obra', v_hora, p_foto, p_lat_cap, p_lng_cap, v_sim,
            format('Marcó %s a %s de %s.', v_art, v_dist_txt, o.nombre));
  end if;
  if p_lat_cap is null then v_obs := array_append(v_obs, 'Sin ubicación al tomar la foto'); end if;

  v_disp := t.dispositivo_id is not null and t.dispositivo_id is distinct from p_dispositivo;
  if v_disp then
    v_obs := array_append(v_obs, 'Marcó desde un celular distinto al registrado');
    insert into public.alertas (trabajador_id, empresa_id, obra_id, tipo, fecha, foto, lat, lng, similitud, detalle)
    values (t.id, t.empresa_id, t.obra_id, 'dispositivo_distinto', v_hora, p_foto, p_lat_cap, p_lng_cap, v_sim,
            'Marcó desde un celular distinto al registrado. El rostro sí coincidió.');
  end if;
  if coalesce(p_sin_conexion, false) then v_obs := array_append(v_obs, 'Marcada sin conexión: se usó la hora del celular'); end if;

  insert into public.marcaciones (
    trabajador_id, empresa_id, obra_id, tipo, hora_marca, hora_servidor, hora_dispositivo,
    lat_captura, lng_captura, prec_captura, lat_subida, lng_subida, prec_subida,
    distancia_m, dentro_obra, similitud, vida, foto, dispositivo_id, dispositivo_distinto, sin_conexion, estado, observaciones
  ) values (
    t.id, t.empresa_id, o.id, v_tipo, v_hora, now(), coalesce(p_hora_dispositivo, now()),
    p_lat_cap, p_lng_cap, p_prec_cap, coalesce(p_lat_sub, p_lat_cap), coalesce(p_lng_sub, p_lng_cap), coalesce(p_prec_sub, p_prec_cap),
    v_dist, v_dentro, v_sim, round(v_vida::numeric, 2), p_foto, p_dispositivo, v_disp, coalesce(p_sin_conexion, false),
    case when cardinality(v_obs) > 0 then 'observada' else 'valida' end, v_obs
  ) returning * into m;

  return jsonb_build_object(
    'ok', true, 'marcacion', to_jsonb(m), 'similitud', v_sim, 'distancia_m', v_dist, 'dentro_obra', v_dentro,
    'mensaje', format('%s registrada a las %s.', v_nombre, to_char(v_hora at time zone 'America/Lima', 'HH24:MI'))
  );
end;
$$;

create or replace function public.app_historial(p_trabajador uuid, p_desde date)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'marcas', coalesce((select jsonb_agg(to_jsonb(m) order by m.hora_marca) from public.marcaciones m
                        where m.trabajador_id = p_trabajador and fecha_lima(m.hora_marca) >= p_desde), '[]'::jsonb),
    'aprobaciones', coalesce((select jsonb_agg(to_jsonb(a)) from public.aprobaciones a
                              where a.trabajador_id = p_trabajador and a.fecha >= p_desde), '[]'::jsonb)
  );
$$;

create or replace function public.app_ver_adenda(p_trabajador uuid, p_adenda uuid)
returns void
language sql security definer set search_path = public
as $$
  update public.adendas set vista_at = coalesce(vista_at, now()) where id = p_adenda and trabajador_id = p_trabajador;
$$;

create or replace function public.app_firmar_adenda(
  p_trabajador uuid, p_adenda uuid, p_embedding jsonb, p_real double precision, p_vida double precision, p_reto boolean,
  p_foto text, p_lat double precision, p_lng double precision, p_dispositivo text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  t public.trabajadores;
  a public.adendas;
  cfg jsonb;
  v_sim double precision;
begin
  select * into t from public.trabajadores where id = p_trabajador and activo;
  select * into a from public.adendas where id = p_adenda and trabajador_id = p_trabajador for update;
  if t.id is null or a.id is null then return jsonb_build_object('ok', false, 'mensaje', 'Documento no encontrado.'); end if;
  if a.estado <> 'enviada' then return jsonb_build_object('ok', false, 'mensaje', 'Este documento ya fue firmado.'); end if;
  if t.embedding is null then return jsonb_build_object('ok', false, 'mensaje', 'Primero debes registrar tu rostro.'); end if;
  cfg := coalesce((select datos from public.configuracion where id = 1), '{}'::jsonb);
  if not coalesce(p_reto, false) or least(coalesce(p_vida, 0), coalesce(p_real, 0)) < coalesce((cfg ->> 'umbral_vida')::double precision, 0.35) then
    return jsonb_build_object('ok', false, 'mensaje', 'No superó la prueba de vida.');
  end if;
  v_sim := similitud_facial(vector_desde_json(p_embedding), t.embedding);
  if v_sim < coalesce((cfg ->> 'umbral_similitud')::double precision, 0.55) then
    insert into public.alertas (trabajador_id, empresa_id, obra_id, tipo, fecha, foto, lat, lng, similitud, detalle)
    values (t.id, t.empresa_id, t.obra_id, 'rostro_no_coincide', now(), p_foto, p_lat, p_lng, v_sim,
            format('Se intentó FIRMAR la adenda N.° %s con un rostro distinto al registrado.', a.numero));
    return jsonb_build_object('ok', false, 'mensaje', 'El rostro no coincide. No se firmó el documento.');
  end if;
  update public.adendas set
    estado = 'firmada', firmada_at = now(), vista_at = coalesce(vista_at, now()), firma_foto = p_foto, firma_similitud = v_sim,
    firma_lat = p_lat, firma_lng = p_lng, firma_dispositivo = p_dispositivo,
    codigo_verificacion = substr(md5(a.id::text || t.id::text || now()::text || coalesce(p_foto, '')), 1, 16)
  where id = a.id
  returning * into a;
  update public.contratos set fecha_fin = a.nueva_fecha_fin where id = a.contrato_id;
  return jsonb_build_object('ok', true, 'mensaje', 'Adenda firmada correctamente.', 'adenda', to_jsonb(a));
end;
$$;

grant execute on function public.app_perfil(uuid, text) to anon, authenticated;
grant execute on function public.app_enrolar(uuid, text, jsonb, text, text) to anon, authenticated;
grant execute on function public.app_marcar(uuid, jsonb, double precision, double precision, boolean, text, text, timestamptz,
  double precision, double precision, double precision, double precision, double precision, double precision, boolean) to anon, authenticated;
grant execute on function public.app_historial(uuid, date) to anon, authenticated;
grant execute on function public.app_ver_adenda(uuid, uuid) to anon, authenticated;
grant execute on function public.app_firmar_adenda(uuid, uuid, jsonb, double precision, double precision, boolean, text,
  double precision, double precision, text) to anon, authenticated;

-- ---------------------------------------------------------------- Permisos de la API
-- Explícitos, por si el proyecto se creó sin "exponer tablas nuevas automáticamente".
-- El celular (anon) no toca las tablas directamente: solo lee empresas y llama a las funciones app_*.
grant usage on schema public to anon, authenticated;
revoke all on public.obras, public.trabajadores, public.contratos, public.adendas, public.marcaciones,
  public.alertas, public.aprobaciones, public.configuracion from anon;
grant select on public.empresas to anon;
grant select, insert, update, delete on public.empresas, public.obras, public.trabajadores, public.contratos,
  public.adendas, public.marcaciones, public.alertas, public.aprobaciones, public.configuracion to authenticated;

-- ---------------------------------------------------------------- Seguridad (RLS)
-- Celular (anon): solo puede leer la lista de empresas y llamar a las funciones app_*.
-- Panel (usuarios creados en Authentication): acceso completo.
alter table public.empresas enable row level security;
alter table public.obras enable row level security;
alter table public.trabajadores enable row level security;
alter table public.contratos enable row level security;
alter table public.adendas enable row level security;
alter table public.marcaciones enable row level security;
alter table public.alertas enable row level security;
alter table public.aprobaciones enable row level security;
alter table public.configuracion enable row level security;

drop policy if exists "empresas lectura" on public.empresas;
create policy "empresas lectura" on public.empresas for select to anon, authenticated using (true);

do $$
declare tabla text;
begin
  foreach tabla in array array['empresas', 'obras', 'trabajadores', 'contratos', 'adendas', 'marcaciones', 'alertas', 'aprobaciones', 'configuracion'] loop
    execute format('drop policy if exists "panel acceso total" on public.%I', tabla);
    execute format('create policy "panel acceso total" on public.%I for all to authenticated using (true) with check (true)', tabla);
  end loop;
end $$;

-- ---------------------------------------------------------------- Fotos de evidencia (Storage privado)
insert into storage.buckets (id, name, public) values ('evidencias', 'evidencias', false) on conflict (id) do nothing;
drop policy if exists "evidencias subir" on storage.objects;
create policy "evidencias subir" on storage.objects for insert to anon, authenticated with check (bucket_id = 'evidencias');
drop policy if exists "evidencias ver panel" on storage.objects;
create policy "evidencias ver panel" on storage.objects for select to authenticated using (bucket_id = 'evidencias');

-- ---------------------------------------------------------------- Tiempo real (panel en vivo)
do $$
declare tabla text;
begin
  foreach tabla in array array['marcaciones', 'alertas', 'adendas', 'trabajadores'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', tabla);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Listo. Siguiente paso: Authentication → Users → "Add user" para crear el usuario del panel.
