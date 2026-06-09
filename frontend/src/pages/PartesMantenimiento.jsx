import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Modal from '../components/Modal';
import { useAuth } from '../context/useAuth';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import {
  PlusIcon, EyeIcon, PencilIcon, TrashIcon, XMarkIcon,
  CheckCircleIcon, ExclamationTriangleIcon, WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

const TIPOS = [
  { value: 'correctivo',  label: 'Correctivo',  color: 'bg-blue-100 text-blue-700'   },
  { value: 'preventivo',  label: 'Preventivo',  color: 'bg-green-100 text-green-700' },
  { value: 'urgente',     label: 'Urgente',     color: 'bg-red-100 text-red-700'     },
];

const ESTADOS = [
  { value: 'pendiente',   label: 'Pendiente',   color: 'bg-yellow-100 text-yellow-700'},
  { value: 'en_proceso',  label: 'En proceso',  color: 'bg-blue-100 text-blue-700'   },
  { value: 'resuelto',    label: 'Resuelto',    color: 'bg-green-100 text-green-700' },
  { value: 'derivado',    label: 'Derivado',    color: 'bg-purple-100 text-purple-700'},
];

const PRIORIDADES = [
  { value: 'baja',  label: 'Baja',  color: 'border-slate-300 text-slate-500'  },
  { value: 'media', label: 'Media', color: 'border-yellow-400 text-yellow-600' },
  { value: 'alta',  label: 'Alta',  color: 'border-red-400 text-red-600'       },
];

function badgeEstado(valor) {
  const e = ESTADOS.find(s => s.value === valor) || ESTADOS[0];
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${e.color}`}>{e.label}</span>;
}
function badgeTipo(valor) {
  const t = TIPOS.find(s => s.value === valor) || TIPOS[0];
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${t.color}`}>{t.label}</span>;
}

function EditorMateriales({ items, onChange, label }) {
  const [form, setForm] = useState({ nombre: '', cantidad: '', unidad: 'unidad', costo: '' });
  function agregar() {
    if (!form.nombre || !form.cantidad) return;
    onChange([...items, { nombre: form.nombre, cantidad: Number(form.cantidad), unidad: form.unidad, costo: form.costo ? Number(form.costo) : null }]);
    setForm({ nombre: '', cantidad: '', unidad: 'unidad', costo: '' });
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
          placeholder="Nombre del material/repuesto"
          className="flex-1 min-w-28 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        <input type="number" min="0" value={form.cantidad} onChange={e => setForm(p => ({ ...p, cantidad: e.target.value }))}
          placeholder="Cant."
          className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400" />
        <select value={form.unidad} onChange={e => setForm(p => ({ ...p, unidad: e.target.value }))}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
          {['unidad','metro','litro','kg','rollo','caja','kit'].map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <input type="number" min="0" step="0.01" value={form.costo} onChange={e => setForm(p => ({ ...p, costo: e.target.value }))}
          placeholder="Costo $"
          className="w-24 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        <button type="button" onClick={agregar}
          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm">
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>
      {items.length > 0 && (
        <div className="space-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm">
              <span className="text-slate-700 flex-1">{item.nombre}</span>
              <span className="text-slate-500 text-xs mr-3">{item.cantidad} {item.unidad}{item.costo ? ` · $${item.costo}` : ''}</span>
              <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="text-red-400 hover:text-red-600"><XMarkIcon className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {items.some(i => i.costo) && (
            <div className="text-xs text-right text-slate-500 pr-6">
              Total: <span className="font-semibold text-slate-700">${items.reduce((s, i) => s + (i.costo || 0) * i.cantidad, 0).toFixed(2)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const FORM_INIT = {
  habitacion_id: '', fecha: new Date().toISOString().split('T')[0],
  tipo: 'correctivo', prioridad: 'media', descripcion: '', diagnostico: '',
  trabajo_realizado: '', estado: 'pendiente',
  materiales_usados: [], materiales_necesarios: [],
  requiere_externo: false, proveedor_externo: '',
  costo_estimado: '', costo_real: '', tiempo_minutos: '',
  observaciones: '', proxima_revision: '',
};

function FormParte({ datos, habitaciones, onGuardar, onCancelar }) {
  const [form, setForm] = useState({ ...FORM_INIT, ...datos });
  function f(field) { return e => setForm(p => ({ ...p, [field]: e.target.value })); }

  return (
    <form onSubmit={e => { e.preventDefault(); onGuardar(form); }} className="space-y-5">

      {/* Identificación */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Habitación *</label>
          <select value={form.habitacion_id} onChange={f('habitacion_id')} required
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option value="">Seleccionar...</option>
            {habitaciones.map(h => <option key={h.id} value={h.id}>Hab. {h.numero} (Piso {h.piso})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Fecha</label>
          <input type="date" value={form.fecha} onChange={f('fecha')}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Estado</label>
          <select value={form.estado} onChange={f('estado')}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
            {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </div>
      </div>

      {/* Tipo y prioridad */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tipo de trabajo</label>
          <div className="flex gap-2">
            {TIPOS.map(t => (
              <button type="button" key={t.value} onClick={() => setForm(p => ({ ...p, tipo: t.value }))}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                  form.tipo === t.value ? `${t.color} border-current` : 'border-slate-200 text-slate-400 hover:border-slate-300'
                }`}>{t.label}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Prioridad</label>
          <div className="flex gap-2">
            {PRIORIDADES.map(p => (
              <button type="button" key={p.value} onClick={() => setForm(f => ({ ...f, prioridad: p.value }))}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                  form.prioridad === p.value ? `bg-slate-800 text-white border-slate-800` : `border-slate-200 ${p.color} hover:border-slate-300`
                }`}>{p.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Descripción y diagnóstico */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Descripción del problema / trabajo *</label>
        <textarea value={form.descripcion} onChange={f('descripcion')} rows={2} required
          placeholder="¿Qué se detectó o qué trabajo se solicitó?"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Diagnóstico (lo que se encontró)</label>
          <textarea value={form.diagnostico || ''} onChange={f('diagnostico')} rows={2}
            placeholder="Causa raíz, estado del equipo o instalación..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Trabajo realizado</label>
          <textarea value={form.trabajo_realizado || ''} onChange={f('trabajo_realizado')} rows={2}
            placeholder="Descripción de lo que se hizo..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
      </div>

      {/* Materiales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Materiales / repuestos usados</label>
          <EditorMateriales items={form.materiales_usados} onChange={v => setForm(p => ({ ...p, materiales_usados: v }))} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-orange-500 uppercase tracking-wide mb-2">⚠ Materiales que se necesitan</label>
          <EditorMateriales items={form.materiales_necesarios} onChange={v => setForm(p => ({ ...p, materiales_necesarios: v }))} />
        </div>
      </div>

      {/* Personal externo */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <input type="checkbox" checked={!!form.requiere_externo}
            onChange={e => setForm(p => ({ ...p, requiere_externo: e.target.checked }))}
            className="w-4 h-4 accent-amber-500" />
          <span className="text-sm font-medium text-slate-700">Requiere personal o servicio externo</span>
        </label>
        {form.requiere_externo && (
          <input value={form.proveedor_externo || ''} onChange={f('proveedor_externo')}
            placeholder="Proveedor / empresa / técnico..."
            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        )}
      </div>

      {/* Costos, tiempo y próxima revisión */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Costo estimado $</label>
          <input type="number" min="0" step="0.01" value={form.costo_estimado || ''} onChange={f('costo_estimado')}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Costo real $</label>
          <input type="number" min="0" step="0.01" value={form.costo_real || ''} onChange={f('costo_real')}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Tiempo (min)</label>
          <input type="number" min="1" value={form.tiempo_minutos || ''} onChange={f('tiempo_minutos')}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Próxima revisión</label>
          <input type="date" value={form.proxima_revision || ''} onChange={f('proxima_revision')}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Observaciones / próximos pasos</label>
        <textarea value={form.observaciones || ''} onChange={f('observaciones')} rows={2}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>

      <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
        <button type="button" onClick={onCancelar}
          className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancelar</button>
        <button type="submit"
          className="px-5 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg">
          {datos?.id ? 'Guardar cambios' : 'Registrar parte'}
        </button>
      </div>
    </form>
  );
}

function DetalleParte({ p }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-3 gap-3 bg-slate-50 rounded-xl p-3">
        <div><span className="text-xs text-slate-400 block">Habitación</span><span className="font-bold">Hab. {p.habitacion_numero}</span></div>
        <div><span className="text-xs text-slate-400 block">Tipo / Prioridad</span>{badgeTipo(p.tipo)} <span className="text-xs ml-1 font-medium capitalize">{p.prioridad}</span></div>
        <div><span className="text-xs text-slate-400 block">Estado</span>{badgeEstado(p.estado)}</div>
      </div>
      <div><span className="text-xs font-semibold text-slate-500 uppercase">Descripción</span><p className="mt-1 text-slate-800">{p.descripcion}</p></div>
      {p.diagnostico && <div><span className="text-xs font-semibold text-slate-500 uppercase">Diagnóstico</span><p className="mt-1 text-slate-700">{p.diagnostico}</p></div>}
      {p.trabajo_realizado && <div><span className="text-xs font-semibold text-green-600 uppercase">Trabajo realizado</span><p className="mt-1 text-slate-700">{p.trabajo_realizado}</p></div>}

      {p.materiales_usados?.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Materiales usados</div>
          <div className="space-y-1">
            {p.materiales_usados.map((m, i) => (
              <div key={i} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 text-xs">
                <span className="text-blue-800 font-medium">{m.nombre}</span>
                <span className="text-blue-600">{m.cantidad} {m.unidad}{m.costo ? ` · $${m.costo}` : ''}</span>
              </div>
            ))}
            {p.materiales_usados.some(m => m.costo) && (
              <div className="text-xs text-right text-slate-500">
                Total materiales: <span className="font-bold text-slate-700">${p.materiales_usados.reduce((s, m) => s + (m.costo || 0) * m.cantidad, 0).toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      )}
      {p.materiales_necesarios?.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-2">⚠ Materiales necesarios</div>
          <div className="flex flex-wrap gap-2">
            {p.materiales_necesarios.map((m, i) => (
              <span key={i} className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full">{m.nombre} — {m.cantidad} {m.unidad}</span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {p.costo_estimado && <div className="bg-slate-50 rounded-lg p-2 text-center"><div className="text-slate-400">Costo estimado</div><div className="font-bold text-slate-700">${p.costo_estimado}</div></div>}
        {p.costo_real && <div className="bg-slate-50 rounded-lg p-2 text-center"><div className="text-slate-400">Costo real</div><div className="font-bold text-slate-700">${p.costo_real}</div></div>}
        {p.tiempo_minutos && <div className="bg-slate-50 rounded-lg p-2 text-center"><div className="text-slate-400">Tiempo</div><div className="font-bold text-slate-700">{p.tiempo_minutos} min</div></div>}
        {p.proxima_revision && <div className="bg-slate-50 rounded-lg p-2 text-center"><div className="text-slate-400">Próx. revisión</div><div className="font-bold text-slate-700">{p.proxima_revision}</div></div>}
      </div>

      {p.requiere_externo ? <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-xs text-purple-700"><span className="font-semibold">Requiere externo:</span> {p.proveedor_externo || 'Sin especificar'}</div> : null}
      {p.observaciones && <div><span className="text-xs text-slate-400">Observaciones:</span><p className="text-slate-700">{p.observaciones}</p></div>}
      <div className="text-xs text-slate-400">Reportado por: {p.usuario_nombre} · {p.fecha}</div>
    </div>
  );
}

const hoy = new Date().toISOString().split('T')[0];
const hace15 = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];

export default function PartesMantenimiento() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';
  const [partes, setPartes] = useState([]);
  const [habitaciones, setHabitaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(null);
  const [filtros, setFiltros] = useState({ desde: hace15, hasta: hoy, estado: '', tipo: '', habitacion_id: '' });

  const cargar = useCallback(() => {
    setCargando(true);
    const p = new URLSearchParams();
    if (filtros.desde) p.set('fecha_desde', filtros.desde);
    if (filtros.hasta) p.set('fecha_hasta', filtros.hasta);
    if (filtros.estado) p.set('estado', filtros.estado);
    if (filtros.tipo) p.set('tipo', filtros.tipo);
    if (filtros.habitacion_id) p.set('habitacion_id', filtros.habitacion_id);
    Promise.all([
      api.get(`/partes-mantenimiento?${p}`),
      habitaciones.length ? Promise.resolve({ data: habitaciones }) : api.get('/habitaciones'),
    ]).then(([parts, habs]) => {
      setPartes(parts.data);
      if (!habitaciones.length) setHabitaciones(habs.data);
    }).finally(() => setCargando(false));
  }, [filtros, habitaciones.length]);

  useEffect(() => { cargar(); }, [filtros]);
  useAutoRefresh(cargar, 60000);

  async function guardar(form) {
    try {
      if (modal?.id) {
        await api.put(`/partes-mantenimiento/${modal.id}`, form);
        toast.success('Parte actualizado');
      } else {
        await api.post('/partes-mantenimiento', form);
        toast.success('Parte registrado');
      }
      setModal(null);
      cargar();
    } catch (e) { toast.error(e.response?.data?.error || 'Error'); }
  }

  async function eliminar(p) {
    if (!confirm('¿Eliminar este parte?')) return;
    await api.delete(`/partes-mantenimiento/${p.id}`);
    toast.success('Eliminado');
    cargar();
  }

  // Alertas: materiales pendientes y trabajos urgentes sin resolver
  const alertasMat = partes.filter(p => p.materiales_necesarios?.length > 0 && p.estado !== 'resuelto');
  const urgentesAbiertos = partes.filter(p => p.tipo === 'urgente' && p.estado !== 'resuelto');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Partes de Mantenimiento</h1>
          <p className="text-sm text-slate-500 mt-0.5">Registro detallado de trabajos y materiales</p>
        </div>
        <button onClick={() => setModal('nuevo')}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <PlusIcon className="w-4 h-4" /> Nuevo parte
        </button>
      </div>

      {/* Alertas */}
      {urgentesAbiertos.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-700 font-semibold mb-1">
            <ExclamationTriangleIcon className="w-5 h-5" /> {urgentesAbiertos.length} trabajo{urgentesAbiertos.length > 1 ? 's' : ''} urgente{urgentesAbiertos.length > 1 ? 's' : ''} sin resolver
          </div>
          <div className="flex flex-wrap gap-2">
            {urgentesAbiertos.map(p => (
              <button key={p.id} onClick={() => setModal({ ver: p })}
                className="text-xs bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-full hover:bg-red-200">
                Hab.{p.habitacion_numero}
              </button>
            ))}
          </div>
        </div>
      )}
      {alertasMat.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-orange-700 font-semibold mb-1">
            <WrenchScrewdriverIcon className="w-5 h-5" /> Materiales pendientes de compra
          </div>
          <div className="flex flex-wrap gap-2">
            {alertasMat.flatMap(p => p.materiales_necesarios.map((m, i) => (
              <span key={`${p.id}-${i}`} className="text-xs bg-orange-100 text-orange-800 border border-orange-200 px-2.5 py-1 rounded-full">
                Hab.{p.habitacion_numero} — {m.nombre} ({m.cantidad} {m.unidad})
              </span>
            )))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Desde</label>
          <input type="date" value={filtros.desde} onChange={e => setFiltros(f => ({ ...f, desde: e.target.value }))}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Hasta</label>
          <input type="date" value={filtros.hasta} onChange={e => setFiltros(f => ({ ...f, hasta: e.target.value }))}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Estado</label>
          <select value={filtros.estado} onChange={e => setFiltros(f => ({ ...f, estado: e.target.value }))}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option value="">Todos</option>
            {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
          <select value={filtros.tipo} onChange={e => setFiltros(f => ({ ...f, tipo: e.target.value }))}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option value="">Todos</option>
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Habitación</label>
          <select value={filtros.habitacion_id} onChange={e => setFiltros(f => ({ ...f, habitacion_id: e.target.value }))}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option value="">Todas</option>
            {habitaciones.map(h => <option key={h.id} value={h.id}>Hab. {h.numero}</option>)}
          </select>
        </div>
        <button onClick={() => setFiltros({ desde: hace15, hasta: hoy, estado: '', tipo: '', habitacion_id: '' })}
          className="px-3 py-1.5 text-sm text-slate-500 border border-slate-300 rounded-lg hover:bg-slate-50">
          Limpiar
        </button>
      </div>

      {/* Lista */}
      {cargando ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : partes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">Sin partes en el período</div>
      ) : (
        <div className="space-y-2">
          {partes.map(p => {
            const tieneMat = p.materiales_necesarios?.length > 0;
            return (
              <div key={p.id}
                className={`bg-white border-l-4 border border-slate-200 hover:border-amber-300 rounded-xl px-4 py-3 flex items-center gap-4 transition-all ${
                  p.prioridad === 'alta' ? 'border-l-red-500' : p.prioridad === 'media' ? 'border-l-yellow-400' : 'border-l-slate-300'
                }`}>
                <div className="w-16 text-center shrink-0">
                  <div className="font-bold text-slate-800">Hab. {p.habitacion_numero}</div>
                  <div className="text-xs text-slate-400">Piso {p.piso}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {badgeEstado(p.estado)}
                    {badgeTipo(p.tipo)}
                    {tieneMat && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">⚠ Materiales pendientes</span>}
                    {p.requiere_externo ? <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Externo</span> : null}
                  </div>
                  <p className="text-sm text-slate-700 mt-0.5 truncate">{p.descripcion}</p>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {p.fecha} · {p.usuario_nombre}
                    {p.costo_real ? ` · $${p.costo_real}` : p.costo_estimado ? ` · ~$${p.costo_estimado}` : ''}
                    {p.tiempo_minutos ? ` · ${p.tiempo_minutos} min` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => setModal({ ver: p })}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"><EyeIcon className="w-4 h-4" /></button>
                  {esAdmin && <>
                    <button onClick={() => setModal(p)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600"><PencilIcon className="w-4 h-4" /></button>
                    <button onClick={() => eliminar(p)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                  </>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!modal && !modal?.ver && (modal === 'nuevo' || esAdmin)} onClose={() => setModal(null)}
        title={modal?.id ? `Editar parte — Hab. ${modal.habitacion_numero}` : 'Nuevo parte de mantenimiento'} size="xl">
        {modal && !modal.ver && (
          <FormParte datos={modal !== 'nuevo' ? modal : {}} habitaciones={habitaciones}
            onGuardar={guardar} onCancelar={() => setModal(null)} />
        )}
      </Modal>

      <Modal open={!!modal?.ver} onClose={() => setModal(null)}
        title={`Parte de mantenimiento — Hab. ${modal?.ver?.habitacion_numero} · ${modal?.ver?.fecha}`} size="lg">
        {modal?.ver && <DetalleParte p={modal.ver} />}
      </Modal>
    </div>
  );
}
