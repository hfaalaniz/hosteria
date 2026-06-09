import { useState, useEffect, useRef } from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import CalendarioReserva from '../components/CalendarioReserva';
import { descuentoPara, precioConDescuento } from '../utils/descuentos';
import { useDescuentos } from '../hooks/useDescuentos';

// ──────────────────────────────────────────────
// Helpers compartidos
// ──────────────────────────────────────────────
const CAMA_LABELS = { simple: 'Simple', doble: 'Doble', queen: 'Queen', king: 'King', litera: 'Litera', sofa_cama: 'Sofá' };
const CAMA_ICONS  = { simple: '🛏', doble: '🛏', queen: '👑', king: '♛', litera: '🪜', sofa_cama: '🛋' };
const VISTA_ICONS = { jardín: '🌿', piscina: '🏊', montaña: '⛰️', mar: '🌊', ciudad: '🏙️', patio: '🌸', calle: '🏠' };

export function ResumenCamas({ camas }) {
  if (!camas?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {camas.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
          {CAMA_ICONS[c.tipo] || '🛏'} {c.cantidad}× {CAMA_LABELS[c.tipo] || c.tipo}
        </span>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// Modal de detalle de habitación
// ──────────────────────────────────────────────
export function ModalHabitacion({ hab, busqueda, onReservar, onCerrar }) {
  const { t } = useTranslation();
  if (!hab) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onCerrar}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        {/* Header visual */}
        <div className="h-52 relative rounded-t-2xl overflow-hidden">
          {hab.imagen
            ? <img src={hab.imagen} alt={hab.tipo_nombre} className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-amber-200 to-amber-400 flex items-center justify-center"><span className="text-7xl">🛏️</span></div>
          }
          <button onClick={onCerrar}
            className="absolute top-3 right-3 bg-black/30 hover:bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg">
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Título y precio */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{hab.tipo_nombre}</h2>
              <p className="text-slate-500 text-sm">Habitación {hab.numero} · Piso {hab.piso}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-amber-600">${hab.precio_noche}</div>
              <div className="text-xs text-slate-400">{t('habitaciones.por_noche')}</div>
            </div>
          </div>

          {/* Descripción */}
          {(hab.descripcion || hab.tipo_descripcion) && (
            <p className="text-slate-600 text-sm">{hab.descripcion || hab.tipo_descripcion}</p>
          )}

          {/* Características clave */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
              <span>👥</span>
              <span className="text-slate-700">{hab.capacidad} {t('habitaciones.personas')}</span>
            </div>
            {hab.metros_cuadrados && (
              <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                <span>📐</span>
                <span className="text-slate-700">{hab.metros_cuadrados} m²</span>
              </div>
            )}
            {hab.vista && (
              <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                <span>{VISTA_ICONS[hab.vista] || '🪟'}</span>
                <span className="text-slate-700 capitalize">Vista {hab.vista}</span>
              </div>
            )}
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
              <span>🚿</span>
              <span className="text-slate-700">{hab.bano_privado ? 'Baño privado' : 'Baño compartido'}</span>
            </div>
          </div>

          {/* Camas */}
          {hab.camas?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Camas</p>
              <ResumenCamas camas={hab.camas} />
            </div>
          )}

          {/* Amenidades */}
          {hab.amenidades?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Incluye</p>
              <div className="flex flex-wrap gap-1.5">
                {hab.amenidades.map((a, i) => (
                  <span key={i} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-full">{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* Precio total si hay fechas */}
          {hab.precio_total && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex justify-between items-center">
              <div>
                <div className="text-sm text-amber-700">{hab.noches} {t('formulario.noches')} × ${hab.precio_noche}</div>
                <div className="text-xs text-amber-500">{busqueda?.fecha_entrada} → {busqueda?.fecha_salida}</div>
              </div>
              <div className="text-xl font-bold text-amber-700">${hab.precio_total}</div>
            </div>
          )}

          {/* CTA */}
          {onReservar ? (
            <button onClick={() => onReservar(hab)}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-colors text-base">
              {t('habitaciones.reservar')}
            </button>
          ) : (
            <a href={`/reservar`}
              className="block w-full text-center bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-colors text-base">
              {t('hero.btn_reservar')}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Card de habitación para el catálogo
// ──────────────────────────────────────────────
function CardHabitacion({ hab, onVerDetalle, onReservar, descuentos }) {
  const { t } = useTranslation();
  const [noches, setNoches] = useState(1);
  const { precio, descuento } = precioConDescuento(hab.precio_noche, noches, descuentos);
  const total = Math.round(precio * noches * 100) / 100;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-lg transition-shadow group">
      {/* Imagen */}
      <div className="h-44 relative overflow-hidden cursor-pointer" onClick={() => onVerDetalle(hab)}>
        {hab.imagen
          ? <img src={hab.imagen} alt={hab.tipo_nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          : <div className="w-full h-full bg-gradient-to-br from-amber-100 to-amber-300 flex items-center justify-center"><span className="text-6xl group-hover:scale-110 transition-transform">🛏️</span></div>
        }
        <div className="absolute top-3 left-3">
          {hab.estado === 'disponible' ? (
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">✓ Disponible hoy</span>
          ) : (
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700">No disponible hoy</span>
          )}
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
            <h3 className="font-bold text-slate-800">{hab.tipo_nombre}</h3>
            <p className="text-xs text-slate-400">Hab. {hab.numero} · Piso {hab.piso}</p>
          </div>
          <div className="text-right shrink-0 ml-2">
            {descuento ? (
              <>
                <span className="text-xs line-through text-slate-400">${hab.precio_noche}</span>
                <span className="text-lg font-bold text-amber-600 ml-1">${precio}</span>
                <span className="block text-xs font-semibold text-green-600">{descuento.label}</span>
              </>
            ) : (
              <>
                <span className="text-lg font-bold text-amber-600">${hab.precio_noche}</span>
                <span className="text-xs text-slate-400 block">{t('habitaciones.por_noche')}</span>
              </>
            )}
          </div>
        </div>

        {/* Características rápidas */}
        <div className="flex items-center gap-3 text-xs text-slate-500 my-2">
          <span>👥 {hab.capacidad} pers.</span>
          {hab.metros_cuadrados && <span>📐 {hab.metros_cuadrados} m²</span>}
          {!!hab.bano_privado && <span>🚿 Privado</span>}
        </div>

        {/* Camas */}
        {hab.camas?.length > 0 && <ResumenCamas camas={hab.camas} />}

        {/* Amenidades */}
        {hab.amenidades?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {hab.amenidades.slice(0, 3).map((a, i) => (
              <span key={i} className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{a}</span>
            ))}
            {hab.amenidades.length > 3 && <span className="text-xs text-slate-400">+{hab.amenidades.length - 3}</span>}
          </div>
        )}

        {/* Selector de noches + total */}
        <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 whitespace-nowrap">Noches:</label>
            <select value={noches} onChange={e => setNoches(Number(e.target.value))}
              className="border border-amber-200 rounded-lg px-2 py-1 text-sm font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
              {[1,2,3,4,5,6,7,10,14].map(n => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'noche' : 'noches'}{descuentoPara(n, descuentos) ? ` (${descuentoPara(n, descuentos).pct}% off)` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-amber-700">${total}</span>
            <span className="text-xs text-slate-400 block">total est.</span>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button onClick={() => onVerDetalle(hab)}
            className="flex-1 text-sm text-slate-600 hover:text-slate-800 font-medium border border-slate-300 hover:border-slate-400 rounded-lg py-1.5 transition-colors">
            {t('habitaciones.ver_detalle')}
          </button>
          <button onClick={() => onReservar(hab)}
            className="flex-1 text-sm bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg py-1.5 transition-colors">
            {t('habitaciones.reservar')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Carrusel hero
// ──────────────────────────────────────────────
function CarruselHero({ imagenes, children }) {
  const [actual, setActual] = useState(0);
  const timerRef = useRef(null);

  const iniciar = () => {
    timerRef.current = setInterval(() => {
      setActual(i => (i + 1) % imagenes.length);
    }, 5000);
  };

  useEffect(() => {
    if (imagenes.length > 1) iniciar();
    return () => clearInterval(timerRef.current);
  }, [imagenes.length]);

  function ir(idx) {
    setActual(idx);
    clearInterval(timerRef.current);
    if (imagenes.length > 1) iniciar();
  }

  function anterior() { ir((actual - 1 + imagenes.length) % imagenes.length); }
  function siguiente() { ir((actual + 1) % imagenes.length); }

  // Sin imágenes: fondo degradado original
  if (imagenes.length === 0) {
    return (
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 text-white py-20 px-4">
        {children}
      </section>
    );
  }

  return (
    <section className="relative h-[580px] md:h-[640px] overflow-hidden text-white">
      {/* Slides */}
      {imagenes.map((img, i) => (
        <div key={i}
          className={`absolute inset-0 transition-opacity duration-1000 ${i === actual ? 'opacity-100' : 'opacity-0'}`}>
          <img src={img.url} alt={img.nombre} className="w-full h-full object-cover" />
          {/* Overlay oscuro para legibilidad del texto */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        </div>
      ))}

      {/* Contenido superpuesto */}
      <div className="relative z-10 h-full flex items-center">
        <div className="w-full py-12 px-4">
          {children}
        </div>
      </div>

      {/* Flechas de navegación */}
      {imagenes.length > 1 && (
        <>
          <button onClick={anterior}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/60 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors backdrop-blur-sm">
            ‹
          </button>
          <button onClick={siguiente}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/60 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors backdrop-blur-sm">
            ›
          </button>
        </>
      )}

      {/* Dots indicadores */}
      {imagenes.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {imagenes.map((_, i) => (
            <button key={i} onClick={() => ir(i)}
              className={`rounded-full transition-all ${i === actual ? 'bg-amber-400 w-6 h-2' : 'bg-white/50 hover:bg-white/80 w-2 h-2'}`} />
          ))}
        </div>
      )}

      {/* Nombre de la habitación */}
      {imagenes[actual]?.nombre && (
        <div className="absolute bottom-10 right-6 z-20 text-xs text-white/60 bg-black/20 px-2 py-1 rounded-full backdrop-blur-sm">
          {imagenes[actual].nombre}
        </div>
      )}
    </section>
  );
}

// ──────────────────────────────────────────────
// Página Inicio
// ──────────────────────────────────────────────
export default function Inicio() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const descuentos = useDescuentos();
  const hoy = new Date().toISOString().split('T')[0];
  const manana = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [form, setForm] = useState({ fecha_entrada: hoy, fecha_salida: manana, adultos: 2, ninos: 0 });
  const [habitaciones, setHabitaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [habDetalle, setHabDetalle] = useState(null);
  const [habCalendario, setHabCalendario] = useState(null);

  useAutoRefresh(() => {
    api.get('/api/web/habitaciones')
      .then(r => setHabitaciones(r.data))
      .finally(() => setCargando(false));
  }, 60000);

  // Imágenes únicas de habitaciones que tengan imagen configurada
  const imagenesCarrusel = habitaciones
    .filter(h => h.imagen)
    .reduce((acc, h) => {
      if (!acc.find(i => i.url === h.imagen))
        acc.push({ url: h.imagen, nombre: h.tipo_nombre });
      return acc;
    }, []);

  function buscar(e) {
    e.preventDefault();
    navigate(`/reservar?${new URLSearchParams(form).toString()}`);
  }

  return (
    <div>
      {/* ── Hero con carrusel ── */}
      <CarruselHero imagenes={imagenesCarrusel}>
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight drop-shadow-lg">{t('hero.titulo')}</h1>
          <p className="text-xl text-slate-200 mb-10 drop-shadow">{t('hero.subtitulo')}</p>

          {/* Buscador */}
          <div className="bg-white rounded-2xl shadow-2xl p-6 text-slate-800 max-w-3xl mx-auto">
            <h2 className="text-base font-semibold mb-4 text-slate-700">{t('buscar.titulo')}</h2>
            <form onSubmit={buscar} className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('buscar.entrada')}</label>
                <input type="date" value={form.fecha_entrada} min={hoy}
                  onChange={e => setForm(f => ({ ...f, fecha_entrada: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('buscar.salida')}</label>
                <input type="date" value={form.fecha_salida} min={form.fecha_entrada}
                  onChange={e => setForm(f => ({ ...f, fecha_salida: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('buscar.adultos')}</label>
                <select value={form.adultos} onChange={e => setForm(f => ({ ...f, adultos: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                  {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('buscar.ninos')}</label>
                <select value={form.ninos} onChange={e => setForm(f => ({ ...f, ninos: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                  {[0,1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <button type="submit"
                className="col-span-2 md:col-span-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-xl transition-colors">
                {t('buscar.buscar')}
              </button>
            </form>
          </div>
        </div>
      </CarruselHero>

      {/* ── Catálogo de habitaciones ── */}
      <section className="py-16 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-800 mb-2">{t('habitaciones.titulo')}</h2>
            <p className="text-slate-500">{t('habitaciones.subtitulo')}</p>
          </div>

          {cargando ? (
            <div className="flex justify-center py-16">
              <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {habitaciones.map(hab => (
                <CardHabitacion key={hab.id} hab={hab}
                  onVerDetalle={setHabDetalle}
                  onReservar={setHabCalendario}
                  descuentos={descuentos}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Por qué elegirnos ── */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-800 mb-10">{t('nosotros.titulo')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: '🏡', title: t('nosotros.familiar'), desc: t('nosotros.familiar_desc') },
              { icon: '📍', title: t('nosotros.ubicacion'), desc: t('nosotros.ubicacion_desc') },
              { icon: '✨', title: t('nosotros.servicios'), desc: t('nosotros.servicios_desc') },
            ].map((item, i) => (
              <div key={i} className="text-center p-6 rounded-2xl border border-slate-100 hover:shadow-md transition-shadow">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">{item.title}</h3>
                <p className="text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modal de detalle */}
      {habDetalle && (
        <ModalHabitacion
          hab={habDetalle}
          busqueda={null}
          onReservar={(hab) => { setHabDetalle(null); setHabCalendario(hab); }}
          onCerrar={() => setHabDetalle(null)}
        />
      )}

      {/* Calendario de reserva */}
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
              adultos: 1,
              ...(senia != null ? { senia } : {}),
            });
            navigate(`/reservar?${params.toString()}`);
          }}
        />
      )}
    </div>
  );
}
