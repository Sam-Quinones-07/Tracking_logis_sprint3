# Trackline — Tracking Logístico

Backend Spring Boot (`backend/`) y frontend React + Vite + Tailwind (`frontend/`). `node_modules` no se incluye.

## Base de datos

PostgreSQL 17 local, como servicio de Windows que arranca solo (`postgresql-x64-17`):

| Dato | Valor |
|---|---|
| Servidor | `localhost:5432` |
| Base | `tracking_logistico` |
| Usuario / clave | `postgres` / `postgres` |

Estos valores ya están por defecto en `application.properties`, así que no hay que definir variables. Las tablas las crea Hibernate al arrancar (`ddl-auto=update`). Los datos se conservan entre reinicios.

En otro equipo: instala PostgreSQL con esa clave (o define `DB_PASSWORD`). Luego crea la base:

```
psql -U postgres -c "CREATE DATABASE tracking_logistico"
```

### Administrador fijo

`admin@tracking.com` / `admin1234`. En cada arranque el backend lo crea si no existe. Si existe, le restablece el rol Administrador, la clave y el desbloqueo, así nunca se pierde el acceso administrativo. Se puede cambiar con `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Desde Visual Studio Code (lo más fácil)

1. Abre la carpeta `sprint2-TL-main` completa (Archivo → Abrir carpeta).
2. Menú **Terminal → Ejecutar tarea… → "Iniciar todo"** (o `Ctrl+Shift+B`).
3. Cuando el panel del backend muestre `Started LogisticaApplication`, abre http://localhost:8443.

Otras tareas:

- **"Iniciar todo (PostgreSQL + datos de ejemplo)":** carga una sola vez las cuentas `@demo.com` y 12 envíos en la base real.
- **"Backend (H2 en memoria, sin PostgreSQL)":** usa una base en memoria; los datos se borran al detener el backend.
- **"Pruebas backend"**.
- **"Instalar dependencias del frontend":** solo si falta `frontend/node_modules`.

Para detener todo: icono de papelera en cada terminal, o `Ctrl+C`.

Requisitos: Java 25 o superior, Node 20 o superior y PostgreSQL. Maven no hace falta (se usa `mvnw.cmd`).

## Arranque desde la terminal

```
cd backend
mvnw.cmd spring-boot:run
```

```
cd frontend
npm run dev
```

## Modo H2 en memoria (sin PostgreSQL)

Terminal 1 — backend con base H2 en memoria y datos de ejemplo:

```
cd backend
mvnw.cmd spring-boot:test-run -Dspring-boot.run.profiles=h2
```

Terminal 2 — frontend:

```
cd frontend
npm run dev
```

Abre http://localhost:8443 (backend en http://localhost:8080). Los datos se pierden al detener el backend.

### Cuentas de demostración (perfil `h2`, o `DEMO_DATA=true` con PostgreSQL)

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@tracking.com` | `admin1234` |
| Cliente | `cliente@demo.com` / `cliente2@demo.com` | `Demo1234!` |
| Operador logístico | `operador@demo.com` | `Demo1234!` |
| Supervisor logístico | `supervisor@demo.com` | `Demo1234!` |
| Cuenta bloqueada (HU-S-19) | `bloqueado@demo.com` | `Demo1234!` |

Se cargan 12 envíos con historial real: entregados, retrasados, uno cancelado y un grupo ("Lote Medellín"), para que los reportes del supervisor muestren datos.

Sin servidor SMTP, el correo de verificación no se envía: el enlace aparece en el log del backend y en la pantalla de "Revisa tu correo" (recuadro "Modo desarrollo").

## Variables de entorno del backend

| Variable | Por defecto | Uso |
|---|---|---|
| `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` | `jdbc:postgresql://localhost:5432/tracking_logistico` / `postgres` / `postgres` | Conexión a PostgreSQL |
| `JWT_SECRET` | clave de desarrollo | Firma de tokens (mínimo 32 caracteres); obligatoria fuera de desarrollo |
| `JWT_EXPIRATION_MS` | `28800000` (8 h) | Tope absoluto del token; la sesión real se cierra antes por inactividad |
| `SESSION_INACTIVITY_MINUTES` | `5` | HU-S-22: minutos sin actividad antes de cerrar la sesión en el servidor |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@tracking.com` / `admin1234` | Administrador fijo (se restablece en cada arranque) |
| `FRONTEND_URL` | `http://localhost:8443` | Base del enlace de verificación de correo |
| `SPRING_MAIL_HOST`, `SPRING_MAIL_PORT`, `SPRING_MAIL_USERNAME`, `SPRING_MAIL_PASSWORD` | *(sin definir)* | SMTP real (p. ej. `smtp.gmail.com`, `587` y contraseña de aplicación). Sin ellas, modo desarrollo |
| `MAIL_FROM` | `no-reply@trackline.local` | Remitente de los correos |
| `WHATSAPP_NUMBER` | *(vacío)* | HU-18: número en formato internacional sin `+` (p. ej. `573001234567`) |
| `SUPPORT_PHONE` | *(vacío)* | HU-S-19: teléfono de soporte que se muestra al bloquear una cuenta |
| `SUPPORT_HOURS` | Lunes a viernes, 8:00 a. m. a 6:00 p. m. | Horario de atención mostrado al cliente |
| `DEMO_DATA` | `false` | Carga usuarios y envíos de ejemplo (el perfil `h2` lo activa) |
| `PORT` | `8080` | Puerto del backend |

En el frontend, `VITE_API_URL` es opcional (por defecto `http://localhost:8080/api`).

## Pruebas

```
cd backend
mvnw.cmd test
```

22 pruebas, ninguna necesita PostgreSQL. `Sprint3IntegrationTest` recorre con MockMvc el registro con verificación, el reenvío con límite, el cierre de sesión, el cambio de rol auditado, la validación del perfil, los reportes y el contacto.

## Flujo de etapas

`Recibido en origen → En central → En tránsito → En reparto → Entregado`, con `Cancelado` como alternativa desde Recibido en origen o En central.

## Historias implementadas

### Sprint 3

- **HU-S-22 — Cierre de sesión por inactividad.** La sesión vive en el servidor (el JWT lleva su id). Tras 5 minutos sin peticiones el servidor la invalida y responde 401 con el motivo. El frontend avisa 60 s antes con una cuenta regresiva ("Seguir conectado"), y al cerrar muestra una ventana emergente con la razón: inactividad, sesión cerrada o cambio de rol. Cerrar sesión revoca el token en el servidor.
- **HU-S-23 — Verificación de correo.** La cuenta queda pendiente hasta abrir el enlace. El código es aleatorio, se guarda con hash, sirve una sola vez y vence en 24 h. Pedir uno nuevo invalida el anterior, con máximo 3 reenvíos por hora. Las cuentas sin verificar se eliminan a los 7 días. El inicio de sesión de una cuenta sin verificar ofrece reenviar el enlace.
- **HU-06 — Perfil.** Dirección (máx. 200) y ciudad-país (máx. 100) se validan en el servidor y en la interfaz, con contador y error por campo.
- **HU-18 — Contacto por WhatsApp.** Botón con mensaje prellenado (opcionalmente con el número de guía). Si la empresa no configuró el número, la pantalla lo dice en lugar de inventar uno.
- **HU-A-24 / HU-A-25 — Accesibilidad.** Contraste AA en los colores de estado (≥ 4.5:1) y estados con icono y texto, no solo color. Incluye enlace "Saltar al contenido", foco visible, foco al título al cambiar de página, ventanas modales con foco atrapado, anuncios `aria-live` en el tracking, historial como lista ordenada y etiquetas en todos los campos.
- **HU-14 — Tiempos de tránsito.** Desde "Recibido en origen" hasta "Entregado": promedio, mínimo y máximo, y promedio entre cada par de etapas.
- **HU-15 — Envíos retrasados.** Un envío no entregado se considera retrasado cuando supera un máximo de horas según su categoría (`app.delays.max-hours.*`: 72/72/96/120).
- **HU-16 — Volumen.** Total por estado y gráfico de los últimos 7 días.
- **HU-S-21 — Auditoría de cambios de rol.** Se registran el actor, el rol anterior y el nuevo, y los intentos rechazados (rol inválido, asignar Administrador o usuario sin permiso). Un cambio de rol cierra todas las sesiones del usuario afectado.

### Correcciones de sprints anteriores

- **HU-S-19:** cada penalización, bloqueo y desbloqueo queda en el Registro de seguridad (incluido qué administrador desbloqueó). El mensaje de bloqueo incluye el teléfono de soporte.
- HU-03, HU-04/05/17, HU-08, HU-10 a HU-13 y HU-S-20 se conservan como estaban. Sus pantallas se rediseñaron.

## Frontend

Rediseño completo en `frontend/src`:

- `lib/`: cliente de API, estados y formatos.
- `components/ui.tsx`: componentes accesibles.
- `pages/`: una carpeta lógica por rol, con panel de inicio, indicadores y tablas en cada una.
- Tracking con línea de tiempo visual de las etapas.

## Pendiente de validar con el cliente

- **HU-14 / HU-15:** el documento no define la fórmula de tránsito ni la regla de retraso. Las implementadas son una propuesta configurable.
- **WhatsApp y teléfono de soporte:** faltan los números oficiales (los del perfil `h2` son de ejemplo).
- **SMTP:** falta el proveedor de correo real.
- **Centros logísticos:** solo se cargan con el inicializador; no hay pantalla de alta.
