import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function MiReserva() {
  const { t } = useTranslation();
  const [codigo, setCodigo] = useState('');
  const [reserva, setReserva] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [noEncontrada, setNoEncontrada] = useState(false);

  async function buscar(e) {
    e.preventDefault();
    if (!codigo.trim()) return;
    setCargando(true);
    setNoEncontrada(false);
    setReserva(null);
    try {
      const r = await api.get(`/api/web/estado/${codigo.trim().toUpperCase()}`);
      setReserva(r.data);
    } catch (e) {
      if (e.response?.status === 404) setNoEncontrada(true);
      else toast.error('Error al consultar');
    } finally {
      setCargando(false);
    }
  }

  const estadoLabel = reserva ? (t(`estados.${reserva.estado}`) || reserva.estado) : '';

  const ESTADO_COLORS = {
    pendiente: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    confirmada: 'bg-green-100 text-green-800 border-green-300',
    checkin: 'bg-blue-100 text-blue-800 border-blue-300',
    checkout: 'bg-slate-100 text-slate-700 border-slate-300',
    cancelada: 'bg-red-100 text-red-800 border-red-300',
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">{t('consulta.titulo')}</h1>
      <p className="text-slate-500 mb-8">{t('consulta.estado')}</p>

      <form onSubmit={buscar} className="flex gap-3 mb-8">
        <input
          value={codigo}
          onChange={e => setCodigo(e.target.value)}
          placeholder={t('consulta.placeholder')}
          className="flex-1 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
        />
        <button type="submit" disabled={cargando}
          className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors disabled:opacity-60">
          {cargando ? '...' : t('consulta.buscar')}
        </button>
      </form>

      {noEncontrada && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center text-red-600">
          <div className="text-3xl mb-2">🔍</div>
          {t('consulta.no_encontrada')}
        </div>
      )}

      {reserva && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-amber-500 text-white p-5">
            <div className="text-sm opacity-80 mb-1">Código de reserva</div>
            <div className="text-2xl font-mono font-bold tracking-widest">{reserva.codigo}</div>
          </div>
          <div className="p-5 space-y-3 text-sm">
            <div className={`inline-block px-3 py-1.5 rounded-full border text-sm font-medium ${ESTADO_COLORS[reserva.estado] || ESTADO_COLORS.pendiente}`}>
              {estadoLabel}
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <div className="text-slate-500 text-xs">Huésped</div>
                <div className="font-semibold text-slate-800">{reserva.huesped_nombre}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Habitación</div>
                <div className="font-semibold text-slate-800">{reserva.tipo_nombre}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Entrada</div>
                <div className="font-semibold text-slate-800">{reserva.fecha_entrada}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Salida</div>
                <div className="font-semibold text-slate-800">{reserva.fecha_salida}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Noches</div>
                <div className="font-semibold text-slate-800">{reserva.noches}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Huéspedes</div>
                <div className="font-semibold text-slate-800">{reserva.adultos} adultos, {reserva.ninos} niños</div>
              </div>
              <div className="col-span-2">
                <div className="text-slate-500 text-xs">Total estimado</div>
                <div className="text-xl font-bold text-amber-600">${reserva.precio_total}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
