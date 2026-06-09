import { useEffect, useState } from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import Tabla from '../components/Tabla';
import { PlusIcon, EyeIcon, ExclamationTriangleIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

const ESTADOS = ['pendiente', 'confirmada', 'checkin', 'checkout', 'cancelada', 'noshow'];
const ORIGENES = ['directo', 'web', 'telefono', 'booking', 'airbnb'];

const DOC_TIPOS = ['DNI', 'Pasaporte', 'Cédula', 'Otro'];
const PAISES = [
  'Argentina','Bolivia','Brasil','Chile','Colombia','Costa Rica','Cuba','Ecuador',
  'El Salvador','España','Guatemala','Honduras','México','Nicaragua','Panamá',
  'Paraguay','Perú','Puerto Rico','República Dominicana','Uruguay','Venezuela',
  'Alemania','Australia','Bélgica','Canadá','China','Corea del Sur','Estados Unidos',
  'Francia','India','Italia','Japón','Países Bajos','Polonia','Portugal',
  'Reino Unido','Rusia','Suecia','Suiza','Turquía','Otro',
];

function noches(entrada, salida) {
  if (!entrada || !salida) return 0;
  const diff = (new Date(salida) - new Date(entrada)) / 86400000;
  return diff > 0 ? diff : 0;
}

function FormReserva({ onGuardar, onCancelar }) {
  // ── Paso 1: fechas + personas
  const [fechas, setFechas] = useState({
    fecha_entrada: '', fecha_salida: '', adultos: 2, ninos: 0, origen: 'directo',
  });

  // ── Paso 2: elegir habitación disponible
  const [paso, setPaso] = useState(1); // 1=fechas 2=habitacion 3=huesped
  const [habitaciones, setHabitaciones] = useState([]);
  const [cargandoHabs, setCargandoHabs] = useState(false);
  const [habSeleccionada, setHabSeleccionada] = useState(null);
  const [precioNoche, setPrecioNoche] = useState('');

  // ── Paso 3: datos del huésped
  const [huesped, setHuesped] = useState({
    nombre: '', apellido: '', email: '', telefono: '',
    nacionalidad: 'Argentina', documento_tipo: 'DNI', documento_numero: '',
    pasaporte_numero: '',
  });
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);

  const f = key => e => setHuesped(p => ({ ...p, [key]: e.target.value }));

  function buscarDisponibles(e) {
    e.preventDefault();
    if (!fechas.fecha_entrada || !fechas.fecha_salida) return;
    if (new Date(fechas.fecha_salida) <= new Date(fechas.fecha_entrada)) {
      toast.error('La salida debe ser posterior a la entrada'); return;
    }
    setCargandoHabs(true);
    api.get('/habitaciones/disponibles', {
      params: { fecha_entrada: fechas.fecha_entrada, fecha_salida: fechas.fecha_salida, adultos: fechas.adultos }
    }).then(r => {
      setHabitaciones(r.data);
      setPaso(2);
    }).catch(() => toast.error('Error al buscar disponibilidad'))
      .finally(() => setCargandoHabs(false));
  }

  function elegirHab(hab) {
    setHabSeleccionada(hab);
    setPrecioNoche(hab.precio_efectivo ?? hab.precio_base ?? hab.precio_noche ?? '');
    setPaso(3);
  }

  async function confirmar(e) {
    e.preventDefault();
    setEnviando(true);
    try {
      const documento = huesped.nacionalidad !== 'Argentina' && huesped.pasaporte_numero
        ? `${huesped.documento_numero} / Pasaporte: ${huesped.pasaporte_numero}`
        : huesped.documento_numero;
      await onGuardar({
        fecha_entrada: fechas.fecha_entrada,
        fecha_salida: fechas.fecha_salida,
        adultos: fechas.adultos,
        ninos: fechas.ninos,
        origen: fechas.origen,
        habitacion_id: habSeleccionada.id,
        precio_noche: precioNoche,
        notas,
        huesped: { ...huesped, documento_numero: documento },
      });
    } finally {
      setEnviando(false);
    }
  }

  const n = noches(fechas.fecha_entrada, fechas.fecha_salida);
  const total = n && precioNoche ? (n * Number(precioNoche)).toFixed(2) : null;

  const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400';

  // ── PASO 1: fechas, personas y origen ──
  if (paso === 1) return (
    <form onSubmit={buscarDisponibles} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Fecha entrada *</label>
          <input type="date" value={fechas.fecha_entrada} onChange={e => setFechas(f => ({ ...f, fecha_entrada: e.target.value }))}
            className={inputCls} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Fecha salida *</label>
          <input type="date" value={fechas.fecha_salida} onChange={e => setFechas(f => ({ ...f, fecha_salida: e.target.value }))}
            className={inputCls} required />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Adultos</label>
          <input type="number" min="1" value={fechas.adultos} onChange={e => setFechas(f => ({ ...f, adultos: +e.target.value }))}
            className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Niños</label>
          <input type="number" min="0" value={fechas.ninos} onChange={e => setFechas(f => ({ ...f, ninos: +e.target.value }))}
            className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Origen</label>
          <select value={fechas.origen} onChange={e => setFechas(f => ({ ...f, origen: e.target.value }))} className={inputCls}>
            {ORIGENES.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancelar} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancelar</button>
        <button type="submit" disabled={cargandoHabs} className="px-5 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg disabled:opacity-60">
          {cargandoHabs ? 'Buscando...' : 'Ver disponibilidad →'}
        </button>
      </div>
    </form>
  );

  // ── PASO 2: elegir habitación ──
  if (paso === 2) return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-slate-500">
          {fechas.fecha_entrada} → {fechas.fecha_salida} · {n} noche{n !== 1 ? 's' : ''} · {fechas.adultos}A {fechas.ninos > 0 ? `+ ${fechas.ninos}N` : ''}
        </p>
        <button onClick={() => setPaso(1)} className="text-xs text-amber-600 hover:underline">← Cambiar fechas</button>
      </div>
      {habitaciones.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <div className="text-4xl mb-2">😔</div>
          <p>Sin habitaciones disponibles para esas fechas.</p>
          <button onClick={() => setPaso(1)} className="mt-3 text-amber-600 hover:underline text-sm">Cambiar fechas</button>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {habitaciones.map(hab => (
            <button key={hab.id} onClick={() => elegirHab(hab)}
              className="w-full text-left border border-slate-200 hover:border-amber-400 hover:bg-amber-50 rounded-xl p-4 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-semibold text-slate-800">Hab. {hab.numero}</span>
                  <span className="text-slate-500 text-sm ml-2">{hab.tipo_nombre}</span>
                  {hab.vista && <span className="text-xs text-slate-400 ml-2">· {hab.vista}</span>}
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="font-bold text-amber-600">${hab.precio_efectivo ?? hab.precio_base ?? hab.precio_noche}/noche</div>
                  <div className="text-xs text-slate-500">Total: ${((hab.precio_efectivo ?? hab.precio_base ?? hab.precio_noche) * n).toFixed(2)}</div>
                </div>
              </div>
              <div className="flex gap-3 text-xs text-slate-500 mt-1">
                <span>👥 {hab.capacidad} personas</span>
                {hab.metros_cuadrados && <span>📐 {hab.metros_cuadrados} m²</span>}
                {!!hab.bano_privado && <span>🚿 Baño privado</span>}
              </div>
            </button>
          ))}
        </div>
      )}
      <div className="flex justify-start pt-1">
        <button onClick={onCancelar} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancelar</button>
      </div>
    </div>
  );

  // ── PASO 3: datos del huésped ──
  return (
    <form onSubmit={confirmar} className="space-y-4">
      {/* Resumen */}
      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
        <div className="text-2xl">🛏️</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 text-sm">{habSeleccionada.tipo_nombre} — Hab. {habSeleccionada.numero}</div>
          <div className="text-xs text-amber-700">{fechas.fecha_entrada} → {fechas.fecha_salida} · {n} noche{n !== 1 ? 's' : ''}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500">$/noche:</span>
            <input type="number" step="0.01" value={precioNoche} onChange={e => setPrecioNoche(e.target.value)}
              className="w-20 border border-amber-300 rounded px-2 py-0.5 text-sm font-bold text-amber-700 focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white" required />
          </div>
          {total && <div className="text-xs text-amber-600 text-right">Total: ${total}</div>}
        </div>
        <button type="button" onClick={() => setPaso(2)} className="text-xs text-slate-400 hover:text-amber-600 ml-1">✎</button>
      </div>

      {/* Datos del huésped */}
      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Datos del huésped</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Nombre *</label>
          <input value={huesped.nombre} onChange={f('nombre')} required className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Apellido *</label>
          <input value={huesped.apellido} onChange={f('apellido')} required className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Email *</label>
          <input type="email" value={huesped.email} onChange={f('email')} required className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Teléfono</label>
          <input type="tel" value={huesped.telefono} onChange={f('telefono')} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-600 mb-1">Nacionalidad</label>
          <select value={huesped.nacionalidad} onChange={f('nacionalidad')} className={inputCls}>
            {PAISES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Tipo documento</label>
          <select value={huesped.documento_tipo} onChange={f('documento_tipo')} className={inputCls}>
            {DOC_TIPOS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Nº documento</label>
          <input value={huesped.documento_numero} onChange={f('documento_numero')} className={inputCls} />
        </div>
        {huesped.nacionalidad !== 'Argentina' && (
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-600 mb-1">Nº pasaporte *</label>
            <input value={huesped.pasaporte_numero} onChange={f('pasaporte_numero')} required
              placeholder="Requerido para huéspedes extranjeros"
              className="w-full border border-amber-300 bg-amber-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">Notas</label>
        <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} className={inputCls} />
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={() => setPaso(2)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">← Volver</button>
        <button type="submit" disabled={enviando} className="px-5 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg disabled:opacity-60">
          {enviando ? 'Guardando...' : 'Confirmar reserva'}
        </button>
      </div>
    </form>
  );
}

const METODOS_PAGO = [
  { value: 'efectivo',     label: '💵 Efectivo' },
  { value: 'transferencia', label: '🏦 Transferencia' },
  { value: 'tarjeta',      label: '💳 Tarjeta' },
  { value: 'otro',         label: '📋 Otro' },
];

function DetalleReserva({ reserva: reservaInicial, onCambiarEstado, onClose, onReload }) {
  const { t } = useTranslation();
  const [reserva, setReserva] = useState(reservaInicial);
  const [metodoSenia, setMetodoSenia] = useState('efectivo');
  const [registrandoSenia, setRegistrandoSenia] = useState(false);
  const [enviandoRecordatorio, setEnviandoRecordatorio] = useState(false);
  const [nuevaSalida, setNuevaSalida] = useState('');
  const [extendiendo, setExtendiendo] = useState(false);
  const [editNotas, setEditNotas] = useState(false);
  const [notasForm, setNotasForm] = useState({ notas: reservaInicial.notas || '', notas_internas: reservaInicial.notas_internas || '' });
  const [guardandoNotas, setGuardandoNotas] = useState(false);

  const saldo = reserva.senia != null
    ? Math.round((reserva.precio_total - reserva.senia) * 100) / 100
    : null;

  async function cobrarSenia() {
    setRegistrandoSenia(true);
    try {
      await api.patch(`/reservas/${reserva.id}/senia`, { metodo: metodoSenia });
      toast.success('Seña registrada como cobrada');
      // Recargar datos de la reserva
      const r = await api.get(`/reservas/${reserva.id}`);
      setReserva(r.data);
      onReload?.();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al registrar seña');
    } finally { setRegistrandoSenia(false); }
  }

  async function guardarNotas() {
    setGuardandoNotas(true);
    try {
      await api.patch(`/reservas/${reserva.id}/notas`, notasForm);
      toast.success('Notas guardadas');
      setReserva(r => ({ ...r, ...notasForm }));
      setEditNotas(false);
      onReload?.();
    } catch { toast.error('Error al guardar notas'); }
    finally { setGuardandoNotas(false); }
  }

  async function extenderEstadia() {
    if (!nuevaSalida) return toast.error('Seleccioná la nueva fecha de salida');
    setExtendiendo(true);
    try {
      const r = await api.patch(`/reservas/${reserva.id}/extender`, { nueva_fecha_salida: nuevaSalida });
      toast.success(`Estadía extendida — ${r.data.noches} noches · $${r.data.precio_total}`);
      const updated = await api.get(`/reservas/${reserva.id}`);
      setReserva(updated.data);
      setNuevaSalida('');
      onReload?.();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al extender estadía');
    } finally { setExtendiendo(false); }
  }

  async function enviarRecordatorio() {
    setEnviandoRecordatorio(true);
    try {
      await api.post(`/reservas/${reserva.id}/recordatorio`);
      toast.success('Recordatorio enviado por email');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al enviar email');
    } finally { setEnviandoRecordatorio(false); }
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-4">
        <div><span className="text-slate-500">Código:</span> <span className="font-mono font-bold">{reserva.codigo}</span></div>
        <div><span className="text-slate-500">Estado:</span> <Badge value={reserva.estado} label={t(`reservas.estados.${reserva.estado}`)} /></div>
        <div><span className="text-slate-500">Huésped:</span> <span className="font-medium">{reserva.huesped_nombre}</span></div>
        <div><span className="text-slate-500">Habitación:</span> <span className="font-medium">Hab. {reserva.habitacion_numero} ({reserva.tipo_nombre})</span></div>
        <div><span className="text-slate-500">Entrada:</span> <span className="font-medium">{reserva.fecha_entrada}</span></div>
        <div><span className="text-slate-500">Salida:</span> <span className="font-medium">{reserva.fecha_salida}</span></div>
        <div><span className="text-slate-500">Noches:</span> <span className="font-medium">{reserva.noches}</span></div>
        <div><span className="text-slate-500">Huéspedes:</span> <span className="font-medium">{reserva.adultos}A + {reserva.ninos}N</span></div>
        <div><span className="text-slate-500">Precio/noche:</span> <span className="font-medium">${reserva.precio_noche}</span></div>
        <div><span className="text-slate-500">Total:</span> <span className="font-bold text-amber-600">${reserva.precio_total}</span></div>
        <div><span className="text-slate-500">Origen:</span> <span className="font-medium capitalize">{reserva.origen}</span></div>
      </div>
      {/* Notas y notas internas — editables */}
      <div className="border border-slate-200 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notas</span>
          <button onClick={() => { setEditNotas(e => !e); setNotasForm({ notas: reserva.notas || '', notas_internas: reserva.notas_internas || '' }); }}
            className="text-xs text-amber-600 hover:underline">
            {editNotas ? 'Cancelar' : '✎ Editar'}
          </button>
        </div>
        {editNotas ? (
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Notas del huésped</label>
              <textarea value={notasForm.notas} onChange={e => setNotasForm(f => ({ ...f, notas: e.target.value }))} rows={2}
                placeholder="Visible para el huésped..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Notas internas (solo staff)</label>
              <textarea value={notasForm.notas_internas} onChange={e => setNotasForm(f => ({ ...f, notas_internas: e.target.value }))} rows={2}
                placeholder="Observaciones internas, preferencias, alertas..."
                className="w-full border border-amber-100 border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50" />
            </div>
            <div className="flex justify-end">
              <button onClick={guardarNotas} disabled={guardandoNotas}
                className="px-4 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg disabled:opacity-50">
                {guardandoNotas ? 'Guardando...' : 'Guardar notas'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {reserva.notas
              ? <div className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2">{reserva.notas}</div>
              : <div className="text-xs text-slate-400 italic">Sin notas del huésped</div>}
            {reserva.notas_internas && (
              <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <span className="text-xs font-semibold text-amber-600 block mb-0.5">Nota interna:</span>
                {reserva.notas_internas}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bloque de seña */}
      {reserva.senia != null && (
        <div className={`rounded-xl border p-4 space-y-3 ${reserva.senia_cobrada ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700 text-sm">💳 Seña (10%)</span>
            {reserva.senia_cobrada
              ? <span className="text-xs bg-green-100 text-green-700 border border-green-300 px-2 py-0.5 rounded-full font-semibold">✓ Cobrada</span>
              : <span className="text-xs bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full font-semibold">⏳ Pendiente</span>
            }
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center bg-white rounded-lg p-2 border border-slate-100">
              <div className="text-slate-400">Seña</div>
              <div className="font-bold text-amber-600">${reserva.senia}</div>
            </div>
            <div className="text-center bg-white rounded-lg p-2 border border-slate-100">
              <div className="text-slate-400">Saldo al llegar</div>
              <div className="font-bold text-slate-700">${saldo}</div>
            </div>
            <div className="text-center bg-white rounded-lg p-2 border border-slate-100">
              <div className="text-slate-400">Total</div>
              <div className="font-bold text-slate-700">${reserva.precio_total}</div>
            </div>
          </div>
          {reserva.senia_cobrada ? (
            <div className="text-xs text-green-700 space-y-0.5">
              <div>Método: <strong>{METODOS_PAGO.find(m => m.value === reserva.senia_metodo)?.label || reserva.senia_metodo}</strong></div>
              {reserva.senia_fecha && <div>Fecha: <strong>{reserva.senia_fecha}</strong></div>}
            </div>
          ) : (
            <div className="flex gap-2 items-center pt-1">
              <select value={metodoSenia} onChange={e => setMetodoSenia(e.target.value)}
                className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400">
                {METODOS_PAGO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <button onClick={cobrarSenia} disabled={registrandoSenia}
                className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg disabled:opacity-60 whitespace-nowrap">
                {registrandoSenia ? '...' : '✓ Registrar cobro'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Extensión de estadía — solo en checkin activo */}
      {reserva.estado === 'checkin' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-blue-800 font-semibold text-sm">
            <ArrowRightIcon className="w-4 h-4" /> Extender estadía
          </div>
          <div className="text-xs text-blue-700">
            Salida actual: <strong>{reserva.fecha_salida}</strong> · ${reserva.precio_noche}/noche
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Nueva fecha de salida</label>
              <input type="date" value={nuevaSalida} onChange={e => setNuevaSalida(e.target.value)}
                min={reserva.fecha_salida}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            {nuevaSalida && nuevaSalida > reserva.fecha_salida && (
              <div className="text-xs text-blue-700 self-end pb-2">
                +{Math.round((new Date(nuevaSalida) - new Date(reserva.fecha_salida)) / 86400000)} noche(s) adicional(es)
                · nuevo total: <strong>${(Math.round((new Date(nuevaSalida) - new Date(reserva.fecha_entrada)) / 86400000) * reserva.precio_noche).toFixed(2)}</strong>
              </div>
            )}
            <button onClick={extenderEstadia} disabled={extendiendo || !nuevaSalida}
              className="self-end mb-0.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
              {extendiendo ? 'Guardando...' : 'Confirmar extensión'}
            </button>
          </div>
        </div>
      )}

      {/* Acciones de email */}
      {reserva.huesped_email && (
        <div className="border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            📧 <span className="text-slate-700">{reserva.huesped_email}</span>
          </div>
          <button onClick={enviarRecordatorio} disabled={enviandoRecordatorio}
            className="text-xs px-3 py-1.5 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-60 whitespace-nowrap">
            {enviandoRecordatorio ? 'Enviando...' : '📬 Enviar recordatorio'}
          </button>
        </div>
      )}

      <div className="border-t pt-4">
        <p className="text-slate-500 text-xs mb-2">Cambiar estado:</p>
        <div className="flex flex-wrap gap-2">
          {ESTADOS.filter(e => e !== reserva.estado).map(e => (
            <button key={e} onClick={() => onCambiarEstado(e)}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg hover:bg-slate-50 font-medium">
              → {t(`reservas.estados.${e}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const FILTROS_INIT = { estado: '', desde: '', hasta: '', busqueda: '' };

export default function Reservas() {
  const { t } = useTranslation();
  const [reservas, setReservas] = useState([]);
  const [filtros, setFiltros] = useState(FILTROS_INIT);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [alertasNoshow, setAlertasNoshow] = useState([]);
  const [marcandoNoshow, setMarcandoNoshow] = useState(null);

  const cargar = () => {
    setCargando(true);
    const p = new URLSearchParams();
    if (filtros.estado)   p.set('estado', filtros.estado);
    if (filtros.desde)    p.set('fecha_inicio', filtros.desde);
    if (filtros.hasta)    p.set('fecha_fin', filtros.hasta);
    if (filtros.busqueda) p.set('busqueda', filtros.busqueda);
    Promise.all([
      api.get(`/reservas?${p}`),
      api.get('/reservas/alertas/noshow'),
    ]).then(([r, alertas]) => {
      setReservas(r.data);
      setAlertasNoshow(alertas.data);
    }).finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, [filtros]);
  useAutoRefresh(cargar, 30000);

  async function guardar(form) {
    try {
      await api.post('/reservas', form);
      toast.success('Reserva creada');
      setModal(null);
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al crear reserva');
    }
  }

  async function marcarNoshow(reserva) {
    setMarcandoNoshow(reserva.id);
    try {
      await api.patch(`/reservas/${reserva.id}/estado`, { estado: 'noshow' });
      toast.success(`Reserva ${reserva.codigo} marcada como no-show`);
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error');
    } finally { setMarcandoNoshow(null); }
  }

  async function cambiarEstado(reserva, estado) {
    try {
      const r = await api.patch(`/reservas/${reserva.id}/estado`, { estado });
      if (estado === 'cancelada' && r.data.cancelacion) {
        const c = r.data.cancelacion;
        if (c.penalidad) {
          toast.error(
            c.senia_monto
              ? `Cancelación con penalidad — ${c.dias_anticipacion} días de anticipación. Seña de $${c.senia_monto} NO se devuelve.`
              : `Cancelación con penalidad — ${c.dias_anticipacion} días de anticipación.`,
            { duration: 6000 }
          );
        } else {
          toast.success(
            c.senia_monto
              ? `Cancelación sin penalidad — ${c.dias_anticipacion} días de anticipación. Seña de $${c.senia_monto} se devuelve al huésped.`
              : `Cancelación sin penalidad — ${c.dias_anticipacion} días de anticipación.`,
            { duration: 6000 }
          );
        }
      } else {
        toast.success('Estado actualizado');
      }
      setDetalle(null);
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error');
    }
  }

  const columnas = [
    { key: 'codigo', label: 'Código', render: v => <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{v}</span> },
    { key: 'huesped_nombre', label: 'Huésped' },
    { key: 'habitacion_numero', label: 'Hab.', render: v => `Hab. ${v}` },
    { key: 'fecha_entrada', label: 'Entrada' },
    { key: 'fecha_salida', label: 'Salida' },
    { key: 'noches', label: 'Noches' },
    { key: 'precio_total', label: 'Total', render: v => <span className="font-semibold">${v}</span> },
    { key: 'senia', label: 'Seña', render: (v, row) => v != null
        ? row.senia_cobrada
          ? <span className="text-xs text-green-600 font-semibold">✓ ${v}</span>
          : <span className="text-xs text-amber-500 font-semibold">⏳ ${v}</span>
        : <span className="text-xs text-slate-300">—</span>
    },
    { key: 'estado', label: 'Estado', render: (v) => <Badge value={v} label={t(`reservas.estados.${v}`)} /> },
    { key: 'origen', label: 'Origen', render: v => <span className="capitalize text-xs text-slate-500">{v}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800">{t('reservas.titulo')}</h1>
        <button onClick={() => setModal('nueva')} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <PlusIcon className="w-4 h-4" /> {t('reservas.nueva')}
        </button>
      </div>

      {/* Panel alertas no-show */}
      {alertasNoshow.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-700 font-semibold mb-3">
            <ExclamationTriangleIcon className="w-5 h-5" />
            No-shows posibles ({alertasNoshow.length}) — reservas con fecha de entrada vencida
          </div>
          <div className="space-y-2">
            {alertasNoshow.map(r => (
              <div key={r.id} className="flex items-center gap-3 bg-white border border-red-100 rounded-lg px-3 py-2">
                <span className="font-mono text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">{r.codigo}</span>
                <span className="text-sm font-medium text-slate-800 flex-1">{r.huesped_nombre}</span>
                <span className="text-xs text-slate-500">Hab. {r.habitacion_numero} · entrada {r.fecha_entrada}</span>
                <Badge value={r.estado} label={t(`reservas.estados.${r.estado}`)} />
                <button onClick={() => setDetalle(r)}
                  className="text-xs px-2.5 py-1 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
                  Ver
                </button>
                <button onClick={() => marcarNoshow(r)} disabled={marcandoNoshow === r.id}
                  className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg disabled:opacity-50 whitespace-nowrap">
                  {marcandoNoshow === r.id ? '...' : 'No-show'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        {/* Búsqueda libre */}
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-slate-500 mb-1">Buscar</label>
            <input
              type="text"
              value={filtros.busqueda}
              onChange={e => setFiltros(f => ({ ...f, busqueda: e.target.value }))}
              placeholder="Nombre, email, código, hab..."
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Entrada desde</label>
            <input type="date" value={filtros.desde}
              onChange={e => setFiltros(f => ({ ...f, desde: e.target.value }))}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Entrada hasta</label>
            <input type="date" value={filtros.hasta}
              onChange={e => setFiltros(f => ({ ...f, hasta: e.target.value }))}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          {(filtros.busqueda || filtros.desde || filtros.hasta || filtros.estado) && (
            <button onClick={() => setFiltros(FILTROS_INIT)}
              className="px-3 py-1.5 text-sm text-slate-500 border border-slate-300 rounded-lg hover:bg-slate-50">
              Limpiar
            </button>
          )}
        </div>
        {/* Filtro por estado */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFiltros(f => ({ ...f, estado: '' }))}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${!filtros.estado ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
            Todos ({reservas.length})
          </button>
          {ESTADOS.map(e => {
            const cnt = reservas.filter(r => r.estado === e).length;
            return (
              <button key={e} onClick={() => setFiltros(f => ({ ...f, estado: f.estado === e ? '' : e }))}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${filtros.estado === e ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                {t(`reservas.estados.${e}`)} {cnt > 0 && <span className="opacity-60 text-xs ml-0.5">({cnt})</span>}
              </button>
            );
          })}
        </div>
      </div>

      <Tabla columnas={columnas} datos={reservas} cargando={cargando}
        acciones={row => (
          <button onClick={() => setDetalle(row)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600">
            <EyeIcon className="w-3.5 h-3.5" /> Ver
          </button>
        )}
      />

      <Modal open={modal === 'nueva'} onClose={() => setModal(null)} title={t('reservas.nueva')} size="lg">
        <FormReserva onGuardar={guardar} onCancelar={() => setModal(null)} />
      </Modal>

      <Modal open={!!detalle} onClose={() => setDetalle(null)} title={`Reserva ${detalle?.codigo}`} size="lg">
        {detalle && <DetalleReserva reserva={detalle} onCambiarEstado={e => cambiarEstado(detalle, e)} onClose={() => setDetalle(null)} onReload={cargar} />}
      </Modal>
    </div>
  );
}
