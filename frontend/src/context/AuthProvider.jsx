import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { AuthContext } from './AuthContext';

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [cargando, setCargando] = useState(true);

  const limpiarSesion = useCallback(() => {
    localStorage.removeItem('token');
    setUsuario(null);
    setTenant(null);
  }, []);

  async function cargarTenant() {
    try {
      const res = await api.get('/tenants/mi-tenant');
      setTenant(res.data);
    } catch {
      // no crítico
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      Promise.resolve().then(() => setCargando(false));
      return;
    }
    api.get('/auth/me')
      .then(res => {
        if (!res.data?.tenant_id) { limpiarSesion(); return; }
        setUsuario(res.data);
        cargarTenant();
      })
      .catch(() => limpiarSesion())
      .finally(() => setCargando(false));
  }, [limpiarSesion]);

  async function login(email, password) {
    limpiarSesion();
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setUsuario(res.data.usuario);
    cargarTenant();
    return res.data;
  }

  function logout() {
    limpiarSesion();
  }

  async function refreshUsuario() {
    try {
      const res = await api.get('/auth/me');
      if (!res.data?.tenant_id) { limpiarSesion(); return; }
      setUsuario(res.data);
    } catch {
      limpiarSesion();
    }
  }

  return (
    <AuthContext.Provider value={{ usuario, setUsuario, tenant, cargando, login, logout, refreshUsuario, cargarTenant }}>
      {children}
    </AuthContext.Provider>
  );
}
