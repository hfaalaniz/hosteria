import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import api from '../api/axios';

const NotificacionesContext = createContext(null);

export function NotificacionesProvider({ children }) {
  const [notificaciones, setNotificaciones] = useState([]);
  const intervalRef = useRef(null);

  const cargar = useCallback(async () => {
    if (!localStorage.getItem('token')) return;
    try {
      const r = await api.get('/notificaciones');
      setNotificaciones(r.data);
    } catch {
      // silencioso — puede fallar si no hay sesión aún
    }
  }, []);

  const marcarLeida = useCallback(async (id) => {
    try {
      await api.patch(`/notificaciones/${id}/leer`);
      setNotificaciones(prev => prev.filter(n => n.id !== id));
    } catch {/* silencioso */}
  }, []);

  const marcarTodasLeidas = useCallback(async () => {
    try {
      await api.patch('/notificaciones/leer-todas');
      setNotificaciones([]);
    } catch {/* silencioso */}
  }, []);

  // Polling cada 30s
  useEffect(() => {
    cargar();
    intervalRef.current = setInterval(cargar, 30000);
    return () => clearInterval(intervalRef.current);
  }, [cargar]);

  return (
    <NotificacionesContext.Provider value={{ notificaciones, cargar, marcarLeida, marcarTodasLeidas }}>
      {children}
    </NotificacionesContext.Provider>
  );
}

export function useNotificaciones() {
  return useContext(NotificacionesContext);
}
