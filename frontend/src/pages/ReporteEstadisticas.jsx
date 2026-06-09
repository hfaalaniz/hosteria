import { useState, useCallback, useEffect, useRef } from 'react';
import api from '../api/axios';
import { PrinterIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const TIPOS = [
  { value: 'hoy',    label: 'Hoy',         desc: '1 día' },
  { value: '7dias',  label: 'Últimos 7 días',  desc: '7 días' },
  { value: '15dias', label: 'Últimos 15 días', desc: '15 días' },
];

function fmtFecha(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

function PctBar({ value, color = 'bg-amber-500' }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-sm font-bold w-10 text-right">{value}%</span>
    </div>
  );
}

function Gauge({ value }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;
  const filled = arc * (value / 100);
  const color = value >= 80 ? '#22c55e' : value >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <svg viewBox="0 0 140 100" className="w-full max-w-[180px]">
      <circle cx="70" cy="80" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12"
        strokeDasharray={`${arc} ${circ}`} strokeLinecap="round"
        transform="rotate(-135 70 80)" />
      <circle cx="70" cy="80" r={r} fill="none" stroke={color} strokeWidth="12"
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        transform="rotate(-135 70 80)" />
      <text x="70" y="78" textAnchor="middle" fontSize="22" fontWeight="bold" fill={color}>{value}%</text>
      <text x="70" y="94" textAnchor="middle" fontSize="9" fill="#94a3b8">OCUPACIÓN</text>
    </svg>
  );
}

export default function ReporteEstadisticas() {
  const [tipo, setTipo] = useState('hoy');
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    api.get(`/reportes/estadisticas?tipo=${tipo}`)
      .then(r => setDatos(r.data))
      .finally(() => setCargando(false));
  }, [tipo]);

  useEffect(() => { cargar(); }, [cargar]);

  const r = datos?.resumen;
  const p = datos?.periodo;

  const hoyStr = new Date().toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reporte Estadístico de Ocupación</h1>
          <p className="text-sm text-slate-500 mt-0.5">Solo porcentajes y métricas — sin listado de clientes</p>
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} disabled={cargando}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 disabled:opacity-50">
            <ArrowPathIcon className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg">
            <PrinterIcon className="w-4 h-4" />
            Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Selector de período */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 no-print">
        <label className="block text-xs font-medium text-slate-500 mb-2">Período</label>
        <div className="flex flex-wrap gap-2">
          {TIPOS.map(t => (
            <button key={t.value} onClick={() => setTipo(t.value)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                tipo === t.value
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {cargando && !datos ? (
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : datos && (
        <div className="space-y-5">

          {/* Encabezado imprimible */}
          <div className="hidden print-only bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4 mb-4">
              <div>
                <div className="text-xl font-bold text-slate-800">{datos.establecimiento?.nombre_hosteria}</div>
                <div className="text-sm text-slate-500">{datos.establecimiento?.direccion}</div>
                <div className="text-sm text-slate-500">{datos.establecimiento?.telefono}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-slate-700">Reporte Estadístico de Ocupación</div>
                <div className="text-sm text-slate-500">
                  {p?.desde === p?.hasta ? fmtFecha(p?.desde) : `${fmtFecha(p?.desde)} al ${fmtFecha(p?.hasta)}`}
                  {' '}({p?.dias} {p?.dias === 1 ? 'día' : 'días'})
                </div>
                <div className="text-xs text-slate-400 mt-1">Generado: {hoyStr}</div>
              </div>
            </div>
          </div>

          {/* Período activo */}
          <div className="bg-slate-800 text-white rounded-xl px-5 py-3 flex items-center justify-between">
            <span className="font-semibold">
              {p?.desde === p?.hasta ? fmtFecha(p?.desde) : `${fmtFecha(p?.desde)} — ${fmtFecha(p?.hasta)}`}
            </span>
            <span className="text-slate-300 text-sm capitalize">{TIPOS.find(t => t.value === tipo)?.label} · {p?.dias} {p?.dias === 1 ? 'día' : 'días'}</span>
          </div>

          {/* Gauge + métricas clave */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Gauge de ocupación */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col items-center justify-center">
              <Gauge value={r.pct_ocupacion} />
              <div className="mt-3 text-center">
                <div className="text-sm text-slate-500">{r.habitaciones_ocupadas} de {r.total_habitaciones} habitaciones</div>
                <div className="text-xs text-slate-400 mt-0.5">{r.noches_vendidas} noches de {r.capacidad_total} posibles</div>
              </div>
            </div>

            {/* Huéspedes */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Huéspedes</div>
              <div className="text-4xl font-bold text-slate-800">{r.total_huespedes}</div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Adultos ({r.adultos})</span>
                  </div>
                  <PctBar value={r.pct_adultos} color="bg-blue-500" />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Niños ({r.ninos})</span>
                  </div>
                  <PctBar value={r.pct_ninos} color="bg-purple-400" />
                </div>
              </div>
            </div>

            {/* Movimientos */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Movimientos</div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Ingresos (check-in)</span>
                  <span className="text-lg font-bold text-green-600">{r.checkins}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Egresos (check-out)</span>
                  <span className="text-lg font-bold text-amber-600">{r.checkouts}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Cancelaciones</span>
                  <span className="text-lg font-bold text-red-500">{r.cancelaciones}</span>
                </div>
                <div className="border-t border-slate-100 pt-2">
                  <div className="text-xs text-slate-500 mb-1">Tasa de cancelación</div>
                  <PctBar value={r.pct_cancelacion} color="bg-red-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Ocupación por día */}
          {datos.por_dia?.length > 1 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Ocupación por día</div>
              <div className="space-y-2">
                {datos.por_dia.map((d, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-20 shrink-0">{fmtFecha(d.fecha)}</span>
                    <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${d.pct >= 80 ? 'bg-green-500' : d.pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ width: `${Math.min(d.pct, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold w-10 text-right text-slate-700">{d.pct}%</span>
                    <span className="text-xs text-slate-400 w-16 shrink-0">{d.ocupadas}/{datos.resumen.total_habitaciones} habs</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Por tipo de habitación + Procedencia */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Por tipo */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Ocupación por tipo</div>
              <div className="space-y-4">
                {datos.por_tipo?.map((t, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-700">{t.tipo}</span>
                      <span className="text-slate-400 text-xs">{t.habitaciones_ocupadas}/{t.habitaciones_total} · {t.adultos + t.ninos} pax</span>
                    </div>
                    <PctBar value={t.pct} color={t.pct >= 80 ? 'bg-green-500' : t.pct >= 50 ? 'bg-amber-400' : 'bg-blue-400'} />
                  </div>
                ))}
              </div>
            </div>

            {/* Procedencia */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Procedencia</div>
              {datos.procedencia?.length === 0 ? (
                <div className="text-sm text-slate-400 py-4 text-center">Sin datos de procedencia</div>
              ) : (
                <div className="space-y-3">
                  {datos.procedencia?.map((p, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-slate-700">{p.nacionalidad}</span>
                        <span className="text-slate-400 text-xs">{p.cantidad} huéspedes</span>
                      </div>
                      <PctBar value={p.pct} color="bg-teal-500" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Canal de origen */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Canal de origen de reservas</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {datos.origenes?.map((o, i) => (
                <div key={i} className="text-center bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <div className="text-3xl font-bold text-slate-800">{o.pct}%</div>
                  <div className="text-xs font-medium text-slate-500 mt-1 capitalize">{o.origen || 'directo'}</div>
                  <div className="text-xs text-slate-400">{o.cantidad} reserva{o.cantidad !== 1 ? 's' : ''}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Pie de firma imprimible */}
          <div className="hidden print-only bg-white rounded-xl border border-slate-200 p-6 mt-8">
            <div className="flex justify-between items-end pt-10">
              <div className="text-center w-52">
                <div className="border-t border-slate-400 pt-2 text-xs text-slate-500">Firma y sello del establecimiento</div>
              </div>
              <div className="text-xs text-slate-400 text-right">
                Generado: {hoyStr}<br />
                {datos.establecimiento?.nombre_hosteria}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
