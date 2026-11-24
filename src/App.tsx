import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Bienvenida from './Bienvenida';
import { Cargando } from './ui/comunes';

const AppTrabajador = lazy(() => import('./worker/AppTrabajador'));
const Panel = lazy(() => import('./admin/Panel'));

export default function App() {
  return (
    <Suspense fallback={<Cargando texto="Abriendo…" className="min-h-screen" />}>
      <Routes>
        <Route path="/" element={<Bienvenida />} />
        <Route path="/app/*" element={<AppTrabajador />} />
        <Route path="/admin/*" element={<Panel />} />
        <Route path="*" element={<Bienvenida />} />
      </Routes>
    </Suspense>
  );
}
