# CONECTA EXPRESS | SISTEMA INTEGRAL DE GESTIÓN LOGÍSTICA (TMS + WMS)

Plataforma web empresarial para administrar la operación logística de **Conecta Express** desde la solicitud de recogida en el portal de clientes hasta la asignación de transportadores terceros, recolección física móvil, escaneo continuo de códigos de barras, recepción masiva en bodega, almacenamiento WMS, clasificación/consolidación, despacho con manifiestos, integración preparada con Coordinadora y trazabilidad inmutable.

---

## 1. Identidad Corporativa Aplicada
- **Marca:** CONECTA EXPRESS
- **Color Principal Único:** `#DE1025`
- **Color Secundario:** `#FFFFFF`
- **Escala Neutros:** `#111827` a `#F9FAFB` (sin otros tonos de rojo, sin degradados ni colores decorativos).

---

## 2. Tres Entornos Conectados y Cuentas Iniciales

La contraseña inicial de los perfiles aprovisionados para pruebas operativas es: `Conecta2026*`

| Entorno | Ruta | Usuario Inicial | Rol |
| :--- | :--- | :--- | :--- |
| **A. Portal de Clientes** | `/portal-cliente` | `cliente@industrialandina.co` | `CLIENTE` (Aislado a Industrial Andina S.A.S.) |
| **B. Panel Administrativo CE** | `/admin` | `admin@conectaexpress.co` | `SUPERADMIN` |
| **B. Coordinación Logística** | `/admin` | `coordinador@conectaexpress.co` | `COORDINADOR_LOGISTICO` |
| **B. Operación de Bodega WMS** | `/admin` | `bodega@conectaexpress.co` | `OPERARIO_BODEGA` |
| **B. Despachos y Salidas** | `/admin` | `despachos@conectaexpress.co` | `RESPONSABLE_DESPACHO` |
| **C. Portal Móvil Transportadores** | `/transportador` | `conductor@transmetropolitana.co` | `TRANSPORTADOR_EXTERNO` (Aislado a Transmetropolitana) |

---

## 3. Instalación y Ejecución

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar archivo de variables de entorno (opcional si ya existe .env.local)
cp .env.example .env.local

# 3. Ejecutar servidor de desarrollo (aprovisiona automáticamente las 27 tablas PostgreSQL en ./data/postgres-conecta o en DATABASE_URL)
npm run dev
```

---

## 4. Documentación de API REST Interna

- `POST /api/auth/login` | `POST /api/auth/logout` | `GET /api/auth/session` — Autenticación HMAC-SHA256 HTTP-Only y matriz RBAC.
- `GET /api/dashboard` — Los 15 KPIs ejecutivos y series analíticas por fecha, cliente, ciudad, transportador, servicio y productividad.
- `GET | POST | PATCH /api/recogidas` — Solicitudes de recogida, pre-creación de paquetes internos `CE-AAMM-XXXXXX`, asignación de transportadores, ejecución móvil en ruta con firma digital/fotos y reporte de recogidas fallidas.
- `GET | POST /api/transportadores` — Empresas transportadoras terceras, conductores, vehículos y cumplimiento SLA.
- `POST /api/escaner` — Motor de escaneo continuo con clasificador determinístico A/B/C/D (`GUIA_COORDINADORA`, `GUIA_OTRA_TRANSPORTADORA`, `ROTULO_INTERNO_CE`, `CODIGO_DESCONOCIDO`).
- `GET | POST /api/paquetes` — Identificación interna `CE-...`, rótulos térmicos 4x6" y 4x2", reimpresión auditada con permisos y asociación N:1 con guías externas.
- `GET /api/barcode` — Generador industrial de imágenes PNG `Code 128` y `QR`.
- `GET | POST /api/bodega` — Recepción masiva de bodega (`RBO-...`), inventario WMS (Sedes, Bodegas, Zonas, Pasillos, Estanterías, Niveles, Ubicaciones) y movimientos internos (`MOV-...`).
- `GET | POST /api/despachos` — Consolidación, desconsolidación auditada, creación de despachos (`DSP-...`), manifiestos (`MAN-...`), verificación obligatoria por escaneo en muelle y cierre de salida.
- `GET | POST /api/integraciones` — Adaptador modular Coordinadora / Plataforma Actual de Guías CE, importador Excel/CSV y registro de sincronización.
- `GET | POST /api/trazabilidad` — Eventos de trazabilidad inmutables (protegidos por trigger PostgreSQL `trg_inmutable_eventos_trazabilidad`), Centro de Novedades (`NOV-...`) y Notificaciones.
- `GET | POST | PATCH /api/usuarios` — Gestión de usuarios, 8 roles, permisos y auditoría forense.
