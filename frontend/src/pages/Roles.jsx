import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/useAuth';
import { ShieldCheckIcon, CheckIcon } from '@heroicons/react/24/outline';

// Debe coincidir con los módulos en ALL_NAV de Layout.jsx
const MODULOS = [
  { key: 'calendario',           label: 'Calendario',           desc: 'Vista de calendario de reservas' },
  { key: 'habitaciones',         label: 'Habitaciones',          desc: 'Ver y gestionar habitaciones' },
  { key: 'reservas',             label: 'Reservas',              desc: 'Crear y administrar reservas' },
  { key: 'huespedes',            label: 'Clientes / Huéspedes',  desc: 'Listado y ficha de clientes' },
  { key: 'checkin',              label: 'Check-in',              desc: 'Realizar ingresos de huéspedes' },
  { key: 'checkout',             label: 'Check-out',             desc: 'Realizar egresos y cierre' },
  { key: 'facturacion',          label: 'Facturación',           desc: 'Emitir y ver facturas' },
  { key: 'servicios',            label: 'Servicios',             desc: 'Gestionar servicios adicionales' },
  { key: 'mantenimiento',        label: 'Mantenimiento',         desc: 'Reportes de mantenimiento (vista original)' },
  { key: 'partes_limpieza',      label: 'Partes de limpieza',    desc: 'Registro de limpieza por habitación' },
  { key: 'partes_mantenimiento', label: 'Partes de mantenimiento', desc: 'Registro detallado de trabajos y materiales' },
  { key: 'historial',            label: 'Historial',             desc: 'Historial de movimientos' },
  { key: 'reportes',             label: 'Reportes',              desc: 'Reportes de ocupación (ambos)' },
  { key: 'configuracion',        label: 'Configuración',         desc: 'Configuración general del sistema' },
];

const ROLES_EDITABLES = [
  { value: 'recepcion',     label: 'Recepción',    color: 'bg-blue-100 text-blue-700 border-blue-200'   },
  { value: 'limpieza',      label: 'Limpieza',     color: 'bg-green-100 text-green-700 border-green-200'},
  { value: 'mantenimiento', label: 'Mantenimiento',color: 'bg-orange-100 text-orange-700 border-orange-200'},
];

export default function Roles() {
  const { usuario } = useAuth();
  const [permisos, setPermisos] = useState({}); // { recepcion: ['calendario',...], limpieza: [...] }
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(null); // rol que se está guardando

  const esAdmin = usuario?.rol === 'admin';

  useEffect(() => {
    if (!esAdmin) return;
    api.get('/permisos')
      .then(r => setPermisos(r.data))
      .finally(() => setCargando(false));
  }, [esAdmin]);

  function toggle(rol, modulo) {
    setPermisos(prev => {
      const actuales = prev[rol] || [];
      const nuevos = actuales.includes(modulo)
        ? actuales.filter(m => m !== modulo)
        : [...actuales, modulo];
      return { ...prev, [rol]: nuevos };
    });
  }

  function toggleTodos(rol) {
    const actuales = permisos[rol] || [];
    const todos = MODULOS.map(m => m.key);
    const tieneTodos = todos.every(m => actuales.includes(m));
    setPermisos(prev => ({ ...prev, [rol]: tieneTodos ? [] : todos }));
  }

  async function guardar(rol) {
    setGuardando(rol);
    try {
      await api.put(`/permisos/${rol}`, { modulos: permisos[rol] || [] });
      toast.success(`Permisos de ${ROLES_EDITABLES.find(r => r.value === rol)?.label} guardados`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al guardar');
    } finally {
      setGuardando(null);
    }
  }

  if (!esAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldCheckIcon className="w-14 h-14 text-slate-300 mb-4" />
        <h2 className="text-lg font-semibold text-slate-600">Acceso restringido</h2>
        <p className="text-sm text-slate-400 mt-1">Solo los administradores pueden gestionar roles y permisos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Roles y permisos</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Configurá qué módulos puede ver cada rol. El administrador siempre tiene acceso completo.
        </p>
      </div>

      {/* Admin card (solo lectura) */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
            <ShieldCheckIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-purple-800">Administrador</div>
            <div className="text-xs text-purple-500">Acceso completo a todos los módulos — no configurable</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {MODULOS.map(m => (
            <span key={m.key} className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full font-medium">
              <CheckIcon className="w-3 h-3" /> {m.label}
            </span>
          ))}
        </div>
      </div>

      {/* Roles editables */}
      {cargando ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          {ROLES_EDITABLES.map(rol => {
            const modulosRol = permisos[rol.value] || [];
            const tieneTodos = MODULOS.every(m => modulosRol.includes(m.key));

            return (
              <div key={rol.value} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Header del rol */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold px-3 py-1 rounded-full border ${rol.color}`}>
                      {rol.label}
                    </span>
                    <span className="text-sm text-slate-500">
                      {modulosRol.length} de {MODULOS.length} módulos habilitados
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleTodos(rol.value)}
                      className="text-xs text-slate-500 hover:text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                      {tieneTodos ? 'Quitar todos' : 'Seleccionar todos'}
                    </button>
                    <button onClick={() => guardar(rol.value)} disabled={guardando === rol.value}
                      className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                      {guardando === rol.value ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </div>
                </div>

                {/* Grid de módulos */}
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {MODULOS.map(mod => {
                    const activo = modulosRol.includes(mod.key);
                    return (
                      <button
                        key={mod.key}
                        onClick={() => toggle(rol.value, mod.key)}
                        className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                          activo
                            ? 'border-amber-400 bg-amber-50'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        {/* Checkbox visual */}
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          activo ? 'bg-amber-500 border-amber-500' : 'border-slate-300'
                        }`}>
                          {activo && <CheckIcon className="w-3 h-3 text-white" />}
                        </div>
                        <div>
                          <div className={`text-sm font-semibold ${activo ? 'text-amber-800' : 'text-slate-700'}`}>
                            {mod.label}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">{mod.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
