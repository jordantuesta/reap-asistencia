// Prueba supabase/schema.sql en un PostgreSQL local (PGlite) simulando lo mínimo de Supabase.
// Uso: node scripts/probar-sql.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = new PGlite();
const ok = (c, m) => { if (!c) { console.error('✗ ' + m); process.exitCode = 1; } else console.log('✓ ' + m); };

// Lo que Supabase ya trae
await db.exec(`
  create role anon; create role authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create publication supabase_realtime;
`);

const sql = readFileSync('supabase/schema.sql', 'utf8');
await db.exec(sql);
await db.exec(sql); // idempotente
ok(true, 'schema.sql se ejecuta dos veces sin errores');

// Similitud: misma fórmula que JS
function simJS(a, b) {
  let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  const dist = Math.round(100 * 25 * s) / 100; if (dist === 0) return 1;
  return Math.round(100 * Math.max(Math.min((1 - Math.sqrt(dist) / 100 - 0.2) / 0.6, 1), 0)) / 100;
}
const vec = (seed, k) => { let a = seed; return Array.from({ length: 1024 }, () => { a = (a * 16807) % 2147483647; return (a / 2147483647 - 0.5) * k; }); };
const A = vec(11, 2), A2 = A.map((x, i) => x + Math.sin(i) * 0.05), B = vec(77, 2), C = A.map((x, i) => x + Math.cos(i * 3) * 0.6);
for (const [x, y, n] of [[A, A2, 'A~A2'], [A, B, 'A/B'], [A, C, 'A/C'], [A, A, 'A=A']]) {
  const r = await db.query('select similitud_facial($1::float8[], $2::float8[]) s', [x, y]);
  ok(Math.abs(r.rows[0].s - simJS(x, y)) < 0.011, `similitud ${n}: SQL ${r.rows[0].s} = JS ${simJS(x, y)}`);
}

// Datos de prueba
const E = 'a0000000-0000-4000-8000-000000000001';
const { rows: [obra] } = await db.query(`insert into obras (nombre, lat, lng, radio_m) values ('Obra test', -12.1, -77.03, 150) returning id`);
const { rows: [t] } = await db.query(`insert into trabajadores (empresa_id, dni, nombres, apellidos, obra_id, codigo_alta) values ($1, '12345678', 'Ana', 'Prueba', $2, '123456') returning id`, [E, obra.id]);

const rpc = async (fn, args) => {
  const keys = Object.keys(args);
  const r = await db.query(`select ${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`, keys.map((k) => args[k]));
  return r.rows[0].r;
};

let r = await rpc('app_perfil', { p_empresa: E, p_dni: '12345678' });
ok(r && r.trabajador.nombres === 'Ana' && !('embedding' in r.trabajador) && !('codigo_alta' in r.trabajador) && r.trabajador.tiene_rostro === false, 'app_perfil sin datos biométricos ni código');
ok((await rpc('app_perfil', { p_empresa: E, p_dni: '99999999' })) === null, 'app_perfil devuelve null si el DNI no existe');

r = await rpc('app_enrolar', { p_trabajador: t.id, p_codigo: '000000', p_embedding: JSON.stringify(A), p_foto: 'x.jpg', p_dispositivo: 'cel-1' });
ok(r.ok === false && /Código/.test(r.mensaje), 'enrolar con código incorrecto se rechaza');
r = await rpc('app_enrolar', { p_trabajador: t.id, p_codigo: '123456', p_embedding: JSON.stringify(A), p_foto: 'x.jpg', p_dispositivo: 'cel-1' });
ok(r.ok === true, 'enrolar con código correcto');
const { rows: [t2] } = await db.query('select codigo_alta, tiene_rostro, cardinality(embedding) n from trabajadores where id = $1', [t.id]);
ok(t2.tiene_rostro && t2.n === 1024 && t2.codigo_alta !== '123456', 'plantilla guardada (1024) y código rotado');

const marca = (emb, extra = {}) => rpc('app_marcar', {
  p_trabajador: t.id, p_embedding: JSON.stringify(emb), p_real: 0.8, p_vida: 0.8, p_reto: true, p_foto: 'm.jpg', p_dispositivo: 'cel-1',
  p_hora_dispositivo: new Date().toISOString(), p_lat_cap: -12.1003, p_lng_cap: -77.03, p_prec_cap: 10, p_lat_sub: -12.1003, p_lng_sub: -77.03,
  p_prec_sub: 10, p_sin_conexion: false, ...extra,
});

r = await marca(A2);
ok(r.ok && r.marcacion.tipo === 'entrada' && r.dentro_obra === true && r.marcacion.estado === 'valida', `marca válida: ${r.mensaje} (sim ${r.similitud}, ${r.distancia_m} m)`);
r = await marca(B);
ok(!r.ok && r.motivo === 'rostro_no_coincide', `otro rostro bloqueado (sim ${r.similitud})`);
r = await marca(A2, { p_reto: false });
ok(!r.ok && r.motivo === 'prueba_vida', 'sin prueba de vida bloqueado');
r = await marca(A2, { p_lat_cap: -12.13, p_lat_sub: -12.13, p_dispositivo: 'cel-2' });
ok(r.ok && r.marcacion.tipo === 'salida_refrigerio' && r.marcacion.estado === 'observada' && r.marcacion.observaciones.length === 2, `fuera de obra + otro celular → observada: ${r.marcacion?.observaciones}`);
r = await marca(A2, { p_sin_conexion: true, p_hora_dispositivo: new Date(Date.now() - 20 * 60000).toISOString(), p_lat_sub: -12.11 });
ok(r.ok && r.marcacion.sin_conexion && r.marcacion.lat_subida === -12.11, 'marca sin conexión guarda dónde se tomó y dónde se subió');
await marca(A2);
r = await marca(A2);
ok(!r.ok && r.motivo === 'jornada_completa', 'quinta marca → jornada completa');

const { rows: al } = await db.query('select tipo from alertas where trabajador_id = $1 order by fecha', [t.id]);
ok(al.length === 4, `alertas generadas: ${al.map((x) => x.tipo).join(', ')}`);

await db.exec(`update configuracion set datos = '{"bloquear_fuera_obra": true}' where id = 1`);
await db.exec(`delete from marcaciones`);
r = await marca(A2, { p_lat_cap: -12.13 });
ok(!r.ok && r.motivo === 'fuera_de_obra', 'con bloqueo activado, fuera de obra no marca');
await db.exec(`update configuracion set datos = '{}' where id = 1`);

r = await rpc('app_historial', { p_trabajador: t.id, p_desde: '2020-01-01' });
ok(Array.isArray(r.marcas) && Array.isArray(r.aprobaciones), 'app_historial');

// Adenda
const { rows: [c] } = await db.query(`insert into contratos (trabajador_id, empresa_id, modalidad, fecha_inicio, fecha_fin) values ($1, $2, 'Obra determinada', '2026-06-01', '2026-11-30') returning id`, [t.id, E]);
const { rows: [ad] } = await db.query(`insert into adendas (contrato_id, trabajador_id, empresa_id, fecha_fin_anterior, nueva_fecha_fin) values ($1, $2, $3, '2026-11-30', '2027-02-28') returning id`, [c.id, t.id, E]);
await rpc('app_ver_adenda', { p_trabajador: t.id, p_adenda: ad.id });
const firma = (emb) => rpc('app_firmar_adenda', { p_trabajador: t.id, p_adenda: ad.id, p_embedding: JSON.stringify(emb), p_real: 0.8, p_vida: 0.8, p_reto: true, p_foto: 'f.jpg', p_lat: -12.1, p_lng: -77.03, p_dispositivo: 'cel-1' });
r = await firma(B);
ok(!r.ok, 'firmar con otro rostro se rechaza');
r = await firma(A2);
ok(r.ok && r.adenda.estado === 'firmada' && r.adenda.codigo_verificacion?.length === 16 && r.adenda.vista_at, 'adenda firmada con código de verificación');
const { rows: [c2] } = await db.query('select fecha_fin::text f from contratos where id = $1', [c.id]);
ok(c2.f === '2027-02-28', 'contrato prorrogado automáticamente');
r = await rpc('app_perfil', { p_empresa: E, p_dni: '12345678' });
ok(r.adendas.length === 1 && r.contrato && r.trabajador.tiene_rostro === true, 'perfil refleja contrato, adenda y rostro');

// Permisos: el celular (anon) solo ve empresas y usa las funciones; el panel (authenticated) ve todo
const comoRol = async (rol, consulta) => {
  await db.exec(`set role ${rol}`);
  try { return { filas: (await db.query(consulta)).rows }; } catch (e) { return { error: e.message }; } finally { await db.exec('reset role'); }
};
let q = await comoRol('anon', 'select id from trabajadores');
ok(q.error && /permission denied/.test(q.error), 'anon NO puede leer trabajadores (plantillas biométricas)');
q = await comoRol('anon', 'select id from marcaciones');
ok(q.error && /permission denied/.test(q.error), 'anon NO puede leer marcaciones');
q = await comoRol('anon', 'select id from empresas');
ok(q.filas?.length === 2, 'anon puede listar las 2 empresas');
q = await comoRol('anon', `select app_perfil('${E}', '12345678') r`);
ok(q.filas?.[0]?.r?.trabajador?.nombres === 'Ana', 'anon puede usar app_perfil');
q = await comoRol('authenticated', 'select id from trabajadores');
ok(q.filas?.length === 1, 'panel (authenticated) puede leer trabajadores');

console.log(process.exitCode ? '\nHAY ERRORES' : '\nTODO OK');
