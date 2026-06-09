import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from './useAuth';

const PermisosContext = createContext({ modulos: [], tieneAcceso: () => false, cargando: true });

export function PermisosProvider({ children }) {
  const { usuario } = useAuth();
  const [modulos, setModulos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!usuario) {
      setModulos([]);
      setCargando(false);
      return;
    }
    // Admin tiene acceso a todo — no necesita consultar
    if (usuario.rol === 'admin') {
      setModulos(['*']);
      setCargando(false);
      return;
    }
    setCargando(true);
    api.get(`/permisos/${usuario.rol}`)
      .then(r => setModulos(r.data.modulos))
      .catch(() => setModulos([]))
      .finally(() => setCargando(false));
  }, [usuario]);

  function tieneAcceso(modulo) {
    if (modulos.includes('*')) return true; // admin
    return modulos.includes(modulo);
  }

  return (
    <PermisosContext.Provider value={{ modulos, tieneAcceso, cargando }}>
      {children}
    </PermisosContext.Provider>
  );
}

export const usePermisos = () => useContext(PermisosContext);
