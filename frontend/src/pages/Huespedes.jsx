import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import {
  PlusIcon, EyeIcon, PencilIcon, TrashIcon,
  MagnifyingGlassIcon, UserIcon, EnvelopeIcon,
  PhoneIcon, IdentificationIcon, GlobeAltIcon,
  QrCodeIcon, XMarkIcon, CameraIcon, ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';

const DOC_TIPOS = ['DNI', 'Pasaporte', 'Cédula', 'Otro'];

// ── Parser PDF417 DNI argentino ───────────────────────────────────────────────
// El código de barras del reverso del DNI emite una cadena con campos separados por @
// Formato nuevo (desde ~2012): @APELLIDO@NOMBRE@SEXO@DNI@EJEMPLAR@NACIMIENTO@EMISION@...
// Formato viejo (pre-2012):    APELLIDO@NOMBRE@SEXO@DNI@EJEMPLAR@NACIMIENTO@EMISION
function parsearDNI(raw) {
  if (!raw || raw.trim().length < 10) return null;
  try {
    // Normalizar: eliminar espacios y saltos al inicio/fin, separar por @
    const str = raw.trim();
    const partes = str.split('@').map(p => p.trim()).filter((p, i, arr) => {
      // Ignorar primeros campos vacíos (formato nuevo empieza con @)
      return i > 0 || p.length > 0;
    });

    // Eliminar vacíos del inicio
    while (partes.length > 0 && partes[0] === '') partes.shift();

    if (partes.length < 6) return null;

    // Detectar formato: si el primer campo tiene solo letras y espacios → apellido
    // Campos esperados: APELLIDO, NOMBRE, SEXO, DNI, EJEMPLAR, NACIMIENTO[, EMISION, ...]
    const [apellido, nombre, sexo, dni, , nacimiento] = partes;

    if (!apellido || !nombre || !dni) return null;

    // Parsear fecha nacimiento: viene como DD/MM/AAAA o DDMMAAAA
    let fecha_nacimiento = '';
    if (nacimiento) {
      const limpio = nacimiento.replace(/\D/g, '');
      if (limpio.length === 8) {
        // DDMMAAAA → AAAA-MM-DD
        fecha_nacimiento = `${limpio.slice(4,8)}-${limpio.slice(2,4)}-${limpio.slice(0,2)}`;
      } else if (nacimiento.includes('/')) {
        const [d, m, a] = nacimiento.split('/');
        if (a && m && d) fecha_nacimiento = `${a.padStart(4,'0')}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
      }
    }

    // Capitalizar nombre/apellido (el DNI viene en mayúsculas)
    const capitalizar = s => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

    return {
      apellido: capitalizar(apellido),
      nombre:   capitalizar(nombre),
      documento_tipo: 'DNI',
      documento_numero: dni.replace(/\D/g, ''),
      fecha_nacimiento,
      nacionalidad: 'Argentina',
      sexo: sexo?.toUpperCase(),
    };
  } catch {
    return null;
  }
}

// ── Modo lector USB ───────────────────────────────────────────────────────────
function EscanerUSB({ onDatos }) {
  const [raw, setRaw]       = useState('');
  const [estado, setEstado] = useState('esperando');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleChange(e) {
    const val = e.target.value;
    setRaw(val);
    setEstado('esperando');
    if (val.length > 20) {
      const datos = parsearDNI(val);
      if (datos) { setEstado('ok'); setTimeout(() => onDatos(datos), 400); }
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const datos = parsearDNI(raw);
      if (datos) { setEstado('ok'); setTimeout(() => onDatos(datos), 300); }
      else setEstado('error');
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-blue-600">
        Apuntá el lector al <strong>reverso del DNI</strong> (código PDF417 rectangular) y escaneá.
      </p>
      <div className="relative">
        <input ref={inputRef} value={raw} onChange={handleChange} onKeyDown={handleKeyDown}
          placeholder="Esperando lectura del lector..."
          className={`w-full border-2 rounded-lg px-3 py-2 text-sm focus:outline-none font-mono
            ${estado === 'ok'    ? 'border-green-400 bg-green-50 text-green-800' :
              estado === 'error' ? 'border-red-400 bg-red-50 text-red-800' :
              'border-blue-300 bg-white focus:border-blue-500'}`} />
        {estado === 'ok'    && <span className="absolute right-3 top-2 text-green-600 text-sm">✓ Leído</span>}
        {estado === 'error' && <span className="absolute right-3 top-2 text-red-500 text-xs">No reconocido</span>}
      </div>
      {estado === 'error' && <p className="text-xs text-red-600">Formato no reconocido. Intentá de nuevo.</p>}
      <button type="button" onClick={() => { setRaw(''); setEstado('esperando'); inputRef.current?.focus(); }}
        className="text-xs text-blue-500 hover:text-blue-700 underline">Limpiar y reintentar</button>
    </div>
  );
}

// ── Modo cámara ───────────────────────────────────────────────────────────────
function EscanerCamara({ onDatos }) {
  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const readerRef   = useRef(null);
  const [camaras, setCamaras]   = useState([]);
  const [camaraId, setCamaraId] = useState('');
  const [estado, setEstado]     = useState('iniciando'); // iniciando | escaneando | ok | error | sin_permiso
  const [errorMsg, setErrorMsg] = useState('');

  // Cargar cámaras disponibles
  useEffect(() => {
    import('@zxing/browser').then(({ BrowserPDF417Reader }) => {
      BrowserPDF417Reader.listVideoInputDevices().then(devs => {
        setCamaras(devs);
        // Preferir cámara trasera en móvil
        const trasera = devs.find(d => /back|rear|environment/i.test(d.label));
        setCamaraId(trasera?.deviceId || devs[0]?.deviceId || '');
      }).catch(() => setEstado('sin_permiso'));
    });
    return () => detener();
  }, []);

  function detener() {
    try { readerRef.current?.reset(); } catch {}
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }

  const iniciarEscaneo = useCallback(async (deviceId) => {
    if (!deviceId || !videoRef.current) return;
    detener();
    setEstado('escaneando');
    setErrorMsg('');
    try {
      const { BrowserPDF417Reader } = await import('@zxing/browser');
      const reader = new BrowserPDF417Reader();
      readerRef.current = reader;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, facingMode: { ideal: 'environment' } }
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      reader.decodeFromVideoElement(videoRef.current, (result, err) => {
        if (result) {
          const datos = parsearDNI(result.getText());
          if (datos) {
            setEstado('ok');
            detener();
            setTimeout(() => onDatos(datos), 400);
          }
          // Si no parsea, seguir escaneando (puede ser otro código QR)
        }
        // err es normal mientras no hay código enfocado, ignorar
      });
    } catch (e) {
      if (e.name === 'NotAllowedError') setEstado('sin_permiso');
      else { setEstado('error'); setErrorMsg(e.message); }
    }
  }, [onDatos]);

  useEffect(() => {
    if (camaraId) iniciarEscaneo(camaraId);
  }, [camaraId, iniciarEscaneo]);

  // Limpiar al desmontar
  useEffect(() => () => detener(), []);

  return (
    <div className="space-y-2">
      {/* Selector de cámara */}
      {camaras.length > 1 && (
        <select value={camaraId} onChange={e => setCamaraId(e.target.value)}
          className="w-full border border-blue-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400">
          {camaras.map(c => <option key={c.deviceId} value={c.deviceId}>{c.label || `Cámara ${c.deviceId.slice(0,8)}`}</option>)}
        </select>
      )}

      {/* Preview video */}
      <div className="relative bg-black rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

        {/* Overlay de guía */}
        {estado === 'escaneando' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {/* Marco de escaneo */}
            <div className="w-3/4 h-1/3 border-2 border-amber-400 rounded-lg relative">
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-amber-400 rounded-tl" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-amber-400 rounded-tr" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-amber-400 rounded-bl" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-amber-400 rounded-br" />
              {/* Línea animada */}
              <div className="absolute inset-x-0 h-0.5 bg-amber-400 opacity-80 animate-bounce" style={{ top: '50%' }} />
            </div>
            <p className="text-white text-xs mt-3 bg-black/50 px-3 py-1 rounded-full">
              Enfocá el código PDF417 del reverso del DNI
            </p>
          </div>
        )}

        {estado === 'iniciando' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="text-center text-white space-y-2">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs">Iniciando cámara...</p>
            </div>
          </div>
        )}

        {estado === 'ok' && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-900/60">
            <div className="text-center text-white">
              <div className="text-4xl mb-1">✓</div>
              <p className="text-sm font-semibold">DNI leído</p>
            </div>
          </div>
        )}

        {estado === 'sin_permiso' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
            <div className="text-center text-white space-y-2">
              <p className="text-2xl">🚫</p>
              <p className="text-sm font-semibold">Sin acceso a la cámara</p>
              <p className="text-xs text-slate-300">Permitir acceso en la configuración del navegador</p>
            </div>
          </div>
        )}

        {estado === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
            <div className="text-center text-white space-y-2">
              <p className="text-2xl">⚠️</p>
              <p className="text-xs">{errorMsg || 'Error al iniciar la cámara'}</p>
              <button type="button" onClick={() => iniciarEscaneo(camaraId)}
                className="text-xs bg-amber-500 hover:bg-amber-600 px-3 py-1 rounded-lg">
                Reintentar
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-blue-600 text-center">
        Mantené el DNI quieto y bien iluminado · El reverso tiene el código rectangular grande
      </p>
    </div>
  );
}

// ── Panel escáner DNI (contenedor con tabs) ───────────────────────────────────
function EscanerDNI({ onDatos, onCerrar }) {
  const [modo, setModo] = useState('usb'); // 'usb' | 'camara'

  return (
    <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <QrCodeIcon className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-semibold text-blue-800">Escanear DNI argentino</span>
        </div>
        <button type="button" onClick={onCerrar} className="text-blue-400 hover:text-blue-600">
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg border border-blue-200 overflow-hidden text-xs">
        <button type="button" onClick={() => setModo('usb')}
          className={`flex-1 py-1.5 font-medium transition-colors ${modo === 'usb' ? 'bg-blue-600 text-white' : 'text-blue-600 hover:bg-blue-100'}`}>
          🔌 Lector USB
        </button>
        <button type="button" onClick={() => setModo('camara')}
          className={`flex-1 py-1.5 font-medium border-l border-blue-200 transition-colors ${modo === 'camara' ? 'bg-blue-600 text-white' : 'text-blue-600 hover:bg-blue-100'}`}>
          📷 Cámara
        </button>
      </div>

      {/* Contenido */}
      {modo === 'usb'    && <EscanerUSB    onDatos={onDatos} />}
      {modo === 'camara' && <EscanerCamara onDatos={onDatos} />}
    </div>
  );
}

// ── Formulario ───────────────────────────────────────────────────────────────
function FormHuesped({ datos, onGuardar, onCancelar }) {
  const [form, setForm] = useState(datos || {
    nombre: '', apellido: '', email: '', telefono: '',
    documento_tipo: 'DNI', documento_numero: '', nacionalidad: '',
    fecha_nacimiento: '', direccion: '', notas: '',
  });
  const [mostrarEscaner, setMostrarEscaner] = useState(false);

  function f(field) { return e => setForm(p => ({ ...p, [field]: e.target.value })); }

  function aplicarDatosDNI(datos) {
    setForm(p => ({
      ...p,
      nombre:           datos.nombre   || p.nombre,
      apellido:         datos.apellido || p.apellido,
      documento_tipo:   datos.documento_tipo   || p.documento_tipo,
      documento_numero: datos.documento_numero || p.documento_numero,
      fecha_nacimiento: datos.fecha_nacimiento || p.fecha_nacimiento,
      nacionalidad:     datos.nacionalidad     || p.nacionalidad,
    }));
    setMostrarEscaner(false);
    toast.success(`DNI leído: ${datos.nombre} ${datos.apellido}`);
  }

  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400';

  return (
    <form onSubmit={e => { e.preventDefault(); onGuardar(form); }} className="space-y-4">

      {/* Botón escáner */}
      {!mostrarEscaner ? (
        <button type="button" onClick={() => setMostrarEscaner(true)}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-blue-300 hover:border-blue-400 hover:bg-blue-50 text-blue-600 rounded-xl py-2.5 text-sm font-medium transition-colors">
          <QrCodeIcon className="w-4 h-4" />
          Escanear código de barras del DNI
        </button>
      ) : (
        <EscanerDNI onDatos={aplicarDatosDNI} onCerrar={() => setMostrarEscaner(false)} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
          <input value={form.nombre} onChange={f('nombre')} required className={inp} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Apellido *</label>
          <input value={form.apellido} onChange={f('apellido')} required className={inp} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input type="email" value={form.email || ''} onChange={f('email')} className={inp} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
          <input value={form.telefono || ''} onChange={f('telefono')} className={inp} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tipo doc.</label>
          <select value={form.documento_tipo || ''} onChange={f('documento_tipo')} className={inp}>
            <option value="">—</option>
            {DOC_TIPOS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">N° documento</label>
          <input value={form.documento_numero || ''} onChange={f('documento_numero')} className={inp} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nacionalidad</label>
          <input value={form.nacionalidad || ''} onChange={f('nacionalidad')} className={inp} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Fecha nacimiento</label>
          <input type="date" value={form.fecha_nacimiento || ''} onChange={f('fecha_nacimiento')} className={inp} />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
          <input value={form.direccion || ''} onChange={f('direccion')} className={inp} />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
          <textarea value={form.notas || ''} onChange={f('notas')} rows={2} className={inp} />
        </div>
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancelar} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancelar</button>
        <button type="submit" className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg">Guardar</button>
      </div>
    </form>
  );
}

// ── Detalle ──────────────────────────────────────────────────────────────────
function FotoDocumento({ huesped, onActualizar }) {
  const inputRef = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const [foto, setFoto] = useState(huesped.foto_documento || null);

  async function subir(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    try {
      const form = new FormData();
      form.append('foto', file);
      const r = await api.post(`/huespedes/${huesped.id}/foto-documento`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFoto(r.data.url);
      onActualizar?.(r.data.url);
      toast.success('Foto guardada');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al subir foto');
    } finally {
      setSubiendo(false);
      e.target.value = '';
    }
  }

  async function eliminar() {
    if (!confirm('¿Eliminar la foto del documento?')) return;
    try {
      await api.delete(`/huespedes/${huesped.id}/foto-documento`);
      setFoto(null);
      onActualizar?.(null);
      toast.success('Foto eliminada');
    } catch { toast.error('Error al eliminar'); }
  }

  return (
    <div className="border border-slate-200 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
          <IdentificationIcon className="w-3.5 h-3.5" /> Foto del documento
        </span>
        <div className="flex gap-2">
          <button onClick={() => inputRef.current?.click()} disabled={subiendo}
            className="flex items-center gap-1 text-xs px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg disabled:opacity-50">
            <ArrowUpTrayIcon className="w-3 h-3" /> {subiendo ? 'Subiendo...' : foto ? 'Reemplazar' : 'Subir foto'}
          </button>
          {foto && (
            <button onClick={eliminar}
              className="text-xs px-2.5 py-1 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg">
              Eliminar
            </button>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={subir} className="hidden" />
      {foto ? (
        <img src={foto} alt="Documento" className="max-h-48 rounded-lg border border-slate-200 object-contain w-full bg-slate-50" />
      ) : (
        <div className="flex items-center justify-center h-24 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-400 text-xs gap-2 cursor-pointer"
          onClick={() => inputRef.current?.click()}>
          <CameraIcon className="w-5 h-5" /> Hacer click para subir foto del DNI/Pasaporte
        </div>
      )}
    </div>
  );
}

function DetalleHuesped({ huesped, onActualizar }) {
  const { t } = useTranslation();
  if (!huesped) return null;
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-3">
        {[
          ['Nombre', `${huesped.nombre} ${huesped.apellido}`],
          ['Email', huesped.email || '—'],
          ['Teléfono', huesped.telefono || '—'],
          ['Documento', huesped.documento_tipo ? `${huesped.documento_tipo}: ${huesped.documento_numero}` : '—'],
          ['Nacionalidad', huesped.nacionalidad || '—'],
          ['Nacimiento', huesped.fecha_nacimiento || '—'],
        ].map(([k, v]) => (
          <div key={k}><span className="text-slate-500">{k}:</span> <span className="font-medium">{v}</span></div>
        ))}
      </div>
      {huesped.direccion && <div><span className="text-slate-500">Dirección: </span>{huesped.direccion}</div>}
      {huesped.notas && <div className="bg-slate-50 rounded p-2"><span className="text-slate-500">Notas: </span>{huesped.notas}</div>}

      {/* Foto documento */}
      <FotoDocumento huesped={huesped} onActualizar={onActualizar} />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 pt-1">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-blue-700">{huesped.total_reservas ?? 0}</div>
          <div className="text-xs text-blue-500">Reservas</div>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-green-700">${huesped.total_gastado ?? 0}</div>
          <div className="text-xs text-green-500">Total gastado</div>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 text-center">
          <div className="text-sm font-bold text-amber-700">{huesped.ultima_visita || '—'}</div>
          <div className="text-xs text-amber-500">Última visita</div>
        </div>
      </div>

      {huesped.reservas?.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-700 mb-2">{t('huespedes.historial')} ({huesped.reservas.length})</h3>
          <div className="space-y-2">
            {huesped.reservas.map(r => (
              <div key={r.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                <div>
                  <span className="font-mono text-xs">{r.codigo}</span>
                  <span className="text-slate-500 ml-2">Hab. {r.habitacion_numero}</span>
                  <span className="text-slate-500 ml-2">{r.fecha_entrada} → {r.fecha_salida}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">${r.precio_total}</span>
                  <Badge value={r.estado} label={r.estado} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Fila de lista ─────────────────────────────────────────────────────────────
function ClienteFila({ h, onVer, onEditar, onEliminar }) {
  const iniciales = `${h.nombre?.[0] || ''}${h.apellido?.[0] || ''}`.toUpperCase();
  const colores = ['bg-amber-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-rose-500', 'bg-teal-500'];
  const color = colores[(h.nombre?.charCodeAt(0) || 0) % colores.length];

  return (
    <div className="flex items-center gap-4 bg-white border border-slate-200 hover:border-amber-300 hover:shadow-sm transition-all rounded-xl px-4 py-3">
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
        {iniciales}
      </div>

      {/* Nombre + badge */}
      <div className="w-44 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-800 text-sm">{h.apellido}, {h.nombre}</span>
          {h.actualmente_alojado > 0 && (
            <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded-full">● En casa</span>
          )}
        </div>
        {h.nacionalidad && (
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
            <GlobeAltIcon className="w-3 h-3 shrink-0" /> {h.nacionalidad}
          </div>
        )}
      </div>

      {/* Contacto */}
      <div className="flex-1 min-w-0 space-y-0.5">
        {h.email && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
            <EnvelopeIcon className="w-3.5 h-3.5 shrink-0" /> {h.email}
          </div>
        )}
        {h.telefono && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <PhoneIcon className="w-3.5 h-3.5 shrink-0" /> {h.telefono}
          </div>
        )}
        {h.documento_numero && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <IdentificationIcon className="w-3.5 h-3.5 shrink-0" />
            {h.documento_tipo && `${h.documento_tipo}: `}{h.documento_numero}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 shrink-0 text-center">
        <div>
          <div className="text-sm font-bold text-slate-800">{h.total_reservas ?? 0}</div>
          <div className="text-[10px] text-slate-400">Reservas</div>
        </div>
        <div>
          <div className="text-sm font-bold text-amber-600">${h.total_gastado ?? 0}</div>
          <div className="text-[10px] text-slate-400">Gastado</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-600">{h.ultima_visita || '—'}</div>
          <div className="text-[10px] text-slate-400">Última visita</div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={() => onVer(h)}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition-colors">
          <EyeIcon className="w-3.5 h-3.5" /> Historial
        </button>
        <button onClick={() => onEditar(h)}
          className="flex items-center justify-center px-2.5 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-blue-600 transition-colors">
          <PencilIcon className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onEliminar(h)}
          className="flex items-center justify-center px-2.5 py-1.5 text-xs bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-red-500 transition-colors">
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function Huespedes() {
  const { t } = useTranslation();
  const [huespedes, setHuespedes] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [detalleData, setDetalleData] = useState(null);

  const cargar = () => {
    setCargando(true);
    const q = buscar ? `?buscar=${encodeURIComponent(buscar)}` : '';
    api.get(`/huespedes${q}`).then(r => setHuespedes(r.data)).finally(() => setCargando(false));
  };

  useEffect(() => {
    setCargando(true);
    const controller = new AbortController();
    const q = buscar ? `?buscar=${encodeURIComponent(buscar)}` : '';
    api.get(`/huespedes${q}`, { signal: controller.signal })
      .then(r => setHuespedes(r.data))
      .catch(e => { if (e.name !== 'CanceledError' && e.code !== 'ERR_CANCELED') toast.error('Error al cargar huéspedes'); })
      .finally(() => setCargando(false));
    return () => controller.abort();
  }, [buscar]);

  useAutoRefresh(cargar, 30000);

  async function verDetalle(h) {
    setDetalleData(null);
    try {
      const r = await api.get(`/huespedes/${h.id}`);
      // Solo actualizar si el modal sigue abierto para este mismo huésped
      setDetalle(current => {
        if (current?.id === h.id) {
          setDetalleData({ ...r.data, total_reservas: h.total_reservas, total_gastado: h.total_gastado, ultima_visita: h.ultima_visita });
        }
        return current;
      });
    } catch {
      toast.error('Error al cargar detalle del huésped');
    }
  }

  async function guardar(form) {
    try {
      if (modal === 'nuevo') {
        await api.post('/huespedes', form);
        toast.success('Cliente registrado');
      } else {
        await api.put(`/huespedes/${modal.id}`, form);
        toast.success('Cliente actualizado');
      }
      setModal(null);
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error');
    }
  }

  async function eliminar(h) {
    if (!confirm(`¿Eliminar a ${h.nombre} ${h.apellido}?`)) return;
    try {
      await api.delete(`/huespedes/${h.id}`);
      toast.success('Eliminado');
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error');
    }
  }

  const enCasa = huespedes.filter(h => h.actualmente_alojado > 0).length;
  const totalGastado = huespedes.reduce((s, h) => s + (h.total_gastado || 0), 0);

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
          <p className="text-sm text-slate-500 mt-0.5">{huespedes.length} clientes registrados</p>
        </div>
        <button onClick={() => setModal('nuevo')}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <PlusIcon className="w-4 h-4" /> Nuevo cliente
        </button>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-2xl font-bold text-slate-800">{huespedes.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Total clientes</div>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{enCasa}</div>
          <div className="text-xs text-green-500 mt-0.5">En casa ahora</div>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center">
          <div className="text-2xl font-bold text-amber-700">${totalGastado.toFixed(0)}</div>
          <div className="text-xs text-amber-500 mt-0.5">Ingresos totales</div>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative max-w-md">
        <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={buscar} onChange={e => setBuscar(e.target.value)}
          placeholder="Buscar por nombre, email, documento..."
          className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>

      {/* Grid de cards */}
      {cargando ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : huespedes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <UserIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400">No se encontraron clientes</p>
        </div>
      ) : (
        <div className="space-y-2">
          {huespedes.map(h => (
            <ClienteFila key={h.id} h={h}
              onVer={h => { setDetalle(h); verDetalle(h); }}
              onEditar={setModal}
              onEliminar={eliminar}
            />
          ))}
        </div>
      )}

      {/* Modal formulario */}
      <Modal open={!!modal} onClose={() => setModal(null)}
        title={modal === 'nuevo' ? 'Nuevo cliente' : 'Editar cliente'} size="lg">
        <FormHuesped datos={modal !== 'nuevo' ? modal : null} onGuardar={guardar} onCancelar={() => setModal(null)} />
      </Modal>

      {/* Modal detalle */}
      <Modal open={!!detalle} onClose={() => { setDetalle(null); setDetalleData(null); }}
        title={detalle ? `${detalle.nombre} ${detalle.apellido}` : ''} size="lg">
        <DetalleHuesped huesped={detalleData || detalle}
          onActualizar={url => {
            setDetalleData(d => d ? { ...d, foto_documento: url } : d);
          }} />
      </Modal>
    </div>
  );
}
