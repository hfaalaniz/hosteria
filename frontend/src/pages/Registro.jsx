import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function Registro() {
  const { setUsuario } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nombre_hosteria: '', email: '', password: '', confirmar: '', nombre_admin: '' });
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState('');

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirmar) { toast.error('Las contraseñas no coinciden'); return; }
    if (form.password.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return; }
    setCargando(true);
    try {
      const { data } = await api.post('/api/tenants/registro', {
        nombre_hosteria: form.nombre_hosteria,
        email: form.email,
        password: form.password,
        nombre_admin: form.nombre_admin || 'Administrador',
      });
      localStorage.setItem('token', data.token);
      setUsuario(data.usuario);
      setAviso(data.aviso);
      toast.success('¡Cuenta creada exitosamente!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear la cuenta');
      setCargando(false);
    }
  }

  if (aviso) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center text-white text-3xl mx-auto mb-4">✓</div>
          <h2 className="text-xl font-bold text-slate-800 mb-4">¡Tu sistema está listo!</h2>
          <p className="text-slate-600 text-sm mb-6 text-left whitespace-pre-line">{aviso}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            Ir al dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">H</div>
          <h1 className="text-2xl font-bold text-slate-800">Crear cuenta</h1>
          <p className="text-slate-500 text-sm mt-1">Registrá tu hostería en el sistema</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la hostería</label>
            <input
              type="text"
              value={form.nombre_hosteria}
              onChange={set('nombre_hosteria')}
              placeholder="Ej: Hostería El Lago"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tu nombre</label>
            <input
              type="text"
              value={form.nombre_admin}
              onChange={set('nombre_admin')}
              placeholder="Ej: Juan García"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Correo electrónico</label>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="tu@email.com"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder="Mínimo 6 caracteres"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar contraseña</label>
            <input
              type="password"
              value={form.confirmar}
              onChange={set('confirmar')}
              placeholder="Repetí la contraseña"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              required
            />
          </div>
          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {cargando ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="text-amber-600 font-medium hover:underline">Iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
}
