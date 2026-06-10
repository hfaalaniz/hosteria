import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthProvider';
import { useAuth } from './context/useAuth';
import { PermisosProvider, usePermisos } from './context/PermisosContext';
import { NotificacionesProvider } from './context/NotificacionesContext';
import './i18n';

import Layout from './components/Layout';
import Login from './pages/Login';
import Registro from './pages/Registro';
import Dashboard from './pages/Dashboard';
import Habitaciones from './pages/Habitaciones';
import Reservas from './pages/Reservas';
import Huespedes from './pages/Huespedes';
import Checkin from './pages/Checkin';
import Checkout from './pages/Checkout';
import Facturacion from './pages/Facturacion';
import Servicios from './pages/Servicios';
import Mantenimiento from './pages/Mantenimiento';
import Configuracion from './pages/Configuracion';
import Calendario from './pages/Calendario';
import Historial from './pages/Historial';
import Reportes from './pages/Reportes';
import ReporteEstadisticas from './pages/ReporteEstadisticas';
import Usuarios from './pages/Usuarios';
import Roles from './pages/Roles';
import PartesLimpieza from './pages/PartesLimpieza';
import PartesMantenimiento from './pages/PartesMantenimiento';
import Demo from './pages/Demo';

function ProtectedRoute({ children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return usuario ? children : <Navigate to="/login" replace />;
}

// Protege una ruta por módulo — redirige al dashboard si no tiene acceso
function ModuloRoute({ modulo, children }) {
  const { tieneAcceso, cargando } = usePermisos();
  if (cargando) return null;
  return tieneAcceso(modulo) ? children : <Navigate to="/" replace />;
}

function AppRoutes() {
  const { usuario } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={usuario ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/registro" element={usuario ? <Navigate to="/" replace /> : <Registro />} />
      <Route path="/demo" element={<Demo />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="calendario"   element={<ModuloRoute modulo="calendario">  <Calendario />   </ModuloRoute>} />
        <Route path="habitaciones" element={<ModuloRoute modulo="habitaciones"><Habitaciones />  </ModuloRoute>} />
        <Route path="reservas"     element={<ModuloRoute modulo="reservas">    <Reservas />      </ModuloRoute>} />
        <Route path="huespedes"    element={<ModuloRoute modulo="huespedes">   <Huespedes />     </ModuloRoute>} />
        <Route path="checkin"      element={<ModuloRoute modulo="checkin">     <Checkin />       </ModuloRoute>} />
        <Route path="checkout"     element={<ModuloRoute modulo="checkout">    <Checkout />      </ModuloRoute>} />
        <Route path="facturacion"  element={<ModuloRoute modulo="facturacion"> <Facturacion />   </ModuloRoute>} />
        <Route path="servicios"    element={<ModuloRoute modulo="servicios">   <Servicios />     </ModuloRoute>} />
        <Route path="mantenimiento" element={<ModuloRoute modulo="mantenimiento"><Mantenimiento /></ModuloRoute>} />
        <Route path="historial"    element={<ModuloRoute modulo="historial">   <Historial />     </ModuloRoute>} />
        <Route path="reportes"     element={<ModuloRoute modulo="reportes">    <Reportes />      </ModuloRoute>} />
        <Route path="reportes/estadisticas" element={<ModuloRoute modulo="reportes"><ReporteEstadisticas /></ModuloRoute>} />
        <Route path="configuracion" element={<ModuloRoute modulo="configuracion"><Configuracion /></ModuloRoute>} />
        <Route path="partes-limpieza"       element={<ModuloRoute modulo="partes_limpieza">      <PartesLimpieza />       </ModuloRoute>} />
        <Route path="partes-mantenimiento"  element={<ModuloRoute modulo="partes_mantenimiento"> <PartesMantenimiento />  </ModuloRoute>} />
        {/* Solo admin */}
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="roles"    element={<Roles />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PermisosProvider>
          <NotificacionesProvider>
            <AppRoutes />
            <Toaster position="top-right" toastOptions={{ duration: 3000, style: { fontSize: '14px' } }} />
          </NotificacionesProvider>
        </PermisosProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
