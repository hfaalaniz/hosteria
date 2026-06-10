import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const TenantContext = createContext({ config: {}, cargando: true });

export function TenantProvider({ children }) {
  const [config, setConfig] = useState({});
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get('/api/web/config')
      .then(r => setConfig(r.data || {}))
      .catch(() => setConfig({}))
      .finally(() => setCargando(false));
  }, []);

  return (
    <TenantContext.Provider value={{ config, cargando }}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);
