-- ============================================================================
-- CONECTA EXPRESS | SISTEMA INTEGRAL DE GESTIÓN LOGÍSTICA (TMS + WMS)
-- MIGRACIÓN 001: ESQUEMA RELACIONAL NORMALIZADO EN POSTGRESQL (3FN)
-- ============================================================================

-- 1. TABLA DE USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    email VARCHAR(180) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    nombre_completo VARCHAR(180) NOT NULL,
    telefono VARCHAR(50),
    cargo VARCHAR(100),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    cliente_id TEXT,
    transportador_id TEXT,
    ultimo_acceso TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_aislamiento_tenant CHECK (
        NOT (cliente_id IS NOT NULL AND transportador_id IS NOT NULL)
    )
);

-- 2. TABLA DE ROLES
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    codigo VARCHAR(60) NOT NULL UNIQUE,
    nombre VARCHAR(120) NOT NULL,
    descripcion TEXT,
    nivel_jerarquia INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABLA DE PERMISOS
CREATE TABLE IF NOT EXISTS permisos (
    id TEXT PRIMARY KEY,
    modulo VARCHAR(80) NOT NULL,
    accion VARCHAR(80) NOT NULL,
    clave VARCHAR(160) NOT NULL UNIQUE,
    descripcion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ROLES_PERMISOS y USUARIOS_ROLES
CREATE TABLE IF NOT EXISTS roles_permisos (
    rol_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permiso_id TEXT NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
    PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE IF NOT EXISTS usuarios_roles (
    usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    rol_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    asignado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (usuario_id, rol_id)
);

-- 5. TABLA DE CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
    id TEXT PRIMARY KEY,
    codigo_cliente VARCHAR(40) NOT NULL UNIQUE,
    razon_social VARCHAR(200) NOT NULL,
    nit VARCHAR(40) NOT NULL UNIQUE,
    digito_verificacion VARCHAR(2),
    nombre_comercial VARCHAR(200),
    email_corporativo VARCHAR(180) NOT NULL,
    telefono_principal VARCHAR(50) NOT NULL,
    ciudad_principal VARCHAR(100) NOT NULL,
    direccion_principal TEXT NOT NULL,
    servicios_habilitados TEXT NOT NULL DEFAULT 'PAQUETERIA,CARGA_MASIVA,CROSS_DOCKING',
    sla_recogida_horas INTEGER NOT NULL DEFAULT 4,
    requiere_cita_bodega BOOLEAN NOT NULL DEFAULT FALSE,
    estado VARCHAR(30) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'SUSPENDIDO', 'INACTIVO')),
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABLA DE TRANSPORTADORES TERCEROS
CREATE TABLE IF NOT EXISTS transportadores (
    id TEXT PRIMARY KEY,
    codigo_transportador VARCHAR(40) NOT NULL UNIQUE,
    razon_social VARCHAR(200) NOT NULL,
    nit VARCHAR(40) NOT NULL UNIQUE,
    representante_legal VARCHAR(180),
    telefono_operaciones VARCHAR(50) NOT NULL,
    email_operaciones VARCHAR(180) NOT NULL,
    direccion VARCHAR(250) NOT NULL,
    ciudad_base VARCHAR(100) NOT NULL,
    zonas_cobertura TEXT NOT NULL,
    servicios_prestados TEXT NOT NULL DEFAULT 'RECOGIDA_URBANA,TRASLADO_BODEGA,ULTIMA_MILLA',
    calificacion_promedio NUMERIC(4,2) NOT NULL DEFAULT 5.00,
    cumplimiento_sla_pct NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    documentacion_al_dia BOOLEAN NOT NULL DEFAULT TRUE,
    poliza_responsabilidad VARCHAR(100),
    vencimiento_poliza DATE,
    estado VARCHAR(30) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'SUSPENDIDO', 'INACTIVO')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Añadir claves foráneas diferidas a usuarios
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS fk_usuarios_cliente;
ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS fk_usuarios_transportador;
ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_transportador FOREIGN KEY (transportador_id) REFERENCES transportadores(id) ON DELETE SET NULL;

-- 7. TABLA DE CONTACTOS (Clientes y Transportadores)
CREATE TABLE IF NOT EXISTS contactos (
    id TEXT PRIMARY KEY,
    cliente_id TEXT REFERENCES clientes(id) ON DELETE CASCADE,
    transportador_id TEXT REFERENCES transportadores(id) ON DELETE CASCADE,
    nombre_completo VARCHAR(180) NOT NULL,
    cargo VARCHAR(100),
    telefono VARCHAR(50) NOT NULL,
    email VARCHAR(180),
    ciudad VARCHAR(100),
    es_principal BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. TABLA DE DIRECCIONES (Frecuentes y Sedes de Clientes)
CREATE TABLE IF NOT EXISTS direcciones (
    id TEXT PRIMARY KEY,
    cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    alias VARCHAR(120) NOT NULL,
    direccion_completa VARCHAR(280) NOT NULL,
    complemento VARCHAR(150),
    barrio VARCHAR(120),
    ciudad VARCHAR(100) NOT NULL,
    departamento VARCHAR(100) NOT NULL,
    zona_logistica VARCHAR(80) NOT NULL DEFAULT 'ZONA_CENTRO',
    codigo_dane VARCHAR(20),
    latitud NUMERIC(10,7),
    longitud NUMERIC(10,7),
    contacto_local_nombre VARCHAR(160),
    contacto_local_telefono VARCHAR(50),
    horario_atencion VARCHAR(120) DEFAULT '08:00 - 17:30',
    es_frecuente BOOLEAN NOT NULL DEFAULT TRUE,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. TABLA DE CONDUCTORES
CREATE TABLE IF NOT EXISTS conductores (
    id TEXT PRIMARY KEY,
    transportador_id TEXT NOT NULL REFERENCES transportadores(id) ON DELETE CASCADE,
    usuario_id TEXT UNIQUE REFERENCES usuarios(id) ON DELETE SET NULL,
    cedula VARCHAR(30) NOT NULL UNIQUE,
    nombre_completo VARCHAR(180) NOT NULL,
    telefono VARCHAR(50) NOT NULL,
    email VARCHAR(180),
    licencia_numero VARCHAR(50) NOT NULL,
    licencia_categoria VARCHAR(15) NOT NULL DEFAULT 'C1',
    licencia_vencimiento DATE NOT NULL,
    arl_entidad VARCHAR(100) NOT NULL,
    arl_vencimiento DATE NOT NULL,
    estado_operativo VARCHAR(30) NOT NULL DEFAULT 'DISPONIBLE' CHECK (estado_operativo IN ('DISPONIBLE', 'EN_RUTA', 'INACTIVO', 'SUSPENDIDO')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. TABLA DE VEHÍCULOS
CREATE TABLE IF NOT EXISTS vehiculos (
    id TEXT PRIMARY KEY,
    transportador_id TEXT NOT NULL REFERENCES transportadores(id) ON DELETE CASCADE,
    conductor_habitual_id TEXT REFERENCES conductores(id) ON DELETE SET NULL,
    placa VARCHAR(15) NOT NULL UNIQUE,
    tipo_vehiculo VARCHAR(50) NOT NULL CHECK (tipo_vehiculo IN ('MOTO', 'VAN_CARGA', 'CARRY', 'FURGON_NHR', 'TURBO_NPR', 'SENCILLO', 'PATINETA')),
    marca_modelo VARCHAR(100) NOT NULL,
    capacidad_kg NUMERIC(10,2) NOT NULL,
    capacidad_m3 NUMERIC(10,2) NOT NULL,
    soat_numero VARCHAR(60) NOT NULL,
    soat_vencimiento DATE NOT NULL,
    tecnomecanica_numero VARCHAR(60) NOT NULL,
    tecnomecanica_vencimiento DATE NOT NULL,
    gps_activo BOOLEAN NOT NULL DEFAULT TRUE,
    estado VARCHAR(30) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'MANTENIMIENTO', 'INACTIVO')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. TABLA DE SOLICITUDES DE RECOGIDA
-- Estados de Recogida (Separados de Bodega y Despacho):
-- SOLICITUD_RECIBIDA, PENDIENTE_PROGRAMACION, PROGRAMADA, ASIGNADA, ACEPTADA,
-- EN_CAMINO, EN_PUNTO_RECOGIDA, RECOGIDA_COMPLETADA, RECOGIDA_FALLIDA, REPROGRAMADA, CANCELADA
CREATE TABLE IF NOT EXISTS solicitudes_recogida (
    id TEXT PRIMARY KEY,
    consecutivo VARCHAR(40) NOT NULL UNIQUE,
    cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    direccion_recogida_id TEXT REFERENCES direcciones(id) ON DELETE SET NULL,
    direccion_texto VARCHAR(280) NOT NULL,
    ciudad VARCHAR(100) NOT NULL,
    departamento VARCHAR(100) NOT NULL DEFAULT 'Cundinamarca',
    zona_logistica VARCHAR(80) NOT NULL DEFAULT 'ZONA_NORTE',
    latitud NUMERIC(10,7),
    longitud NUMERIC(10,7),
    contacto_nombre VARCHAR(180) NOT NULL,
    contacto_telefono VARCHAR(50) NOT NULL,
    contacto_email VARCHAR(180),
    fecha_solicitada DATE NOT NULL,
    fecha_programada DATE,
    franja_horaria VARCHAR(60) NOT NULL DEFAULT '08:00 - 12:00',
    cantidad_estimada_paquetes INTEGER NOT NULL CHECK (cantidad_estimada_paquetes > 0),
    cantidad_recogida_real INTEGER NOT NULL DEFAULT 0,
    tipo_mercancia VARCHAR(120) NOT NULL,
    tipo_servicio VARCHAR(80) NOT NULL DEFAULT 'ESTANDAR_CONECTA',
    peso_estimado_kg NUMERIC(10,2) NOT NULL DEFAULT 1.00,
    dimensiones_estimadas VARCHAR(120),
    valor_declarado_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    observaciones TEXT,
    prioridad VARCHAR(20) NOT NULL DEFAULT 'NORMAL' CHECK (prioridad IN ('BAJA', 'NORMAL', 'ALTA', 'CRITICA')),
    transportador_asignado_id TEXT REFERENCES transportadores(id) ON DELETE SET NULL,
    conductor_asignado_id TEXT REFERENCES conductores(id) ON DELETE SET NULL,
    vehiculo_asignado_id TEXT REFERENCES vehiculos(id) ON DELETE SET NULL,
    responsable_conecta_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_por_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
    origen_solicitud VARCHAR(30) NOT NULL DEFAULT 'PORTAL_CLIENTE' CHECK (origen_solicitud IN ('PORTAL_CLIENTE', 'ADMIN_INTERNO', 'API')),
    estado_recogida VARCHAR(40) NOT NULL DEFAULT 'SOLICITUD_RECIBIDA' CHECK (
        estado_recogida IN (
            'SOLICITUD_RECIBIDA',
            'PENDIENTE_PROGRAMACION',
            'PROGRAMADA',
            'ASIGNADA',
            'ACEPTADA',
            'EN_CAMINO',
            'EN_PUNTO_RECOGIDA',
            'RECOGIDA_COMPLETADA',
            'RECOGIDA_FALLIDA',
            'REPROGRAMADA',
            'CANCELADA'
        )
    ),
    motivo_fallo_o_cancelacion TEXT,
    firma_recibido_cliente_data TEXT,
    nombre_quien_entrega VARCHAR(180),
    documento_quien_entrega VARCHAR(40),
    fecha_cierre_recogida TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. TABLA DE ASIGNACIONES A TRANSPORTADORES
CREATE TABLE IF NOT EXISTS asignaciones (
    id TEXT PRIMARY KEY,
    consecutivo_orden VARCHAR(40) NOT NULL UNIQUE,
    solicitud_id TEXT NOT NULL REFERENCES solicitudes_recogida(id) ON DELETE CASCADE,
    transportador_id TEXT NOT NULL REFERENCES transportadores(id) ON DELETE RESTRICT,
    conductor_id TEXT REFERENCES conductores(id) ON DELETE SET NULL,
    vehiculo_id TEXT REFERENCES vehiculos(id) ON DELETE SET NULL,
    asignado_por_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_programada DATE NOT NULL,
    franja_horaria VARCHAR(60) NOT NULL,
    estado_asignacion VARCHAR(40) NOT NULL DEFAULT 'ASIGNADA' CHECK (
        estado_asignacion IN ('ASIGNADA', 'ACEPTADA', 'EN_DESPLAZAMIENTO', 'EN_SITIO', 'COMPLETADA', 'FALLIDA', 'REASIGNADA', 'CANCELADA')
    ),
    fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_aceptacion TIMESTAMPTZ,
    fecha_inicio_desplazamiento TIMESTAMPTZ,
    fecha_llegada_sitio TIMESTAMPTZ,
    fecha_finalizacion TIMESTAMPTZ,
    latitud_evento NUMERIC(10,7),
    longitud_evento NUMERIC(10,7),
    unidades_recolectadas INTEGER NOT NULL DEFAULT 0,
    firma_remitente_data TEXT,
    nombre_firmante VARCHAR(180),
    cedula_firmante VARCHAR(40),
    observaciones_conductor TEXT,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. BODEGAS, ZONAS Y UBICACIONES (WMS - MÓDULO 9)
CREATE TABLE IF NOT EXISTS bodegas (
    id TEXT PRIMARY KEY,
    sede VARCHAR(100) NOT NULL,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(160) NOT NULL,
    ciudad VARCHAR(100) NOT NULL,
    direccion VARCHAR(250) NOT NULL,
    responsable_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
    capacidad_total_paquetes INTEGER NOT NULL DEFAULT 5000,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zonas (
    id TEXT PRIMARY KEY,
    bodega_id TEXT NOT NULL REFERENCES bodegas(id) ON DELETE CASCADE,
    codigo VARCHAR(30) NOT NULL,
    nombre VARCHAR(140) NOT NULL,
    tipo_zona VARCHAR(40) NOT NULL CHECK (
        tipo_zona IN ('RECEPCION', 'ALMACENAMIENTO', 'CLASIFICACION', 'CONSOLIDACION', 'DESPACHO', 'NOVEDADES_CUARENTENA')
    ),
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (bodega_id, codigo)
);

CREATE TABLE IF NOT EXISTS ubicaciones (
    id TEXT PRIMARY KEY,
    bodega_id TEXT NOT NULL REFERENCES bodegas(id) ON DELETE CASCADE,
    zona_id TEXT NOT NULL REFERENCES zonas(id) ON DELETE CASCADE,
    codigo_ubicacion VARCHAR(60) NOT NULL UNIQUE,
    codigo_barras_ubicacion VARCHAR(60) NOT NULL UNIQUE,
    pasillo VARCHAR(20) NOT NULL,
    estanteria VARCHAR(20) NOT NULL,
    nivel VARCHAR(20) NOT NULL,
    posicion VARCHAR(20) NOT NULL DEFAULT '01',
    capacidad_max_paquetes INTEGER NOT NULL DEFAULT 50,
    ocupacion_actual INTEGER NOT NULL DEFAULT 0,
    bloqueada BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. DESPACHOS (MÓDULO 11)
-- Estados de Despacho (Separados de Recogida y Bodega):
-- PENDIENTE, EN_PREPARACION, CONSOLIDADO, GUIA_GENERADA, LISTO_PARA_DESPACHO,
-- ENTREGADO_AL_TRANSPORTADOR, EN_TRANSITO, ENTREGADO, DEVUELTO
CREATE TABLE IF NOT EXISTS despachos (
    id TEXT PRIMARY KEY,
    consecutivo VARCHAR(40) NOT NULL UNIQUE,
    bodega_origen_id TEXT NOT NULL REFERENCES bodegas(id) ON DELETE RESTRICT,
    transportadora_aliada VARCHAR(80) NOT NULL DEFAULT 'COORDINADORA',
    transportador_tercero_id TEXT REFERENCES transportadores(id) ON DELETE SET NULL,
    ciudad_destino VARCHAR(100) NOT NULL,
    departamento_destino VARCHAR(100) NOT NULL DEFAULT 'Nacional',
    cliente_consolidado_id TEXT REFERENCES clientes(id) ON DELETE SET NULL,
    tipo_servicio VARCHAR(80) NOT NULL DEFAULT 'TERRESTRE_NACIONAL',
    fecha_programada_salida DATE NOT NULL,
    total_paquetes_incluidos INTEGER NOT NULL DEFAULT 0,
    total_paquetes_verificados INTEGER NOT NULL DEFAULT 0,
    peso_total_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
    estado_despacho VARCHAR(40) NOT NULL DEFAULT 'PENDIENTE' CHECK (
        estado_despacho IN (
            'PENDIENTE',
            'EN_PREPARACION',
            'CONSOLIDADO',
            'GUIA_GENERADA',
            'LISTO_PARA_DESPACHO',
            'ENTREGADO_AL_TRANSPORTADOR',
            'EN_TRANSITO',
            'ENTREGADO',
            'DEVUELTO'
        )
    ),
    responsable_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
    placa_vehiculo_transportadora VARCHAR(20),
    conductor_transportadora_nombre VARCHAR(180),
    conductor_transportadora_cedula VARCHAR(40),
    precinto_seguridad VARCHAR(60),
    firma_conductor_entrega TEXT,
    autorizado_con_diferencias_por TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
    motivo_autorizacion_diferencias TEXT,
    observaciones TEXT,
    fecha_cierre_despacho TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. PAQUETES (MÓDULO 7: Entidad Física Central con 3 Dimensiones de Estado Separadas)
-- Estados de Bodega:
-- SIN_INGRESO, PENDIENTE_RECEPCION, RECIBIDO, EN_VERIFICACION, CONFORME, CON_NOVEDAD, CLASIFICADO, ALMACENADO
CREATE TABLE IF NOT EXISTS paquetes (
    id TEXT PRIMARY KEY,
    identificador_interno VARCHAR(40) NOT NULL UNIQUE, -- Ej. CE-2611-000001
    solicitud_recogida_id TEXT REFERENCES solicitudes_recogida(id) ON DELETE SET NULL,
    cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    remitente_nombre VARCHAR(180) NOT NULL,
    remitente_telefono VARCHAR(50),
    remitente_direccion VARCHAR(250) NOT NULL,
    remitente_ciudad VARCHAR(100) NOT NULL,
    destinatario_nombre VARCHAR(180) NOT NULL,
    destinatario_telefono VARCHAR(50) NOT NULL,
    destinatario_direccion VARCHAR(250) NOT NULL,
    destinatario_ciudad VARCHAR(100) NOT NULL,
    destinatario_departamento VARCHAR(100) NOT NULL DEFAULT 'Cundinamarca',
    destinatario_codigo_dane VARCHAR(20),
    contenido_declarado VARCHAR(250) NOT NULL,
    tipo_mercancia VARCHAR(100) NOT NULL DEFAULT 'PAQUETERIA_ESTANDAR',
    tipo_servicio VARCHAR(80) NOT NULL DEFAULT 'ESTANDAR',
    unidad_numero INTEGER NOT NULL DEFAULT 1,
    total_unidades_lote INTEGER NOT NULL DEFAULT 1,
    peso_kg NUMERIC(10,2) NOT NULL DEFAULT 1.00,
    largo_cm NUMERIC(8,2) NOT NULL DEFAULT 20.00,
    ancho_cm NUMERIC(8,2) NOT NULL DEFAULT 20.00,
    alto_cm NUMERIC(8,2) NOT NULL DEFAULT 20.00,
    peso_volumetrico_kg NUMERIC(10,2) NOT NULL DEFAULT 1.60,
    valor_declarado NUMERIC(14,2) NOT NULL DEFAULT 50000,
    bodega_actual_id TEXT REFERENCES bodegas(id) ON DELETE SET NULL,
    zona_actual_id TEXT REFERENCES zonas(id) ON DELETE SET NULL,
    ubicacion_actual_id TEXT REFERENCES ubicaciones(id) ON DELETE SET NULL,
    despacho_actual_id TEXT REFERENCES despachos(id) ON DELETE SET NULL,
    guia_externa_principal VARCHAR(80),
    transportadora_principal VARCHAR(80) DEFAULT 'COORDINADORA',
    -- LAS 3 DIMENSIONES DE ESTADO SEPARADAS POR REGLA OPERATIVA:
    estado_recogida VARCHAR(40) NOT NULL DEFAULT 'SOLICITUD_RECIBIDA' CHECK (
        estado_recogida IN (
            'SOLICITUD_RECIBIDA',
            'PENDIENTE_PROGRAMACION',
            'PROGRAMADA',
            'ASIGNADA',
            'ACEPTADA',
            'EN_CAMINO',
            'EN_PUNTO_RECOGIDA',
            'RECOGIDA_COMPLETADA',
            'RECOGIDA_FALLIDA',
            'REPROGRAMADA',
            'CANCELADA'
        )
    ),
    estado_bodega VARCHAR(40) NOT NULL DEFAULT 'PENDIENTE_RECEPCION' CHECK (
        estado_bodega IN (
            'PENDIENTE_RECEPCION',
            'RECIBIDO',
            'EN_VERIFICACION',
            'CONFORME',
            'CON_NOVEDAD',
            'CLASIFICADO',
            'ALMACENADO'
        )
    ),
    estado_despacho VARCHAR(40) NOT NULL DEFAULT 'PENDIENTE' CHECK (
        estado_despacho IN (
            'PENDIENTE',
            'EN_PREPARACION',
            'CONSOLIDADO',
            'GUIA_GENERADA',
            'LISTO_PARA_DESPACHO',
            'ENTREGADO_AL_TRANSPORTADOR',
            'EN_TRANSITO',
            'ENTREGADO',
            'DEVUELTO'
        )
    ),
    recogido_verificado BOOLEAN NOT NULL DEFAULT FALSE,
    recibido_bodega_verificado BOOLEAN NOT NULL DEFAULT FALSE,
    despacho_salida_verificado BOOLEAN NOT NULL DEFAULT FALSE,
    es_mercancia_no_identificada BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_recogida_fisica TIMESTAMPTZ,
    fecha_recepcion_bodega TIMESTAMPTZ,
    fecha_ubicacion_bodega TIMESTAMPTZ,
    fecha_salida_despacho TIMESTAMPTZ,
    fecha_entrega_final TIMESTAMPTZ,
    observaciones TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. RÓTULOS INTERNOS CONECTA EXPRESS (MÓDULO 7)
CREATE TABLE IF NOT EXISTS rotulos_internos (
    id TEXT PRIMARY KEY,
    paquete_id TEXT NOT NULL UNIQUE REFERENCES paquetes(id) ON DELETE CASCADE,
    codigo_barras_code128 VARCHAR(60) NOT NULL UNIQUE,
    contenido_qr TEXT NOT NULL,
    formato_etiqueta VARCHAR(20) NOT NULL DEFAULT '4X6' CHECK (formato_etiqueta IN ('4X6', '4X2')),
    contador_impresiones INTEGER NOT NULL DEFAULT 1,
    generado_por_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
    ultima_reimpresion_por_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
    motivo_reimpresion TEXT,
    ultima_impresion_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. GUÍAS EXTERNAS (Relación N:1 con Paquete - Entidades Distintas)
CREATE TABLE IF NOT EXISTS guias_externas (
    id TEXT PRIMARY KEY,
    paquete_id TEXT NOT NULL REFERENCES paquetes(id) ON DELETE CASCADE,
    transportadora VARCHAR(60) NOT NULL DEFAULT 'COORDINADORA',
    numero_guia VARCHAR(80) NOT NULL,
    codigo_barras_rotulo VARCHAR(100),
    prefijo_servicio VARCHAR(40),
    estado_actual_transportadora VARCHAR(100) NOT NULL DEFAULT 'GENERADA',
    origen_vinculacion VARCHAR(40) NOT NULL DEFAULT 'PLATAFORMA_ACTUAL' CHECK (
        origen_vinculacion IN ('PLATAFORMA_ACTUAL', 'API_COORDINADORA', 'ESCANEO_FISICO', 'IMPORTACION_EXCEL_CSV', 'CARGA_MANUAL')
    ),
    url_pdf_rotulo_original TEXT,
    es_guia_activa BOOLEAN NOT NULL DEFAULT TRUE,
    datos_raw_json TEXT,
    ultima_sincronizacion_at TIMESTAMPTZ,
    registrado_por_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (transportadora, numero_guia)
);

-- 18. RECEPCIONES EN BODEGA (MÓDULO 8)
CREATE TABLE IF NOT EXISTS recepciones (
    id TEXT PRIMARY KEY,
    consecutivo VARCHAR(40) NOT NULL UNIQUE,
    bodega_id TEXT NOT NULL REFERENCES bodegas(id) ON DELETE RESTRICT,
    solicitud_recogida_id TEXT REFERENCES solicitudes_recogida(id) ON DELETE SET NULL,
    asignacion_id TEXT REFERENCES asignaciones(id) ON DELETE SET NULL,
    cliente_id TEXT REFERENCES clientes(id) ON DELETE SET NULL,
    transportador_id TEXT REFERENCES transportadores(id) ON DELETE SET NULL,
    conductor_id TEXT REFERENCES conductores(id) ON DELETE SET NULL,
    placa_vehiculo VARCHAR(20),
    recibido_por_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    unidades_esperadas INTEGER NOT NULL DEFAULT 0,
    unidades_escaneadas_conformes INTEGER NOT NULL DEFAULT 0,
    unidades_faltantes INTEGER NOT NULL DEFAULT 0,
    unidades_sobrantes INTEGER NOT NULL DEFAULT 0,
    unidades_averiadas INTEGER NOT NULL DEFAULT 0,
    unidades_no_identificadas INTEGER NOT NULL DEFAULT 0,
    estado_recepcion VARCHAR(40) NOT NULL DEFAULT 'EN_PROCESO' CHECK (
        estado_recepcion IN ('EN_PROCESO', 'CERRADA_CONFORME', 'CERRADA_CON_NOVEDAD')
    ),
    observaciones TEXT,
    firma_responsable_bodega TEXT,
    firma_conductor_entrega TEXT,
    fecha_apertura TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_cierre TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recepciones_detalle (
    id TEXT PRIMARY KEY,
    recepcion_id TEXT NOT NULL REFERENCES recepciones(id) ON DELETE CASCADE,
    paquete_id TEXT REFERENCES paquetes(id) ON DELETE SET NULL,
    codigo_leido VARCHAR(100) NOT NULL,
    clasificacion_lectura VARCHAR(40) NOT NULL CHECK (
        clasificacion_lectura IN ('GUIA_COORDINADORA', 'GUIA_OTRA_TRANSPORTADORA', 'ROTULO_INTERNO_CE', 'CODIGO_DESCONOCIDO')
    ),
    estado_fisico VARCHAR(40) NOT NULL DEFAULT 'CONFORME' CHECK (
        estado_fisico IN ('CONFORME', 'AVERIADO', 'SOBRANTE', 'NO_IDENTIFICADO', 'FALTANTE')
    ),
    observacion_item TEXT,
    escaneado_por_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. MOVIMIENTOS DE INVENTARIO (WMS - MÓDULO 9 & 10)
CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id TEXT PRIMARY KEY,
    consecutivo_movimiento VARCHAR(40) NOT NULL UNIQUE,
    paquete_id TEXT NOT NULL REFERENCES paquetes(id) ON DELETE CASCADE,
    bodega_id TEXT NOT NULL REFERENCES bodegas(id) ON DELETE RESTRICT,
    ubicacion_origen_id TEXT REFERENCES ubicaciones(id) ON DELETE SET NULL,
    ubicacion_destino_id TEXT REFERENCES ubicaciones(id) ON DELETE SET NULL,
    tipo_movimiento VARCHAR(40) NOT NULL CHECK (
        tipo_movimiento IN (
            'INGRESO_RECEPCION',
            'UBICACION_ESTANTERIA',
            'TRASLADO_INTERNO',
            'CLASIFICACION_ZONA',
            'CONSOLIDACION_DESPACHO',
            'DESCONSOLIDACION_AUDITORIA',
            'SALIDA_DESPACHO',
            'REINGRESO_DEVOLUCION'
        )
    ),
    motivo TEXT,
    ejecutado_por_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    metodo_captura VARCHAR(20) NOT NULL DEFAULT 'ESCANER' CHECK (metodo_captura IN ('ESCANER', 'MANUAL')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. MANIFIESTOS Y DETALLE DE DESPACHOS (MÓDULO 10 & 11)
CREATE TABLE IF NOT EXISTS despachos_paquetes (
    id TEXT PRIMARY KEY,
    despacho_id TEXT NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
    paquete_id TEXT NOT NULL REFERENCES paquetes(id) ON DELETE RESTRICT,
    estado_en_despacho VARCHAR(40) NOT NULL DEFAULT 'CONSOLIDADO' CHECK (
        estado_en_despacho IN ('CONSOLIDADO', 'ESCANEADO_SALIDA_OK', 'DESCONSOLIDADO')
    ),
    escaneado_salida BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_escaneo_salida TIMESTAMPTZ,
    escaneado_por_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_desconsolidacion TIMESTAMPTZ,
    desconsolidado_por_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
    motivo_desconsolidacion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (despacho_id, paquete_id)
);

CREATE TABLE IF NOT EXISTS manifiestos (
    id TEXT PRIMARY KEY,
    numero_manifiesto VARCHAR(50) NOT NULL UNIQUE,
    despacho_id TEXT NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
    transportadora VARCHAR(80) NOT NULL,
    ciudad_destino VARCHAR(100) NOT NULL,
    total_paquetes INTEGER NOT NULL,
    peso_total_kg NUMERIC(12,2) NOT NULL,
    hash_verificacion VARCHAR(128) NOT NULL,
    generado_por_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    datos_snapshot_json TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 21. EVENTOS DE TRAZABILIDAD INMUTABLES (MÓDULO 13)
CREATE TABLE IF NOT EXISTS eventos_trazabilidad (
    id TEXT PRIMARY KEY,
    paquete_id TEXT REFERENCES paquetes(id) ON DELETE RESTRICT,
    solicitud_id TEXT REFERENCES solicitudes_recogida(id) ON DELETE RESTRICT,
    recepcion_id TEXT REFERENCES recepciones(id) ON DELETE RESTRICT,
    despacho_id TEXT REFERENCES despachos(id) ON DELETE RESTRICT,
    tipo_evento VARCHAR(50) NOT NULL CHECK (
        tipo_evento IN (
            'SOLICITUD',
            'PROGRAMACION',
            'ASIGNACION',
            'ACEPTACION_TRANSPORTADOR',
            'DESPLAZAMIENTO_RECOGIDA',
            'LLEGADA_PUNTO_RECOGIDA',
            'RECOGIDA',
            'ESCANEO',
            'RECEPCION',
            'CLASIFICACION',
            'ALMACENAMIENTO',
            'TRASLADO_INTERNO',
            'PREPARACION',
            'DESCONSOLIDACION',
            'DESPACHO',
            'ENTREGA_TRANSPORTADOR',
            'EVENTO_SEGUIMIENTO',
            'ENTREGA_FINAL',
            'DEVOLUCION',
            'NOVEDAD'
        )
    ),
    dimension_estado VARCHAR(30) NOT NULL DEFAULT 'GENERAL' CHECK (
        dimension_estado IN ('RECOGIDA', 'BODEGA', 'DESPACHO', 'GENERAL')
    ),
    estado_anterior VARCHAR(60),
    estado_nuevo VARCHAR(60) NOT NULL,
    usuario_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
    usuario_nombre VARCHAR(180) NOT NULL,
    rol_usuario VARCHAR(80) NOT NULL,
    ubicacion_texto VARCHAR(200),
    latitud NUMERIC(10,7),
    longitud NUMERIC(10,7),
    observaciones TEXT NOT NULL,
    evidencia_id TEXT,
    origen_evento VARCHAR(30) NOT NULL DEFAULT 'MANUAL' CHECK (
        origen_evento IN ('MANUAL', 'ESCANER', 'INTEGRACION')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 22. NOVEDADES E INCIDENCIAS (MÓDULO 14)
CREATE TABLE IF NOT EXISTS novedades (
    id TEXT PRIMARY KEY,
    consecutivo VARCHAR(40) NOT NULL UNIQUE,
    tipo_novedad VARCHAR(60) NOT NULL CHECK (
        tipo_novedad IN (
            'CLIENTE_AUSENTE',
            'DIRECCION_INCORRECTA',
            'MERCANCIA_NO_PREPARADA',
            'RECOGIDA_FALLIDA',
            'DIFERENCIA_DE_UNIDADES',
            'PAQUETE_AVERIADO',
            'CODIGO_ILEGIBLE',
            'PAQUETE_SIN_IDENTIFICAR',
            'FALTANTE',
            'SOBRANTE',
            'RETRASO',
            'ERROR_DE_DESPACHO',
            'DEVOLUCION',
            'OTRAS'
        )
    ),
    prioridad VARCHAR(20) NOT NULL DEFAULT 'ALTA' CHECK (prioridad IN ('BAJA', 'MEDIA', 'ALTA', 'CRITICA')),
    estado_novedad VARCHAR(30) NOT NULL DEFAULT 'ABIERTA' CHECK (
        estado_novedad IN ('ABIERTA', 'EN_GESTION', 'PENDIENTE_CLIENTE', 'RESUELTA', 'CERRADA')
    ),
    solicitud_id TEXT REFERENCES solicitudes_recogida(id) ON DELETE SET NULL,
    paquete_id TEXT REFERENCES paquetes(id) ON DELETE SET NULL,
    recepcion_id TEXT REFERENCES recepciones(id) ON DELETE SET NULL,
    despacho_id TEXT REFERENCES despachos(id) ON DELETE SET NULL,
    cliente_id TEXT REFERENCES clientes(id) ON DELETE SET NULL,
    transportador_id TEXT REFERENCES transportadores(id) ON DELETE SET NULL,
    reportado_por_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
    responsable_asignado_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    acciones_tomadas TEXT,
    resolucion_final TEXT,
    comentarios_historial_json TEXT NOT NULL DEFAULT '[]',
    fecha_limite_resolucion TIMESTAMPTZ,
    fecha_resolucion TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 23. EVIDENCIAS (Fotos, Firmas, Documentos, Actas)
CREATE TABLE IF NOT EXISTS evidencias (
    id TEXT PRIMARY KEY,
    entidad_tipo VARCHAR(40) NOT NULL CHECK (
        entidad_tipo IN ('SOLICITUD', 'ASIGNACION', 'PAQUETE', 'RECEPCION', 'DESPACHO', 'NOVEDAD')
    ),
    entidad_id TEXT NOT NULL,
    tipo_evidencia VARCHAR(40) NOT NULL CHECK (
        tipo_evidencia IN ('FOTOGRAFIA_MERCANCIA', 'FIRMA_RECIBIDO', 'DOCUMENTO_ADJUNTO', 'ACTA_RECEPCION', 'COMPROBANTE_DESPACHO')
    ),
    nombre_archivo VARCHAR(200) NOT NULL,
    mime_type VARCHAR(80) NOT NULL DEFAULT 'image/png',
    contenido_base64_o_url TEXT NOT NULL,
    descripcion TEXT,
    latitud NUMERIC(10,7),
    longitud NUMERIC(10,7),
    registrado_por_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 24. NOTIFICACIONES (MÓDULO 18)
CREATE TABLE IF NOT EXISTS notificaciones (
    id TEXT PRIMARY KEY,
    usuario_destino_id TEXT REFERENCES usuarios(id) ON DELETE CASCADE,
    rol_destino VARCHAR(60),
    cliente_id TEXT REFERENCES clientes(id) ON DELETE CASCADE,
    transportador_id TEXT REFERENCES transportadores(id) ON DELETE CASCADE,
    tipo_notificacion VARCHAR(50) NOT NULL CHECK (
        tipo_notificacion IN (
            'NUEVA_SOLICITUD',
            'RECOGIDA_ASIGNADA',
            'RECOGIDA_ACEPTADA',
            'RECOGIDA_COMPLETADA',
            'RECOGIDA_FALLIDA',
            'MERCANCIA_RECIBIDA',
            'NOVEDAD_ABIERTA',
            'PAQUETE_PENDIENTE_ALERTA',
            'DESPACHO_GENERADO',
            'CAMBIO_RELEVANTE'
        )
    ),
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    enlace_accion VARCHAR(200),
    canal_email_estado VARCHAR(30) NOT NULL DEFAULT 'EN_COLA',
    canal_whatsapp_estado VARCHAR(30) NOT NULL DEFAULT 'PREPARADO',
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    leida_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 25. AUDITORÍA FORENSE DEL SISTEMA
CREATE TABLE IF NOT EXISTS auditoria (
    id TEXT PRIMARY KEY,
    modulo VARCHAR(80) NOT NULL,
    accion VARCHAR(100) NOT NULL,
    entidad_tipo VARCHAR(60) NOT NULL,
    entidad_id TEXT NOT NULL,
    usuario_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
    usuario_email VARCHAR(180) NOT NULL,
    rol_activo VARCHAR(80) NOT NULL,
    ip_origen VARCHAR(60),
    datos_previos_json TEXT,
    datos_nuevos_json TEXT,
    justificacion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 26. INTEGRACIONES CON TRANSPORTADORAS (MÓDULO 12)
CREATE TABLE IF NOT EXISTS integraciones (
    id TEXT PRIMARY KEY,
    codigo_integracion VARCHAR(50) NOT NULL UNIQUE, -- COORDINADORA, PLATAFORMA_ACTUAL_CE, SERVIENTREGA, etc.
    nombre_proveedor VARCHAR(150) NOT NULL,
    tipo_conector VARCHAR(40) NOT NULL CHECK (tipo_conector IN ('API_REST_SOAP', 'PLATAFORMA_INTERNA_CE', 'IMPORTADOR_ARCHIVO')),
    modo_operacion VARCHAR(40) NOT NULL DEFAULT 'CONTINGENCIA_CSV' CHECK (
        modo_operacion IN ('API_VERIFICADA', 'CONTINGENCIA_CSV', 'CARGA_MANUAL')
    ),
    endpoint_configurado VARCHAR(250),
    variable_entorno_credencial VARCHAR(120) NOT NULL,
    conexion_verificada BOOLEAN NOT NULL DEFAULT FALSE,
    reintentos_maximos INTEGER NOT NULL DEFAULT 3,
    timeout_ms INTEGER NOT NULL DEFAULT 8000,
    ultima_sincronizacion_at TIMESTAMPTZ,
    estado_salud VARCHAR(40) NOT NULL DEFAULT 'MODO_LOCAL_IMPORTACION',
    observaciones_tecnicas TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 27. REGISTROS DE SINCRONIZACIÓN E IMPORTACIÓN
CREATE TABLE IF NOT EXISTS registros_sincronizacion (
    id TEXT PRIMARY KEY,
    integracion_id TEXT NOT NULL REFERENCES integraciones(id) ON DELETE CASCADE,
    tipo_operacion VARCHAR(60) NOT NULL CHECK (
        tipo_operacion IN ('CONSULTA_GUIA', 'CONSULTA_ESTADOS', 'CONSULTA_EVENTOS', 'IMPORTACION_LOTE_CSV_EXCEL', 'VINCULACION_MANUAL')
    ),
    referencia_consultada VARCHAR(120),
    estado_ejecucion VARCHAR(30) NOT NULL CHECK (
        estado_ejecucion IN ('EXITOSO', 'ERROR_CONEXION', 'PENDIENTE_REINTENTO', 'SIN_CREDENCIALES_API', 'PROCESADO_ARCHIVO')
    ),
    intentos_realizados INTEGER NOT NULL DEFAULT 1,
    registros_procesados INTEGER NOT NULL DEFAULT 0,
    registros_fallidos INTEGER NOT NULL DEFAULT 0,
    codigo_respuesta VARCHAR(30),
    mensaje_detalle TEXT NOT NULL,
    ejecutado_por_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ÍNDICES DE ALTO RENDIMIENTO PARA ESCÁNER, WMS Y TRAZABILIDAD
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_paquetes_identificador ON paquetes(identificador_interno);
CREATE INDEX IF NOT EXISTS idx_paquetes_guia_principal ON paquetes(guia_externa_principal);
CREATE INDEX IF NOT EXISTS idx_paquetes_cliente ON paquetes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_paquetes_solicitud ON paquetes(solicitud_recogida_id);
CREATE INDEX IF NOT EXISTS idx_paquetes_estados ON paquetes(estado_recogida, estado_bodega, estado_despacho);
CREATE INDEX IF NOT EXISTS idx_guias_externas_num ON guias_externas(numero_guia);
CREATE INDEX IF NOT EXISTS idx_guias_externas_rotulo ON guias_externas(codigo_barras_rotulo);
CREATE INDEX IF NOT EXISTS idx_rotulos_code128 ON rotulos_internos(codigo_barras_code128);
CREATE INDEX IF NOT EXISTS idx_solicitudes_cliente ON solicitudes_recogida(cliente_id, estado_recogida);
CREATE INDEX IF NOT EXISTS idx_solicitudes_transportador ON solicitudes_recogida(transportador_asignado_id, estado_recogida);
CREATE INDEX IF NOT EXISTS idx_trazabilidad_paquete ON eventos_trazabilidad(paquete_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trazabilidad_solicitud ON eventos_trazabilidad(solicitud_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_novedades_estado ON novedades(estado_novedad, prioridad);

-- ============================================================================
-- PROTECCIÓN DE INMUTABILIDAD EN BASE DE DATOS (REGLA 9 Y MÓDULO 13)
-- Prohibido eliminar o alterar silenciosamente eventos históricos de trazabilidad
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_proteger_historial_inmutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'OPERACION_PROHIBIDA_POR_AUDITORIA: Los registros de % son inmutables y no pueden ser modificados ni eliminados.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inmutable_eventos_trazabilidad ON eventos_trazabilidad;
CREATE TRIGGER trg_inmutable_eventos_trazabilidad
BEFORE UPDATE OR DELETE ON eventos_trazabilidad
FOR EACH ROW EXECUTE FUNCTION fn_proteger_historial_inmutable();

DROP TRIGGER IF EXISTS trg_inmutable_auditoria ON auditoria;
CREATE TRIGGER trg_inmutable_auditoria
BEFORE UPDATE OR DELETE ON auditoria
FOR EACH ROW EXECUTE FUNCTION fn_proteger_historial_inmutable();
