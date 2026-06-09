import { useState, useCallback, useEffect } from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import api from '../api/axios';
import {
  CalendarDaysIcon, ArrowRightOnRectangleIcon, ArrowLeftOnRectangleIcon,
  XCircleIcon, WrenchScrewdriverIcon, CurrencyDollarIcon, MagnifyingGlassIcon,
  FunnelIcon, ChevronLeftIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline';

const hoy = new Date().toISOString().split('T')[0];
const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

const TIPOS = [
  { value: '',             label: 'Todos',          icon: FunnelIcon,                     color: 'text-slate-500'  },
  { value: 'reserva',     label: 'Reservas',        icon: CalendarDaysIcon,               color: 'text-blue-500'   },
  { value: 'checkin',     label: 'Check-in',        icon: ArrowRightOnRectangleIcon,      color: 'text-green-500'  },
  { value: 'checkout',    label: 'Check-out',       icon: ArrowLeftOnRectangleIcon,       color: 'text-amber-500'  },
  { value: 'cancelacion', label: 'Cancelaciones',   icon: XCircleIcon,                    color: 'text-red-500'    },
  { value: 'factura',     label: 'Facturas',        icon: CurrencyDollarIcon,             color: 'text-purple-500' },
  { value: 'mantenimiento', label: 'Mantenimiento', icon: WrenchScrewdriverIcon,          color: 'text-orange-500' },
];

const TIPO_STYLE = {
  reserva:      { bg: 'bg-blue-50 border-blue-200',     dot: 'bg-blue-500',    icon: CalendarDaysIcon,          label: 'Reserva'       },
  checkin:      { bg: 'bg-green-50 border-green-200',   dot: 'bg-green-500',   icon: ArrowRightOnRectangleIcon, label: 'Check-in'      },
  checkout:     { bg: 'bg-amber-50 border-amber-200',   dot: 'bg-amber-500',   icon: ArrowLeftOnRectangleIcon,  label: 'Check-out'     },
  cancelacion:  { bg: 'bg-red-50 border-red-200',       dot: 'bg-red-500',     icon: XCircleIcon,               label: 'Cancelación'   },
  factura:      { bg: 'bg-purple-50 border-purple-200', dot: 'bg-purple-500',  icon: CurrencyDollarIcon,        label: 'Factura'       },
  mantenimiento:{ bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500',  icon: WrenchScrewdriverIcon,     label: 'Mantenimiento' },
};

function formatFecha(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function EventoCard({ ev }) {
  const estilo = TIPO_STYLE[ev.tipo] || TIPO_STYLE.reserva;
  const Icon = estilo.icon;
  return (
    <div className={`flex gap-4 border rounded-xl px-4 py-3 ${estilo.bg}`}>
      {/* Icono */}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${estilo.dot} bg-opacity-20`}>
        <Icon className={`w-5 h-5 ${estilo.dot.replace('bg-', 'text-')}`} />
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <span className={`text-[11px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${estilo.dot} text-white mr-2`}>
              {estilo.label}
            </span>
            <span className="font-semibold text-slate-800 text-sm">{ev.titulo}</span>
          </div>
          <span className="text-xs text-slate-400 shrink-0">{formatFecha(ev.fecha)}</span>
        </div>
        <p className="text-xs text-slate-600 mt-1">{ev.detalle}</p>
        <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-slate-500">
          {ev.codigo && <span className="font-mono bg-white/70 px-1.5 py-0.5 rounded border border-slate-200">{ev.codigo}</span>}
          {ev.habitacion && <span>Hab. {ev.habitacion}</span>}
          {ev.meta?.metodo_pago && <span>· Pago: {ev.meta.metodo_pago}</span>}
          {ev.meta?.factura_numero && <span>· Factura: {ev.meta.factura_numero}</span>}
          {ev.meta?.prioridad && <span>· Prioridad: {ev.meta.prioridad}</span>}
          {ev.origen && <span>· Origen: {ev.origen}</span>}
        </div>
      </div>
    </div>
  );
}

export default function Historial() {
  const [eventos, setEventos] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [cargando, setCargando] = useState(true);

  const [filtros, setFiltros] = useState({
    desde: hace30,
    hasta: hoy,
    tipo: '',
    buscar: '',
    page: 1,
  });

  const cargar = useCallback(() => {
    setCargando(true);
    const params = new URLSearchParams();
    if (filtros.desde)  params.set('desde', filtros.desde);
    if (filtros.hasta)  params.set('hasta', filtros.hasta);
    if (filtros.tipo)   params.set('tipo', filtros.tipo);
    if (filtros.buscar) params.set('buscar', filtros.buscar);
    params.set('page', filtros.page);

    api.get(`/historial?${params.toString()}`)
      .then(r => { setEventos(r.data.eventos); setTotal(r.data.total); setPages(r.data.pages); })
      .finally(() => setCargando(false));
  }, [filtros]);

  // Carga inmediata al cambiar cualquier filtro
  useEffect(() => { cargar(); }, [cargar]);

  // Polling automático cada 30s (no re-dispara si ya corrió por cambio de filtro)
  useAutoRefresh(cargar, 30000);

  function setF(key, value) {
    setFiltros(f => ({ ...f, [key]: value, page: key !== 'page' ? 1 : value }));
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-800">Historial de movimientos</h1>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        {/* Fechas y búsqueda */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Desde</label>
            <input type="date" value={filtros.desde} max={filtros.hasta}
              onChange={e => setF('desde', e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Hasta</label>
            <input type="date" value={filtros.hasta} min={filtros.desde} max={hoy}
              onChange={e => setF('hasta', e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-slate-500 mb-1">Buscar</label>
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={filtros.buscar} onChange={e => setF('buscar', e.target.value)}
                placeholder="Huésped, código, habitación..."
                className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>
          <button onClick={() => setFiltros({ desde: hace30, hasta: hoy, tipo: '', buscar: '', page: 1 })}
            className="px-3 py-1.5 text-sm text-slate-500 border border-slate-300 rounded-lg hover:bg-slate-50">
            Limpiar
          </button>
        </div>

        {/* Filtro por tipo */}
        <div className="flex flex-wrap gap-2">
          {TIPOS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.value} onClick={() => setF('tipo', t.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  filtros.tipo === t.value
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                }`}>
                <Icon className={`w-3.5 h-3.5 ${filtros.tipo === t.value ? 'text-white' : t.color}`} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Resultados */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{total} evento{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</span>
        {pages > 1 && <span>Página {filtros.page} de {pages}</span>}
      </div>

      {cargando ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : eventos.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-slate-400">No hay eventos en el período seleccionado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {eventos.map(ev => <EventoCard key={ev.id} ev={ev} />)}
        </div>
      )}

      {/* Paginación */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button disabled={filtros.page <= 1} onClick={() => setF('page', filtros.page - 1)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
            <ChevronLeftIcon className="w-4 h-4" /> Anterior
          </button>
          <span className="text-sm text-slate-600">
            {filtros.page} / {pages}
          </span>
          <button disabled={filtros.page >= pages} onClick={() => setF('page', filtros.page + 1)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
            Siguiente <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
