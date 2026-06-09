import { useEffect, useState, useRef } from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';
import {
  ChevronLeftIcon, ChevronRightIcon, PlusIcon,
  XMarkIcon, CheckIcon, ArrowRightOnRectangleIcon,
  ArrowLeftOnRectangleIcon, NoSymbolIcon
} from '@heroicons/react/24/outline';

// ── Colores por estado ──────────────────────────────────────────────────────
const ESTADO_STYLE = {
  pendiente:  { bg: 'bg-yellow-200 border-yellow-400 text-yellow-900', dot: 'bg-yellow-400', label: 'Pendiente' },
  confirmada: { bg: 'bg-blue-200 border-blue-400 text-blue-900',       dot: 'bg-blue-500',   label: 'Confirmada' },
  checkin:    { bg: 'bg-green-300 border-green-500 text-green-900',    dot: 'bg-green-500',  label: 'En casa' },
  checkout:   { bg: 'bg-slate-200 border-slate-400 text-slate-700',    dot: 'bg-slate-400',  label: 'Checkout' },
};

// Tooltip simple para bloques externos
function TooltipExterno({ children, texto }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && texto && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap pointer-events-none shadow-lg">
          {texto}
        </div>
      )}
    </div>
  );
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function formatFecha(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

function formatFechaLarga(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' });
}

function esHoy(dateStr) {
  return dateStr === new Date().toISOString().split('T')[0];
}

function esFinde(dateStr) {
  const dia = new Date(dateStr + 'T00:00:00').getDay();
  return dia === 0 || dia === 6;
}

// ── Panel lateral de detalle de reserva ────────────────────────────────────
function PanelReserva({ reserva, onCerrar, onCambiarEstado, onVerReservas }) {
  if (!reserva) return null;
  const estilo = ESTADO_STYLE[reserva.estado] || ESTADO_STYLE.pendiente;

  const acciones = [
    reserva.estado === 'pendiente'  && { estado: 'confirmada', icon: CheckIcon,                     label: 'Confirmar',  color: 'bg-blue-500 hover:bg-blue-600' },
    reserva.estado === 'confirmada' && { estado: 'checkin',    icon: ArrowRightOnRectangleIcon,      label: 'Check-in',   color: 'bg-green-500 hover:bg-green-600' },
    reserva.estado === 'checkin'    && { estado: 'checkout',   icon: ArrowLeftOnRectangleIcon,       label: 'Check-out',  color: 'bg-slate-500 hover:bg-slate-600' },
    (reserva.estado === 'pendiente' || reserva.estado === 'confirmada') &&
                                       { estado: 'cancelada',  icon: NoSymbolIcon,                  label: 'Cancelar',   color: 'bg-red-500 hover:bg-red-600' },
  ].filter(Boolean);

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 bg-white shadow-2xl border-l border-slate-200 flex flex-col">
      {/* Header */}
      <div className={`px-5 py-4 border-b border-slate-200 flex items-center justify-between`}>
        <div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${estilo.bg}`}>{estilo.label}</span>
          <div className="text-xs text-slate-400 mt-1">{reserva.codigo}</div>
        </div>
        <button onClick={onCerrar} className="text-slate-400 hover:text-slate-600 p-1 rounded">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Huésped */}
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Huésped</div>
          <div className="font-semibold text-slate-800">{reserva.huesped_nombre}</div>
          {reserva.huesped_email && <div className="text-sm text-slate-500">{reserva.huesped_email}</div>}
        </div>

        {/* Habitación */}
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Habitación</div>
          <div className="font-semibold text-slate-800">Hab. {reserva.habitacion_numero} — {reserva.tipo_nombre}</div>
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-0.5">Entrada</div>
            <div className="font-semibold text-slate-700 text-sm">{formatFechaLarga(reserva.fecha_entrada)}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-0.5">Salida</div>
            <div className="font-semibold text-slate-700 text-sm">{formatFechaLarga(reserva.fecha_salida)}</div>
          </div>
        </div>

        {/* Detalles */}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Noches</span>
            <span className="font-medium text-slate-800">{reserva.noches}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Huéspedes</span>
            <span className="font-medium text-slate-800">{reserva.adultos} adultos{reserva.ninos > 0 ? `, ${reserva.ninos} niños` : ''}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Origen</span>
            <span className="font-medium text-slate-800 capitalize">{reserva.origen}</span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-2 mt-2">
            <span className="text-slate-500">Total</span>
            <span className="font-bold text-amber-600 text-base">${reserva.precio_total?.toFixed(2)}</span>
          </div>
        </div>

        {/* Acciones de estado */}
        {acciones.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Acciones</div>
            {acciones.map(acc => (
              <button key={acc.estado}
                onClick={() => onCambiarEstado(reserva.id, acc.estado)}
                className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors ${acc.color}`}>
                <acc.icon className="w-4 h-4" />
                {acc.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-200">
        <button onClick={() => onVerReservas(reserva.id)}
          className="w-full text-sm text-amber-600 hover:text-amber-700 border border-amber-300 hover:border-amber-400 rounded-xl py-2 transition-colors">
          Ver reserva completa →
        </button>
      </div>
    </div>
  );
}

const DOC_TIPOS = ['DNI', 'Pasaporte', 'Cédula', 'Otro'];
const PAISES = [
  'Argentina','Bolivia','Brasil','Chile','Colombia','Costa Rica','Cuba','Ecuador',
  'El Salvador','España','Guatemala','Honduras','México','Nicaragua','Panamá',
  'Paraguay','Perú','Puerto Rico','República Dominicana','Uruguay','Venezuela',
  'Alemania','Australia','Bélgica','Canadá','China','Corea del Sur','Estados Unidos',
  'Francia','India','Italia','Japón','Países Bajos','Polonia','Portugal',
  'Reino Unido','Rusia','Suecia','Suiza','Turquía','Otro',
];

function AcompananteRow({ tipo, index, datos, onChange, onRemove }) {
  const inp = 'w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400';
  return (
    <div className="grid grid-cols-12 gap-2 items-start bg-slate-50 rounded-lg p-2">
      <div className="col-span-5">
        <input placeholder={tipo === 'adulto' ? 'Nombre y apellido' : 'Nombre'} value={datos.nombre} onChange={e => onChange('nombre', e.target.value)}
          className={inp} required />
      </div>
      {tipo === 'adulto' ? (
        <>
          <div className="col-span-3">
            <select value={datos.documento_tipo || 'DNI'} onChange={e => onChange('documento_tipo', e.target.value)} className={inp}>
              {DOC_TIPOS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="col-span-3">
            <input placeholder="Nº doc" value={datos.documento_numero || ''} onChange={e => onChange('documento_numero', e.target.value)} className={inp} />
          </div>
        </>
      ) : (
        <>
          <div className="col-span-3">
            <input type="number" min="0" max="17" placeholder="Edad" value={datos.edad || ''} onChange={e => onChange('edad', e.target.value)} className={inp} />
          </div>
          <div className="col-span-3" />
        </>
      )}
      <div className="col-span-1 flex justify-end pt-1">
        <button type="button" onClick={onRemove} className="text-slate-400 hover:text-red-500">
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Modal nueva reserva rápida ──────────────────────────────────────────────
function ModalNuevaReserva({ hab, fechaInicio, onGuardar, onCerrar }) {
  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400';

  const [form, setForm] = useState({
    fecha_entrada: fechaInicio || '',
    fecha_salida: addDays(fechaInicio || new Date().toISOString().split('T')[0], 1),
    origen: 'directo',
    precio_noche: hab?.precio_efectivo || '',
  });

  // Titular — puede ser existente o nuevo
  const [modoHuesped, setModoHuesped] = useState('buscar'); // 'buscar' | 'nuevo'
  const [buscar, setBuscar] = useState('');
  const [resultados, setResultados] = useState([]);
  const [huespedId, setHuespedId] = useState('');
  const [huespedNombre, setHuespedNombre] = useState('');
  const [nuevoHuesped, setNuevoHuesped] = useState({
    nombre: '', apellido: '', email: '', telefono: '',
    nacionalidad: 'Argentina', documento_tipo: 'DNI', documento_numero: '', pasaporte_numero: '',
  });

  // Acompañantes
  const [adultos, setAdultos] = useState([]);    // [{nombre, documento_tipo, documento_numero}]
  const [ninos, setNinos]     = useState([]);    // [{nombre, edad}]

  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (buscar.length >= 2) api.get(`/huespedes?buscar=${buscar}`).then(r => setResultados(Array.isArray(r.data) ? r.data : []));
    else setResultados([]);
  }, [buscar]);

  const fForm = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const fNuevo = k => e => setNuevoHuesped(p => ({ ...p, [k]: e.target.value }));

  const totalAdultos = 1 + adultos.length;
  const totalNinos   = ninos.length;

  function addAdulto() { setAdultos(a => [...a, { nombre: '', documento_tipo: 'DNI', documento_numero: '' }]); }
  function addNino()   { setNinos(n => [...n, { nombre: '', edad: '' }]); }
  function updAdulto(i, k, v) { setAdultos(a => a.map((x, j) => j === i ? { ...x, [k]: v } : x)); }
  function updNino(i, k, v)   { setNinos(n => n.map((x, j) => j === i ? { ...x, [k]: v } : x)); }

  const noches = (() => {
    if (!form.fecha_entrada || !form.fecha_salida) return 0;
    const d = (new Date(form.fecha_salida) - new Date(form.fecha_entrada)) / 86400000;
    return d > 0 ? d : 0;
  })();
  const total = noches && form.precio_noche ? (noches * Number(form.precio_noche)).toFixed(2) : null;

  async function submit(e) {
    e.preventDefault();
    if (modoHuesped === 'buscar' && !huespedId) { toast.error('Seleccioná un huésped'); return; }
    if (new Date(form.fecha_salida) <= new Date(form.fecha_entrada)) { toast.error('La salida debe ser posterior a la entrada'); return; }
    setEnviando(true);
    try {
      const acompanantes = [
        ...adultos.map(a => ({ tipo: 'adulto', ...a })),
        ...ninos.map(n => ({ tipo: 'nino', ...n })),
      ];
      const payload = {
        habitacion_id: hab.id,
        fecha_entrada: form.fecha_entrada,
        fecha_salida:  form.fecha_salida,
        adultos: totalAdultos,
        ninos:   totalNinos,
        origen:  form.origen,
        precio_noche: form.precio_noche,
        acompanantes: acompanantes.length ? acompanantes : undefined,
      };
      if (modoHuesped === 'buscar') {
        payload.huesped_id = huespedId;
      } else {
        const doc = nuevoHuesped.nacionalidad !== 'Argentina' && nuevoHuesped.pasaporte_numero
          ? `${nuevoHuesped.documento_numero} / Pasaporte: ${nuevoHuesped.pasaporte_numero}`
          : nuevoHuesped.documento_numero;
        payload.huesped = { ...nuevoHuesped, documento_numero: doc };
      }
      await api.post('/reservas', payload);
      toast.success('Reserva creada');
      onGuardar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear reserva');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onCerrar}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="font-bold text-slate-800">Nueva reserva</h2>
            <p className="text-sm text-slate-500">Hab. {hab.numero} — {hab.tipo_nombre}</p>
          </div>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="w-5 h-5" /></button>
        </div>

        <form onSubmit={submit} className="overflow-y-auto flex-1 px-6 py-4 space-y-4">

          {/* Fechas + precio */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Entrada *</label>
              <input type="date" value={form.fecha_entrada} onChange={fForm('fecha_entrada')} required className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Salida *</label>
              <input type="date" value={form.fecha_salida} min={form.fecha_entrada} onChange={fForm('fecha_salida')} required className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">$/noche *</label>
              <input type="number" min="0" step="0.01" value={form.precio_noche} onChange={fForm('precio_noche')} required className={inp} />
            </div>
          </div>
          {total && <p className="text-xs text-amber-600 -mt-2">{noches} noche{noches !== 1 ? 's' : ''} · Total: <strong>${total}</strong></p>}

          {/* Origen */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Origen</label>
            <select value={form.origen} onChange={fForm('origen')} className={inp}>
              {['directo','web','telefono','booking','airbnb'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Titular */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Titular de la reserva</span>
              <div className="flex rounded-lg border border-slate-300 overflow-hidden text-xs">
                <button type="button" onClick={() => { setModoHuesped('buscar'); setHuespedId(''); setHuespedNombre(''); setBuscar(''); }}
                  className={`px-3 py-1 ${modoHuesped === 'buscar' ? 'bg-amber-500 text-white font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
                  Buscar existente
                </button>
                <button type="button" onClick={() => { setModoHuesped('nuevo'); setHuespedId(''); }}
                  className={`px-3 py-1 border-l border-slate-300 ${modoHuesped === 'nuevo' ? 'bg-amber-500 text-white font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
                  Nuevo huésped
                </button>
              </div>
            </div>

            {modoHuesped === 'buscar' ? (
              <div>
                <input value={buscar} onChange={e => { setBuscar(e.target.value); setHuespedId(''); setHuespedNombre(''); }}
                  placeholder="Buscar por nombre, email o documento..."
                  className={inp} />
                {resultados.length > 0 && (
                  <div className="mt-1 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                    {resultados.map(h => (
                      <button key={h.id} type="button"
                        onClick={() => { setHuespedId(h.id); setHuespedNombre(`${h.nombre} ${h.apellido}`); setBuscar(`${h.nombre} ${h.apellido}`); setResultados([]); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-amber-50 ${String(huespedId) === String(h.id) ? 'bg-amber-100' : ''}`}>
                        <span className="font-medium text-slate-800">{h.nombre} {h.apellido}</span>
                        {h.email && <span className="text-slate-400 ml-2 text-xs">{h.email}</span>}
                        {h.documento_numero && <span className="text-slate-400 ml-2 text-xs">{h.documento_numero}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {huespedId && <p className="text-xs text-green-600 mt-1">✓ {huespedNombre}</p>}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
                    <input value={nuevoHuesped.nombre} onChange={fNuevo('nombre')} required className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Apellido *</label>
                    <input value={nuevoHuesped.apellido} onChange={fNuevo('apellido')} required className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
                    <input type="email" value={nuevoHuesped.email} onChange={fNuevo('email')} required className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Teléfono</label>
                    <input type="tel" value={nuevoHuesped.telefono} onChange={fNuevo('telefono')} className={inp} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Nacionalidad</label>
                    <select value={nuevoHuesped.nacionalidad} onChange={fNuevo('nacionalidad')} className={inp}>
                      {PAISES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Tipo doc.</label>
                    <select value={nuevoHuesped.documento_tipo} onChange={fNuevo('documento_tipo')} className={inp}>
                      {DOC_TIPOS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Nº documento</label>
                    <input value={nuevoHuesped.documento_numero} onChange={fNuevo('documento_numero')} className={inp} />
                  </div>
                  {nuevoHuesped.nacionalidad !== 'Argentina' && (
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Nº pasaporte *</label>
                      <input value={nuevoHuesped.pasaporte_numero} onChange={fNuevo('pasaporte_numero')} required
                        className="w-full border border-amber-300 bg-amber-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Acompañantes adultos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Acompañantes adultos <span className="text-slate-400 font-normal">({adultos.length} + titular = {totalAdultos} total)</span>
              </span>
              <button type="button" onClick={addAdulto}
                className="text-xs text-amber-600 hover:text-amber-700 border border-amber-300 rounded-lg px-2 py-1 hover:bg-amber-50">
                + Agregar
              </button>
            </div>
            {adultos.length > 0 && (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs text-slate-400 px-2">
                  <div className="col-span-5">Nombre y apellido</div>
                  <div className="col-span-3">Tipo doc.</div>
                  <div className="col-span-3">Nº documento</div>
                </div>
                {adultos.map((a, i) => (
                  <AcompananteRow key={i} tipo="adulto" index={i} datos={a}
                    onChange={(k, v) => updAdulto(i, k, v)}
                    onRemove={() => setAdultos(prev => prev.filter((_, j) => j !== i))} />
                ))}
              </div>
            )}
          </div>

          {/* Acompañantes niños */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Niños <span className="text-slate-400 font-normal">({totalNinos} total)</span>
              </span>
              <button type="button" onClick={addNino}
                className="text-xs text-amber-600 hover:text-amber-700 border border-amber-300 rounded-lg px-2 py-1 hover:bg-amber-50">
                + Agregar
              </button>
            </div>
            {ninos.length > 0 && (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs text-slate-400 px-2">
                  <div className="col-span-5">Nombre</div>
                  <div className="col-span-3">Edad</div>
                </div>
                {ninos.map((n, i) => (
                  <AcompananteRow key={i} tipo="nino" index={i} datos={n}
                    onChange={(k, v) => updNino(i, k, v)}
                    onRemove={() => setNinos(prev => prev.filter((_, j) => j !== i))} />
                ))}
              </div>
            )}
          </div>

        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex gap-3 shrink-0">
          <button type="button" onClick={onCerrar}
            className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 text-sm font-medium">
            Cancelar
          </button>
          <button type="submit" form="form-nueva-reserva" disabled={enviando} onClick={submit}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-xl transition-colors text-sm disabled:opacity-60">
            {enviando ? 'Guardando...' : 'Crear reserva'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────
const SEMANAS_OPCIONES = [2, 4, 6, 8];
const COL_HAB_W = 120; // px ancho columna habitación
const COL_DIA_W = 38;  // px ancho por día

export default function Calendario() {
  const navigate = useNavigate();
  const hoy = new Date().toISOString().split('T')[0];

  const [fechaInicio, setFechaInicio] = useState(() => {
    // Empezar desde el lunes de la semana actual
    const d = new Date();
    const dia = d.getDay();
    d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1));
    return d.toISOString().split('T')[0];
  });
  const [semanas, setSemanas] = useState(4);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);

  const [reservaSeleccionada, setReservaSeleccionada] = useState(null);
  const [reservaDetalle, setReservaDetalle] = useState(null); // datos enriquecidos para el panel
  const [nuevaReserva, setNuevaReserva] = useState(null); // { hab, fecha }
  const [bloqueadosExternos, setBloqueadosExternos] = useState([]); // reservas_externas
  const [pisosVisible, setPisosVisible] = useState([]); // [] = todos los pisos visibles

  const gridRef = useRef(null);

  const fechaFin = addDays(fechaInicio, semanas * 7);

  function cargar() {
    setCargando(true);
    Promise.all([
      api.get(`/reservas/calendario?fecha_inicio=${fechaInicio}&semanas=${semanas}`),
      api.get(`/ical-feeds/bloqueados?desde=${fechaInicio}&hasta=${fechaFin}`),
    ]).then(([rCal, rBlq]) => {
      setDatos(rCal.data);
      setBloqueadosExternos(Array.isArray(rBlq.data) ? rBlq.data : []);
    }).finally(() => setCargando(false));
  }

  useEffect(() => { cargar(); }, [fechaInicio, semanas]);
  useAutoRefresh(cargar, 30000);

  // Scroll a "hoy" al cargar
  useEffect(() => {
    if (!datos || !gridRef.current) return;
    const idx = daysBetween(datos.fecha_inicio, hoy);
    if (idx >= 0 && idx < datos.dias) {
      const scrollX = COL_HAB_W + idx * COL_DIA_W - 120;
      gridRef.current.scrollLeft = Math.max(0, scrollX);
    }
  }, [datos]);

  function irSemanaAnterior() { setFechaInicio(addDays(fechaInicio, -7)); }
  function irSemanaProxima()  { setFechaInicio(addDays(fechaInicio,  7)); }
  function irHoy()            {
    const d = new Date();
    const dia = d.getDay();
    d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1));
    setFechaInicio(d.toISOString().split('T')[0]);
  }

  async function abrirReserva(reservaId) {
    try {
      const r = await api.get(`/reservas/${reservaId}`);
      setReservaDetalle(r.data);
      setReservaSeleccionada(reservaId);
    } catch { toast.error('No se pudo cargar la reserva'); }
  }

  async function cambiarEstado(id, estado) {
    try {
      await api.patch(`/reservas/${id}/estado`, { estado });
      toast.success('Estado actualizado');
      setReservaDetalle(null);
      setReservaSeleccionada(null);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cambiar estado');
    }
  }

  if (cargando && !datos) {
    return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const { habitaciones: todasHabs = [], reservas = [], dias = 28 } = datos || {};

  // Pisos disponibles
  const pisos = [...new Set(todasHabs.map(h => h.piso))].sort((a, b) => a - b);

  // Habitaciones filtradas por piso seleccionado
  const habitaciones = pisosVisible.length > 0
    ? todasHabs.filter(h => pisosVisible.includes(h.piso))
    : todasHabs;

  // Construir array de fechas del rango
  const fechas = Array.from({ length: dias }, (_, i) => addDays(fechaInicio, i));

  // Mapa de reservas por habitación
  const reservasPorHab = {};
  for (const r of reservas) {
    if (!reservasPorHab[r.habitacion_id]) reservasPorHab[r.habitacion_id] = [];
    reservasPorHab[r.habitacion_id].push(r);
  }

  // Mapa de bloqueados externos por habitación
  const bloqueadosPorHab = {};
  for (const b of bloqueadosExternos) {
    if (!bloqueadosPorHab[b.habitacion_id]) bloqueadosPorHab[b.habitacion_id] = [];
    bloqueadosPorHab[b.habitacion_id].push(b);
  }

  const totalW = COL_HAB_W + dias * COL_DIA_W;

  return (
    <div className="space-y-4">
      {/* ── Cabecera ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Calendario de disponibilidad</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro por piso — solo si hay más de 1 piso */}
          {pisos.length > 1 && (
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              <button onClick={() => setPisosVisible([])}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${pisosVisible.length === 0 ? 'bg-white shadow text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}>
                Todos
              </button>
              {pisos.map(p => (
                <button key={p}
                  onClick={() => setPisosVisible(prev =>
                    prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                  )}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${pisosVisible.includes(p) ? 'bg-white shadow text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}>
                  P{p}
                </button>
              ))}
            </div>
          )}
          {/* Semanas */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {SEMANAS_OPCIONES.map(s => (
              <button key={s} onClick={() => setSemanas(s)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${semanas === s ? 'bg-white shadow text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}>
                {s}sem
              </button>
            ))}
          </div>
          {/* Navegación */}
          <button onClick={irSemanaAnterior} className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-600">
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <button onClick={irHoy} className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-600">
            Hoy
          </button>
          <button onClick={irSemanaProxima} className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-600">
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Leyenda ── */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(ESTADO_STYLE).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm ${v.dot}`} />
            {v.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-slate-100 border border-dashed border-slate-300" />
          Libre
        </span>
        {bloqueadosExternos.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border border-slate-400"
              style={{ backgroundImage: 'repeating-linear-gradient(135deg, #94a3b8 0px, #94a3b8 2px, #e2e8f0 2px, #e2e8f0 8px)' }} />
            Bloqueado externo
          </span>
        )}
      </div>

      {/* ── Grid ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div ref={gridRef} className="overflow-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
          <div style={{ minWidth: totalW + 'px' }}>
            {/* Header de fechas (sticky top) */}
            <div className="flex sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
              {/* Columna habitación */}
              <div style={{ minWidth: COL_HAB_W, width: COL_HAB_W }}
                className="shrink-0 sticky left-0 z-30 bg-white border-r border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                Habitación
              </div>
              {/* Días */}
              {fechas.map(f => (
                <div key={f} style={{ minWidth: COL_DIA_W, width: COL_DIA_W }}
                  className={`shrink-0 text-center py-2 border-r border-slate-100 last:border-r-0
                    ${esHoy(f) ? 'bg-amber-50' : esFinde(f) ? 'bg-slate-50' : ''}`}>
                  <div className={`text-xs font-semibold leading-tight ${esHoy(f) ? 'text-amber-600' : 'text-slate-500'}`}>
                    {new Date(f + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'narrow' })}
                  </div>
                  <div className={`text-xs leading-tight ${esHoy(f) ? 'text-amber-700 font-bold' : 'text-slate-400'}`}>
                    {new Date(f + 'T00:00:00').getDate()}
                  </div>
                  {/* Indicador mes */}
                  {new Date(f + 'T00:00:00').getDate() === 1 && (
                    <div className="text-[9px] font-bold text-amber-500 uppercase leading-none">
                      {new Date(f + 'T00:00:00').toLocaleDateString('es-AR', { month: 'short' })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Filas de habitaciones — con separadores de piso */}
            {habitaciones.map((hab, hi) => {
              const reservasHab = reservasPorHab[hab.id] || [];
              const bloqueadosHab = bloqueadosPorHab[hab.id] || [];
              // Mostrar separador de piso si es la primera hab de ese piso (y hay más de 1 piso)
              const esPrimeroDePiso = pisos.length > 1 && (hi === 0 || habitaciones[hi - 1].piso !== hab.piso);

              return (
                <div key={hab.id}>
                  {/* Separador de piso */}
                  {esPrimeroDePiso && (
                    <div className="flex bg-slate-700 border-y border-slate-600" style={{ minWidth: totalW + 'px' }}>
                      <div style={{ minWidth: COL_HAB_W, width: COL_HAB_W }}
                        className="shrink-0 px-3 py-1 text-[11px] font-bold text-white uppercase tracking-wider sticky left-0 bg-slate-700">
                        Piso {hab.piso}
                      </div>
                      <div className="flex-1" />
                    </div>
                  )}
                <div className={`flex border-b border-slate-100 last:border-b-0 ${hi % 2 === 0 ? '' : 'bg-slate-50/40'}`}
                  style={{ height: 48 }}>
                  {/* Columna habitación (sticky left) */}
                  <div style={{ minWidth: COL_HAB_W, width: COL_HAB_W, backgroundColor: hi % 2 === 0 ? 'white' : 'rgb(248 250 252)' }}
                    className="shrink-0 sticky left-0 z-10 border-r border-slate-200 px-3 flex flex-col justify-center">
                    <div className="text-xs font-bold text-slate-700 leading-tight">Hab. {hab.numero}</div>
                    <div className="text-[10px] text-slate-400 leading-tight truncate">{hab.tipo_nombre}</div>
                  </div>

                  {/* Celdas de días — posicionamiento relativo para los bloques */}
                  <div className="flex-1 relative" style={{ height: 48 }}>
                    {/* Líneas verticales de días */}
                    {fechas.map((f, di) => (
                      <div key={f}
                        onClick={() => {
                          // Solo abrir modal si la celda está libre (sin reservas ni bloqueados externos)
                          const ocupada = reservasHab.some(r => r.fecha_entrada <= f && r.fecha_salida > f);
                          const bloqueada = bloqueadosHab.some(b => b.fecha_entrada <= f && b.fecha_salida > f);
                          if (!ocupada && !bloqueada) setNuevaReserva({ hab, fecha: f });
                        }}
                        style={{ left: di * COL_DIA_W, width: COL_DIA_W, top: 0, bottom: 0 }}
                        className={`absolute border-r border-slate-100 last:border-r-0 cursor-pointer transition-colors
                          ${esHoy(f) ? 'bg-amber-50/60' : esFinde(f) ? 'bg-slate-50/60' : 'hover:bg-amber-50/30'}
                          ${reservasHab.some(r => r.fecha_entrada <= f && r.fecha_salida > f) ? 'cursor-default' : ''}`}
                      />
                    ))}

                    {/* Bloques externos (Booking/Airbnb) */}
                    {bloqueadosHab.map(b => {
                      const inicio = Math.max(0, daysBetween(fechaInicio, b.fecha_entrada));
                      const fin    = Math.min(dias, daysBetween(fechaInicio, b.fecha_salida));
                      if (fin <= 0 || inicio >= dias || fin <= inicio) return null;
                      const ancho = (fin - inicio) * COL_DIA_W;
                      const label = b.feed_nombre || b.origen || 'Externo';
                      return (
                        <TooltipExterno key={`ext-${b.id}`} texto={`${label}${b.resumen ? ' · ' + b.resumen : ''}`}>
                          <div
                            style={{
                              position: 'absolute',
                              left: inicio * COL_DIA_W + 1,
                              width: ancho - 2,
                              top: 4,
                              bottom: 4,
                              backgroundImage: 'repeating-linear-gradient(135deg, #94a3b8 0px, #94a3b8 2px, #e2e8f0 2px, #e2e8f0 8px)',
                            }}
                            className="rounded border border-slate-400 overflow-hidden flex items-center px-1 gap-1 text-[10px] text-slate-600 font-medium z-5">
                            <span className="truncate">{label}</span>
                          </div>
                        </TooltipExterno>
                      );
                    })}

                    {/* Bloques de reservas */}
                    {reservasHab.map(r => {
                      const inicio = Math.max(0, daysBetween(fechaInicio, r.fecha_entrada));
                      const fin    = Math.min(dias, daysBetween(fechaInicio, r.fecha_salida));
                      if (fin <= 0 || inicio >= dias || fin <= inicio) return null;
                      const estilo = ESTADO_STYLE[r.estado] || ESTADO_STYLE.pendiente;
                      const ancho = (fin - inicio) * COL_DIA_W;
                      const seleccionada = reservaSeleccionada === r.id;

                      return (
                        <div key={r.id}
                          onClick={e => { e.stopPropagation(); abrirReserva(r.id); }}
                          style={{
                            position: 'absolute',
                            left: inicio * COL_DIA_W + 2,
                            width: ancho - 4,
                            top: 6,
                            bottom: 6,
                          }}
                          className={`rounded border cursor-pointer overflow-hidden flex items-center px-2 gap-1 text-xs font-medium transition-all z-10
                            ${estilo.bg} ${seleccionada ? 'ring-2 ring-offset-1 ring-amber-400 shadow-md' : 'opacity-90 hover:opacity-100 hover:shadow-sm'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${estilo.dot}`} />
                          <span className="truncate">{r.huesped_nombre?.split(' ')[0]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                </div>
              );
            })}

            {habitaciones.length === 0 && (
              <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
                No hay habitaciones registradas
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Recarga ── */}
      {cargando && (
        <div className="flex justify-center py-2">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── Panel lateral ── */}
      {reservaDetalle && (
        <>
          <div className="fixed inset-0 z-30 bg-black/10" onClick={() => { setReservaDetalle(null); setReservaSeleccionada(null); }} />
          <PanelReserva
            reserva={reservaDetalle}
            onCerrar={() => { setReservaDetalle(null); setReservaSeleccionada(null); }}
            onCambiarEstado={cambiarEstado}
            onVerReservas={() => { navigate('/reservas'); }}
          />
        </>
      )}

      {/* ── Modal nueva reserva ── */}
      {nuevaReserva && (
        <ModalNuevaReserva
          hab={nuevaReserva.hab}
          fechaInicio={nuevaReserva.fecha}
          onGuardar={() => { setNuevaReserva(null); cargar(); }}
          onCerrar={() => setNuevaReserva(null)}
        />
      )}
    </div>
  );
}
