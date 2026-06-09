# Hostería — Sistema de Gestión Hotelera

Sistema completo de gestión para hosterías y hoteles pequeños. Incluye panel de administración para el personal, sitio web público con reservas online y sincronización con canales externos (Booking.com, Airbnb).

## Tecnologías

| Capa | Stack |
|------|-------|
| Backend | Node.js · Express 5 · SQLite (better-sqlite3) |
| Admin | React 19 · Vite · TailwindCSS 4 · React Router 7 |
| Web pública | React 19 · Vite · TailwindCSS 4 |
| Auth | JWT + control de acceso por roles |
| Extras | Nodemailer · Multer · iCal sync · i18next |

---

## Estructura del proyecto

```
hosteria/
├── backend/        # API REST (puerto 5000)
├── frontend/       # Panel de administración (puerto 3000)
├── web/            # Sitio público de reservas (puerto 4001)
└── start.bat       # Lanza los tres servicios simultáneamente
```

---

## Instalación

### Requisitos
- Node.js 18+
- npm

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/hosteria.git
cd hosteria

# 2. Instalar dependencias en cada módulo
cd backend && npm install
cd ../frontend && npm install
cd ../web && npm install
```

### Configurar el backend

Crear el archivo `backend/.env`:

```env
PORT=5000
JWT_SECRET=cambiar_esta_clave_en_produccion
DB_PATH=./hosteria.db
```

> El archivo `.env` no se sube al repositorio. Usá el ejemplo de arriba como base.

---

## Iniciar el sistema

### Opción A — Script automático (Windows)

```
start.bat
```

Abre tres terminales: backend, frontend y web pública.

### Opción B — Manual

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Admin
cd frontend && npm run dev

# Terminal 3 — Web pública
cd web && npm run dev
```

| Servicio | URL |
|----------|-----|
| API | http://localhost:5000 |
| Panel admin | http://localhost:3000 |
| Web pública | http://localhost:4001 |

### Usuario administrador por defecto

```
Email:    admin@hosteria.com
Password: admin123
```

> Cambiar la contraseña inmediatamente después del primer inicio de sesión.

---

## Funcionalidades

### Panel de administración

- **Dashboard** — estadísticas de ocupación, ingresos y check-ins del día
- **Calendario** — vista visual de todas las reservas
- **Habitaciones** — gestión de habitaciones, estados y tipos
- **Reservas** — crear, editar, extender y cancelar reservas
- **Check-in / Check-out** — procesamiento de llegadas y salidas con escáner QR
- **Huéspedes** — perfiles, documentos y historial de estadías
- **Facturación** — generación de facturas y registro de pagos
- **Servicios** — cargos adicionales (comidas, traslados, lavandería, etc.)
- **Mantenimiento** — solicitudes y partes de trabajo
- **Limpieza** — partes diarios por turno (mañana / tarde / noche)
- **Reportes** — estadísticas de ocupación e ingresos
- **Configuración** — SMTP, moneda, políticas de cancelación
- **Usuarios y roles** — gestión del personal con permisos granulares

### Sitio web público

- Catálogo de habitaciones con fotos, amenidades y precios
- Calendario de disponibilidad
- Sistema de descuentos por cantidad de noches
- Formulario de reserva con datos del huésped
- Página de seguimiento de reserva existente

### Integraciones

- **iCal sync** — importa reservas desde Booking.com y Airbnb automáticamente
- **Notificaciones por email** — confirmaciones y recordatorios vía SMTP configurable

---

## Roles del personal

| Rol | Acceso |
|-----|--------|
| `admin` | Acceso completo al sistema |
| `recepcion` | Reservas, check-in/out, facturación, huéspedes |
| `limpieza` | Partes de limpieza y estado de habitaciones |
| `mantenimiento` | Partes de mantenimiento y solicitudes |

---

## API

La API REST corre en `http://localhost:5000/api`. Endpoints principales:

```
POST   /api/auth/login
GET    /api/dashboard
GET    /api/habitaciones
GET    /api/reservas
POST   /api/reservas
GET    /api/huespedes
POST   /api/checkin/:id
POST   /api/checkout/:id
GET    /api/reportes
GET    /ical/:habitacion_id    ← feed público iCal
```

Todos los endpoints (excepto `/api/auth` y los de la web pública) requieren el header:

```
Authorization: Bearer <token>
```

---

## Base de datos

SQLite con modo WAL. El archivo `hosteria.db` se crea automáticamente al iniciar el backend por primera vez. Las migraciones se aplican en cada inicio.

Tablas principales: `usuarios`, `habitaciones`, `tipos_habitacion`, `reservas`, `huespedes`, `consumos`, `facturas`, `servicios`, `mantenimiento`, `partes_limpieza`, `partes_mantenimiento`, `ical_feeds`, `notificaciones`, `configuracion`.

---

## Licencia

MIT
