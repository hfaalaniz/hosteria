import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../api/axios';

const PASOS = [
  { icono: '🏨', titulo: 'Panel de administración', desc: 'Gestioná reservas, habitaciones, huéspedes, facturación y más desde un panel centralizado.' },
  { icono: '🌐', titulo: 'Sitio web público', desc: 'Tus huéspedes ven disponibilidad y hacen reservas directamente desde tu web personalizada.' },
  { icono: '👥', titulo: 'Multi-usuario', desc: 'Creá usuarios con roles: recepcionista, limpieza, mantenimiento — cada uno ve solo lo suyo.' },
  { icono: '📊', titulo: 'Reportes y estadísticas', desc: 'Ocupación, ingresos, historial de huéspedes y exportación de datos.' },
];

const MODULOS = [
  'Calendario de reservas', 'Check-in / Check-out', 'Facturación', 'Partes de limpieza',
  'Partes de mantenimiento', 'Gestión de servicios', 'Notificaciones en tiempo real',
  'Exportación iCal', 'Configuración de emails', 'Descuentos por estadía',
];

function CopiarBtn({ text }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }}
      className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors shrink-0"
    >
      {copiado ? '✓ Copiado' : 'Copiar'}
    </button>
  );
}

export default function Demo() {
  const navigate = useNavigate();
  const { setUsuario, cargarTenant } = useAuth();
  const [estado, setEstado] = useState('idle');
  const [resultado, setResultado] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function crearDemo() {
    setEstado('cargando');
    setErrorMsg('');
    const ts = Date.now().toString(36);
    const email = `demo-${ts}@demo.com`;
    const password = `demo${ts}`;
    try {
      const { data } = await api.post('/tenants/registro', {
        nombre_hosteria: `Demo Hostería ${ts}`,
        email,
        password,
        nombre_admin: 'Admin Demo',
      });
      localStorage.setItem('token', data.token);
      setUsuario(data.usuario);
      cargarTenant();
      setResultado({ ...data, _password: password });
      setEstado('ok');
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Error al crear la demo');
      setEstado('error');
    }
  }

  if (estado === 'ok' && resultado) {
    const slug = resultado.tenant?.slug || '';
    const deployCmd = `.\\scripts\\deploy-nuevo-tenant.ps1 -Slug ${slug}`;
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center text-white text-3xl mx-auto mb-3">✓</div>
            <h2 className="text-2xl font-bold text-slate-800">¡Tenant creado!</h2>
            <p className="text-slate-500 text-sm mt-1">Datos de ejemplo listos. Ya podés usar el panel.</p>
          </div>

          <div className="space-y-3 mb-5">
            {/* Acceso inmediato */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">Acceso inmediato — mismo panel</p>
              <p className="text-xs text-green-700 mb-2">
                Podés usar el sistema ahora mismo desde <strong>hosteria-admin.pages.dev</strong> con estas credenciales:
              </p>
              <div className="space-y-1 text-xs font-mono bg-white rounded p-2 border border-green-100">
                <p>Email: <span className="text-slate-800">{resultado.usuario?.email}</span></p>
                <p>Contraseña: <span className="text-slate-800">{resultado._password}</span></p>
              </div>
            </div>

            {/* Deploy propio subdominio */}
            <div className="bg-slate-800 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Para crear subdominio propio (opcional)
              </p>
              <p className="text-xs text-slate-400 mb-3">
                Ejecutá este comando en PowerShell desde la carpeta del proyecto para deployar{' '}
                <span className="text-amber-400 font-mono">{resultado.admin_url}</span> y{' '}
                <span className="text-blue-400 font-mono">{resultado.web_url}</span>:
              </p>
              <div className="flex items-center gap-2 bg-slate-900 rounded-lg px-3 py-2">
                <code className="text-green-400 text-xs flex-1 break-all">{deployCmd}</code>
                <CopiarBtn text={deployCmd} />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              Ir al panel ahora →
            </button>
            <button
              onClick={() => { setEstado('idle'); setResultado(null); }}
              className="border border-slate-300 hover:bg-slate-50 text-slate-600 font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
            >
              Nueva demo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">H</div>
            <span className="text-white font-bold text-lg">Hostería SaaS</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-slate-300 hover:text-white text-sm transition-colors">Iniciar sesión</Link>
            <Link to="/registro" className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Crear cuenta
            </Link>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 py-16 text-center">
        <span className="inline-block bg-amber-500/20 text-amber-300 text-xs font-semibold px-3 py-1 rounded-full mb-4 border border-amber-500/30">
          Sistema completo de gestión
        </span>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
          Administrá tu hostería<br />
          <span className="text-amber-400">de forma profesional</span>
        </h1>
        <p className="text-slate-400 text-lg mb-10 max-w-2xl mx-auto">
          Panel de administración + sitio web público con reservas online. Todo en uno, listo en segundos.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={crearDemo}
            disabled={estado === 'cargando'}
            className="bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold px-8 py-4 rounded-xl text-lg transition-colors shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2"
          >
            {estado === 'cargando' ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creando demo...
              </>
            ) : (
              'Probar demo gratis →'
            )}
          </button>
          <Link to="/registro"
            className="border border-white/20 hover:border-white/40 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-colors">
            Crear mi cuenta real
          </Link>
        </div>

        {estado === 'error' && (
          <p className="mt-4 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 inline-block">
            {errorMsg}
          </p>
        )}

        <p className="text-slate-500 text-xs mt-4">Sin tarjeta de crédito · Datos de prueba incluidos · Acceso inmediato</p>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-6 pb-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {PASOS.map((p, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="text-3xl mb-3">{p.icono}</div>
              <h3 className="text-white font-semibold mb-1 text-sm">{p.titulo}</h3>
              <p className="text-slate-400 text-xs leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-white font-bold text-lg mb-4 text-center">Todo lo que incluye</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {MODULOS.map((m, i) => (
              <div key={i} className="flex items-center gap-2 text-slate-300 text-sm">
                <span className="text-green-400 font-bold">✓</span>
                {m}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-12">
          <p className="text-slate-400 text-sm mb-4">¿Listo para empezar con tu hostería real?</p>
          <Link to="/registro"
            className="inline-block bg-amber-500 hover:bg-amber-600 text-white font-bold px-8 py-3 rounded-xl transition-colors">
            Crear mi cuenta →
          </Link>
        </div>
      </div>
    </div>
  );
}
