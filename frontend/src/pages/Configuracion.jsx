import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/useAuth';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, CheckIcon, PhotoIcon, ArrowUpTrayIcon, LinkIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';

const TIPOS_CAMA = [
  { value: 'simple',    label: 'Simple (1 plaza)' },
  { value: 'doble',     label: 'Doble (2 plazas)' },
  { value: 'matrimonial', label: 'Matrimonial' },
  { value: 'queen',     label: 'Queen' },
  { value: 'king',      label: 'King' },
  { value: 'litera',    label: 'Litera' },
  { value: 'sofa_cama', label: 'Sofá cama' },
];

const AMENIDADES_OPCIONES = ['TV', 'Wifi', 'Baño privado', 'Frigobar', 'Jacuzzi', 'Sala de estar', 'Aire acondicionado', 'Calefacción', 'Caja fuerte', 'Escritorio'];

const TIPO_VACIO = { nombre: '', descripcion: '', capacidad: 2, precio_base: '', precio_fin_semana: '', amenidades: [], camas: [], imagen: null };

// ── Selector de imagen ────────────────────────────────────────────────────────
function SelectorImagen({ valor, onChange }) {
  const [imagenes, setImagenes] = useState([]);
  const [abierto, setAbierto]   = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (abierto) cargarImagenes();
  }, [abierto]);

  async function cargarImagenes() {
    try {
      const r = await api.get('/tipos-habitacion/imagenes');
      setImagenes(r.data);
    } catch { setImagenes([]); }
  }

  async function subirImagen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('imagen', file);
      const r = await api.post('/tipos-habitacion/upload-imagen', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(r.data.url);
      setAbierto(false);
      toast.success('Imagen subida');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al subir imagen');
    } finally {
      setSubiendo(false);
      e.target.value = '';
    }
  }

  return (
    <div className="space-y-2">
      {/* Preview actual */}
      <div className="flex items-center gap-3">
        <div className="w-20 h-16 rounded-lg border-2 border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center shrink-0">
          {valor
            ? <img src={valor} alt="preview" className="w-full h-full object-cover" />
            : <PhotoIcon className="w-7 h-7 text-slate-300" />
          }
        </div>
        <div className="space-y-1.5">
          <button type="button" onClick={() => setAbierto(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600">
            <PhotoIcon className="w-4 h-4" />
            {valor ? 'Cambiar imagen' : 'Seleccionar imagen'}
          </button>
          {valor && (
            <button type="button" onClick={() => onChange(null)}
              className="text-xs text-red-400 hover:text-red-600">
              Quitar imagen
            </button>
          )}
        </div>
      </div>

      {/* Panel selector */}
      {abierto && (
        <div className="border-2 border-amber-300 rounded-xl p-3 bg-amber-50 space-y-3">
          {/* Subir nueva */}
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={subirImagen} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={subiendo}
              className="flex items-center gap-2 px-3 py-2 text-sm border-2 border-dashed border-amber-400 hover:border-amber-500 hover:bg-amber-100 text-amber-700 rounded-lg w-full justify-center transition-colors disabled:opacity-60">
              <ArrowUpTrayIcon className="w-4 h-4" />
              {subiendo ? 'Subiendo...' : 'Subir imagen desde el equipo'}
            </button>
          </div>

          {/* Galería de imágenes existentes */}
          {imagenes.length > 0 && (
            <>
              <p className="text-xs font-medium text-slate-600">O elegir una existente:</p>
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {imagenes.map(img => (
                  <button key={img.url} type="button"
                    onClick={() => { onChange(img.url); setAbierto(false); }}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${valor === img.url ? 'border-amber-500 ring-2 ring-amber-300' : 'border-slate-200 hover:border-amber-400'}`}>
                    <img src={img.url} alt={img.nombre} className="w-full h-20 object-cover" />
                    {valor === img.url && (
                      <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                        <CheckIcon className="w-6 h-6 text-amber-700" />
                      </div>
                    )}
                    <p className="text-[10px] text-slate-500 truncate px-1 py-0.5 bg-white">{img.nombre}</p>
                  </button>
                ))}
              </div>
            </>
          )}

          <button type="button" onClick={() => setAbierto(false)}
            className="text-xs text-slate-400 hover:text-slate-600 w-full text-center">
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}

function EditorCamas({ camas, onChange }) {
  function agregar() { onChange([...camas, { tipo: 'doble', cantidad: 1 }]); }
  function actualizar(i, campo, valor) {
    onChange(camas.map((c, idx) => idx === i ? { ...c, [campo]: campo === 'cantidad' ? Number(valor) : valor } : c));
  }
  function quitar(i) { onChange(camas.filter((_, idx) => idx !== i)); }

  return (
    <div className="space-y-2">
      {camas.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <select value={c.tipo} onChange={e => actualizar(i, 'tipo', e.target.value)}
            className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
            {TIPOS_CAMA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input type="number" min="1" max="10" value={c.cantidad} onChange={e => actualizar(i, 'cantidad', e.target.value)}
            className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400" />
          <button type="button" onClick={() => quitar(i)} className="text-red-400 hover:text-red-600">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={agregar}
        className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium">
        <PlusIcon className="w-3.5 h-3.5" /> Agregar cama
      </button>
    </div>
  );
}

function ModalTipo({ tipo, onGuardar, onCerrar }) {
  const [form, setForm] = useState(tipo ? { ...tipo, imagen: tipo.imagen || null } : { ...TIPO_VACIO });
  const [guardando, setGuardando] = useState(false);

  function f(key) { return e => setForm(p => ({ ...p, [key]: e.target.value })); }
  function toggleAmenidad(a) {
    setForm(p => ({
      ...p,
      amenidades: p.amenidades.includes(a) ? p.amenidades.filter(x => x !== a) : [...p.amenidades, a],
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      await onGuardar({ ...form, capacidad: Number(form.capacidad), precio_base: Number(form.precio_base), precio_fin_semana: form.precio_fin_semana ? Number(form.precio_fin_semana) : null });
      onCerrar();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCerrar}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-lg">{tipo ? 'Editar tipo' : 'Nuevo tipo de habitación'}</h3>
          <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500">×</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del tipo *</label>
              <input value={form.nombre} onChange={f('nombre')} required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
              <input value={form.descripcion || ''} onChange={f('descripcion')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Capacidad (personas)</label>
              <input type="number" min="1" max="20" value={form.capacidad} onChange={f('capacidad')} required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Precio base / noche *</label>
              <input type="number" min="0" step="0.01" value={form.precio_base} onChange={f('precio_base')} required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Precio fin de semana / noche</label>
              <input type="number" min="0" step="0.01" value={form.precio_fin_semana || ''} onChange={f('precio_fin_semana')}
                placeholder="Dejar vacío si es el mismo precio"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>

          {/* Camas */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Camas</label>
            <EditorCamas camas={form.camas || []} onChange={camas => setForm(p => ({ ...p, camas }))} />
          </div>

          {/* Imagen */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Imagen de la habitación</label>
            <SelectorImagen valor={form.imagen} onChange={url => setForm(p => ({ ...p, imagen: url }))} />
          </div>

          {/* Amenidades */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Amenidades</label>
            <div className="flex flex-wrap gap-2">
              {AMENIDADES_OPCIONES.map(a => (
                <button key={a} type="button" onClick={() => toggleAmenidad(a)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    form.amenidades.includes(a)
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-amber-400'
                  }`}>
                  {form.amenidades.includes(a) && <CheckIcon className="w-3 h-3" />}
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCerrar}
              className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 rounded-lg text-sm disabled:opacity-60">
              {guardando ? 'Guardando...' : 'Guardar tipo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Sección descuentos por noches ─────────────────────────────────────────────
function SeccionDescuentos() {
  const [tramos, setTramos] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.get('/configuracion').then(r => {
      try {
        const raw = r.data.descuentos_noches;
        setTramos(raw ? JSON.parse(raw) : []);
      } catch { setTramos([]); }
      setCargado(true);
    });
  }, []);

  function agregar() {
    setTramos(t => [...t, { desde: 2, pct: 5, label: '' }]);
  }

  function actualizar(i, campo, valor) {
    setTramos(t => t.map((tr, idx) => idx === i
      ? { ...tr, [campo]: campo === 'label' ? valor : Number(valor) }
      : tr
    ));
  }

  function quitar(i) {
    setTramos(t => t.filter((_, idx) => idx !== i));
  }

  async function guardar(e) {
    e.preventDefault();
    // Validar que no haya tramos con desde <= 0 o pct fuera de rango
    for (const t of tramos) {
      if (t.desde < 2) return toast.error('El mínimo de noches debe ser 2 o más');
      if (t.pct <= 0 || t.pct >= 100) return toast.error('El descuento debe estar entre 1 y 99%');
    }
    setGuardando(true);
    try {
      await api.put('/configuracion', { descuentos_noches: JSON.stringify(tramos) });
      toast.success('Descuentos guardados');
    } catch { toast.error('Error al guardar'); }
    finally { setGuardando(false); }
  }

  if (!cargado) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🏷</span>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Descuentos por cantidad de noches</h2>
        <span className="text-xs text-slate-400 ml-1">— se aplican automáticamente en la web</span>
      </div>
      <form onSubmit={guardar} className="space-y-3">
        {tramos.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-2">Sin descuentos configurados. La web mostrará el precio base siempre.</p>
        )}
        <div className="space-y-2">
          {[...tramos].sort((a, b) => a.desde - b.desde).map((tr, i) => {
            // índice en el array original (no en el ordenado)
            const origIdx = tramos.indexOf(tr);
            return (
              <div key={i} className="grid grid-cols-[auto_1fr_1fr_1fr_auto] items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <span className="text-xs text-slate-400 whitespace-nowrap">Desde</span>
                <div>
                  <input type="number" min="2" max="30" value={tr.desde}
                    onChange={e => actualizar(origIdx, 'desde', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <span className="text-[10px] text-slate-400 block text-center">noches</span>
                </div>
                <div>
                  <input type="number" min="1" max="99" value={tr.pct}
                    onChange={e => actualizar(origIdx, 'pct', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <span className="text-[10px] text-slate-400 block text-center">% descuento</span>
                </div>
                <div>
                  <input type="text" value={tr.label} placeholder="Ej: Semana completa"
                    onChange={e => actualizar(origIdx, 'label', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <span className="text-[10px] text-slate-400 block text-center">etiqueta</span>
                </div>
                <button type="button" onClick={() => quitar(origIdx)}
                  className="text-red-400 hover:text-red-600 p-1">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button type="button" onClick={agregar}
            className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium border border-amber-300 hover:border-amber-400 px-3 py-1.5 rounded-lg">
            <PlusIcon className="w-3.5 h-3.5" /> Agregar tramo
          </button>
          <button type="submit" disabled={guardando}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg disabled:opacity-60">
            {guardando ? 'Guardando...' : 'Guardar descuentos'}
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Los tramos se evalúan de mayor a menor — si el huésped reserva 7 noches y hay tramos para 4 y 7, se aplica el de 7.
        </p>
      </form>
    </div>
  );
}

// ── Sección datos de pago ─────────────────────────────────────────────────────
function SeccionPago() {
  const KEYS = ['pago_cbu', 'pago_alias', 'pago_titular', 'pago_banco', 'pago_instrucciones'];
  const [pago, setPago] = useState({ pago_cbu: '', pago_alias: '', pago_titular: '', pago_banco: '', pago_instrucciones: '' });
  const [cargado, setCargado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.get('/configuracion').then(r => {
      const c = r.data;
      setPago({ pago_cbu: c.pago_cbu || '', pago_alias: c.pago_alias || '', pago_titular: c.pago_titular || '', pago_banco: c.pago_banco || '', pago_instrucciones: c.pago_instrucciones || '' });
      setCargado(true);
    });
  }, []);

  function f(k) { return e => setPago(p => ({ ...p, [k]: e.target.value })); }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      await api.put('/configuracion', pago);
      toast.success('Datos de pago guardados');
    } catch { toast.error('Error al guardar'); }
    finally { setGuardando(false); }
  }

  if (!cargado) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🏦</span>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Datos de pago para seña</h2>
        <span className="text-xs text-slate-400 ml-1">— se muestran al huésped al confirmar reserva</span>
      </div>
      <form onSubmit={guardar} className="space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">CBU</label>
            <input value={pago.pago_cbu} onChange={f('pago_cbu')} placeholder="0000000000000000000000"
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Alias</label>
            <input value={pago.pago_alias} onChange={f('pago_alias')} placeholder="mi.hosteria.alias"
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Titular de la cuenta</label>
            <input value={pago.pago_titular} onChange={f('pago_titular')} placeholder="Juan Pérez"
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Banco</label>
            <input value={pago.pago_banco} onChange={f('pago_banco')} placeholder="Banco Galicia, Mercado Pago, etc."
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Instrucciones adicionales</label>
            <textarea value={pago.pago_instrucciones} onChange={f('pago_instrucciones')} rows={2}
              placeholder="Ej: Una vez realizada la transferencia, enviá el comprobante por WhatsApp al +54 9 ..."
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
          </div>
        </div>
        <button type="submit" disabled={guardando}
          className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg disabled:opacity-60">
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
    </div>
  );
}

// ── Sección SMTP ──────────────────────────────────────────────────────────────
function SeccionSmtp() {
  const [smtp, setSmtp] = useState({ smtp_host: '', smtp_port: '587', smtp_user: '', smtp_pass: '', smtp_from: '', smtp_habilitado: '0' });
  const [cargado, setCargado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [testeando, setTesteando] = useState(false);

  useEffect(() => {
    api.get('/configuracion').then(r => {
      const c = r.data;
      setSmtp({
        smtp_host:       c.smtp_host       || '',
        smtp_port:       c.smtp_port       || '587',
        smtp_user:       c.smtp_user       || '',
        smtp_pass:       c.smtp_pass       || '',
        smtp_from:       c.smtp_from       || '',
        smtp_habilitado: c.smtp_habilitado || '0',
      });
      setCargado(true);
    });
  }, []);

  function f(k) { return e => setSmtp(p => ({ ...p, [k]: e.target.value })); }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      await api.put('/configuracion', smtp);
      toast.success('Configuración SMTP guardada');
    } catch { toast.error('Error al guardar'); }
    finally { setGuardando(false); }
  }

  async function testear() {
    setTesteando(true);
    try {
      const r = await api.post('/configuracion/test-email');
      toast.success(r.data.mensaje);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error de conexión SMTP');
    } finally { setTesteando(false); }
  }

  if (!cargado) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📧</span>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Configuración de email (SMTP)</h2>
        <label className="ml-auto flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-slate-500">Habilitado</span>
          <div className="relative">
            <input type="checkbox" className="sr-only" checked={smtp.smtp_habilitado === '1'}
              onChange={e => setSmtp(p => ({ ...p, smtp_habilitado: e.target.checked ? '1' : '0' }))} />
            <div className={`w-9 h-5 rounded-full transition-colors ${smtp.smtp_habilitado === '1' ? 'bg-amber-500' : 'bg-slate-300'}`} />
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${smtp.smtp_habilitado === '1' ? 'translate-x-4' : ''}`} />
          </div>
        </label>
      </div>
      <form onSubmit={guardar} className="space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Servidor SMTP (host)</label>
            <input value={smtp.smtp_host} onChange={f('smtp_host')} placeholder="smtp.gmail.com"
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Puerto</label>
            <select value={smtp.smtp_port} onChange={f('smtp_port')}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
              <option value="587">587 (TLS — recomendado)</option>
              <option value="465">465 (SSL)</option>
              <option value="25">25 (sin cifrado)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Usuario / Email</label>
            <input type="email" value={smtp.smtp_user} onChange={f('smtp_user')} placeholder="tu@gmail.com"
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Contraseña / App password</label>
            <input type="password" value={smtp.smtp_pass} onChange={f('smtp_pass')} placeholder="••••••••••••"
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Dirección "De" (from)</label>
            <input type="email" value={smtp.smtp_from} onChange={f('smtp_from')} placeholder="noreply@mihosteria.com (dejar vacío para usar el usuario)"
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
          💡 Para Gmail usá una <strong>contraseña de aplicación</strong> (no tu contraseña normal). Activala en: Cuenta Google → Seguridad → Verificación en dos pasos → Contraseñas de aplicación.
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={guardando}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg disabled:opacity-60">
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
          <button type="button" onClick={testear} disabled={testeando}
            className="px-4 py-1.5 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 disabled:opacity-60">
            {testeando ? 'Enviando...' : '🧪 Probar conexión'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Sección importación iCal (feeds externos: Booking, Airbnb) ───────────────
function SeccionICalImport({ habitaciones }) {
  const [feeds, setFeeds] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState({}); // feed_id → bool
  const [sincAll, setSincAll] = useState(false);
  const [formAbierto, setFormAbierto] = useState(false);
  const [nuevoFeed, setNuevoFeed] = useState({ habitacion_id: '', nombre: '', url: '' });
  const [guardando, setGuardando] = useState(false);

  async function cargarFeeds() {
    try {
      const r = await api.get('/ical-feeds');
      setFeeds(Array.isArray(r.data) ? r.data : []);
    } catch { setFeeds([]); }
    finally { setCargando(false); }
  }

  useEffect(() => { cargarFeeds(); }, []);

  async function agregarFeed(e) {
    e.preventDefault();
    if (!nuevoFeed.habitacion_id || !nuevoFeed.nombre || !nuevoFeed.url) {
      toast.error('Completá todos los campos'); return;
    }
    setGuardando(true);
    try {
      await api.post('/ical-feeds', nuevoFeed);
      toast.success('Feed agregado');
      setNuevoFeed({ habitacion_id: '', nombre: '', url: '' });
      setFormAbierto(false);
      cargarFeeds();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al agregar feed');
    } finally { setGuardando(false); }
  }

  async function eliminarFeed(feed) {
    if (!confirm(`¿Eliminar el feed "${feed.nombre}"?`)) return;
    try {
      await api.delete(`/ical-feeds/${feed.id}`);
      toast.success('Feed eliminado');
      cargarFeeds();
    } catch { toast.error('Error al eliminar'); }
  }

  async function sincronizar(feed) {
    setSincronizando(s => ({ ...s, [feed.id]: true }));
    try {
      const r = await api.post(`/ical-feeds/${feed.id}/sync`);
      toast.success(r.data.mensaje || 'Sincronizado');
      cargarFeeds();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al sincronizar');
    } finally {
      setSincronizando(s => ({ ...s, [feed.id]: false }));
    }
  }

  async function sincAll_fn() {
    setSincAll(true);
    try {
      const r = await api.post('/ical-feeds/sync-all');
      const ok = r.data.resultados?.filter(x => x.resultado.startsWith('OK')).length || 0;
      toast.success(`Sincronizados ${ok} feed(s)`);
      cargarFeeds();
    } catch { toast.error('Error al sincronizar todos'); }
    finally { setSincAll(false); }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LinkIcon className="w-4 h-4 text-purple-500" />
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Importar calendarios externos (iCal)</h2>
        </div>
        <div className="flex gap-2">
          {feeds.length > 0 && (
            <button onClick={sincAll_fn} disabled={sincAll}
              className="text-xs px-3 py-1.5 border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 disabled:opacity-60">
              {sincAll ? 'Sincronizando...' : '↻ Sincronizar todos'}
            </button>
          )}
          <button onClick={() => setFormAbierto(f => !f)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg">
            <PlusIcon className="w-3.5 h-3.5" /> Agregar feed
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Pegá aquí las URLs iCal de <strong>Booking.com</strong> o <strong>Airbnb</strong> para importar los bloqueos externos al calendario.
        Los períodos bloqueados se mostrarán en el calendario con rayas.
      </p>

      {/* Formulario nuevo feed */}
      {formAbierto && (
        <form onSubmit={agregarFeed} className="border border-purple-200 bg-purple-50 rounded-xl p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Habitación *</label>
              <select value={nuevoFeed.habitacion_id}
                onChange={e => setNuevoFeed(f => ({ ...f, habitacion_id: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                <option value="">Seleccionar...</option>
                {habitaciones.map(h => (
                  <option key={h.id} value={h.id}>Hab. {h.numero} — {h.tipo_nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre del canal *</label>
              <input placeholder="Booking.com, Airbnb..." value={nuevoFeed.nombre}
                onChange={e => setNuevoFeed(f => ({ ...f, nombre: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">URL del feed iCal *</label>
              <input placeholder="https://admin.booking.com/..." value={nuevoFeed.url}
                onChange={e => setNuevoFeed(f => ({ ...f, url: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setFormAbierto(false)}
              className="text-xs px-3 py-1.5 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="text-xs px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg disabled:opacity-60">
              {guardando ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        </form>
      )}

      {/* Lista de feeds */}
      {cargando ? (
        <div className="text-xs text-slate-400 py-2">Cargando...</div>
      ) : feeds.length === 0 ? (
        <p className="text-xs text-slate-400 py-2">No hay feeds configurados. Agregá uno para importar bloqueos externos.</p>
      ) : (
        <div className="space-y-2">
          {feeds.map(feed => (
            <div key={feed.id} className="border border-slate-200 rounded-lg px-3 py-2.5 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-700">{feed.nombre}</span>
                  <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">Hab. {feed.habitacion_numero}</span>
                  <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">{feed.total_bloqueados} bloqueados</span>
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5 max-w-xs">{feed.url}</div>
                {feed.ultimo_sync && (
                  <div className={`text-[11px] mt-0.5 ${feed.ultimo_resultado?.startsWith('OK') ? 'text-green-600' : 'text-red-500'}`}>
                    Última sync: {new Date(feed.ultimo_sync).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                    {' — '}{feed.ultimo_resultado}
                  </div>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => sincronizar(feed)} disabled={sincronizando[feed.id]}
                  className="text-xs px-2.5 py-1 border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 disabled:opacity-60">
                  {sincronizando[feed.id] ? '...' : '↻ Sync'}
                </button>
                <button onClick={() => eliminarFeed(feed)}
                  className="text-xs px-2 py-1 border border-red-200 text-red-500 rounded-lg hover:bg-red-50">
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Configuracion() {
  const { t } = useTranslation();
  const { usuario } = useAuth();
  const [config, setConfig] = useState({});
  const [tipos, setTipos] = useState([]);
  const [habitaciones, setHabitaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [modalTipo, setModalTipo] = useState(null); // null | 'nuevo' | objeto tipo

  useEffect(() => {
    Promise.all([
      api.get('/configuracion'),
      api.get('/tipos-habitacion'),
      api.get('/habitaciones'),
    ]).then(([c, t, h]) => {
      setConfig(c.data);
      setTipos(t.data);
      setHabitaciones(h.data);
    }).finally(() => setCargando(false));
  }, []);

  async function cargarTipos() {
    const r = await api.get('/tipos-habitacion');
    setTipos(r.data);
  }

  async function guardarTipo(form) {
    try {
      if (modalTipo === 'nuevo') {
        await api.post('/tipos-habitacion', form);
        toast.success('Tipo creado');
      } else {
        await api.put(`/tipos-habitacion/${modalTipo.id}`, form);
        toast.success('Tipo actualizado');
      }
      await cargarTipos();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al guardar');
      throw e;
    }
  }

  async function eliminarTipo(tipo) {
    if (!confirm(`¿Eliminar el tipo "${tipo.nombre}"?`)) return;
    try {
      await api.delete(`/tipos-habitacion/${tipo.id}`);
      toast.success('Tipo eliminado');
      await cargarTipos();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al eliminar');
    }
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      await api.put('/configuracion', config);
      toast.success('Configuración guardada');
    } catch (e) {
      toast.error('Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  function f(key) {
    return e => setConfig(c => ({ ...c, [key]: e.target.value }));
  }

  if (cargando) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <>
    <div className="space-y-4 max-w-5xl">
      <h1 className="text-2xl font-bold text-slate-800">{t('configuracion.titulo')}</h1>

      <form onSubmit={guardar} className="space-y-4">
        {/* Fila superior: Información + Financiera */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Información general */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Información de la hostería</h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('configuracion.nombre_hosteria')}</label>
              <input value={config.nombre_hosteria || ''} onChange={f('nombre_hosteria')}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('configuracion.direccion')}</label>
              <input value={config.direccion || ''} onChange={f('direccion')}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('configuracion.telefono')}</label>
                <input value={config.telefono || ''} onChange={f('telefono')}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('configuracion.email')}</label>
                <input type="email" value={config.email || ''} onChange={f('email')}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
            </div>
          </div>

          {/* Financiera + Horarios */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Configuración financiera</h2>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('configuracion.moneda')}</label>
                  <select value={config.moneda || 'USD'} onChange={f('moneda')}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="ARS">ARS</option>
                    <option value="COP">COP</option>
                    <option value="MXN">MXN</option>
                    <option value="CLP">CLP</option>
                    <option value="PEN">PEN</option>
                    <option value="BRL">BRL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Símbolo</label>
                  <input value={config.simbolo_moneda || '$'} onChange={f('simbolo_moneda')}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('configuracion.impuesto')}</label>
                  <input type="number" min="0" max="100" step="0.01" value={config.impuesto_porcentaje || '0'} onChange={f('impuesto_porcentaje')}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Horarios</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('configuracion.hora_checkin')}</label>
                  <input type="time" value={config.hora_checkin || '14:00'} onChange={f('hora_checkin')}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('configuracion.hora_checkout')}</label>
                  <input type="time" value={config.hora_checkout || '11:00'} onChange={f('hora_checkout')}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tipos de habitación — ancho completo, grid 2 cols */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Tipos de habitación</h2>
            <button type="button" onClick={() => setModalTipo('nuevo')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors">
              <PlusIcon className="w-3.5 h-3.5" /> Nuevo tipo
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {tipos.map(tipo => (
              <div key={tipo.id} className="border border-slate-200 rounded-lg p-3 flex items-center gap-3">
                <div className="w-14 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                  {tipo.imagen
                    ? <img src={tipo.imagen} alt={tipo.nombre} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><PhotoIcon className="w-5 h-5 text-slate-300" /></div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-slate-800 text-sm">{tipo.nombre}</span>
                    <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{tipo.capacidad} pers.</span>
                    <span className="text-xs font-semibold text-amber-600">${tipo.precio_base}/n</span>
                    {tipo.precio_fin_semana && (
                      <span className="text-xs text-slate-400">${tipo.precio_fin_semana} fds</span>
                    )}
                  </div>
                  {tipo.camas?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tipo.camas.map((c, i) => (
                        <span key={i} className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                          {c.cantidad}× {TIPOS_CAMA.find(t => t.value === c.tipo)?.label || c.tipo}
                        </span>
                      ))}
                    </div>
                  )}
                  {tipo.amenidades?.length > 0 && (
                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">{tipo.amenidades.join(' · ')}</div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button type="button" onClick={() => setModalTipo(tipo)}
                    className="flex items-center gap-1 px-2 py-1 text-xs border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50">
                    <PencilIcon className="w-3 h-3" /> Editar
                  </button>
                  <button type="button" onClick={() => eliminarTipo(tipo)}
                    className="flex items-center justify-center px-2 py-1 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50">
                    <TrashIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
            {tipos.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-4 col-span-2">No hay tipos de habitación registrados</p>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={guardando}
            className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-60 text-sm">
            {guardando ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </form>

      {/* Descuentos por noches */}
      <SeccionDescuentos />

      {/* Datos de pago para seña */}
      <SeccionPago />

      {/* Sección SMTP — fuera del form principal, tiene su propio guardado */}
      <SeccionSmtp />

      {/* Importación iCal desde canales externos */}
      <SeccionICalImport habitaciones={habitaciones} />

      {/* Sección iCal — fuera del form */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-1">
          <LinkIcon className="w-4 h-4 text-blue-500" />
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Exportar calendario (iCal) a Booking/Airbnb</h2>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Copiá la URL de cada habitación y pegala en <strong>Booking.com</strong> (Extranet → Disponibilidad → Sincronizar calendario)
          o <strong>Airbnb</strong> (Calendario → Importar calendario). Los días reservados en tu sistema se bloquearán automáticamente.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {habitaciones.map(hab => {
            const url = `${window.location.protocol}//${window.location.hostname}:5000/ical/${hab.id}.ics`;
            return (
              <div key={hab.id} className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
                <div className="shrink-0 text-xs font-semibold text-slate-600 w-16">
                  Hab. {hab.numero}
                  <span className="block font-normal text-slate-400">{hab.tipo_nombre}</span>
                </div>
                <input readOnly value={url}
                  className="flex-1 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-1 min-w-0 cursor-text"
                  onFocus={e => e.target.select()}
                />
                <button
                  onClick={() => { navigator.clipboard.writeText(url); toast.success(`URL copiada · Hab. ${hab.numero}`); }}
                  className="shrink-0 p-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-500"
                  title="Copiar URL">
                  <ClipboardDocumentIcon className="w-4 h-4" />
                </button>
              </div>
            );
          })}
          {habitaciones.length === 0 && (
            <p className="text-slate-400 text-xs col-span-2 py-2">No hay habitaciones registradas</p>
          )}
        </div>
      </div>
    </div>

    {modalTipo && (
      <ModalTipo
        tipo={modalTipo === 'nuevo' ? null : modalTipo}
        onGuardar={guardarTipo}
        onCerrar={() => setModalTipo(null)}
      />
    )}
    </>
  );
}
