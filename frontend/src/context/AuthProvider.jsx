import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { AuthContext } from './AuthContext';

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  const limpiarSesion = useCallback(() => {
    localStorage.removeItem('token');
    setUsuario(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      Promise.resolve().then(() => setCargando(false));
      return;
    }
    api.get('/auth/me')
      .then(res => setUsuario(res.data))
      .catch(() => limpiarSesion())
      .finally(() => setCargando(false));
  }, [limpiarSesion]);

  async function login(email, password) {
    limpiarSesion();
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setUsuario(res.data.usuario);
    return res.data;
  }

  function logout() {
    limpiarSesion();
  }

  async function refreshUsuario() {
    try {
      const res = await api.get('/auth/me');
      setUsuario(res.data);
    } catch {
      limpiarSesion();
    }
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout, refreshUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}
