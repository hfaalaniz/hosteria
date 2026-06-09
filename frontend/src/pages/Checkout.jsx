import { useState, useEffect } from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { ArrowLeftOnRectangleIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

function ModalCheckout({ reserva, onConfirmar, onCancelar }) {
  const [consumos, setConsumos] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [nuevoConsumo, setNuevoConsumo] = useState({ servicio_id: '', descripcion: '', cantidad: 1, precio_unitario: '' });
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [descuento, setDescuento] = useState(0);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!reserva) return;
    Promise.all([
      api.get(`/consumos/reserva/${reserva.id}`),
      api.get('/servicios'),
    ]).then(([c, s]) => {
      setConsumos(c.data);
      setServicios(s.data);
    }).catch(() => toast.error('Error al cargar datos del checkout'));
  }, [reserva]);

  // Auto-completar precio al seleccionar servicio
  function onSelectServicio(e) {
    const id = e.target.value;
    const serv = servicios.find(s => String(s.id) === id);
    setNuevoConsumo(nc => ({
      ...nc,
      servicio_id: id,
      descripcion: serv?.nombre || nc.descripcion,
      precio_unitario: serv?.precio || nc.precio_unitario,
    }));
  }

  async function agregarConsumo() {
    if (!nuevoConsumo.descripcion || !nuevoConsumo.precio_unitario) return;
    try {
      await api.post('/consumos', { reserva_id: reserva.id, ...nuevoConsumo });
      const r = await api.get(`/consumos/reserva/${reserva.id}`);
      setConsumos(Array.isArray(r.data) ? r.data : []);
      setNuevoConsumo({ servicio_id: '', descripcion: '', cantidad: 1, precio_unitario: '' });
      toast.success('Consumo agregado');
    } catch (e) {
      toast.error('Error al agregar consumo');
    }
  }

  async function eliminarConsumo(id) {
    await api.delete(`/consumos/${id}`);
    setConsumos(prev => prev.filter(c => c.id !== id));
  }

  const totalConsumos = consumos.reduce((s, c) => s + c.total, 0);
  const subtotal = reserva.precio_total + totalConsumos;
  const totalFinal = subtotal - (descuento || 0);

  async function confirmar() {
    setCargando(true);
    try {
      await onConfirmar({ reserva_id: reserva.id, metodo_pago: metodoPago, descuento, notas: '' });
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-5 text-sm">
      {/* Info reserva */}
      <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-2 gap-2">
        <div><span className="text-slate-500">Huésped:</span> <strong>{reserva.huesped_nombre}</strong></div>
        <div><span className="text-slate-500">Habitación:</span> <strong>Hab. {reserva.habitacion_numero}</strong></div>
        <div><span className="text-slate-500">Estancia:</span> <strong>{reserva.fecha_entrada} → {reserva.fecha_salida}</strong></div>
        <div><span className="text-slate-500">Noches:</span> <strong>{reserva.noches}</strong></div>
        <div><span className="text-slate-500">Alojamiento:</span> <strong>${reserva.precio_total}</strong></div>
      </div>

      {/* Consumos adicionales */}
      <div>
        <h3 className="font-semibold text-slate-700 mb-2">Consumos adicionales</h3>
        {consumos.length > 0 && (
          <div className="space-y-1 mb-3">
            {consumos.map(c => (
              <div key={c.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                <span>{c.descripcion} × {c.cantidad}</span>
                <div className="flex items-center gap-3">
                  <span className="font-medium">${c.total}</span>
                  <button onClick={() => eliminarConsumo(c.id)} className="text-red-400 hover:text-red-600">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Agregar consumo */}
        <div className="border border-dashed border-slate-300 rounded-lg p-3 space-y-2">
          <select value={nuevoConsumo.servicio_id} onChange={onSelectServicio}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400">
            <option value="">Seleccionar servicio predefinido (opcional)</option>
            {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre} — ${s.precio}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <input placeholder="Descripción" value={nuevoConsumo.descripcion} onChange={e => setNuevoConsumo(n => ({ ...n, descripcion: e.target.value }))}
              className="col-span-1 border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400" />
            <input type="number" placeholder="Cant." min="1" value={nuevoConsumo.cantidad} onChange={e => setNuevoConsumo(n => ({ ...n, cantidad: e.target.value }))}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400" />
            <input type="number" placeholder="Precio" value={nuevoConsumo.precio_unitario} onChange={e => setNuevoConsumo(n => ({ ...n, precio_unitario: e.target.value }))}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400" />
          </div>
          <button onClick={agregarConsumo} className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium">
            <PlusIcon className="w-3.5 h-3.5" /> Agregar consumo
          </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="border-t pt-4 space-y-2">
        <div className="flex justify-between"><span>Alojamiento</span><span>${reserva.precio_total}</span></div>
        <div className="flex justify-between"><span>Consumos</span><span>${totalConsumos.toFixed(2)}</span></div>
        <div className="flex justify-between items-center">
          <span>Descuento</span>
          <input type="number" min="0" value={descuento} onChange={e => setDescuento(Number(e.target.value))}
            className="w-24 border border-slate-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-amber-400" />
        </div>
        <div className="flex justify-between font-bold text-base border-t pt-2">
          <span>TOTAL</span><span className="text-amber-600">${totalFinal.toFixed(2)}</span>
        </div>
      </div>

      {/* Método de pago */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Método de pago</label>
        <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
          <option value="efectivo">Efectivo</option>
          <option value="tarjeta">Tarjeta</option>
          <option value="transferencia">Transferencia</option>
        </select>
      </div>

      <div className="flex gap-3 justify-end">
        <button onClick={onCancelar} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancelar</button>
        <button onClick={confirmar} disabled={cargando}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg disabled:opacity-60">
          <ArrowLeftOnRectangleIcon className="w-4 h-4" />
          {cargando ? 'Procesando...' : 'Confirmar checkout y facturar'}
        </button>
      </div>
    </div>
  );
}

export default function Checkout() {
  const { t } = useTranslation();
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [reservaSeleccionada, setReservaSeleccionada] = useState(null);

  const cargar = () => {
    setCargando(true);
    api.get('/reservas?estado=checkin').then(r => setReservas(Array.isArray(r.data) ? r.data : [])).finally(() => setCargando(false));
  };

  useAutoRefresh(cargar, 30000);

  async function hacerCheckout(datos) {
    try {
      // Intentar generar factura; si ya existe, igual hacer checkout de la reserva
      try {
        const r = await api.post('/facturas', datos);
        toast.success(`Checkout completado. Factura ${r.data.numero} — Total: $${r.data.total.toFixed(2)}`);
      } catch (e) {
        if (e.response?.data?.error?.includes('Ya existe')) {
          // Factura ya existe — solo cambiar estado de reserva y habitación
          await api.patch(`/reservas/${datos.reserva_id}/estado`, { estado: 'checkout' });
          toast.success('Checkout realizado (factura ya existía)');
        } else {
          throw e;
        }
      }
      setReservaSeleccionada(null);
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al procesar checkout');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">{t('checkout.titulo')}</h1>

      {cargando ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : reservas.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          No hay huéspedes en casa actualmente
        </div>
      ) : (() => {
          const hoy = new Date().toISOString().split('T')[0];
          const pisos = [...new Set(reservas.map(r => r.habitacion_piso ?? 1))].sort((a, b) => a - b);
          const agrupadasPorPiso = pisos.reduce((acc, p) => {
            acc[p] = reservas.filter(r => (r.habitacion_piso ?? 1) === p);
            return acc;
          }, {});

          return (
            <div className="space-y-6">
              {pisos.map(piso => (
                <div key={piso}>
                  {pisos.length > 1 && (
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-slate-700 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                        Piso {piso}
                      </div>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-4">
                    {agrupadasPorPiso[piso].map(r => {
                      const salidaHoy = r.fecha_salida === hoy;
                      const salidaPasada = r.fecha_salida < hoy;
                      return (
                        <div key={r.id} className={`bg-white rounded-xl border-2 p-3 ${salidaHoy || salidaPasada ? 'border-amber-400' : 'border-slate-200'}`}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 text-sm truncate">{r.huesped_nombre}</div>
                              <div className="text-xs text-slate-500 truncate">Hab. {r.habitacion_numero} — {r.tipo_nombre}</div>
                            </div>
                            {(salidaHoy || salidaPasada) && (
                              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium shrink-0 ml-1">
                                {salidaPasada ? '⚠ Vencida' : 'Hoy'}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-slate-600 mb-3">
                            <div className="whitespace-nowrap">📅 <strong>{r.fecha_entrada}</strong></div>
                            <div className="whitespace-nowrap">📅 <strong>{r.fecha_salida}</strong></div>
                            <div>🌙 <strong>{r.noches}</strong> noches</div>
                            <div>💰 <strong>${r.precio_total}</strong></div>
                          </div>
                          <button onClick={() => setReservaSeleccionada(r)}
                            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors">
                            <ArrowLeftOnRectangleIcon className="w-3.5 h-3.5" /> {t('checkout.generar_factura')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })()
      }

      <Modal open={!!reservaSeleccionada} onClose={() => setReservaSeleccionada(null)} title="Proceso de checkout" size="lg">
        {reservaSeleccionada && (
          <ModalCheckout reserva={reservaSeleccionada} onConfirmar={hacerCheckout} onCancelar={() => setReservaSeleccionada(null)} />
        )}
      </Modal>
    </div>
  );
}
