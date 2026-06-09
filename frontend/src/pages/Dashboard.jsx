import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import api from '../api/axios';
import Badge from '../components/Badge';
import { useAuth } from '../context/useAuth';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function StatCard({ label, value, sub, color = 'amber', onClick }) {
  const colors = {
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
  };
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-4 ${colors[color]} ${onClick ? 'cursor-pointer hover:brightness-95 transition-all' : ''}`}
    >
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-0.5">{label}</div>
      {sub && <div className="text-xs opacity-70 mt-1">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [stats, setStats] = useState(null);
  const [cargando, setCargando] = useState(true);

  const rol = usuario?.rol || '';
  const esAdmin     = rol === 'admin';
  const esRecepcion = rol === 'recepcion';
  // Qué datos de ingresos puede ver cada rol:
  // admin        → todo (cards, gráfico, subtítulo mes)
  // recepcion    → solo card "ingresos hoy $" (sin gráfico, sin mes)
  // otros        → nada de ingresos
  const verIngresosHoy      = esAdmin || esRecepcion;
  const verGrafico          = esAdmin;
  const verMes              = esAdmin;
  const verProximasLlegadas = esAdmin || esRecepcion;
  const verProximasSalidas  = esAdmin || esRecepcion;

  useAutoRefresh(() => {
    api.get('/dashboard/stats').then(r => setStats(r.data)).finally(() => setCargando(false));
  }, 30000);

  if (cargando) {
    return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!stats) return null;

  const { ocupacion, hoy, mes, proximasLlegadas, proximasSalidas, ingresosUltimos30, ocupacionPorTipo, mantenimientoPendiente } = stats;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">{t('dashboard.titulo')}</h1>

      {/* Ocupación */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label={t('dashboard.disponibles')} value={ocupacion.disponibles} sub={`${t('dashboard.ocupacion')}: ${ocupacion.porcentaje}%`} color="green" onClick={() => navigate('/habitaciones?estado=disponible')} />
        <StatCard label={t('dashboard.ocupadas')} value={ocupacion.ocupadas} sub={`de ${ocupacion.total} habitaciones`} color="red" onClick={() => navigate('/habitaciones?estado=ocupada')} />
        <StatCard label={t('dashboard.limpieza')} value={ocupacion.limpieza} color="amber" onClick={() => navigate('/habitaciones?estado=limpieza')} />
        <StatCard label={t('dashboard.mantenimiento')} value={ocupacion.mantenimiento} color="slate" onClick={() => navigate('/habitaciones?estado=mantenimiento')} />
      </div>

      {/* Hoy */}
      <div className={`grid gap-4 ${verIngresosHoy ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
        <StatCard label={t('dashboard.checkins_hoy')} value={hoy.checkins} color="blue" />
        <StatCard label={t('dashboard.checkouts_hoy')} value={hoy.checkouts} color="blue" />
        <StatCard label={t('dashboard.en_casa')} value={hoy.enCasa} color="green" />
        {verIngresosHoy && (
          <StatCard
            label={t('dashboard.ingresos_hoy')}
            value={`$${hoy.ingresos?.toFixed(2)}`}
            sub={verMes ? `Mes: $${mes.ingresos?.toFixed(2)}` : undefined}
            color="amber"
          />
        )}
      </div>

      {/* Gráfico ingresos — solo admin */}
      {verGrafico && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-base font-semibold text-slate-700 mb-4">{t('dashboard.ingresos_ultimos_30')}</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={ingresosUltimos30}>
              <defs>
                <linearGradient id="ingresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11 }} tickFormatter={d => d?.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => [`$${v}`, 'Ingresos']} />
              <Area type="monotone" dataKey="total" stroke="#f59e0b" fill="url(#ingresos)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ocupación por tipo */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-base font-semibold text-slate-700 mb-4">{t('dashboard.ocupacion_por_tipo')}</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={ocupacionPorTipo}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="total" fill="#e2e8f0" name="Total" />
              <Bar dataKey="ocupadas" fill="#f59e0b" name="Ocupadas" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Mantenimiento pendiente */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-base font-semibold text-slate-700 mb-4">{t('dashboard.mantenimiento_pendiente')}</h2>
          {mantenimientoPendiente.length === 0 ? (
            <p className="text-slate-400 text-sm">Sin reportes pendientes ✓</p>
          ) : (
            <ul className="space-y-2">
              {mantenimientoPendiente.map(m => (
                <li key={m.id} className="flex items-start gap-3 text-sm">
                  <Badge value={m.prioridad} label={m.prioridad} />
                  <div>
                    <span className="font-medium text-slate-700">Hab. {m.habitacion_numero}</span>
                    <span className="text-slate-500"> — {m.descripcion}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {(verProximasLlegadas || verProximasSalidas) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Próximas llegadas */}
          {verProximasLlegadas && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-base font-semibold text-slate-700 mb-3">{t('dashboard.proximas_llegadas')}</h2>
              {proximasLlegadas.length === 0 ? (
                <p className="text-slate-400 text-sm">Sin llegadas próximas</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {proximasLlegadas.map(r => (
                    <li key={r.id} className="py-2 flex justify-between text-sm">
                      <div>
                        <span className="font-medium text-slate-800">{r.huesped_nombre}</span>
                        <span className="text-slate-400 ml-2">Hab. {r.habitacion_numero}</span>
                      </div>
                      <span className="text-slate-500">{r.fecha_entrada}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Próximas salidas */}
          {verProximasSalidas && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-base font-semibold text-slate-700 mb-3">{t('dashboard.proximas_salidas')}</h2>
              {proximasSalidas.length === 0 ? (
                <p className="text-slate-400 text-sm">Sin salidas próximas</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {proximasSalidas.map(r => (
                    <li key={r.id} className="py-2 flex justify-between text-sm">
                      <div>
                        <span className="font-medium text-slate-800">{r.huesped_nombre}</span>
                        <span className="text-slate-400 ml-2">Hab. {r.habitacion_numero}</span>
                      </div>
                      <span className="text-slate-500">{r.fecha_salida}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
