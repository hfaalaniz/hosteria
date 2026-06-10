import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/useAuth';
import { usePermisos } from '../context/PermisosContext';
import PillNotificaciones from './PillNotificaciones';
import {
  HomeIcon, BuildingOfficeIcon, CalendarDaysIcon, UsersIcon,
  ArrowRightOnRectangleIcon, ArrowLeftOnRectangleIcon, CurrencyDollarIcon,
  WrenchScrewdriverIcon, Cog6ToothIcon, SparklesIcon, Bars3Icon,
  TableCellsIcon, ClockIcon, DocumentChartBarIcon, ChartBarIcon,
  UserGroupIcon, ShieldCheckIcon, ClipboardDocumentListIcon, WrenchIcon,
} from '@heroicons/react/24/outline';

const LANGUAGES = [
  { code: 'es', label: 'ES', name: 'Español' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'pt', label: 'PT', name: 'Português' },
  { code: 'zh', label: '中文', name: '中文' },
];

// Todos los módulos disponibles con su módulo clave para chequear permisos
// modulo: null = siempre visible (dashboard, admin-only)
const ALL_NAV = [
  { to: '/',                      icon: HomeIcon,                    label: 'nav.dashboard',    modulo: null,             end: true },
  { to: '/calendario',            icon: TableCellsIcon,              label: 'Calendario',        modulo: 'calendario'              },
  { to: '/habitaciones',          icon: BuildingOfficeIcon,          label: 'nav.habitaciones',  modulo: 'habitaciones'            },
  { to: '/reservas',              icon: CalendarDaysIcon,            label: 'nav.reservas',      modulo: 'reservas'                },
  { to: '/huespedes',             icon: UsersIcon,                   label: 'nav.huespedes',     modulo: 'huespedes'               },
  { to: '/checkin',               icon: ArrowRightOnRectangleIcon,   label: 'nav.checkin',       modulo: 'checkin'                 },
  { to: '/checkout',              icon: ArrowLeftOnRectangleIcon,    label: 'nav.checkout',      modulo: 'checkout'                },
  { to: '/facturacion',           icon: CurrencyDollarIcon,          label: 'nav.facturacion',   modulo: 'facturacion'             },
  { to: '/servicios',             icon: SparklesIcon,                label: 'nav.servicios',     modulo: 'servicios'               },
  { to: '/mantenimiento',         icon: WrenchScrewdriverIcon,       label: 'nav.mantenimiento', modulo: 'mantenimiento'           },
  { to: '/historial',             icon: ClockIcon,                   label: 'Historial',          modulo: 'historial'               },
  { to: '/partes-limpieza',       icon: ClipboardDocumentListIcon,   label: 'Partes de limpieza', modulo: 'partes_limpieza'         },
  { to: '/partes-mantenimiento',  icon: WrenchIcon,                  label: 'Partes de mant.',    modulo: 'partes_mantenimiento'    },
  { to: '/reportes',              icon: DocumentChartBarIcon,        label: 'Reporte detallado',  modulo: 'reportes'                },
  { to: '/reportes/estadisticas', icon: ChartBarIcon,                label: 'Reporte estadístico',modulo: 'reportes'               },
  // Solo admin — sin modulo (null = siempre para quien pase el filtro de adminOnly)
  { to: '/usuarios',              icon: UserGroupIcon,               label: 'Usuarios',           modulo: 'adminOnly'               },
  { to: '/roles',                 icon: ShieldCheckIcon,             label: 'Roles y permisos',   modulo: 'adminOnly'               },
  { to: '/configuracion',         icon: Cog6ToothIcon,               label: 'nav.configuracion',  modulo: 'configuracion'           },
];

export default function Layout() {
  const { t, i18n } = useTranslation();
  const { usuario, tenant, logout } = useAuth();
  const { tieneAcceso } = usePermisos();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const esAdmin = usuario?.rol === 'admin';

  const navItems = ALL_NAV.filter(item => {
    if (item.modulo === null) return true;           // dashboard siempre
    if (item.modulo === 'adminOnly') return esAdmin; // solo admin
    return tieneAcceso(item.modulo);                 // chequea permisos
  });

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-slate-900 text-white">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
        <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0">
          {(tenant?.nombre || 'H')[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="font-bold text-sm leading-tight truncate">{tenant?.nombre || 'Mi Hostería'}</div>
          <div className="text-slate-400 text-xs capitalize">{tenant?.plan || 'trial'}</div>
        </div>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-amber-500 text-white font-medium'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            {label.startsWith('nav.') ? t(label) : label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-slate-700">
        <div className="flex flex-wrap gap-1 mb-3">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => i18n.changeLanguage(lang.code)}
              title={lang.name}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                i18n.language === lang.code
                  ? 'bg-amber-500 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-white">{usuario?.nombre}</div>
            <div className="text-xs text-slate-400 capitalize">{usuario?.rol}</div>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-white p-1 rounded" title={t('auth.logout')}>
            <ArrowLeftOnRectangleIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-60 z-50">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-600">
            <Bars3Icon className="w-6 h-6" />
          </button>
          <span className="font-bold text-slate-800">{tenant?.nombre || 'Hostería'}</span>
        </div>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <PillNotificaciones />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
