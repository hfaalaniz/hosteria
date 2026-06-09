import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import Tabla from '../components/Tabla';
import { EyeIcon, XCircleIcon, PrinterIcon } from '@heroicons/react/24/outline';

function DetalleFactura({ facturaId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (facturaId) api.get(`/facturas/${facturaId}`).then(r => setData(r.data));
  }, [facturaId]);

  if (!data) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4 text-sm" id="factura-print">
      {/* Encabezado */}
      <div className="text-center border-b pb-4">
        <div className="text-xl font-bold text-slate-800">{data.config?.nombre_hosteria || 'Hostería'}</div>
        <div className="text-slate-500">{data.config?.direccion}</div>
        <div className="text-slate-500">{data.config?.telefono} · {data.config?.email}</div>
      </div>

      <div className="flex justify-between items-start">
        <div>
          <div className="font-bold text-lg">{data.numero}</div>
          <div className="text-slate-500">Emitida: {new Date(data.emitida_en).toLocaleString()}</div>
        </div>
        <Badge value={data.estado} label={data.estado} />
      </div>

      {/* Datos del huésped */}
      <div className="bg-slate-50 rounded-lg p-3">
        <div className="font-semibold mb-1">Cliente</div>
        <div>{data.nombre} {data.apellido}</div>
        {data.email && <div className="text-slate-500">{data.email}</div>}
        {data.documento_tipo && <div className="text-slate-500">{data.documento_tipo}: {data.documento_numero}</div>}
      </div>

      {/* Reserva */}
      <div className="bg-slate-50 rounded-lg p-3">
        <div className="font-semibold mb-1">Detalle de estadía</div>
        <div>{data.reserva_codigo} — Hab. {data.habitacion_numero} ({data.tipo_nombre})</div>
        <div className="text-slate-500">{data.fecha_entrada} → {data.fecha_salida} ({data.noches} noches)</div>
      </div>

      {/* Consumos */}
      {data.consumos?.length > 0 && (
        <div>
          <div className="font-semibold mb-1">Servicios adicionales</div>
          <div className="space-y-1">
            {data.consumos.map(c => (
              <div key={c.id} className="flex justify-between text-slate-600">
                <span>{c.descripcion} × {c.cantidad}</span>
                <span>${c.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Totales */}
      <div className="border-t pt-3 space-y-1">
        <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>${data.subtotal.toFixed(2)}</span></div>
        {data.descuento > 0 && <div className="flex justify-between text-green-600"><span>Descuento</span><span>-${data.descuento.toFixed(2)}</span></div>}
        {data.impuestos > 0 && <div className="flex justify-between text-slate-600"><span>Impuestos</span><span>${data.impuestos.toFixed(2)}</span></div>}
        <div className="flex justify-between font-bold text-base border-t pt-2"><span>TOTAL</span><span className="text-amber-600">${data.total.toFixed(2)}</span></div>
        <div className="flex justify-between text-slate-500 text-xs"><span>Método de pago</span><span className="capitalize">{data.metodo_pago}</span></div>
      </div>

      <button onClick={() => window.print()} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg mt-2">
        <PrinterIcon className="w-4 h-4" /> Imprimir
      </button>
    </div>
  );
}

export default function Facturacion() {
  const { t } = useTranslation();
  const [facturas, setFacturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [detalleId, setDetalleId] = useState(null);

  const cargar = () => {
    setCargando(true);
    api.get('/facturas').then(r => setFacturas(Array.isArray(r.data) ? r.data : [])).finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, []);

  async function anular(factura) {
    if (!confirm(`¿Anular la factura ${factura.numero}?`)) return;
    try {
      await api.patch(`/facturas/${factura.id}/anular`);
      toast.success('Factura anulada');
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error');
    }
  }

  const columnas = [
    { key: 'numero', label: 'N° Factura', render: v => <span className="font-mono text-xs">{v}</span> },
    { key: 'huesped_nombre', label: 'Huésped' },
    { key: 'reserva_codigo', label: 'Reserva', render: v => <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{v}</span> },
    { key: 'total', label: 'Total', render: v => <span className="font-bold text-amber-600">${Number(v).toFixed(2)}</span> },
    { key: 'metodo_pago', label: 'Pago', render: v => <span className="capitalize text-xs">{v}</span> },
    { key: 'estado', label: 'Estado', render: v => <Badge value={v} label={t(`facturacion.estados.${v}`)} /> },
    { key: 'emitida_en', label: 'Fecha', render: v => new Date(v).toLocaleDateString() },
  ];

  const totalMes = facturas.filter(f => f.estado === 'pagada').reduce((s, f) => s + f.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800">{t('facturacion.titulo')}</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm">
          Total cobrado: <strong className="text-amber-700">${totalMes.toFixed(2)}</strong>
        </div>
      </div>

      <Tabla columnas={columnas} datos={facturas} cargando={cargando}
        acciones={row => (<>
          <button onClick={() => setDetalleId(row.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600">
            <EyeIcon className="w-3.5 h-3.5" /> Ver
          </button>
          {row.estado !== 'anulada' && (
            <button onClick={() => anular(row)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 rounded-lg text-red-500">
              <XCircleIcon className="w-3.5 h-3.5" /> Anular
            </button>
          )}
        </>)}
      />

      <Modal open={!!detalleId} onClose={() => setDetalleId(null)} title="Detalle de factura">
        {detalleId && <DetalleFactura facturaId={detalleId} />}
      </Modal>
    </div>
  );
}
