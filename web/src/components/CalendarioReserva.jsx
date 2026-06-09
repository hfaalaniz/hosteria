import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { descuentoPara, precioConDescuento } from '../utils/descuentos';
import { useDescuentos } from '../hooks/useDescuentos';

// ── Utilidades de fecha ──────────────────────────────────────────────────────
function toStr(d) {
  return d.toISOString().split('T')[0];
}
function fromStr(s) {
  return new Date(s + 'T00:00:00');
}
function addDays(s, n) {
  const d = fromStr(s);
  d.setDate(d.getDate() + n);
  return toStr(d);
}
function daysBetween(a, b) {
  return Math.round((fromStr(b) - fromStr(a)) / 86400000);
}
function esFinde(dateStr) {
  const d = fromStr(dateStr).getDay();
  return d === 0 || d === 6;
}
function formatLargo(dateStr) {
  return fromStr(dateStr).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}
function formatCorto(dateStr) {
  return fromStr(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Feriados nacionales argentinos fijos (MM-DD) — ampliable
const FERIADOS_FIJOS = new Set([
  '01-01','02-24','02-25','03-24','04-02','04-18','04-19',
  '05-01','05-25','06-20','07-09','08-17','10-12','11-20',
  '12-08','12-25',
]);
function esFeriado(dateStr) {
  return FERIADOS_FIJOS.has(dateStr.slice(5));
}
function esEspecial(dateStr) {
  return esFinde(dateStr) || esFeriado(dateStr);
}

// Días de antelación mínima para cancelar
function diasAntelacionCancelacion(dateStr) {
  return esEspecial(dateStr) ? 5 : 3;
}

// ── Calendario mensual ───────────────────────────────────────────────────────
function MesCalendario({ year, month, diasOcupados, inicio, fin, hover, hoy, onDiaClick, onDiaHover }) {
  const primerDia = new Date(year, month, 1);
  const ultimoDia = new Date(year, month + 1, 0);

  // Ajuste: semana empieza en lunes (0=lunes … 6=domingo)
  const offsetInicio = (primerDia.getDay() + 6) % 7;
  const totalCeldas = offsetInicio + ultimoDia.getDate();
  const filas = Math.ceil(totalCeldas / 7);

  const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const mesNombre = primerDia.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  return (
    <div className="select-none">
      <div className="text-center text-sm font-bold text-slate-700 capitalize mb-3">{mesNombre}</div>
      <div className="grid grid-cols-7 mb-1">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className={`text-center text-[11px] font-semibold py-1 ${i === 6 ? 'text-green-600' : 'text-slate-400'}`}>{d}</div>
        ))}
      </div>
      {Array.from({ length: filas }, (_, fila) => (
        <div key={fila} className="grid grid-cols-7">
          {Array.from({ length: 7 }, (_, col) => {
            const idx = fila * 7 + col;
            const diaNum = idx - offsetInicio + 1;
            if (diaNum < 1 || diaNum > ultimoDia.getDate()) {
              return <div key={col} />;
            }
            const dateStr = toStr(new Date(year, month, diaNum));
            const pasado = dateStr < hoy;
            const ocupado = diasOcupados.has(dateStr);
            const domingo = fromStr(dateStr).getDay() === 0;
            const feriado = esFeriado(dateStr);
            const especial = domingo || feriado; // círculo verde
            const esInicio = dateStr === inicio;
            const esFin = dateStr === fin;
            const enRango = inicio && fin && dateStr > inicio && dateStr < fin;
            const enHover = inicio && !fin && hover && dateStr > inicio && dateStr <= hover;
            const deshabilitado = pasado || ocupado;

            let clases = 'relative h-9 w-9 mx-auto flex items-center justify-center text-sm font-semibold transition-all rounded-full ';

            if (esInicio || esFin) {
              // Día seleccionado — ámbar
              clases += 'bg-amber-500 text-white z-10 ';
            } else if (enRango || enHover) {
              // Dentro del rango — fondo ámbar suave, sin círculo completo
              clases += 'bg-amber-100 text-amber-800 rounded-none ';
            } else if (ocupado) {
              // Ocupado — círculo rojo
              clases += 'bg-red-500 text-white cursor-not-allowed line-through ';
            } else if (pasado) {
              // Pasado — gris sin círculo
              clases += 'text-slate-300 cursor-not-allowed rounded-none ';
            } else if (especial) {
              // Domingo o feriado — círculo verde
              clases += 'bg-green-500 text-white cursor-pointer hover:bg-green-600 ';
            } else {
              // Disponible normal — círculo azul
              clases += 'bg-blue-500 text-white cursor-pointer hover:bg-blue-600 ';
            }

            return (
              <div key={col} className="relative flex flex-col items-center justify-center h-10"
                onClick={() => !deshabilitado && onDiaClick(dateStr)}
                onMouseEnter={() => !deshabilitado && onDiaHover(dateStr)}
                title={feriado ? 'Feriado nacional' : domingo ? 'Domingo' : ''}>
                <div className={clases}>{diaNum}</div>
                {feriado && !ocupado && !pasado && (
                  <span className="absolute bottom-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Modal principal ──────────────────────────────────────────────────────────
export default function CalendarioReserva({ hab, onConfirmar, onCerrar }) {
  const { t } = useTranslation();
  const hoy = toStr(new Date());
  const descuentos = useDescuentos();

  const [mesBase, setMesBase] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [diasOcupados, setDiasOcupados] = useState(new Set());
  const [cargando, setCargando] = useState(true);
  const [inicio, setInicio] = useState(null);
  const [fin, setFin] = useState(null);
  const [hover, setHover] = useState(null);
  const [confirmando, setConfirmando] = useState(false);

  // Cargar días ocupados
  useEffect(() => {
    setCargando(true);
    api.get(`/api/web/ocupacion/${hab.id}`)
      .then(r => setDiasOcupados(new Set(r.data.dias_ocupados)))
      .finally(() => setCargando(false));
  }, [hab.id]);

  // Mes siguiente para mostrar dos meses
  const mesS = (() => {
    let m = mesBase.month + 1;
    let y = mesBase.year;
    if (m > 11) { m = 0; y++; }
    return { year: y, month: m };
  })();

  function anteriorMes() {
    setMesBase(prev => {
      let m = prev.month - 1;
      let y = prev.year;
      if (m < 0) { m = 11; y--; }
      return { year: y, month: m };
    });
  }
  function siguienteMes() {
    setMesBase(prev => {
      let m = prev.month + 1;
      let y = prev.year;
      if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
  }

  function handleDiaClick(dateStr) {
    if (!inicio || (inicio && fin)) {
      // Iniciar nueva selección
      setInicio(dateStr);
      setFin(null);
      setHover(null);
    } else {
      // Completar rango
      if (dateStr <= inicio) {
        setInicio(dateStr);
        setFin(null);
        return;
      }
      // Verificar que no haya días ocupados en el rango
      let d = addDays(inicio, 1);
      while (d < dateStr) {
        if (diasOcupados.has(d)) {
          // Hay un día ocupado en el rango — reiniciar desde este día
          setInicio(dateStr);
          setFin(null);
          return;
        }
        d = addDays(d, 1);
      }
      setFin(dateStr);
      setHover(null);
    }
  }

  function handleDiaHover(dateStr) {
    if (inicio && !fin) setHover(dateStr);
  }

  // Calcular precio total del rango
  const noches = inicio && fin ? daysBetween(inicio, fin) : 0;
  const tieneFindeEnRango = (() => {
    if (!inicio || !fin) return false;
    let d = inicio;
    while (d < fin) {
      if (esEspecial(d)) return true;
      d = addDays(d, 1);
    }
    return false;
  })();

  // Precio base por noche (finde/feriado tiene tarifa propia)
  const precioNocheBase = tieneFindeEnRango && hab.precio_fin_semana
    ? hab.precio_fin_semana
    : hab.precio_noche;

  // Aplicar descuento por cantidad de noches
  const { precio: precioNoche, descuento } = precioConDescuento(precioNocheBase, noches, descuentos);
  const precioTotal = Math.round(precioNoche * noches * 100) / 100;

  // Política de cancelación aplicable
  const diasAntelacion = inicio ? diasAntelacionCancelacion(inicio) : 2;
  const fechaLimiteCancelacion = inicio ? addDays(inicio, -diasAntelacion) : null;

  function limpiar() {
    setInicio(null);
    setFin(null);
    setHover(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={onCerrar}>
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10 rounded-t-3xl sm:rounded-t-2xl">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">Elegir fechas</h2>
            <p className="text-sm text-slate-500">{hab.tipo_nombre} · Hab. {hab.numero} · <span className="font-semibold text-amber-600">${hab.precio_noche}/noche</span></p>
          </div>
          <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 text-lg font-bold">×</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Descuentos disponibles */}
          {descuentos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {[...descuentos].sort((a, b) => a.desde - b.desde).map(d => (
                <span key={d.desde} className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${noches >= d.desde ? 'bg-green-100 text-green-700 border-green-300' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                  {d.desde}+ noches → {d.pct}% off
                </span>
              ))}
            </div>
          )}

          {/* Leyenda */}
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-blue-500 inline-block" /> Disponible</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-red-500 inline-block" /> Ocupado</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-green-500 inline-block" /> Domingo / Feriado</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-amber-500 inline-block" /> Seleccionado</span>
            <span className="flex items-center gap-1.5 relative"><span className="w-4 h-4 rounded-full bg-green-500 inline-block" /><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block -ml-2 -mb-2" /> Feriado (punto rojo)</span>
          </div>

          {cargando ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Navegación */}
              <div className="flex items-center justify-between mb-2">
                <button onClick={anteriorMes}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-300 hover:bg-slate-50 text-slate-600 text-lg">‹</button>
                <div className="flex-1" />
                <button onClick={siguienteMes}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-300 hover:bg-slate-50 text-slate-600 text-lg">›</button>
              </div>

              {/* Dos meses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <MesCalendario
                  year={mesBase.year} month={mesBase.month}
                  diasOcupados={diasOcupados}
                  inicio={inicio} fin={fin} hover={hover} hoy={hoy}
                  onDiaClick={handleDiaClick} onDiaHover={handleDiaHover}
                />
                <MesCalendario
                  year={mesS.year} month={mesS.month}
                  diasOcupados={diasOcupados}
                  inicio={inicio} fin={fin} hover={hover} hoy={hoy}
                  onDiaClick={handleDiaClick} onDiaHover={handleDiaHover}
                />
              </div>

              {/* Instrucción */}
              <p className="text-center text-xs text-slate-400">
                {!inicio ? 'Tocá el día de llegada' : !fin ? 'Ahora elegí el día de salida' : ''}
              </p>
            </>
          )}

          {/* Resumen del rango seleccionado */}
          {inicio && fin && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-amber-600 font-semibold uppercase tracking-wider mb-0.5">Llegada</div>
                  <div className="font-bold text-slate-800 capitalize">{formatLargo(inicio)}</div>
                </div>
                <div>
                  <div className="text-xs text-amber-600 font-semibold uppercase tracking-wider mb-0.5">Salida</div>
                  <div className="font-bold text-slate-800 capitalize">{formatLargo(fin)}</div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-amber-200 pt-3">
                <div className="text-sm text-slate-600">
                  <div>
                    {noches} {noches === 1 ? 'noche' : 'noches'} × ${precioNoche}
                    {tieneFindeEnRango && <span className="ml-1 text-xs text-amber-600">(tarifa finde/feriado)</span>}
                  </div>
                  {descuento && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs line-through text-slate-400">${precioNocheBase}/noche</span>
                      <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                        🏷 {descuento.label}
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-xl font-bold text-amber-700">${precioTotal}</div>
              </div>

              {/* Política de cancelación */}
              <div className="bg-white border border-amber-100 rounded-xl px-3 py-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Política de cancelación: </span>
                {esEspecial(inicio)
                  ? `Fin de semana o feriado — cancelando antes del ${formatCorto(fechaLimiteCancelacion)} (5 días antes) no se te cobra el total y se te devuelve la seña.`
                  : `Cancelando antes del ${formatCorto(fechaLimiteCancelacion)} (3 días antes) no se te cobra el total y se te devuelve la seña.`
                }
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-1">
                <button onClick={limpiar}
                  className="px-4 py-2.5 border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 text-sm font-medium">
                  Cambiar fechas
                </button>
                <button
                  onClick={() => setConfirmando(true)}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl transition-colors text-sm">
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {/* Solo inicio seleccionado */}
          {inicio && !fin && (
            <div className="text-center py-2">
              <p className="text-sm text-slate-500">
                Llegada: <strong className="text-slate-800 capitalize">{formatLargo(inicio)}</strong>
              </p>
              <p className="text-xs text-slate-400 mt-1">Seleccioná el día de salida</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal de confirmación ── */}
      {confirmando && inicio && fin && (() => {
        const senia = Math.round(precioTotal * 0.10 * 100) / 100;
        const restante = Math.round((precioTotal - senia) * 100) / 100;
        return (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70"
            onClick={() => setConfirmando(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-y-auto max-h-[90vh]"
              onClick={e => e.stopPropagation()}>

              <div className="p-6 space-y-4">
                <div className="text-center">
                  <div className="text-4xl mb-2">🏨</div>
                  <h3 className="text-xl font-bold text-slate-800 mb-0.5">¿Confirmás tu estancia?</h3>
                  <p className="text-sm text-slate-500">{hab.tipo_nombre} · Hab. {hab.numero}</p>
                </div>

                {/* Resumen fechas y precio */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Llegada</span>
                    <span className="font-semibold text-slate-800">{formatCorto(inicio)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Salida</span>
                    <span className="font-semibold text-slate-800">{formatCorto(fin)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{noches} {noches === 1 ? 'noche' : 'noches'} × ${precioNoche}</span>
                    <span className="font-bold text-amber-600">${precioTotal}</span>
                  </div>
                  {descuento && (
                    <div className="flex justify-between text-green-600 text-xs font-semibold">
                      <span>🏷 {descuento.label}</span>
                      <span>− ${Math.round((precioNocheBase - precioNoche) * noches * 100) / 100}</span>
                    </div>
                  )}
                </div>

                {/* Seña */}
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">💳</span>
                    <span className="font-bold text-amber-800 text-sm">Seña requerida (10%)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-700">Seña a abonar ahora</span>
                    <span className="font-bold text-amber-800 text-base">${senia}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-700">Saldo al llegar</span>
                    <span className="font-semibold text-amber-700">${restante}</span>
                  </div>
                  <p className="text-xs text-amber-600 border-t border-amber-200 pt-2 mt-1 leading-relaxed">
                    La hostería se comunicará con vos para coordinar el pago de la seña. Sin seña confirmada, la reserva no queda garantizada.
                  </p>
                </div>

                {/* Política cancelación */}
                <div className={`rounded-xl p-3 text-xs leading-relaxed border ${esEspecial(inicio) ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  <p className="font-bold mb-1">⚠️ Política de cancelación</p>
                  {esEspecial(inicio) ? (
                    <p>Esta reserva incluye <strong>fin de semana o feriado</strong>. Si cancelás antes del <strong>{formatCorto(fechaLimiteCancelacion)}</strong> (5 días antes), no se te cobra el total y <strong>se te devuelve la seña</strong>.</p>
                  ) : (
                    <p>Si cancelás antes del <strong>{formatCorto(fechaLimiteCancelacion)}</strong> (3 días antes de tu llegada), no se te cobra el total y <strong>se te devuelve la seña</strong>.</p>
                  )}
                  <p className="mt-1.5 font-semibold text-red-600">
                    ❌ Cancelando con menos antelación, <strong>la seña no se reintegra</strong>.
                  </p>
                </div>

                <div className="flex gap-3 pt-1">
                  <button onClick={() => setConfirmando(false)}
                    className="flex-1 py-2.5 border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 text-sm font-medium">
                    Volver
                  </button>
                  <button
                    onClick={() => {
                      setConfirmando(false);
                      onConfirmar({ fecha_entrada: inicio, fecha_salida: fin, noches, precio_noche: precioNoche, precio_total: precioTotal, senia });
                    }}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl transition-colors text-sm">
                    Sí, reservar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
