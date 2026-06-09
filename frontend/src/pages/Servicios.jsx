import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Modal from '../components/Modal';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

const CATEGORIAS = ['desayuno', 'almuerzo', 'cena', 'lavanderia', 'transporte', 'otro'];

const CAT_ICONS = {
  desayuno: '🍳', almuerzo: '🍽️', cena: '🌙', lavanderia: '👕', transporte: '🚗', otro: '✨',
};

function FormServicio({ datos, onGuardar, onCancelar }) {
  const [form, setForm] = useState(datos || { nombre: '', descripcion: '', precio: '', categoria: 'otro', activo: 1 });

  return (
    <form onSubmit={e => { e.preventDefault(); onGuardar(form); }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
        <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
        <input value={form.descripcion || ''} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Precio *</label>
          <input type="number" step="0.01" value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} required
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
          <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
            {CATEGORIAS.map(c => <option key={c} value={c}>{CAT_ICONS[c]} {c}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancelar} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancelar</button>
        <button type="submit" className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg">Guardar</button>
      </div>
    </form>
  );
}

export default function Servicios() {
  const { t } = useTranslation();
  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(null);
  const [categoriaFiltro, setCategoriaFiltro] = useState('');

  const cargar = () => {
    setCargando(true);
    const q = categoriaFiltro ? `?categoria=${categoriaFiltro}` : '';
    api.get(`/servicios${q}`).then(r => setServicios(Array.isArray(r.data) ? r.data : [])).finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, [categoriaFiltro]);

  async function guardar(form) {
    try {
      if (modal === 'nuevo') {
        await api.post('/servicios', form);
        toast.success('Servicio creado');
      } else {
        await api.put(`/servicios/${modal.id}`, form);
        toast.success('Servicio actualizado');
      }
      setModal(null);
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error');
    }
  }

  async function eliminar(s) {
    if (!confirm(`¿Desactivar "${s.nombre}"?`)) return;
    await api.delete(`/servicios/${s.id}`);
    toast.success('Servicio desactivado');
    cargar();
  }

  const agrupados = CATEGORIAS.map(cat => ({
    cat,
    items: servicios.filter(s => s.categoria === cat),
  })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800">{t('servicios.titulo')}</h1>
        <button onClick={() => setModal('nuevo')} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <PlusIcon className="w-4 h-4" /> Nuevo servicio
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setCategoriaFiltro('')} className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${!categoriaFiltro ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
          Todos
        </button>
        {CATEGORIAS.map(c => (
          <button key={c} onClick={() => setCategoriaFiltro(c === categoriaFiltro ? '' : c)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${categoriaFiltro === c ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
            {CAT_ICONS[c]} {t(`servicios.categorias.${c}`)}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-6">
          {agrupados.map(({ cat, items }) => (
            <div key={cat}>
              <h2 className="text-base font-semibold text-slate-700 mb-3">{CAT_ICONS[cat]} {t(`servicios.categorias.${cat}`)}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(s => (
                  <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="font-semibold text-slate-800">{s.nombre}</div>
                      <div className="text-lg font-bold text-amber-600">${s.precio}</div>
                    </div>
                    {s.descripcion && <div className="text-sm text-slate-500">{s.descripcion}</div>}
                    <div className="flex gap-2 mt-auto pt-2">
                      <button onClick={() => setModal(s)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600">
                        <PencilIcon className="w-3.5 h-3.5" /> Editar
                      </button>
                      <button onClick={() => eliminar(s)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 rounded-lg text-red-500">
                        <TrashIcon className="w-3.5 h-3.5" /> Desactivar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {agrupados.length === 0 && <p className="text-slate-400 text-center py-8">No hay servicios registrados</p>}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'nuevo' ? 'Nuevo servicio' : 'Editar servicio'}>
        <FormServicio datos={modal !== 'nuevo' ? modal : null} onGuardar={guardar} onCancelar={() => setModal(null)} />
      </Modal>
    </div>
  );
}
