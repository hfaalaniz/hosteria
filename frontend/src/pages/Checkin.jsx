import { useState } from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Badge from '../components/Badge';
import { CheckCircleIcon, UserIcon, BuildingOfficeIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function Checkin() {
  const { t } = useTranslation();
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);

  const hoy = new Date().toISOString().split('T')[0];

  const cargar = () => {
    setCargando(true);
    // Cargamos pendientes + confirmadas — ambas deben pasar por esta pantalla
    Promise.all([
      api.get('/reservas?estado=pendiente'),
      api.get('/reservas?estado=confirmada'),
    ]).then(([pend, conf]) => {
      setReservas([...pend.data, ...conf.data].sort((a, b) => a.fecha_entrada.localeCompare(b.fecha_entrada)));
    }).finally(() => setCargando(false));
  };

  useAutoRefresh(cargar, 30000);

  async function confirmar(reserva) {
    if (!confirm(`¿Confirmar reserva de ${reserva.huesped_nombre}?`)) return;
    try {
      await api.patch(`/reservas/${reserva.id}/estado`, { estado: 'confirmada' });
      toast.success(`Reserva confirmada para ${reserva.huesped_nombre}`);
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error');
    }
  }

  async function hacerCheckin(reserva) {
    if (!confirm(`¿Confirmar check-in de ${reserva.huesped_nombre}?`)) return;
    try {
      await api.patch(`/reservas/${reserva.id}/estado`, { estado: 'checkin' });
      toast.success(`Check-in realizado — ${reserva.huesped_nombre} en Hab. ${reserva.habitacion_numero}`);
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error');
    }
  }

  async function cancelar(reserva) {
    if (!confirm(`¿Cancelar reserva de ${reserva.huesped_nombre}?`)) return;
    try {
      await api.patch(`/reservas/${reserva.id}/estado`, { estado: 'cancelada' });
      toast.success('Reserva cancelada');
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error');
    }
  }

  const pendientes   = reservas.filter(r => r.estado === 'pendiente');
  const confirmadas  = reservas.filter(r => r.estado === 'confirmada');
  const llegandoHoy  = confirmadas.filter(r => r.fecha_entrada === hoy);
  const llegandoProx = confirmadas.filter(r => r.fecha_entrada > hoy);

  function GridPorPiso({ lista }) {
    const pisos = [...new Set(lista.map(r => r.habitacion_piso ?? 1))].sort((a, b) => a - b);
    return (
      <div className="space-y-4">
        {pisos.map(piso => (
          <div key={piso}>
            {pisos.length > 1 && (
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-slate-700 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Piso {piso}
                </div>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
            )}
            <div className="grid grid-cols-4 gap-4">
              {lista.filter(r => (r.habitacion_piso ?? 1) === piso).map(r => (
                <TarjetaCheckin key={r.id} reserva={r}
                  onConfirmar={confirmar}
                  onCheckin={hacerCheckin}
                  onCancelar={cancelar}
                  hoy={hoy} t={t} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-800">{t('checkin.titulo')}</h1>

      {cargando ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Reservas pendientes de confirmación (web u otras) ── */}
          {pendientes.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <ClockIcon className="w-5 h-5 text-yellow-500" />
                <h2 className="text-lg font-semibold text-slate-700">
                  Pendientes de confirmación ({pendientes.length})
                </h2>
              </div>
              <GridPorPiso lista={pendientes} />
            </section>
          )}

          {/* ── Llegadas de hoy (confirmadas) ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircleIcon className="w-5 h-5 text-green-500" />
              <h2 className="text-lg font-semibold text-slate-700">
                Llegadas de hoy ({llegandoHoy.length})
              </h2>
            </div>
            {llegandoHoy.length === 0 ? (
              <p className="text-slate-400 text-sm">No hay llegadas confirmadas para hoy</p>
            ) : (
              <GridPorPiso lista={llegandoHoy} />
            )}
          </section>

          {/* ── Próximas llegadas ── */}
          {llegandoProx.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-slate-700 mb-3">
                Próximas llegadas ({llegandoProx.length})
              </h2>
              <GridPorPiso lista={llegandoProx} />
            </section>
          )}

          {reservas.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
              No hay reservas pendientes ni confirmadas
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TarjetaCheckin({ reserva, onConfirmar, onCheckin, onCancelar, hoy, t }) {
  const esHoy = reserva.fecha_entrada === hoy;
  const esPendiente = reserva.estado === 'pendiente';
  const origenWeb = reserva.origen === 'web';

  return (
    <div className={`bg-white rounded-xl border-2 p-5 ${
      esPendiente ? 'border-yellow-300' : esHoy ? 'border-amber-400' : 'border-slate-200'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-bold text-slate-800 text-base">{reserva.huesped_nombre}</div>
          <div className="text-sm text-slate-500">{reserva.huesped_email}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge value={reserva.estado} label={t(`reservas.estados.${reserva.estado}`)} />
          {origenWeb && (
            <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium">Web</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm mb-4">
        <div className="flex items-center gap-1.5 text-slate-600">
          <BuildingOfficeIcon className="w-4 h-4 text-slate-400" />
          Hab. {reserva.habitacion_numero} — {reserva.tipo_nombre}
        </div>
        <div className="flex items-center gap-1.5 text-slate-600">
          <UserIcon className="w-4 h-4 text-slate-400" />
          {reserva.adultos}A {reserva.ninos > 0 ? `+ ${reserva.ninos}N` : ''}
        </div>
        <div className="text-slate-600">📅 Entrada: <strong>{reserva.fecha_entrada}</strong></div>
        <div className="text-slate-600">📅 Salida: <strong>{reserva.fecha_salida}</strong></div>
        <div className="text-slate-600">🌙 Noches: <strong>{reserva.noches}</strong></div>
        <div className="text-slate-600">💰 Total: <strong>${reserva.precio_total}</strong></div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">{reserva.codigo}</span>
        <div className="flex gap-2">
          {esPendiente && (
            <button onClick={() => onConfirmar(reserva)}
              className="flex items-center gap-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors">
              ✓ Confirmar
            </button>
          )}
          {reserva.estado === 'confirmada' && (
            <button onClick={() => onCheckin(reserva)}
              className="flex items-center gap-2 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors">
              <CheckCircleIcon className="w-4 h-4" /> Check-in
            </button>
          )}
          <button onClick={() => onCancelar(reserva)}
            className="px-3 py-2 border border-red-200 text-red-500 hover:bg-red-50 text-xs font-medium rounded-lg transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
