import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { PlusIcon, CheckCircleIcon, TrashIcon } from '@heroicons/react/24/outline';

function FormMantenimiento({ onGuardar, onCancelar }) {
  const [form, setForm] = useState({ habitacion_id: '', descripcion: '', prioridad: 'media' });
  const [habitaciones, setHabitaciones] = useState([]);

  useEffect(() => {
    api.get('/habitaciones').then(r => setHabitaciones(r.data));
  }, []);

  return (
    <form onSubmit={e => { e.preventDefault(); onGuardar(form); }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Habitación *</label>
        <select value={form.habitacion_id} onChange={e => setForm(f => ({ ...f, habitacion_id: e.target.value }))} required
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
          <option value="">Seleccionar...</option>
          {habitaciones.map(h => <option key={h.id} value={h.id}>Hab. {h.numero} — {h.tipo_nombre} (Piso {h.piso})</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Descripción del problema *</label>
        <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={3} required
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Prioridad</label>
        <div className="flex gap-3">
          {['baja', 'media', 'alta'].map(p => (
            <label key={p} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${form.prioridad === p ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input type="radio" name="prioridad" value={p} checked={form.prioridad === p} onChange={() => setForm(f => ({ ...f, prioridad: p }))} className="sr-only" />
              <Badge value={p} label={p} />
            </label>
          ))}
        </div>
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancelar} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancelar</button>
        <button type="submit" className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg">Crear reporte</button>
      </div>
    </form>
  );
}

export default function Mantenimiento() {
  const { t } = useTranslation();
  const [reportes, setReportes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('pendiente');

  const cargar = () => {
    setCargando(true);
    const q = filtroEstado ? `?estado=${filtroEstado}` : '';
    api.get(`/mantenimiento${q}`).then(r => setReportes(r.data)).finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, [filtroEstado]);

  async function resolver(m) {
    if (!confirm(`¿Marcar como resuelto el problema en Hab. ${m.habitacion_numero}?`)) return;
    try {
      await api.patch(`/mantenimiento/${m.id}/resolver`);
      toast.success('Reporte resuelto');
      cargar();
    } catch (e) {
      toast.error('Error');
    }
  }

  async function eliminar(m) {
    if (!confirm('¿Eliminar este reporte?')) return;
    await api.delete(`/mantenimiento/${m.id}`);
    toast.success('Eliminado');
    cargar();
  }

  async function guardar(form) {
    try {
      await api.post('/mantenimiento', form);
      toast.success('Reporte creado');
      setModal(false);
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error');
    }
  }

  const PRIORIDAD_ORDER = { alta: 0, media: 1, baja: 2 };
  const ordenados = [...reportes].sort((a, b) => PRIORIDAD_ORDER[a.prioridad] - PRIORIDAD_ORDER[b.prioridad]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800">{t('mantenimiento.titulo')}</h1>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <PlusIcon className="w-4 h-4" /> Nuevo reporte
        </button>
      </div>

      <div className="flex gap-2">
        {['pendiente', 'en_proceso', 'resuelto', ''].map((e, i) => {
          const labels = ['Pendientes', 'En proceso', 'Resueltos', 'Todos'];
          return (
            <button key={i} onClick={() => setFiltroEstado(e)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${filtroEstado === e ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
              {labels[i]}
            </button>
          );
        })}
      </div>

      {cargando ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : ordenados.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          No hay reportes en este estado ✓
        </div>
      ) : (
        <div className="space-y-3">
          {ordenados.map(m => (
            <div key={m.id} className={`bg-white rounded-xl border-l-4 border border-slate-200 p-4 flex items-start justify-between gap-4 ${
              m.prioridad === 'alta' ? 'border-l-red-500' : m.prioridad === 'media' ? 'border-l-yellow-500' : 'border-l-slate-400'
            }`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-slate-800">Hab. {m.habitacion_numero}</span>
                  <Badge value={m.prioridad} label={t(`mantenimiento.prioridades.${m.prioridad}`)} />
                  <Badge value={m.estado} label={t(`mantenimiento.estados.${m.estado}`)} />
                </div>
                <p className="text-slate-700">{m.descripcion}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Reportado: {new Date(m.creado_en).toLocaleString()}
                  {m.resuelto_en && ` · Resuelto: ${new Date(m.resuelto_en).toLocaleString()}`}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {m.estado !== 'resuelto' && (
                  <button onClick={() => resolver(m)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-50 hover:bg-green-100 rounded-lg text-green-600 font-medium">
                    <CheckCircleIcon className="w-3.5 h-3.5" /> Resolver
                  </button>
                )}
                <button onClick={() => eliminar(m)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 rounded-lg text-red-500">
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo reporte de mantenimiento">
        <FormMantenimiento onGuardar={guardar} onCancelar={() => setModal(false)} />
      </Modal>
    </div>
  );
}
