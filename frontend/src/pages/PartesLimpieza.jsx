import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Modal from '../components/Modal';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useAuth } from '../context/useAuth';
import {
  PlusIcon, EyeIcon, PencilIcon, TrashIcon, XMarkIcon,
  CheckCircleIcon, ExclamationTriangleIcon, ClockIcon, SparklesIcon,
} from '@heroicons/react/24/outline';

const TURNOS = [
  { value: 'manana', label: 'Mañana' },
  { value: 'tarde',  label: 'Tarde'  },
  { value: 'noche',  label: 'Noche'  },
];

const ESTADOS_HAB = [
  { value: 'limpia',    label: 'Limpia',      color: 'bg-green-100 text-green-700'  },
  { value: 'sucia',     label: 'Sucia',       color: 'bg-yellow-100 text-yellow-700'},
  { value: 'muy_sucia', label: 'Muy sucia',   color: 'bg-orange-100 text-orange-700'},
  { value: 'danio',     label: 'Con daño',    color: 'bg-red-100 text-red-700'      },
];

const ROPA_CAMA_OPTS = [
  { value: 'ok',            label: 'OK — sin cambio' },
  { value: 'cambio_parcial',label: 'Cambio parcial'  },
  { value: 'cambio_total',  label: 'Cambio total'    },
  { value: 'falta',         label: 'Falta ropa'      },
];

const AMENITY_OPTS = [
  { value: 'ok',        label: 'Completo'         },
  { value: 'repuesto',  label: 'Repuesto'         },
  { value: 'falta',     label: 'Falta reposición' },
];

const MINIBAR_OPTS = [
  { value: 'no_aplica', label: 'No aplica'  },
  { value: 'ok',        label: 'Completo'   },
  { value: 'repuesto',  label: 'Repuesto'   },
  { value: 'falta',     label: 'Falta stock'},
];

const TAREAS_COMUNES = [
  'Barrer y trapear piso', 'Limpiar baño completo', 'Desinfectar sanitarios',
  'Cambiar sábanas', 'Cambiar fundas de almohadas', 'Hacer camas',
  'Limpiar espejos', 'Limpiar ventanas', 'Aspirar alfombras',
  'Vaciar papeleras', 'Reponer amenities', 'Reponer toallas',
  'Limpiar muebles', 'Limpiar TV y controles', 'Airear la habitación',
  'Limpiar heladera/minibar', 'Reponer minibar', 'Desinfectar superficies',
];

function EditorLista({ items, onChange, placeholder }) {
  const [nuevo, setNuevo] = useState('');
  function agregar() {
    const v = nuevo.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setNuevo('');
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={nuevo} onChange={e => setNuevo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), agregar())}
          placeholder={placeholder}
          className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        <button type="button" onClick={agregar}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm">
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2.5 py-1 text-xs text-slate-700">
            {item}
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="text-slate-400 hover:text-red-500 ml-0.5">
              <XMarkIcon className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function EditorInsumos({ items, onChange, conCosto = false }) {
  const [form, setForm] = useState({ nombre: '', cantidad: '', unidad: 'unidad' });
  function agregar() {
    if (!form.nombre || !form.cantidad) return;
    onChange([...items, { ...form, cantidad: Number(form.cantidad) }]);
    setForm({ nombre: '', cantidad: '', unidad: 'unidad' });
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
          placeholder="Nombre del insumo"
          className="flex-1 min-w-28 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        <input type="number" min="0" value={form.cantidad}
          onChange={e => setForm(p => ({ ...p, cantidad: e.target.value }))}
          placeholder="Cant."
          className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400" />
        <select value={form.unidad} onChange={e => setForm(p => ({ ...p, unidad: e.target.value }))}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
          {['unidad','litro','ml','kg','g','rollo','paquete'].map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <button type="button" onClick={agregar}
          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm">
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>
      {items.length > 0 && (
        <div className="space-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm">
              <span className="text-slate-700">{item.nombre}</span>
              <div className="flex items-center gap-3">
                <span className="text-slate-500 text-xs">{item.cantidad} {item.unidad}</span>
                <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}
                  className="text-red-400 hover:text-red-600">
                  <XMarkIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const FORM_INIT = {
  habitacion_id: '', fecha: new Date().toISOString().split('T')[0], turno: 'manana',
  estado_habitacion: 'limpia', tareas_realizadas: [], hallazgos: '', objetos_encontrados: '',
  insumos_usados: [], insumos_faltantes: [], ropa_cama: 'ok', toallas: 'ok',
  amenities: 'ok', minibar: 'no_aplica', observaciones: '', tiempo_minutos: '',
};

function FormParte({ datos, habitaciones, onGuardar, onCancelar }) {
  const [form, setForm] = useState({ ...FORM_INIT, ...datos });
  function f(field) { return e => setForm(p => ({ ...p, [field]: e.target.value })); }
  function toggleTarea(t) {
    setForm(p => ({
      ...p,
      tareas_realizadas: p.tareas_realizadas.includes(t)
        ? p.tareas_realizadas.filter(x => x !== t)
        : [...p.tareas_realizadas, t],
    }));
  }

  return (
    <form onSubmit={e => { e.preventDefault(); onGuardar(form); }} className="space-y-5">

      {/* Identificación */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1">
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
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Turno</label>
          <select value={form.turno} onChange={f('turno')}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
            {TURNOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {/* Estado de la habitación */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Estado encontrado</label>
        <div className="flex gap-2 flex-wrap">
          {ESTADOS_HAB.map(e => (
            <button type="button" key={e.value} onClick={() => setForm(p => ({ ...p, estado_habitacion: e.value }))}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                form.estado_habitacion === e.value ? `${e.color} border-current` : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}>
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tareas realizadas */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tareas realizadas</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {TAREAS_COMUNES.map(t => (
            <button type="button" key={t} onClick={() => toggleTarea(t)}
              className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                form.tareas_realizadas.includes(t)
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-amber-300'
              }`}>
              {t}
            </button>
          ))}
        </div>
        <EditorLista items={form.tareas_realizadas} onChange={v => setForm(p => ({ ...p, tareas_realizadas: v }))}
          placeholder="Otra tarea realizada..." />
      </div>

      {/* Equipamiento */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'ropa_cama', label: 'Ropa de cama', opts: ROPA_CAMA_OPTS },
          { key: 'toallas',   label: 'Toallas',      opts: ROPA_CAMA_OPTS },
          { key: 'amenities', label: 'Amenities',    opts: AMENITY_OPTS   },
          { key: 'minibar',   label: 'Minibar',      opts: MINIBAR_OPTS   },
        ].map(({ key, label, opts }) => (
          <div key={key}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
            <select value={form[key]} onChange={f(key)}
              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
              {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Hallazgos y objetos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Hallazgos / Daños observados</label>
          <textarea value={form.hallazgos || ''} onChange={f('hallazgos')} rows={2}
            placeholder="Daños, suciedad especial, problemas encontrados..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Objetos encontrados</label>
          <textarea value={form.objetos_encontrados || ''} onChange={f('objetos_encontrados')} rows={2}
            placeholder="Objetos olvidados por huéspedes..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
      </div>

      {/* Insumos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Insumos utilizados</label>
          <EditorInsumos items={form.insumos_usados} onChange={v => setForm(p => ({ ...p, insumos_usados: v }))} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Insumos a reponer / que faltan</label>
          <EditorInsumos items={form.insumos_faltantes} onChange={v => setForm(p => ({ ...p, insumos_faltantes: v }))} />
        </div>
      </div>

      {/* Tiempo y observaciones */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Tiempo (min)</label>
          <input type="number" min="1" value={form.tiempo_minutos || ''} onChange={f('tiempo_minutos')}
            placeholder="ej: 45"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Observaciones generales</label>
          <input value={form.observaciones || ''} onChange={f('observaciones')}
            placeholder="Notas adicionales..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
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
  const estado = ESTADOS_HAB.find(e => e.value === p.estado_habitacion);
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-3 gap-3 bg-slate-50 rounded-xl p-3">
        <div><span className="text-xs text-slate-400 block">Habitación</span><span className="font-bold">Hab. {p.habitacion_numero}</span></div>
        <div><span className="text-xs text-slate-400 block">Fecha / Turno</span><span className="font-medium">{p.fecha} · {TURNOS.find(t => t.value === p.turno)?.label}</span></div>
        <div><span className="text-xs text-slate-400 block">Estado</span><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${estado?.color}`}>{estado?.label}</span></div>
      </div>

      {p.tareas_realizadas?.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tareas realizadas</div>
          <div className="flex flex-wrap gap-1.5">{p.tareas_realizadas.map((t, i) => (
            <span key={i} className="flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
              <CheckCircleIcon className="w-3 h-3" /> {t}
            </span>
          ))}</div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {[
          { k: 'ropa_cama', l: 'Ropa cama', opts: ROPA_CAMA_OPTS },
          { k: 'toallas',   l: 'Toallas',   opts: ROPA_CAMA_OPTS },
          { k: 'amenities', l: 'Amenities', opts: AMENITY_OPTS   },
          { k: 'minibar',   l: 'Minibar',   opts: MINIBAR_OPTS   },
        ].map(({ k, l, opts }) => (
          <div key={k} className="bg-slate-50 rounded-lg p-2 text-center">
            <div className="text-slate-400 mb-0.5">{l}</div>
            <div className="font-medium text-slate-700">{opts.find(o => o.value === p[k])?.label || p[k]}</div>
          </div>
        ))}
      </div>

      {p.hallazgos && <div><span className="text-xs font-semibold text-red-500 uppercase tracking-wide">Hallazgos:</span><p className="mt-1 text-slate-700">{p.hallazgos}</p></div>}
      {p.objetos_encontrados && <div><span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Objetos encontrados:</span><p className="mt-1 text-slate-700">{p.objetos_encontrados}</p></div>}

      {p.insumos_usados?.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Insumos usados</div>
          <div className="flex flex-wrap gap-1.5">{p.insumos_usados.map((ins, i) => (
            <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">{ins.nombre} — {ins.cantidad} {ins.unidad}</span>
          ))}</div>
        </div>
      )}
      {p.insumos_faltantes?.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-1">⚠ Insumos a reponer</div>
          <div className="flex flex-wrap gap-1.5">{p.insumos_faltantes.map((ins, i) => (
            <span key={i} className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">{ins.nombre} — {ins.cantidad} {ins.unidad}</span>
          ))}</div>
        </div>
      )}
      {p.observaciones && <div><span className="text-xs text-slate-400">Observaciones:</span><p className="text-slate-700">{p.observaciones}</p></div>}
      {p.tiempo_minutos && <div className="text-xs text-slate-400">Tiempo empleado: <span className="font-medium text-slate-600">{p.tiempo_minutos} minutos</span></div>}
    </div>
  );
}

const hoy = new Date().toISOString().split('T')[0];
const hace7 = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];

export default function PartesLimpieza() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';
  const [partes, setPartes] = useState([]);
  const [habitaciones, setHabitaciones] = useState([]);
  const [habsEnLimpieza, setHabsEnLimpieza] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(null); // null | 'nuevo' | parte | {ver: parte}
  const [filtros, setFiltros] = useState({ desde: hace7, hasta: hoy, habitacion_id: '' });
  const [marcandoId, setMarcandoId] = useState(null);

  const cargar = useCallback(() => {
    setCargando(true);
    const p = new URLSearchParams();
    if (filtros.desde) p.set('fecha_desde', filtros.desde);
    if (filtros.hasta) p.set('fecha_hasta', filtros.hasta);
    if (filtros.habitacion_id) p.set('habitacion_id', filtros.habitacion_id);
    Promise.all([
      api.get(`/partes-limpieza?${p}`),
      habitaciones.length ? Promise.resolve({ data: habitaciones }) : api.get('/habitaciones'),
      api.get('/habitaciones?estado=limpieza'),
    ]).then(([parts, habs, enLimpieza]) => {
      setPartes(parts.data);
      if (!habitaciones.length) setHabitaciones(habs.data);
      setHabsEnLimpieza(enLimpieza.data);
    }).finally(() => setCargando(false));
  }, [filtros, habitaciones.length]);

  useEffect(() => { cargar(); }, [filtros]);
  useAutoRefresh(cargar, 60000);

  async function guardar(form) {
    try {
      if (modal?.id) {
        await api.put(`/partes-limpieza/${modal.id}`, form);
        toast.success('Parte actualizado');
      } else {
        await api.post('/partes-limpieza', form);
        toast.success('Parte registrado');
      }
      setModal(null);
      cargar();
    } catch (e) { toast.error(e.response?.data?.error || 'Error'); }
  }

  async function eliminar(p) {
    if (!confirm('¿Eliminar este parte?')) return;
    await api.delete(`/partes-limpieza/${p.id}`);
    toast.success('Eliminado');
    cargar();
  }

  async function marcarLista(hab) {
    setMarcandoId(hab.id);
    try {
      await api.post('/partes-limpieza', {
        habitacion_id: hab.id,
        fecha: new Date().toISOString().split('T')[0],
        turno: 'manana',
        estado_habitacion: 'limpia',
        tareas_realizadas: ['Limpieza general'],
        ropa_cama: 'ok', toallas: 'ok', amenities: 'ok', minibar: 'no_aplica',
      });
      toast.success(`Hab. ${hab.numero} disponible`);
      cargar();
    } catch { toast.error('Error'); }
    finally { setMarcandoId(null); }
  }

  // Alertas: insumos faltantes en partes recientes
  const alertasFaltantes = partes
    .filter(p => p.insumos_faltantes?.length > 0)
    .flatMap(p => p.insumos_faltantes.map(i => ({ ...i, hab: p.habitacion_numero })));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Partes de Limpieza</h1>
          <p className="text-sm text-slate-500 mt-0.5">Registro de limpieza por habitación</p>
        </div>
        <button onClick={() => setModal('nuevo')}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <PlusIcon className="w-4 h-4" /> Nuevo parte
        </button>
      </div>

      {/* Panel: habitaciones pendientes de limpieza */}
      {habsEnLimpieza.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4">
          <div className="flex items-center gap-2 text-yellow-800 font-semibold mb-3">
            <SparklesIcon className="w-5 h-5" />
            Habitaciones pendientes de limpieza ({habsEnLimpieza.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {habsEnLimpieza.map(h => (
              <div key={h.id} className="flex items-center gap-2 bg-white border border-yellow-200 rounded-lg px-3 py-2">
                <div>
                  <div className="text-sm font-bold text-slate-800">Hab. {h.numero}</div>
                  <div className="text-xs text-slate-400">Piso {h.piso} · {h.tipo_nombre}</div>
                </div>
                <button
                  onClick={() => marcarLista(h)}
                  disabled={marcandoId === h.id}
                  className="flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg disabled:opacity-50">
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                  {marcandoId === h.id ? 'Guardando...' : 'Lista'}
                </button>
                <button
                  onClick={() => setModal({ _nuevo: true, habitacion_id: h.id })}
                  className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg">
                  <PlusIcon className="w-3.5 h-3.5" /> Parte
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerta de insumos faltantes */}
      {alertasFaltantes.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-orange-700 font-semibold mb-2">
            <ExclamationTriangleIcon className="w-5 h-5" /> Insumos pendientes de reposición
          </div>
          <div className="flex flex-wrap gap-2">
            {alertasFaltantes.map((a, i) => (
              <span key={i} className="text-xs bg-orange-100 text-orange-800 border border-orange-200 px-2.5 py-1 rounded-full">
                Hab.{a.hab} — {a.nombre} ({a.cantidad} {a.unidad})
              </span>
            ))}
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
          <label className="block text-xs font-medium text-slate-500 mb-1">Habitación</label>
          <select value={filtros.habitacion_id} onChange={e => setFiltros(f => ({ ...f, habitacion_id: e.target.value }))}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option value="">Todas</option>
            {habitaciones.map(h => <option key={h.id} value={h.id}>Hab. {h.numero}</option>)}
          </select>
        </div>
        <button onClick={() => setFiltros({ desde: hace7, hasta: hoy, habitacion_id: '' })}
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
            const estHab = ESTADOS_HAB.find(e => e.value === p.estado_habitacion);
            const tieneFaltantes = p.insumos_faltantes?.length > 0;
            const tieneHallazgos = !!p.hallazgos;
            return (
              <div key={p.id} className="bg-white border border-slate-200 hover:border-amber-300 rounded-xl px-4 py-3 flex items-center gap-4 transition-all">
                <div className="w-16 text-center shrink-0">
                  <div className="font-bold text-slate-800">Hab. {p.habitacion_numero}</div>
                  <div className="text-xs text-slate-400">Piso {p.piso}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${estHab?.color}`}>{estHab?.label}</span>
                    <span className="text-xs text-slate-400">{TURNOS.find(t => t.value === p.turno)?.label}</span>
                    {tieneFaltantes && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">⚠ Insumos faltantes</span>}
                    {tieneHallazgos && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Hallazgos</span>}
                    {p.objetos_encontrados && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Objeto encontrado</span>}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {p.fecha} · {p.usuario_nombre} · {p.tareas_realizadas?.length || 0} tareas
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

      {/* Modal formulario — edición solo admin, nuevo cualquiera */}
      <Modal open={!!modal && !modal?.ver && (modal === 'nuevo' || modal?._nuevo || esAdmin)} onClose={() => setModal(null)}
        title={modal?.id ? `Editar parte — Hab. ${modal.habitacion_numero}` : 'Nuevo parte de limpieza'} size="xl">
        {modal && !modal.ver && (
          <FormParte
            datos={modal === 'nuevo' ? {} : modal._nuevo ? { habitacion_id: modal.habitacion_id } : modal}
            habitaciones={habitaciones}
            onGuardar={guardar} onCancelar={() => setModal(null)} />
        )}
      </Modal>

      {/* Modal detalle */}
      <Modal open={!!modal?.ver} onClose={() => setModal(null)}
        title={`Parte de limpieza — Hab. ${modal?.ver?.habitacion_numero} · ${modal?.ver?.fecha}`} size="lg">
        {modal?.ver && <DetalleParte p={modal.ver} />}
      </Modal>
    </div>
  );
}
