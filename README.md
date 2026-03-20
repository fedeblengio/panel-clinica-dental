# Panel Admin - Clínica Dental

Panel web de administración para la clínica dental. Permite gestionar pacientes y citas desde una interfaz simple y fácil de usar, conectada a PostgreSQL.

## Funcionalidades

- **Dashboard** - Resumen con citas del día, próximas citas y total de pacientes
- **Pacientes** - Crear, editar, eliminar y buscar pacientes por nombre, teléfono o email
- **Citas** - Crear, editar, eliminar y filtrar citas por fecha y estado
- **Login** - Acceso protegido con usuario y contraseña
- **Diseño accesible** - Letra grande, botones claros, colores suaves

## Requisitos

- Node.js 18+ (o Docker)
- PostgreSQL con las tablas `pacientes` y `citas` ya creadas

## Configuración

### Variables de entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL | `postgresql://humberto:PASSWORD@humberto_proyect_postgres_sql:5432/clinica` |
| `ADMIN_USER` | Usuario del panel | `admin` |
| `ADMIN_PASS` | Contraseña del panel | `tu_contraseña_segura` |
| `SESSION_SECRET` | Clave para sesiones | `una_clave_random_larga_123` |
| `PORT` | Puerto del servidor | `3000` |

## Deploy en EasyPanel

### Opción 1: Desde GitHub (recomendado)

1. En EasyPanel, ir a **Projects** → tu proyecto → **+ New Service** → **App**
2. Conectar con GitHub y seleccionar este repositorio
3. Configurar:
   - **Build Path**: `/` (raíz del repo)
   - **Port**: `3000`
4. Ir a la pestaña **Environment** y agregar las variables:
   ```
   DATABASE_URL=postgresql://humberto:TU_PASSWORD@humberto_proyect_postgres_sql:5432/clinica
   ADMIN_USER=admin
   ADMIN_PASS=tu_contraseña_segura
   SESSION_SECRET=cambiar_por_algo_random_largo
   PORT=3000
   ```
5. Click en **Deploy**
6. En la pestaña **Domains**, EasyPanel asigna un dominio automático. También podés agregar uno custom.

### Opción 2: Docker manual

```bash
docker build -t panel-clinica .
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://humberto:PASSWORD@host:5432/clinica" \
  -e ADMIN_USER=admin \
  -e ADMIN_PASS=tu_contraseña \
  -e SESSION_SECRET=clave_random \
  panel-clinica
```

## Desarrollo local

```bash
npm install
DATABASE_URL="postgresql://usuario:pass@localhost:5432/clinica" npm run dev
```

Abrí `http://localhost:3000` en el navegador.

## Esquema de base de datos

Las tablas deben existir en PostgreSQL antes de usar el panel:

```sql
CREATE TABLE pacientes (
  id SERIAL PRIMARY KEY,
  telefono VARCHAR(20) UNIQUE NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  email VARCHAR(200),
  fecha_nacimiento VARCHAR(20),
  notas TEXT DEFAULT '',
  fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE citas (
  id SERIAL PRIMARY KEY,
  event_id_google VARCHAR(200),
  paciente_telefono VARCHAR(20) NOT NULL REFERENCES pacientes(telefono),
  paciente_nombre VARCHAR(200) NOT NULL,
  fecha_cita DATE NOT NULL,
  hora_cita TIME NOT NULL,
  tipo_cita VARCHAR(100) NOT NULL,
  estado VARCHAR(50) DEFAULT 'Pendiente',
  notas TEXT DEFAULT '',
  recordatorio_24h BOOLEAN DEFAULT FALSE,
  recordatorio_1h BOOLEAN DEFAULT FALSE,
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Stack

- **Backend**: Node.js + Express
- **Vistas**: EJS templates
- **Base de datos**: PostgreSQL
- **Auth**: express-session con cookie
- **Deploy**: Docker / EasyPanel
