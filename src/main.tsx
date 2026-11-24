import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './App';
import { ProveedorAvisos } from './ui/comunes';
import { escucharInstalacion } from './ui/instalar';

registerSW({ immediate: true });
escucharInstalacion();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ProveedorAvisos>
        <App />
      </ProveedorAvisos>
    </HashRouter>
  </StrictMode>,
);
