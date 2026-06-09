import { useState, useCallback, useEffect, useRef } from 'react';
import api from '../api/axios';
import {
  DocumentArrowDownIcon, PrinterIcon, CalendarDaysIcon,
  BuildingOfficeIcon, UsersIcon, CurrencyDollarIcon,
  ChartBarIcon, GlobeAltIcon, ArrowPathIcon, StarIcon,
} from '@heroicons/react/24/outline';

const TIPOS = [
  { value: 'diario',    label: 'Diario',    desc: '1 día' },
  { value: 'semanal',   label: 'Semanal',   desc: '7 días' },
  { value: 'quincenal', label: 'Quincenal', desc: '15 días' },
  { value: 'mensual',   label: 'Mensual',   desc: 'mes completo' },
  { value: 'libre',     label: 'Libre',     desc: 'rango propio' },
];

const ESTADO_LABEL = {
  pendiente:  { text: 'Pendiente',  bg: 'bg-yellow-100 text-yellow-700' },
  confirmada: { text: 'Confirmada', bg: 'bg-blue-100 text-blue-700' },
  checkin:    { text: 'En casa',    bg: 'bg-green-100 text-green-700' },
  checkout:   { text: 'Check-out',  bg: 'bg-slate-100 text-slate-600' },
  cancelada:  { text: 'Cancelada',  bg: 'bg-red-100 text-red-600' },
};

function fmt(n) { return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0 }).format(n ?? 0); }
function fmtMoney(n) { return `$${fmt(n)}`; }
function fmtFecha(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

function StatBox({ label, value, sub, color = 'slate' }) {
  const colors = {
    slate:  'bg-white border-slate-200 text-slate-800',
    blue:   'bg-blue-50 border-blue-200 text-blue-800',
    green:  'bg-green-50 border-green-200 text-green-800',
    amber:  'bg-amber-50 border-amber-200 text-amber-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-xs font-medium opacity-70 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function Reportes() {
  const hoy = new Date().toISOString().split('T')[0];
  const [tipo, setTipo] = useState('diario');
  const [fecha, setFecha] = useState(hoy);
  const [fechaLibreDesde, setFechaLibreDesde] = useState('');
  const [fechaLibreHasta, setFechaLibreHasta] = useState('');
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [huespedesFrec, setHuespedesFrec] = useState([]);
  const [cargandoFrec, setCargandoFrec] = useState(false);
  const printRef = useRef();

  const cargar = useCallback(() => {
    if (tipo === 'libre' && (!fechaLibreDesde || !fechaLibreHasta)) return;
    setCargando(true);
    const params = tipo === 'libre'
      ? `tipo=libre&fecha_desde=${fechaLibreDesde}&fecha_hasta=${fechaLibreHasta}`
      : `tipo=${tipo}&fecha=${fecha}`;
    api.get(`/reportes/ocupacion?${params}`)
      .then(r => setDatos(r.data))
      .finally(() => setCargando(false));
  }, [tipo, fecha, fechaLibreDesde, fechaLibreHasta]);

  const cargarFrecuentes = useCallback(() => {
    setCargandoFrec(true);
    const params = tipo === 'libre' && fechaLibreDesde
      ? `desde=${fechaLibreDesde}&hasta=${fechaLibreHasta}`
      : '';
    api.get(`/reportes/huespedes-frecuentes?${params}`)
      .then(r => setHuespedesFrec(Array.isArray(r.data) ? r.data : (r.data?.huespedes ?? [])))
      .catch(() => setHuespedesFrec([]))
      .finally(() => setCargandoFrec(false));
  }, [tipo, fechaLibreDesde, fechaLibreHasta]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { cargarFrecuentes(); }, [cargarFrecuentes]);

  function imprimir() {
    window.print();
  }

  if (cargando && !datos) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const r = datos?.resumen;
  const p = datos?.periodo;

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reporte de Ocupación</h1>
          <p className="text-sm text-slate-500 mt-0.5">Para presentación al ente turístico municipal</p>
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} disabled={cargando}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 disabled:opacity-50">
            <ArrowPathIcon className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button onClick={imprimir}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg">
            <PrinterIcon className="w-4 h-4" />
            Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 no-print">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Tipo de período */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Período</label>
            <div className="flex gap-2">
              {TIPOS.map(t => (
                <button key={t.value} onClick={() => setTipo(t.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    tipo === t.value
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                  }`}>
                  {t.label}
                  <span className="ml-1.5 text-[10px] opacity-60">({t.desc})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Fecha de referencia o rango libre */}
          {tipo !== 'libre' ? (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Fecha de referencia
              </label>
              <input type="date" value={fecha} max={hoy}
                onChange={e => setFecha(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Desde</label>
                <input type="date" value={fechaLibreDesde} max={hoy}
                  onChange={e => setFechaLibreDesde(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Hasta</label>
                <input type="date" value={fechaLibreHasta} max={hoy}
                  onChange={e => setFechaLibreHasta(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <button onClick={cargar} disabled={!fechaLibreDesde || !fechaLibreHasta || cargando}
                className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg disabled:opacity-50 self-end">
                Generar
              </button>
            </>
          )}

          {p && (
            <div className="text-sm text-slate-500 pb-2">
              Período: <span className="font-semibold text-slate-700">{fmtFecha(p.desde)}</span>
              {p.desde !== p.hasta && <> al <span className="font-semibold text-slate-700">{fmtFecha(p.hasta)}</span></>}
              <span className="ml-2 text-slate-400">({p.dias} {p.dias === 1 ? 'día' : 'días'})</span>
            </div>
          )}
        </div>
      </div>

      {datos && (
        <div ref={printRef} className="space-y-5">
          {/* Encabezado imprimible */}
          <div className="print-only hidden bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{datos.establecimiento?.nombre_hosteria}</h2>
                <p className="text-sm text-slate-500">{datos.establecimiento?.direccion}</p>
                <p className="text-sm text-slate-500">{datos.establecimiento?.telefono} · {datos.establecimiento?.email}</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-slate-800">Reporte de Ocupación</div>
                <div className="text-sm text-slate-500 capitalize">{p?.tipo}</div>
                <div className="text-sm font-medium text-slate-700">
                  {fmtFecha(p?.desde)}{p?.desde !== p?.hasta ? ` al ${fmtFecha(p?.hasta)}` : ''}
                </div>
              </div>
            </div>
          </div>

          {/* Stats resumen */}
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <ChartBarIcon className="w-4 h-4" /> Resumen del período
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatBox label="Ocupación" value={`${r.porcentaje_ocupacion}%`}
                sub={`${r.noches_vendidas} de ${r.capacidad_total} noches-hab`} color="blue" />
              <StatBox label="Hab. ocupadas" value={r.habitaciones_ocupadas}
                sub={`de ${r.total_habitaciones} totales`} color="slate" />
              <StatBox label="Huéspedes" value={r.total_huespedes}
                sub={`${r.adultos} adultos · ${r.ninos} niños`} color="green" />
              <StatBox label="Ingresos" value={fmtMoney(r.ingresos_facturados)}
                sub={`${r.facturas_emitidas} factura${r.facturas_emitidas !== 1 ? 's' : ''}`} color="amber" />
              <StatBox label="Cancelaciones" value={r.cancelaciones}
                sub={`${r.checkins_periodo} ingresos · ${r.checkouts_periodo} egresos`} color="purple" />
            </div>
          </div>

          {/* Detalle de huéspedes */}
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <UsersIcon className="w-4 h-4" /> Registro de huéspedes ({datos.huespedes?.length ?? 0})
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Huésped</th>
                      <th className="px-4 py-3 text-left">Documento</th>
                      <th className="px-4 py-3 text-left">Nacionalidad</th>
                      <th className="px-4 py-3 text-left">Hab.</th>
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-left">Ingreso</th>
                      <th className="px-4 py-3 text-left">Egreso</th>
                      <th className="px-4 py-3 text-center">Noches</th>
                      <th className="px-4 py-3 text-center">Pax</th>
                      <th className="px-4 py-3 text-left">Estado</th>
                      <th className="px-4 py-3 text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {datos.huespedes?.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                          Sin huéspedes en el período
                        </td>
                      </tr>
                    ) : datos.huespedes?.map((h, i) => {
                      const est = ESTADO_LABEL[h.estado] || { text: h.estado, bg: 'bg-slate-100 text-slate-600' };
                      return (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-800">{h.apellido}</td>
                          <td className="px-4 py-2.5 text-slate-500 text-xs">{h.documento}</td>
                          <td className="px-4 py-2.5 text-slate-500">{h.nacionalidad}</td>
                          <td className="px-4 py-2.5 font-mono text-slate-700">{h.habitacion}</td>
                          <td className="px-4 py-2.5 text-slate-500 text-xs">{h.tipo}</td>
                          <td className="px-4 py-2.5 text-slate-600">{fmtFecha(h.entrada)}</td>
                          <td className="px-4 py-2.5 text-slate-600">{fmtFecha(h.salida)}</td>
                          <td className="px-4 py-2.5 text-center text-slate-700">{h.noches}</td>
                          <td className="px-4 py-2.5 text-center text-slate-700">{h.adultos + h.ninos}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${est.bg}`}>{est.text}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-slate-800">{fmtMoney(h.importe)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Por tipo de habitación */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <BuildingOfficeIcon className="w-4 h-4" /> Por tipo de habitación
              </h2>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-center">Habs.</th>
                      <th className="px-4 py-3 text-center">Reservas</th>
                      <th className="px-4 py-3 text-center">Pax</th>
                      <th className="px-4 py-3 text-right">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {datos.por_tipo?.map((t, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-800">{t.tipo}</td>
                        <td className="px-4 py-2.5 text-center text-slate-600">{t.habitaciones}</td>
                        <td className="px-4 py-2.5 text-center text-slate-600">{t.reservas}</td>
                        <td className="px-4 py-2.5 text-center text-slate-600">{(t.adultos || 0) + (t.ninos || 0)}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-800">{fmtMoney(t.ingresos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Procedencia */}
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <GlobeAltIcon className="w-4 h-4" /> Procedencia de huéspedes
              </h2>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {datos.procedencia?.length === 0 ? (
                  <div className="px-4 py-8 text-center text-slate-400 text-sm">Sin datos de procedencia</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
                        <th className="px-4 py-3 text-left">País / Origen</th>
                        <th className="px-4 py-3 text-center">Huéspedes</th>
                        <th className="px-4 py-3 text-right">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {datos.procedencia?.map((p, i) => {
                        const total = datos.procedencia.reduce((s, x) => s + x.cantidad, 0);
                        return (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-medium text-slate-800">{p.nacionalidad || '—'}</td>
                            <td className="px-4 py-2.5 text-center text-slate-600">{p.cantidad}</td>
                            <td className="px-4 py-2.5 text-right text-slate-500">
                              {Math.round((p.cantidad / total) * 100)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* Origen de reservas */}
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <CalendarDaysIcon className="w-4 h-4" /> Canal de origen de reservas
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap gap-3">
                {datos.origenes?.map((o, i) => {
                  const total = datos.origenes.reduce((s, x) => s + x.cantidad, 0);
                  return (
                    <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <span className="font-medium text-slate-800 capitalize">{o.origen || 'directo'}</span>
                      <span className="text-slate-500 text-sm">{o.cantidad}</span>
                      <span className="text-xs text-slate-400">({Math.round((o.cantidad / total) * 100)}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Pie de firma para impresión */}
          <div className="print-only hidden bg-white rounded-xl border border-slate-200 p-6 mt-8">
            <div className="flex justify-between items-end pt-8">
              <div className="text-center w-48">
                <div className="border-t border-slate-400 pt-2 text-xs text-slate-500">Firma y sello del establecimiento</div>
              </div>
              <div className="text-xs text-slate-400 text-right">
                Generado: {new Date().toLocaleString('es-AR')}<br />
                {datos.establecimiento?.nombre_hosteria}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Huéspedes frecuentes — independiente del reporte de ocupación */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <StarIcon className="w-4 h-4" /> Huéspedes frecuentes
          {cargandoFrec && <span className="text-xs text-slate-400 font-normal">(cargando...)</span>}
        </h2>
        {!cargandoFrec && huespedesFrec.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400 text-sm">
            Sin huéspedes con más de una visita registrada
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Huésped</th>
                  <th className="px-4 py-3 text-left">Nacionalidad</th>
                  <th className="px-4 py-3 text-center">Estancias</th>
                  <th className="px-4 py-3 text-center">Noches</th>
                  <th className="px-4 py-3 text-right">Total gastado</th>
                  <th className="px-4 py-3 text-left">Primera visita</th>
                  <th className="px-4 py-3 text-left">Última visita</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {huespedesFrec.map((h, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{h.nombre}</div>
                      {h.email && <div className="text-xs text-slate-400">{h.email}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{h.nacionalidad || '—'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                        {h.total_reservas >= 5 && <StarIcon className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />}
                        {h.total_reservas}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-slate-700">{h.total_noches}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-800">{fmtMoney(h.total_gastado)}</td>
                    <td className="px-4 py-2.5 text-slate-500">{fmtFecha(h.primera_visita)}</td>
                    <td className="px-4 py-2.5 text-slate-500">{fmtFecha(h.ultima_visita)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
