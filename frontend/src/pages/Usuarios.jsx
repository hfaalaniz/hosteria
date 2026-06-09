import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Modal from '../components/Modal';
import { useAuth } from '../context/useAuth';
import {
  PlusIcon, PencilIcon, KeyIcon, ShieldCheckIcon,
  UserCircleIcon, CheckCircleIcon, XCircleIcon,
} from '@heroicons/react/24/outline';

const ROLES = [
  { value: 'admin',         label: 'Administrador', color: 'bg-purple-100 text-purple-700' },
  { value: 'recepcion',     label: 'Recepción',      color: 'bg-blue-100 text-blue-700'   },
  { value: 'limpieza',      label: 'Limpieza',       color: 'bg-green-100 text-green-700' },
  { value: 'mantenimiento', label: 'Mantenimiento',  color: 'bg-orange-100 text-orange-700'},
];

function RolBadge({ rol }) {
  const r = ROLES.find(r => r.value === rol) || { label: rol, color: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${r.color}`}>{r.label}</span>
  );
}

function FormUsuario({ datos, onGuardar, onCancelar }) {
  const [form, setForm] = useState({
    nombre: '', email: '', password: '', rol: 'recepcion', activo: 1,
    ...datos,
    password: '', // nunca pre-llenar contraseña
  });
  const esEdicion = !!datos;

  function f(field) { return e => setForm(p => ({ ...p, [field]: e.target.value })); }

  return (
    <form onSubmit={e => { e.preventDefault(); onGuardar(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Nombre completo *</label>
          <input value={form.nombre} onChange={f('nombre')} required
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
          <input type="email" value={form.email} onChange={f('email')} required
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Contraseña {esEdicion ? '(dejar vacío para no cambiar)' : '*'}
          </label>
          <input type="password" value={form.password} onChange={f('password')}
            required={!esEdicion} minLength={esEdicion ? 0 : 6} placeholder={esEdicion ? '••••••' : ''}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          {!esEdicion && <p className="text-xs text-slate-400 mt-1">Mínimo 6 caracteres</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Rol *</label>
          <select value={form.rol} onChange={f('rol')} required
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        {esEdicion && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
            <select value={form.activo} onChange={e => setForm(p => ({ ...p, activo: Number(e.target.value) }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
              <option value={1}>Activo</option>
              <option value={0}>Inactivo</option>
            </select>
          </div>
        )}
      </div>
      <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
        <button type="button" onClick={onCancelar}
          className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
          Cancelar
        </button>
        <button type="submit"
          className="px-5 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg">
          {esEdicion ? 'Guardar cambios' : 'Crear usuario'}
        </button>
      </div>
    </form>
  );
}

function FormPassword({ usuario, onGuardar, onCancelar }) {
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');

  function submit(e) {
    e.preventDefault();
    if (password.length < 6) return toast.error('Mínimo 6 caracteres');
    if (password !== confirmar) return toast.error('Las contraseñas no coinciden');
    onGuardar(password);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-slate-500">Cambiar contraseña de <span className="font-semibold text-slate-700">{usuario.nombre}</span></p>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Nueva contraseña *</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          required minLength={6} autoFocus
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar contraseña *</label>
        <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)}
          required minLength={6}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>
      <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
        <button type="button" onClick={onCancelar}
          className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
          Cancelar
        </button>
        <button type="submit"
          className="px-5 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg">
          Cambiar contraseña
        </button>
      </div>
    </form>
  );
}

export default function Usuarios() {
  const { usuario: yo } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(null); // null | 'nuevo' | {usuario} | {usuario, modo:'password'}

  const esAdmin = yo?.rol === 'admin';

  const cargar = () => {
    setCargando(true);
    api.get('/usuarios').then(r => setUsuarios(r.data)).finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, []);

  async function guardar(form) {
    try {
      if (modal === 'nuevo') {
        await api.post('/usuarios', form);
        toast.success('Usuario creado');
      } else {
        await api.put(`/usuarios/${modal.id}`, form);
        // Si cambió la contraseña también
        if (form.password) {
          await api.patch(`/usuarios/${modal.id}/password`, { password: form.password });
        }
        toast.success('Usuario actualizado');
      }
      setModal(null);
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al guardar');
    }
  }

  async function cambiarPassword(id, password) {
    try {
      await api.patch(`/usuarios/${id}/password`, { password });
      toast.success('Contraseña actualizada');
      setModal(null);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error');
    }
  }

  async function toggleActivo(u) {
    if (u.id === yo?.id) return toast.error('No podés desactivar tu propia cuenta');
    try {
      await api.patch(`/usuarios/${u.id}/activo`, { activo: !u.activo });
      toast.success(u.activo ? 'Usuario desactivado' : 'Usuario activado');
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error');
    }
  }

  const activos = usuarios.filter(u => u.activo).length;

  if (!esAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldCheckIcon className="w-14 h-14 text-slate-300 mb-4" />
        <h2 className="text-lg font-semibold text-slate-600">Acceso restringido</h2>
        <p className="text-sm text-slate-400 mt-1">Solo los administradores pueden gestionar usuarios.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Usuarios del sistema</h1>
          <p className="text-sm text-slate-500 mt-0.5">{activos} activo{activos !== 1 ? 's' : ''} de {usuarios.length} total</p>
        </div>
        <button onClick={() => setModal('nuevo')}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <PlusIcon className="w-4 h-4" /> Nuevo usuario
        </button>
      </div>

      {/* Lista */}
      {cargando ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3 text-left">Usuario</th>
                <th className="px-5 py-3 text-left">Email</th>
                <th className="px-5 py-3 text-left">Rol</th>
                <th className="px-5 py-3 text-left">Estado</th>
                <th className="px-5 py-3 text-left">Creado</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuarios.map(u => (
                <tr key={u.id} className={`hover:bg-slate-50 ${!u.activo ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                        u.rol === 'admin' ? 'bg-purple-500' : u.rol === 'recepcion' ? 'bg-blue-500' : u.rol === 'mantenimiento' ? 'bg-orange-500' : 'bg-green-500'
                      }`}>
                        {u.nombre?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-slate-800">{u.nombre}</div>
                        {u.id === yo?.id && <div className="text-[10px] text-amber-600 font-semibold">Tú</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{u.email}</td>
                  <td className="px-5 py-3"><RolBadge rol={u.rol} /></td>
                  <td className="px-5 py-3">
                    {u.activo
                      ? <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><CheckCircleIcon className="w-4 h-4" /> Activo</span>
                      : <span className="flex items-center gap-1 text-slate-400 text-xs font-medium"><XCircleIcon className="w-4 h-4" /> Inactivo</span>
                    }
                  </td>
                  <td className="px-5 py-3 text-slate-400 text-xs">
                    {u.creado_en ? new Date(u.creado_en).toLocaleDateString('es-AR') : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => setModal(u)} title="Editar"
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => setModal({ ...u, modo: 'password' })} title="Cambiar contraseña"
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600">
                        <KeyIcon className="w-4 h-4" />
                      </button>
                      {u.id !== yo?.id && (
                        <button onClick={() => toggleActivo(u)}
                          title={u.activo ? 'Desactivar' : 'Activar'}
                          className={`p-1.5 rounded-lg ${u.activo ? 'text-slate-400 hover:bg-red-50 hover:text-red-500' : 'text-slate-400 hover:bg-green-50 hover:text-green-600'}`}>
                          {u.activo ? <XCircleIcon className="w-4 h-4" /> : <CheckCircleIcon className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal nuevo/editar */}
      <Modal
        open={!!modal && modal !== 'nuevo' ? !modal.modo : modal === 'nuevo'}
        onClose={() => setModal(null)}
        title={modal === 'nuevo' ? 'Nuevo usuario' : `Editar — ${modal?.nombre}`}
        size="md"
      >
        <FormUsuario
          datos={modal !== 'nuevo' && !modal?.modo ? modal : null}
          onGuardar={guardar}
          onCancelar={() => setModal(null)}
        />
      </Modal>

      {/* Modal cambio de contraseña */}
      <Modal
        open={!!modal?.modo}
        onClose={() => setModal(null)}
        title="Cambiar contraseña"
        size="sm"
      >
        {modal?.modo === 'password' && (
          <FormPassword
            usuario={modal}
            onGuardar={pwd => cambiarPassword(modal.id, pwd)}
            onCancelar={() => setModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}
