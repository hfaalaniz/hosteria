import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, SparklesIcon, MinusIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const CAT_ICONS = {
  desayuno:   '☕',
  almuerzo:   '🍽️',
  merienda:   '🥐',
  cena:       '🍷',
  lavanderia: '👕',
  transporte: '🚗',
  otro:       '✦',
};

// ── Modal para cargar servicios a una habitación ocupada ──────────────────────
function ModalServicios({ habitacion, onClose }) {
  const [servicios, setServicios] = useState([]);
  const [consumos, setConsumos] = useState([]);
  const [reservaId, setReservaId] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [custom, setCustom] = useState({ descripcion: '', precio_unitario: '', cantidad: 1 });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    // Buscar reserva activa (checkin) de esta habitación
    Promise.all([
      api.get('/servicios'),
      api.get(`/reservas?habitacion_id=${habitacion.id}&estado=checkin`),
    ]).then(([sv, rv]) => {
      setServicios(sv.data);
      const reserva = rv.data?.[0];
      if (reserva) {
        setReservaId(reserva.id);
        return api.get(`/consumos/reserva/${reserva.id}`).then(c => setConsumos(c.data));
      }
    }).finally(() => setCargando(false));
  }, [habitacion.id]);

  async function agregarServicio(serv) {
    if (!reservaId) return toast.error('No hay reserva activa en esta habitación');
    setGuardando(true);
    try {
      await api.post('/consumos', {
        reserva_id: reservaId,
        servicio_id: serv.id,
        descripcion: serv.nombre,
        cantidad: 1,
        precio_unitario: serv.precio,
      });
      const c = await api.get(`/consumos/reserva/${reservaId}`);
      setConsumos(c.data);
      toast.success(`${serv.nombre} agregado`);
    } catch { toast.error('Error al agregar'); }
    finally { setGuardando(false); }
  }

  async function agregarCustom() {
    if (!reservaId) return toast.error('No hay reserva activa');
    if (!custom.descripcion || !custom.precio_unitario) return toast.error('Completá descripción y precio');
    setGuardando(true);
    try {
      await api.post('/consumos', {
        reserva_id: reservaId,
        descripcion: custom.descripcion,
        cantidad: Number(custom.cantidad) || 1,
        precio_unitario: Number(custom.precio_unitario),
      });
      const c = await api.get(`/consumos/reserva/${reservaId}`);
      setConsumos(c.data);
      setCustom({ descripcion: '', precio_unitario: '', cantidad: 1 });
      toast.success('Servicio agregado');
    } catch { toast.error('Error al agregar'); }
    finally { setGuardando(false); }
  }

  async function eliminarConsumo(id) {
    try {
      await api.delete(`/consumos/${id}`);
      setConsumos(p => p.filter(c => c.id !== id));
    } catch { toast.error('Error al eliminar'); }
  }

  const totalConsumos = consumos.reduce((s, c) => s + c.total, 0);

  // Agrupar servicios por categoría
  const porCategoria = servicios.reduce((acc, s) => {
    const cat = s.categoria || 'otro';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {cargando ? (
        <div className="flex justify-center py-8">
          <div className="w-7 h-7 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !reservaId ? (
        <div className="text-center py-8 text-slate-400">
          <SparklesIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No hay reserva activa en esta habitación</p>
        </div>
      ) : (
        <>
          {/* Servicios disponibles */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Servicios disponibles</div>
            <div className="space-y-3">
              {Object.entries(porCategoria).map(([cat, items]) => (
                <div key={cat}>
                  <div className="text-xs font-medium text-slate-400 mb-1.5 capitalize">
                    {CAT_ICONS[cat] || '✦'} {cat}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {items.map(s => (
                      <button key={s.id} onClick={() => agregarServicio(s)} disabled={guardando}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-amber-400 hover:bg-amber-50 rounded-lg text-sm transition-colors disabled:opacity-50">
                        <span className="font-medium text-slate-700">{s.nombre}</span>
                        <span className="text-xs text-amber-600 font-semibold">${s.precio}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Servicio personalizado */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Servicio personalizado</div>
            <div className="flex gap-2 flex-wrap">
              <input value={custom.descripcion} onChange={e => setCustom(p => ({ ...p, descripcion: e.target.value }))}
                placeholder="Descripción"
                className="flex-1 min-w-32 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              <input type="number" min="1" value={custom.cantidad} onChange={e => setCustom(p => ({ ...p, cantidad: e.target.value }))}
                placeholder="Cant."
                className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400" />
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input type="number" min="0" value={custom.precio_unitario} onChange={e => setCustom(p => ({ ...p, precio_unitario: e.target.value }))}
                  placeholder="Precio"
                  className="w-24 border border-slate-300 rounded-lg pl-6 pr-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <button onClick={agregarCustom} disabled={guardando}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                <PlusIcon className="w-4 h-4" /> Agregar
              </button>
            </div>
          </div>

          {/* Consumos registrados */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Consumos registrados ({consumos.length})
              </div>
              {consumos.length > 0 && (
                <div className="text-sm font-bold text-amber-600">Total: ${totalConsumos.toFixed(2)}</div>
              )}
            </div>
            {consumos.length === 0 ? (
              <div className="text-sm text-slate-400 text-center py-4 bg-slate-50 rounded-xl border border-slate-200">
                Sin consumos registrados
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {consumos.map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-white border border-slate-100 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-slate-700">{c.descripcion}</span>
                      {c.cantidad > 1 && <span className="text-xs text-slate-400 ml-1">×{c.cantidad}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold text-slate-800">${c.total.toFixed(2)}</span>
                      <button onClick={() => eliminarConsumo(c.id)}
                        className="text-red-400 hover:text-red-600 p-0.5">
                        <MinusIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Modal para registrar limpieza rápida ──────────────────────────────────────
function ModalLimpiezaRapida({ habitacion, onClose, onLista }) {
  const [obs, setObs] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function registrar() {
    setGuardando(true);
    try {
      await api.post('/partes-limpieza', {
        habitacion_id: habitacion.id,
        fecha: new Date().toISOString().split('T')[0],
        turno: 'manana',
        estado_habitacion: 'limpia',
        tareas_realizadas: ['Limpieza general'],
        observaciones: obs || null,
        ropa_cama: 'ok', toallas: 'ok', amenities: 'ok', minibar: 'no_aplica',
      });
      toast.success(`Hab. ${habitacion.numero} marcada como disponible`);
      onLista();
      onClose();
    } catch { toast.error('Error al registrar'); }
    finally { setGuardando(false); }
  }

  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
        Se registrará un parte de limpieza y la habitación pasará a <strong>disponible</strong>.
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Observaciones (opcional)</label>
        <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
          placeholder="Notas sobre el estado de la habitación..."
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancelar</button>
        <button onClick={registrar} disabled={guardando}
          className="flex items-center gap-2 px-5 py-2 text-sm bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg disabled:opacity-50">
          <CheckCircleIcon className="w-4 h-4" /> Marcar como lista
        </button>
      </div>
    </div>
  );
}

const ESTADOS = ['disponible', 'ocupada', 'limpieza', 'mantenimiento'];

const TIPOS_CAMA = [
  { value: 'simple', label: 'Simple (1 plaza)' },
  { value: 'doble', label: 'Doble (2 plazas)' },
  { value: 'queen', label: 'Queen' },
  { value: 'king', label: 'King' },
  { value: 'litera', label: 'Litera' },
  { value: 'sofa_cama', label: 'Sofá cama' },
];

const VISTAS = ['', 'jardín', 'piscina', 'montaña', 'mar', 'ciudad', 'patio', 'calle'];

function EditorCamas({ camas, onChange }) {
  function agregar() {
    onChange([...camas, { tipo: 'doble', cantidad: 1 }]);
  }
  function actualizar(i, campo, valor) {
    const nuevas = camas.map((c, idx) => idx === i ? { ...c, [campo]: campo === 'cantidad' ? Number(valor) : valor } : c);
    onChange(nuevas);
  }
  function quitar(i) {
    onChange(camas.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      {camas.map((cama, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={cama.tipo}
            onChange={e => actualizar(i, 'tipo', e.target.value)}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {TIPOS_CAMA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input
            type="number" min="1" max="10"
            value={cama.cantidad}
            onChange={e => actualizar(i, 'cantidad', e.target.value)}
            className="w-16 border border-slate-300 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button type="button" onClick={() => quitar(i)} className="text-red-400 hover:text-red-600 p-1">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={agregar}
        className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium mt-1"
      >
        <PlusIcon className="w-3.5 h-3.5" /> Agregar cama
      </button>
    </div>
  );
}

function FormHabitacion({ datos, tipos, onGuardar, onCancelar }) {
  const [form, setForm] = useState(() => ({
    numero: '',
    piso: 1,
    tipo_id: '',
    estado: 'disponible',
    descripcion: '',
    metros_cuadrados: '',
    vista: '',
    bano_privado: 1,
    precio_override: '',
    camas: [],
    notas: '',
    ...datos,
    // Asegurar que precio_override vacío llegue como string para el input
    precio_override: datos?.precio_override ?? '',
  }));

  // Precio base del tipo seleccionado (referencia)
  const tipoSeleccionado = tipos.find(t => String(t.id) === String(form.tipo_id));

  function f(field) {
    return e => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  async function submit(e) {
    e.preventDefault();
    await onGuardar({
      ...form,
      precio_override: form.precio_override !== '' ? Number(form.precio_override) : null,
      metros_cuadrados: form.metros_cuadrados !== '' ? Number(form.metros_cuadrados) : null,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">

      {/* Identificación */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Identificación</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Número *</label>
            <input value={form.numero} onChange={f('numero')} required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Piso *</label>
            <input type="number" min="1" value={form.piso} onChange={f('piso')} required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
        </div>
      </div>

      {/* Tipo y estado */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Clasificación</h3>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de habitación *</label>
            <select value={form.tipo_id} onChange={f('tipo_id')} required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
              <option value="">Seleccionar tipo...</option>
              {tipos.map(t => (
                <option key={t.id} value={t.id}>
                  {t.nombre} — {t.capacidad} pers. — ${t.precio_base}/noche
                </option>
              ))}
            </select>
          </div>
          {datos && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
              <select value={form.estado} onChange={f('estado')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Precio */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Precio</h3>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Precio por noche
            {tipoSeleccionado && (
              <span className="text-slate-400 font-normal ml-1">
                (base del tipo: ${tipoSeleccionado.precio_base} — dejar vacío para usar ese)
              </span>
            )}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              type="number" min="0" step="0.01"
              value={form.precio_override}
              onChange={f('precio_override')}
              placeholder={tipoSeleccionado ? `${tipoSeleccionado.precio_base} (del tipo)` : 'Precio propio'}
              className="w-full border border-slate-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>
      </div>

      {/* Camas */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Camas</h3>
        <EditorCamas camas={form.camas} onChange={camas => setForm(f => ({ ...f, camas }))} />
      </div>

      {/* Características físicas */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Características</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Metros cuadrados</label>
            <input type="number" min="1" value={form.metros_cuadrados} onChange={f('metros_cuadrados')}
              placeholder="ej: 22"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Vista</label>
            <select value={form.vista} onChange={f('vista')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
              <option value="">Sin especificar</option>
              {VISTAS.filter(v => v).map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!form.bano_privado}
                onChange={e => setForm(f => ({ ...f, bano_privado: e.target.checked ? 1 : 0 }))}
                className="w-4 h-4 rounded accent-amber-500"
              />
              <span className="text-sm font-medium text-slate-700">Baño privado</span>
            </label>
          </div>
        </div>
      </div>

      {/* Descripción y notas */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Descripción / Notas</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descripción interna</label>
            <textarea value={form.descripcion || ''} onChange={f('descripcion')} rows={2}
              placeholder="Descripción visible para el staff..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notas de mantenimiento</label>
            <textarea value={form.notas || ''} onChange={f('notas')} rows={2}
              placeholder="Observaciones, problemas conocidos..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
        <button type="button" onClick={onCancelar}
          className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
          Cancelar
        </button>
        <button type="submit"
          className="px-5 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg">
          Guardar
        </button>
      </div>
    </form>
  );
}

const CAMA_ICONS = { simple: '🛏', doble: '🛏', queen: '👑', king: '♛', litera: '🪜', sofa_cama: '🛋' };
const CAMA_LABELS = { simple: 'Simple', doble: 'Doble', queen: 'Queen', king: 'King', litera: 'Litera', sofa_cama: 'Sofá' };

function ResumenCamas({ camas }) {
  if (!camas?.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {camas.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-0.5 text-xs bg-white/70 border border-slate-200 px-1.5 py-0.5 rounded">
          {c.cantidad}× {CAMA_LABELS[c.tipo] || c.tipo}
        </span>
      ))}
    </div>
  );
}

const COLORES = {
  disponible: 'border-green-300 bg-green-50',
  ocupada: 'border-red-300 bg-red-50',
  limpieza: 'border-yellow-300 bg-yellow-50',
  mantenimiento: 'border-orange-300 bg-orange-50',
};

export default function Habitaciones() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [habitaciones, setHabitaciones] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState(searchParams.get('estado') || '');
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(null);
  const [modalServ, setModalServ] = useState(null); // habitación para agregar servicios
  const [modalLimpieza, setModalLimpieza] = useState(null); // habitación para limpieza rápida

  const cargar = () => {
    setCargando(true);
    const params = filtroEstado ? `?estado=${filtroEstado}` : '';
    Promise.all([
      api.get(`/habitaciones${params}`),
      api.get('/tipos-habitacion'),
    ]).then(([h, t]) => {
      setHabitaciones(h.data);
      setTipos(t.data);
    }).finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, [filtroEstado]);
  useAutoRefresh(cargar, 30000);

  async function guardar(form) {
    try {
      if (modal === 'nueva') {
        await api.post('/habitaciones', form);
        toast.success('Habitación creada');
      } else {
        await api.put(`/habitaciones/${modal.id}`, form);
        toast.success('Habitación actualizada');
      }
      setModal(null);
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al guardar');
    }
  }

  async function eliminar(hab) {
    if (!confirm(`¿Eliminar habitación ${hab.numero}?`)) return;
    try {
      await api.delete(`/habitaciones/${hab.id}`);
      toast.success('Eliminada');
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800">{t('habitaciones.titulo')}</h1>
        <button onClick={() => setModal('nueva')}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <PlusIcon className="w-4 h-4" /> {t('habitaciones.nueva')}
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFiltroEstado('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${!filtroEstado ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
          Todas ({habitaciones.length})
        </button>
        {ESTADOS.map(e => (
          <button key={e} onClick={() => setFiltroEstado(e === filtroEstado ? '' : e)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${filtroEstado === e ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
            {t(`habitaciones.estados.${e}`)} ({habitaciones.filter(h => h.estado === e).length})
          </button>
        ))}
      </div>

      {/* Tarjetas */}
      {cargando ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {habitaciones.map(h => (
            <div key={h.id}
              className={`rounded-xl border-2 p-3 ${COLORES[h.estado]} transition-all`}
              style={
                h.estado === 'limpieza'      ? { animation: 'parpadeo 0.8s ease-in-out infinite' } :
                h.estado === 'mantenimiento' ? { animation: 'parpadeo-rojo 0.8s ease-in-out infinite' } :
                undefined
              }
            >
              {/* Encabezado */}
              <div className="flex items-start justify-between mb-1.5">
                <div>
                  <div className="text-base font-bold text-slate-800">Hab. {h.numero}</div>
                  <div className="text-xs text-slate-500">Piso {h.piso} · {h.tipo_nombre}</div>
                </div>
                <Badge value={h.estado} label={t(`habitaciones.estados.${h.estado}`)} />
              </div>

              {/* Precio y capacidad */}
              <div className="text-xs text-slate-700 mb-1 flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-sm">${h.precio_efectivo}</span>
                <span className="text-slate-400">/noche</span>
                {h.precio_override && <span className="text-amber-600">(propio)</span>}
                {h.capacidad && <span className="text-slate-500">· {h.capacidad} pers.</span>}
                {h.metros_cuadrados && <span className="text-slate-500">· {h.metros_cuadrados}m²</span>}
              </div>

              {/* Camas */}
              <ResumenCamas camas={h.camas} />

              {/* Extras en línea */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {h.vista && (
                  <span className="text-[10px] bg-white/80 border border-slate-200 px-1 py-0.5 rounded">
                    {h.vista}
                  </span>
                )}
                {!!h.bano_privado && (
                  <span className="text-[10px] bg-white/80 border border-slate-200 px-1 py-0.5 rounded">
                    🚿 privado
                  </span>
                )}
                {h.amenidades?.slice(0, 2).map((a, i) => (
                  <span key={i} className="text-[10px] bg-white/80 border border-slate-200 px-1 py-0.5 rounded">{a}</span>
                ))}
                {h.amenidades?.length > 2 && (
                  <span className="text-[10px] text-slate-400">+{h.amenidades.length - 2}</span>
                )}
              </div>

              {/* Botones */}
              <div className="flex gap-1.5 mt-2.5">
                {h.estado === 'ocupada' && (
                  <button onClick={() => setModalServ(h)}
                    className="flex-1 flex items-center justify-center gap-1 py-1 text-[11px] bg-amber-50 border border-amber-300 rounded-lg text-amber-700 hover:bg-amber-100">
                    <SparklesIcon className="w-3 h-3" /> Servicios
                  </button>
                )}
                {h.estado === 'limpieza' && (
                  <button onClick={() => setModalLimpieza(h)}
                    className="flex-1 flex items-center justify-center gap-1 py-1 text-[11px] bg-green-50 border border-green-300 rounded-lg text-green-700 hover:bg-green-100">
                    <CheckCircleIcon className="w-3 h-3" /> Lista
                  </button>
                )}
                <button onClick={() => setModal(h)}
                  className="flex-1 flex items-center justify-center gap-1 py-1 text-[11px] bg-white border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
                  <PencilIcon className="w-3 h-3" /> Editar
                </button>
                <button onClick={() => eliminar(h)}
                  className="flex items-center justify-center px-2 py-1 text-[11px] bg-white border border-red-200 rounded-lg text-red-500 hover:bg-red-50">
                  <TrashIcon className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'nueva' ? t('habitaciones.nueva') : `Editar Hab. ${modal?.numero}`}
        size="lg"
      >
        <FormHabitacion
          datos={modal !== 'nueva' ? modal : null}
          tipos={tipos}
          onGuardar={guardar}
          onCancelar={() => setModal(null)}
        />
      </Modal>

      <Modal
        open={!!modalServ}
        onClose={() => setModalServ(null)}
        title={`Servicios — Hab. ${modalServ?.numero}`}
        size="lg"
      >
        {modalServ && <ModalServicios habitacion={modalServ} onClose={() => setModalServ(null)} />}
      </Modal>

      <Modal
        open={!!modalLimpieza}
        onClose={() => setModalLimpieza(null)}
        title={`Limpieza lista — Hab. ${modalLimpieza?.numero}`}
        size="sm"
      >
        {modalLimpieza && (
          <ModalLimpiezaRapida
            habitacion={modalLimpieza}
            onClose={() => setModalLimpieza(null)}
            onLista={cargar}
          />
        )}
      </Modal>
    </div>
  );
}
