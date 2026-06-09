import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ResumenCamas, ModalHabitacion } from './Inicio';
import CalendarioReserva from '../components/CalendarioReserva';

const DOC_TIPOS = ['DNI', 'Pasaporte', 'Cédula', 'Otro'];

const PAISES = [
  'Argentina','Bolivia','Brasil','Chile','Colombia','Costa Rica','Cuba','Ecuador',
  'El Salvador','España','Guatemala','Honduras','México','Nicaragua','Panamá',
  'Paraguay','Perú','Puerto Rico','República Dominicana','Uruguay','Venezuela',
  'Alemania','Australia','Bélgica','Canadá','China','Corea del Sur','Estados Unidos',
  'Francia','India','Italia','Japón','Países Bajos','Polonia','Portugal',
  'Reino Unido','Rusia','Suecia','Suiza','Turquía','Otro',
];

// ──────────────────────────────────────────────
// Card de habitación disponible
// ──────────────────────────────────────────────
const VISTA_ICONS = { jardín: '🌿', piscina: '🏊', montaña: '⛰️', mar: '🌊', ciudad: '🏙️', patio: '🌸', calle: '🏠' };

function CardDisponible({ hab, onVerDetalle, onReservar }) {
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-2xl border-2 border-slate-200 hover:border-amber-300 shadow-sm hover:shadow-md overflow-hidden transition-all">
      {/* Imagen */}
      <div className="h-44 relative overflow-hidden cursor-pointer" onClick={() => onVerDetalle(hab)}>
        {hab.imagen
          ? <img src={hab.imagen} alt={hab.tipo_nombre} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gradient-to-br from-amber-100 to-amber-300 flex items-center justify-center"><span className="text-6xl">🛏️</span></div>
        }
        <div className="absolute top-3 left-3">
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">
            ✓ {t('habitaciones.disponible')}
          </span>
        </div>
        {hab.vista && (
          <div className="absolute top-3 right-3 text-xs bg-white/80 px-2 py-0.5 rounded-full text-slate-600">
            {VISTA_ICONS[hab.vista] || '🪟'} {hab.vista}
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex justify-between items-start mb-1">
          <div>
            <h3 className="font-bold text-slate-800 text-base">{hab.tipo_nombre}</h3>
            <p className="text-xs text-slate-400">{t('habitaciones.hab')} {hab.numero} · {t('habitaciones.piso')} {hab.piso}</p>
          </div>
          <div className="text-right shrink-0 ml-2">
            <span className="text-xl font-bold text-amber-600">${hab.precio_noche}</span>
            <span className="text-xs text-slate-400 block">{t('habitaciones.por_noche')}</span>
          </div>
        </div>

        {/* Características rápidas */}
        <div className="flex flex-wrap gap-2 text-xs text-slate-500 my-2">
          <span>👥 {hab.capacidad} {t('habitaciones.personas')}</span>
          {hab.metros_cuadrados && <span>📐 {hab.metros_cuadrados} {t('habitaciones.metros')}</span>}
          {!!hab.bano_privado && <span>🚿 {t('habitaciones.bano_privado')}</span>}
        </div>

        {/* Camas */}
        {hab.camas?.length > 0 && (
          <div className="mb-2"><ResumenCamas camas={hab.camas} /></div>
        )}

        {/* Amenidades */}
        {hab.amenidades?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {hab.amenidades.slice(0, 3).map((a, i) => (
              <span key={i} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">{a}</span>
            ))}
            {hab.amenidades.length > 3 && <span className="text-xs text-slate-400">+{hab.amenidades.length - 3}</span>}
          </div>
        )}

        {/* Total y botones */}
        <div className="border-t border-slate-100 pt-3 mt-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">{hab.noches} {t('formulario.noches')}</span>
            <span className="font-bold text-slate-800">${hab.precio_total} total</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onVerDetalle(hab)}
              className="flex-1 text-sm border border-slate-300 text-slate-600 hover:bg-slate-50 py-2 rounded-xl transition-colors"
            >
              {t('habitaciones.ver_detalle')}
            </button>
            <button
              onClick={() => onReservar(hab)}
              className="flex-1 text-sm bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 rounded-xl transition-colors"
            >
              {t('habitaciones.reservar')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Formulario de datos del huésped
// ──────────────────────────────────────────────
function FormularioReserva({ hab, busqueda, senia, onExito, onCancelar }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    nombre: '', apellido: '', email: '', telefono: '',
    nacionalidad: 'Argentina', documento_tipo: 'DNI', documento_numero: '',
    pasaporte_numero: '',
  });
  const [enviando, setEnviando] = useState(false);

  function f(key) { return e => setForm(p => ({ ...p, [key]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    setEnviando(true);
    try {
      const r = await axios.post('/api/web/reservar', {
        habitacion_id: hab.id,
        fecha_entrada: busqueda.fecha_entrada,
        fecha_salida: busqueda.fecha_salida,
        adultos: busqueda.adultos,
        ninos: busqueda.ninos,
        precio_noche: hab.precio_noche,
        huesped: {
          ...form,
          documento_numero: form.nacionalidad !== 'Argentina' && form.pasaporte_numero
            ? `${form.documento_numero} / Pasaporte: ${form.pasaporte_numero}`
            : form.documento_numero,
        },
        ...(senia != null ? { senia } : {}),
      });
      onExito(r.data.codigo, r.data.senia);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al procesar la reserva');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-2xl mx-auto">
      {/* Resumen de la habitación seleccionada */}
      <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
        <div className="w-14 h-14 bg-amber-200 rounded-xl flex items-center justify-center text-3xl shrink-0">🛏️</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-800">{hab.tipo_nombre} — {t('habitaciones.hab')} {hab.numero}</div>
          <div className="text-sm text-amber-700">{busqueda.fecha_entrada} → {busqueda.fecha_salida} · {hab.noches} {t('formulario.noches')}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-amber-700">${hab.precio_total}</div>
          <div className="text-xs text-amber-500">{t('formulario.total')}</div>
        </div>
      </div>
      {senia != null && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-sm">
          <div className="font-semibold text-blue-800 mb-1">💳 Seña requerida (10%)</div>
          <div className="flex justify-between text-blue-700">
            <span>Seña a abonar:</span>
            <span className="font-bold">${senia}</span>
          </div>
          <div className="flex justify-between text-blue-600 text-xs mt-1">
            <span>Saldo al llegar:</span>
            <span>${Math.round((hab.precio_total - senia) * 100) / 100}</span>
          </div>
          <p className="text-green-700 font-semibold text-xs mt-2">✅ Si cancelás con 3 días o más de anticipación, la seña se devuelve.</p>
          <p className="text-red-600 font-semibold text-xs mt-1">❌ Con menos de 3 días de anticipación, la seña no se reintegra.</p>
        </div>
      )}

      <h2 className="text-xl font-bold text-slate-800 mb-5">{t('formulario.titulo')}</h2>

      <form onSubmit={submit} className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-600">{t('formulario.datos_personales')}</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            ['nombre', t('formulario.nombre'), 'text', true],
            ['apellido', t('formulario.apellido'), 'text', true],
            ['email', t('formulario.email'), 'email', true],
            ['telefono', t('formulario.telefono'), 'tel', false],
          ].map(([key, label, type, req]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
              <input type={type} value={form[key]} onChange={f(key)} required={req}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-600 mb-1">{t('formulario.nacionalidad')}</label>
            <select value={form.nacionalidad} onChange={f('nacionalidad')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
              {PAISES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">{t('formulario.documento_tipo')}</label>
            <select value={form.documento_tipo} onChange={f('documento_tipo')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
              {DOC_TIPOS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">{t('formulario.documento_numero')}</label>
            <input value={form.documento_numero} onChange={f('documento_numero')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          {form.nacionalidad !== 'Argentina' && (
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-1">Número de pasaporte</label>
              <input value={form.pasaporte_numero} onChange={f('pasaporte_numero')} required
                placeholder="Ingresá el número de tu pasaporte"
                className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50" />
              <p className="text-xs text-amber-600 mt-1">Requerido para huéspedes extranjeros</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onCancelar}
            className="px-6 py-2.5 border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 font-medium">
            {t('formulario.cancelar')}
          </button>
          <button type="submit" disabled={enviando}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-60">
            {enviando ? '...' : t('formulario.confirmar')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ──────────────────────────────────────────────
// Pantalla de confirmación con pago de seña
// ──────────────────────────────────────────────
function PantallaConfirmacion({ codigo, senia, onVolver }) {
  const { t } = useTranslation();
  const [verPago, setVerPago] = useState(false);
  const [datosPago, setDatosPago] = useState(null);
  const [copiado, setCopiado] = useState('');

  useEffect(() => {
    if (senia != null) {
      axios.get('/api/web/config').then(r => setDatosPago(r.data)).catch(() => {});
    }
  }, [senia]);

  function copiar(texto, campo) {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(campo);
      setTimeout(() => setCopiado(''), 2000);
    });
  }

  const tieneDatosPago = datosPago && (datosPago.pago_cbu || datosPago.pago_alias);

  return (
    <div className="max-w-lg mx-auto px-4 py-12 text-center">
      <div className="text-6xl mb-4">🎉</div>
      <h1 className="text-3xl font-bold text-slate-800 mb-3">{t('confirmacion.titulo')}</h1>
      <p className="text-slate-600 mb-6">{t('confirmacion.mensaje')}</p>

      {/* Código de reserva */}
      <div className="bg-amber-50 border border-amber-300 rounded-2xl p-6 mb-4">
        <p className="text-sm text-amber-700 mb-2">{t('confirmacion.codigo')}</p>
        <div className="text-4xl font-mono font-bold text-amber-800 tracking-widest">{codigo}</div>
        <p className="text-xs text-amber-600 mt-3">{t('confirmacion.guardar')}</p>
      </div>

      {/* Bloque de seña */}
      {senia != null && (
        <div className="bg-white border-2 border-amber-300 rounded-2xl p-5 mb-5 text-left shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-slate-800">💳 Seña requerida</div>
            <div className="text-2xl font-bold text-amber-600">${senia}</div>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Para garantizar tu reserva debés abonar la seña (10% del total).
            Sin el pago confirmado, la reserva puede ser liberada.
          </p>
          <p className="text-xs text-green-600 font-semibold mb-1">
            ✅ Si cancelás con 3 días o más de anticipación, la seña se devuelve íntegra.
          </p>
          <p className="text-xs text-red-500 font-semibold mb-4">
            ❌ Con menos de 3 días de anticipación, la seña no se reintegra.
          </p>

          {/* Botón para ver instrucciones */}
          <button
            onClick={() => setVerPago(v => !v)}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
            🏦 {verPago ? 'Ocultar instrucciones' : 'Ver cómo pagar la seña'}
          </button>

          {/* Panel de instrucciones de pago */}
          {verPago && (
            <div className="mt-4 space-y-3">
              {tieneDatosPago ? (
                <>
                  <p className="text-sm font-semibold text-slate-700 text-center">Transferencia bancaria</p>

                  {datosPago.pago_cbu && (
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                      <div>
                        <div className="text-xs text-slate-400 uppercase tracking-wide">CBU</div>
                        <div className="font-mono text-sm font-semibold text-slate-800 break-all">{datosPago.pago_cbu}</div>
                      </div>
                      <button onClick={() => copiar(datosPago.pago_cbu, 'cbu')}
                        className={`ml-3 shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${copiado === 'cbu' ? 'bg-green-100 text-green-700' : 'bg-slate-200 hover:bg-slate-300 text-slate-600'}`}>
                        {copiado === 'cbu' ? '✓ Copiado' : 'Copiar'}
                      </button>
                    </div>
                  )}

                  {datosPago.pago_alias && (
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                      <div>
                        <div className="text-xs text-slate-400 uppercase tracking-wide">Alias</div>
                        <div className="font-mono text-sm font-semibold text-slate-800">{datosPago.pago_alias}</div>
                      </div>
                      <button onClick={() => copiar(datosPago.pago_alias, 'alias')}
                        className={`ml-3 shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${copiado === 'alias' ? 'bg-green-100 text-green-700' : 'bg-slate-200 hover:bg-slate-300 text-slate-600'}`}>
                        {copiado === 'alias' ? '✓ Copiado' : 'Copiar'}
                      </button>
                    </div>
                  )}

                  {(datosPago.pago_titular || datosPago.pago_banco) && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-1 text-sm">
                      {datosPago.pago_titular && (
                        <div className="flex justify-between">
                          <span className="text-slate-400 text-xs">Titular</span>
                          <span className="font-semibold text-slate-700">{datosPago.pago_titular}</span>
                        </div>
                      )}
                      {datosPago.pago_banco && (
                        <div className="flex justify-between">
                          <span className="text-slate-400 text-xs">Banco</span>
                          <span className="font-semibold text-slate-700">{datosPago.pago_banco}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {datosPago.pago_instrucciones && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800 leading-relaxed">
                      📋 {datosPago.pago_instrucciones}
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm text-slate-500 text-center">
                  La hostería se comunicará con vos a la brevedad para coordinar el pago.
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                📌 Indicá tu código de reserva <strong>{codigo}</strong> en el comprobante de pago.
              </div>
            </div>
          )}
        </div>
      )}

      <button onClick={onVolver}
        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-8 py-3 rounded-xl transition-colors">
        {t('confirmacion.volver')}
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────
// Página principal de Reservar
// ──────────────────────────────────────────────
export default function Reservar() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const habIdParam    = searchParams.get('hab_id');
  const precioParam   = searchParams.get('precio_noche');
  const seniaParam    = searchParams.get('senia');

  const busqueda = {
    fecha_entrada: searchParams.get('fecha_entrada') || new Date().toISOString().split('T')[0],
    fecha_salida:  searchParams.get('fecha_salida')  || new Date(Date.now() + 86400000).toISOString().split('T')[0],
    adultos: searchParams.get('adultos') || 2,
    ninos:   searchParams.get('ninos')   || 0,
  };

  const [disponibles, setDisponibles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [habDetalle, setHabDetalle] = useState(null);
  const [habReservar, setHabReservar] = useState(null);
  const [codigoConfirmado, setCodigoConfirmado] = useState(null);
  const [seniaConfirmada, setSeniaConfirmada] = useState(null);
  const [habCalendario, setHabCalendario] = useState(null); // para cambiar fechas

  function cargarDisponibles() {
    // Leemos los params actuales al momento de la llamada para evitar closure stale
    const currentParams = new URLSearchParams(window.location.search);
    const currentHabId    = currentParams.get('hab_id');
    const currentPrecio   = currentParams.get('precio_noche');
    const currentEntrada  = currentParams.get('fecha_entrada') || busqueda.fecha_entrada;
    const currentSalida   = currentParams.get('fecha_salida')  || busqueda.fecha_salida;
    const currentAdultos  = currentParams.get('adultos')       || busqueda.adultos;

    setCargando(true);
    axios.get(`/api/web/disponibilidad`, {
      params: {
        fecha_entrada: currentEntrada,
        fecha_salida:  currentSalida,
        adultos:       currentAdultos,
      }
    }).then(r => {
      const lista = r.data;
      setDisponibles(lista);
      // Si vienen con hab_id pre-seleccionado desde el calendario, ir directo al formulario
      if (currentHabId && lista.length > 0) {
        const hab = lista.find(h => String(h.id) === String(currentHabId));
        if (hab) {
          setHabReservar({ ...hab, precio_noche: currentPrecio ? Number(currentPrecio) : hab.precio_noche });
        }
      }
    }).finally(() => setCargando(false));
  }

  useEffect(() => { cargarDisponibles(); }, [busqueda.fecha_entrada, busqueda.fecha_salida, busqueda.adultos, habIdParam]);

  // Auto-refresh de disponibilidad solo en la vista de lista (no cuando hay hab seleccionada ni formulario activo)
  useEffect(() => {
    if (habReservar || habIdParam) return;
    const timer = setInterval(cargarDisponibles, 60000);
    return () => clearInterval(timer);
  }, [habReservar, habIdParam]);

  // ── Pantalla de confirmación ──
  if (codigoConfirmado) {
    return <PantallaConfirmacion
      codigo={codigoConfirmado}
      senia={seniaConfirmada}
      onVolver={() => navigate('/')}
    />;
  }

  // ── Formulario de reserva ──
  if (habReservar) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <FormularioReserva
          hab={habReservar}
          busqueda={busqueda}
          senia={seniaParam ? Number(seniaParam) : null}
          onExito={(codigo, senia) => { setCodigoConfirmado(codigo); setSeniaConfirmada(senia); }}
          onCancelar={() => setHabReservar(null)}
        />
      </div>
    );
  }

  // ── Lista de disponibles ──
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Cabecera con fechas */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('habitaciones.titulo')}</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {busqueda.fecha_entrada} → {busqueda.fecha_salida} · {busqueda.adultos} {t('buscar.adultos').toLowerCase()}
          </p>
        </div>
        <button onClick={() => navigate('/')}
          className="text-sm text-amber-600 hover:text-amber-700 border border-amber-300 px-4 py-2 rounded-lg hover:bg-amber-50 transition-colors">
          ← {t('confirmacion.volver')}
        </button>
      </div>

      {cargando ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : disponibles.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">😔</div>
          <p className="text-slate-500 text-lg mb-2">{t('habitaciones.sin_resultados')}</p>
          <button onClick={() => navigate('/')} className="mt-2 text-amber-600 hover:underline text-sm">
            {t('confirmacion.volver')}
          </button>
        </div>
      ) : (
        <>
          <p className="text-slate-500 text-sm mb-6">
            {disponibles.length} {t('habitaciones.disponibles')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {disponibles.map(hab => (
              <CardDisponible
                key={hab.id}
                hab={hab}
                onVerDetalle={setHabDetalle}
                onReservar={setHabCalendario}
              />
            ))}
          </div>
        </>
      )}

      {/* Modal de detalle con opción de reservar */}
      {habDetalle && (
        <ModalHabitacion
          hab={habDetalle}
          busqueda={busqueda}
          onReservar={(hab) => { setHabDetalle(null); setHabCalendario(hab); }}
          onCerrar={() => setHabDetalle(null)}
        />
      )}

      {/* Calendario para elegir/cambiar fechas */}
      {habCalendario && (
        <CalendarioReserva
          hab={habCalendario}
          onCerrar={() => setHabCalendario(null)}
          onConfirmar={({ fecha_entrada, fecha_salida, precio_noche, senia }) => {
            setHabCalendario(null);
            const params = new URLSearchParams({
              hab_id: habCalendario.id,
              fecha_entrada,
              fecha_salida,
              precio_noche,
              adultos: busqueda.adultos,
              ...(senia != null ? { senia } : {}),
            });
            navigate(`/reservar?${params.toString()}`);
          }}
        />
      )}
    </div>
  );
}
