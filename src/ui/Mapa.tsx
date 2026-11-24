import { useEffect } from 'react';
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import type { Obra } from '../lib/types';

// Mapa base OpenStreetMap (gratuito, sin clave). En producción con mucho tráfico conviene un proveedor dedicado.
export const TEJAS = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  atribucion: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
};

export interface PuntoMapa { lat: number; lng: number; color: string; etiqueta?: string; radio?: number; }

function Encuadre({ puntos }: { puntos: [number, number][] }) {
  const map = useMap();
  const clave = puntos.map((p) => p.join(',')).join('|');
  useEffect(() => {
    if (!puntos.length) return;
    if (puntos.length === 1) map.setView(puntos[0], 16);
    else map.fitBounds(puntos, { padding: [36, 36], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  return null;
}

function Clic({ onClic }: { onClic: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClic(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function Mapa({
  obras = [], puntos = [], linea, alto = 320, onClic, centro, resaltar,
}: {
  obras?: Obra[];
  puntos?: PuntoMapa[];
  linea?: [[number, number], [number, number]];
  alto?: number | string;
  onClic?: (lat: number, lng: number) => void;
  centro?: [number, number];
  resaltar?: string | null;
}) {
  const todos: [number, number][] = [
    ...obras.map((o) => [o.lat, o.lng] as [number, number]),
    ...puntos.map((p) => [p.lat, p.lng] as [number, number]),
  ];
  const inicial: LatLngExpression = centro || todos[0] || [-12.1, -77.02];
  return (
    <div style={{ height: alto }} className="overflow-hidden rounded-2xl ring-1 ring-acero-100">
      <MapContainer center={inicial} zoom={12} scrollWheelZoom={!!onClic} className="h-full w-full">
        <TileLayer url={TEJAS.url} attribution={TEJAS.atribucion} />
        {obras.map((o) => (
          <Circle key={o.id} center={[o.lat, o.lng]} radius={o.radio_m}
            pathOptions={{ color: resaltar === o.id ? '#D9860B' : '#1E4A75', weight: 2, fillColor: resaltar === o.id ? '#F5A524' : '#3B6A99', fillOpacity: 0.12 }}>
            <Tooltip direction="top">{o.nombre} · radio {o.radio_m} m</Tooltip>
          </Circle>
        ))}
        {linea && <Polyline positions={linea} pathOptions={{ color: '#D9860B', weight: 2, dashArray: '4 6' }} />}
        {puntos.map((p, i) => (
          <CircleMarker key={i} center={[p.lat, p.lng]} radius={p.radio || 7} pathOptions={{ color: '#fff', weight: 2, fillColor: p.color, fillOpacity: 1 }}>
            {p.etiqueta && <Tooltip direction="top">{p.etiqueta}</Tooltip>}
          </CircleMarker>
        ))}
        {onClic && <Clic onClic={onClic} />}
        <Encuadre puntos={todos} />
      </MapContainer>
    </div>
  );
}
