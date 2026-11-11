import { DbExecutor, query } from "./db";
import { generateId, SessionPayload } from "./crypto-auth";

export async function generarConsecutivo(
  tx: DbExecutor,
  tabla:
    | "solicitudes_recogida"
    | "asignaciones"
    | "paquetes"
    | "recepciones"
    | "movimientos_inventario"
    | "despachos"
    | "manifiestos"
    | "novedades",
  prefijo: string
): Promise<string> {
  const res = await tx.query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM ${tabla}`
  );
  const nextNum = Number(res.rows[0]?.total || 0) + 1;
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");

  if (tabla === "paquetes") {
    return `${prefijo}-${yy}${mm}-${String(nextNum).padStart(6, "0")}`;
  }
  return `${prefijo}-${now.getFullYear()}-${String(nextNum).padStart(5, "0")}`;
}

export interface TrazabilidadInput {
  paqueteId?: string | null;
  solicitudId?: string | null;
  recepcionId?: string | null;
  despachoId?: string | null;
  tipoEvento:
    | "SOLICITUD"
    | "PROGRAMACION"
    | "ASIGNACION"
    | "ACEPTACION_TRANSPORTADOR"
    | "DESPLAZAMIENTO_RECOGIDA"
    | "LLEGADA_PUNTO_RECOGIDA"
    | "RECOGIDA"
    | "ESCANEO"
    | "RECEPCION"
    | "CLASIFICACION"
    | "ALMACENAMIENTO"
    | "TRASLADO_INTERNO"
    | "PREPARACION"
    | "DESCONSOLIDACION"
    | "DESPACHO"
    | "ENTREGA_TRANSPORTADOR"
    | "EVENTO_SEGUIMIENTO"
    | "ENTREGA_FINAL"
    | "DEVOLUCION"
    | "NOVEDAD";
  dimensionEstado: "RECOGIDA" | "BODEGA" | "DESPACHO" | "GENERAL";
  estadoAnterior?: string | null;
  estadoNuevo: string;
  session: SessionPayload;
  ubicacionTexto?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  observaciones: string;
  evidenciaId?: string | null;
  origenEvento: "MANUAL" | "ESCANER" | "INTEGRACION";
}

export async function registrarEventoTrazabilidad(
  tx: DbExecutor,
  input: TrazabilidadInput
): Promise<string> {
  const id = generateId();
  await tx.query(
    `INSERT INTO eventos_trazabilidad (
      id, paquete_id, solicitud_id, recepcion_id, despacho_id,
      tipo_evento, dimension_estado, estado_anterior, estado_nuevo,
      usuario_id, usuario_nombre, rol_usuario, ubicacion_texto,
      latitud, longitud, observaciones, evidencia_id, origen_evento
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12, $13,
      $14, $15, $16, $17, $18
    )`,
    [
      id,
      input.paqueteId || null,
      input.solicitudId || null,
      input.recepcionId || null,
      input.despachoId || null,
      input.tipoEvento,
      input.dimensionEstado,
      input.estadoAnterior || null,
      input.estadoNuevo,
      input.session.userId,
      input.session.nombre,
      input.session.rolCodigo,
      input.ubicacionTexto || null,
      input.latitud ?? null,
      input.longitud ?? null,
      input.observaciones,
      input.evidenciaId || null,
      input.origenEvento,
    ]
  );
  return id;
}

export async function registrarAuditoria(
  tx: DbExecutor,
  params: {
    modulo: string;
    accion: string;
    entidadTipo: string;
    entidadId: string;
    session: SessionPayload;
    datosPrevios?: unknown;
    datosNuevos?: unknown;
    justificacion?: string;
  }
): Promise<void> {
  await tx.query(
    `INSERT INTO auditoria (
      id, modulo, accion, entidad_tipo, entidad_id,
      usuario_id, usuario_email, rol_activo,
      datos_previos_json, datos_nuevos_json, justificacion
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      generateId(),
      params.modulo,
      params.accion,
      params.entidadTipo,
      params.entidadId,
      params.session.userId,
      params.session.email,
      params.session.rolCodigo,
      params.datosPrevios ? JSON.stringify(params.datosPrevios) : null,
      params.datosNuevos ? JSON.stringify(params.datosNuevos) : null,
      params.justificacion || null,
    ]
  );
}

export async function crearNotificacionOperativa(
  tx: DbExecutor,
  params: {
    usuarioDestinoId?: string | null;
    rolDestino?: string | null;
    clienteId?: string | null;
    transportadorId?: string | null;
    tipoNotificacion:
      | "NUEVA_SOLICITUD"
      | "RECOGIDA_ASIGNADA"
      | "RECOGIDA_ACEPTADA"
      | "RECOGIDA_COMPLETADA"
      | "RECOGIDA_FALLIDA"
      | "MERCANCIA_RECIBIDA"
      | "NOVEDAD_ABIERTA"
      | "PAQUETE_PENDIENTE_ALERTA"
      | "DESPACHO_GENERADO"
      | "CAMBIO_RELEVANTE";
    titulo: string;
    mensaje: string;
    enlaceAccion?: string | null;
  }
): Promise<void> {
  await tx.query(
    `INSERT INTO notificaciones (
      id, usuario_destino_id, rol_destino, cliente_id, transportador_id,
      tipo_notificacion, titulo, mensaje, enlace_accion
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      generateId(),
      params.usuarioDestinoId || null,
      params.rolDestino || null,
      params.clienteId || null,
      params.transportadorId || null,
      params.tipoNotificacion,
      params.titulo,
      params.mensaje,
      params.enlaceAccion || null,
    ]
  );
}

export type BarcodeClassificationType =
  | "GUIA_COORDINADORA"
  | "GUIA_OTRA_TRANSPORTADORA"
  | "ROTULO_INTERNO_CE"
  | "CODIGO_DESCONOCIDO";

export interface BarcodeResolutionResult {
  codigoLimpio: string;
  clasificacion: BarcodeClassificationType;
  transportadoraDetectada: string | null;
  encontradoEnBaseDatos: boolean;
  paquete: Record<string, unknown> | null;
  guiaExterna: Record<string, unknown> | null;
  rotuloInterno: Record<string, unknown> | null;
  mensajeDiagnostico: string;
}

/**
 * Clasificador determinístico del Escáner Continuo (Módulo 6)
 * Identifica si la lectura corresponde a:
 * A. Una guía de Coordinadora
 * B. Una guía de otra transportadora
 * C. Un rótulo interno de Conecta Express
 * D. Un código desconocido
 */
export async function clasificarYBuscarCodigoBarras(
  rawCode: string
): Promise<BarcodeResolutionResult> {
  const codigoLimpio = rawCode.trim().replace(/[\r\n\t]+/g, "").toUpperCase();

  if (!codigoLimpio) {
    return {
      codigoLimpio: "",
      clasificacion: "CODIGO_DESCONOCIDO",
      transportadoraDetectada: null,
      encontradoEnBaseDatos: false,
      paquete: null,
      guiaExterna: null,
      rotuloInterno: null,
      mensajeDiagnostico: "Lectura vacía o inválida.",
    };
  }

  // 1. Buscar en Rótulos Internos Conecta Express (C)
  const rotuloRes = await query(
    `SELECT r.*, p.identificador_interno, p.id as pkg_id
     FROM rotulos_internos r
     JOIN paquetes p ON p.id = r.paquete_id
     WHERE UPPER(r.codigo_barras_code128) = $1 OR UPPER(p.identificador_interno) = $1
     LIMIT 1`,
    [codigoLimpio]
  );

  if (rotuloRes.rows.length > 0) {
    const rotulo = rotuloRes.rows[0];
    const pkgRes = await query(
      `SELECT p.*, c.razon_social AS cliente_nombre, s.consecutivo AS solicitud_consecutivo,
              u.codigo_ubicacion AS ubicacion_codigo, b.nombre AS bodega_nombre
       FROM paquetes p
       LEFT JOIN clientes c ON c.id = p.cliente_id
       LEFT JOIN solicitudes_recogida s ON s.id = p.solicitud_recogida_id
       LEFT JOIN ubicaciones u ON u.id = p.ubicacion_actual_id
       LEFT JOIN bodegas b ON b.id = p.bodega_actual_id
       WHERE p.id = $1`,
      [rotulo.paquete_id]
    );

    return {
      codigoLimpio,
      clasificacion: "ROTULO_INTERNO_CE",
      transportadoraDetectada: "CONECTA_EXPRESS",
      encontradoEnBaseDatos: true,
      paquete: pkgRes.rows[0] || null,
      guiaExterna: null,
      rotuloInterno: rotulo,
      mensajeDiagnostico: `Rótulo interno Conecta Express verificado (${codigoLimpio}).`,
    };
  }

  // También verificar directamente en tabla paquetes por identificador_interno
  const directPkgRes = await query(
    `SELECT p.*, c.razon_social AS cliente_nombre, s.consecutivo AS solicitud_consecutivo,
            u.codigo_ubicacion AS ubicacion_codigo, b.nombre AS bodega_nombre
     FROM paquetes p
     LEFT JOIN clientes c ON c.id = p.cliente_id
     LEFT JOIN solicitudes_recogida s ON s.id = p.solicitud_recogida_id
     LEFT JOIN ubicaciones u ON u.id = p.ubicacion_actual_id
     LEFT JOIN bodegas b ON b.id = p.bodega_actual_id
     WHERE UPPER(p.identificador_interno) = $1
     LIMIT 1`,
    [codigoLimpio]
  );

  if (directPkgRes.rows.length > 0) {
    return {
      codigoLimpio,
      clasificacion: "ROTULO_INTERNO_CE",
      transportadoraDetectada: "CONECTA_EXPRESS",
      encontradoEnBaseDatos: true,
      paquete: directPkgRes.rows[0],
      guiaExterna: null,
      rotuloInterno: null,
      mensajeDiagnostico: `Identificador interno Conecta Express localizado (${codigoLimpio}).`,
    };
  }

  // 2. Buscar en Guías Externas registradas en base de datos (A o B)
  const guiaRes = await query(
    `SELECT g.*
     FROM guias_externas g
     WHERE UPPER(g.numero_guia) = $1 OR UPPER(g.codigo_barras_rotulo) = $1
     LIMIT 1`,
    [codigoLimpio]
  );

  if (guiaRes.rows.length > 0) {
    const guia = guiaRes.rows[0] as {
      paquete_id: string;
      transportadora: string;
      numero_guia: string;
    };
    const pkgRes = await query(
      `SELECT p.*, c.razon_social AS cliente_nombre, s.consecutivo AS solicitud_consecutivo,
              u.codigo_ubicacion AS ubicacion_codigo, b.nombre AS bodega_nombre
       FROM paquetes p
       LEFT JOIN clientes c ON c.id = p.cliente_id
       LEFT JOIN solicitudes_recogida s ON s.id = p.solicitud_recogida_id
       LEFT JOIN ubicaciones u ON u.id = p.ubicacion_actual_id
       LEFT JOIN bodegas b ON b.id = p.bodega_actual_id
       WHERE p.id = $1`,
      [guia.paquete_id]
    );
    const isCoordinadora =
      guia.transportadora.toUpperCase() === "COORDINADORA";

    return {
      codigoLimpio,
      clasificacion: isCoordinadora
        ? "GUIA_COORDINADORA"
        : "GUIA_OTRA_TRANSPORTADORA",
      transportadoraDetectada: guia.transportadora,
      encontradoEnBaseDatos: true,
      paquete: pkgRes.rows[0] || null,
      guiaExterna: guia,
      rotuloInterno: null,
      mensajeDiagnostico: isCoordinadora
        ? `Guía de Coordinadora #${guia.numero_guia} vinculada al paquete ${(pkgRes.rows[0] as { identificador_interno?: string })?.identificador_interno || ""}.`
        : `Guía de ${guia.transportadora} #${guia.numero_guia} vinculada en sistema.`,
    };
  }

  // También revisar campo guia_externa_principal en paquetes
  const pkgByGuia = await query(
    `SELECT p.*, c.razon_social AS cliente_nombre, s.consecutivo AS solicitud_consecutivo,
            u.codigo_ubicacion AS ubicacion_codigo, b.nombre AS bodega_nombre
     FROM paquetes p
     LEFT JOIN clientes c ON c.id = p.cliente_id
     LEFT JOIN solicitudes_recogida s ON s.id = p.solicitud_recogida_id
     LEFT JOIN ubicaciones u ON u.id = p.ubicacion_actual_id
     LEFT JOIN bodegas b ON b.id = p.bodega_actual_id
     WHERE UPPER(p.guia_externa_principal) = $1
     LIMIT 1`,
    [codigoLimpio]
  );

  if (pkgByGuia.rows.length > 0) {
    const pkg = pkgByGuia.rows[0] as { transportadora_principal?: string };
    const isCoord =
      (pkg.transportadora_principal || "COORDINADORA").toUpperCase() ===
      "COORDINADORA";
    return {
      codigoLimpio,
      clasificacion: isCoord
        ? "GUIA_COORDINADORA"
        : "GUIA_OTRA_TRANSPORTADORA",
      transportadoraDetectada: pkg.transportadora_principal || "COORDINADORA",
      encontradoEnBaseDatos: true,
      paquete: pkgByGuia.rows[0],
      guiaExterna: null,
      rotuloInterno: null,
      mensajeDiagnostico: `Guía externa asociada al paquete ${(pkgByGuia.rows[0] as { identificador_interno?: string })?.identificador_interno}.`,
    };
  }

  // 3. Evaluación heurística de formato cuando aún no existe registro en BD:
  // C. Patrón Rótulo Interno Conecta Express: CE-AAMM-XXXXXX o CE-...
  if (/^CE-\d{4}-\d{4,8}$/.test(codigoLimpio) || codigoLimpio.startsWith("CE-")) {
    return {
      codigoLimpio,
      clasificacion: "ROTULO_INTERNO_CE",
      transportadoraDetectada: "CONECTA_EXPRESS",
      encontradoEnBaseDatos: false,
      paquete: null,
      guiaExterna: null,
      rotuloInterno: null,
      mensajeDiagnostico:
        "Formato de Rótulo Interno Conecta Express válido, pero aún no registrado en la base de datos local.",
    };
  }

  // A. Patrón de Guía / Rótulo de Coordinadora (11 dígitos numéricos o rótulo de unidad de 14-24 dígitos con prefijo de guía Coordinadora)
  if (/^\d{11}$/.test(codigoLimpio) || /^7\d{10,21}$/.test(codigoLimpio) || /^COORD-\d{6,15}$/.test(codigoLimpio)) {
    return {
      codigoLimpio,
      clasificacion: "GUIA_COORDINADORA",
      transportadoraDetectada: "COORDINADORA",
      encontradoEnBaseDatos: false,
      paquete: null,
      guiaExterna: null,
      rotuloInterno: null,
      mensajeDiagnostico:
        "Estructura de Guía/Rótulo de Coordinadora detectada. No está registrada aún en el inventario local; puede importarla o registrarla ahora.",
    };
  }

  // B. Patrón de Otras Transportadoras Nacionales
  if (
    /^(SER|TCC|INT|DEP|ENV|9\d{9,12})/.test(codigoLimpio) &&
    codigoLimpio.length >= 9 &&
    codigoLimpio.length <= 20
  ) {
    return {
      codigoLimpio,
      clasificacion: "GUIA_OTRA_TRANSPORTADORA",
      transportadoraDetectada: codigoLimpio.startsWith("SER")
        ? "SERVIENTREGA"
        : codigoLimpio.startsWith("TCC")
        ? "TCC"
        : codigoLimpio.startsWith("INT")
        ? "INTERRAPIDISIMO"
        : "OTRA_TRANSPORTADORA",
      encontradoEnBaseDatos: false,
      paquete: null,
      guiaExterna: null,
      rotuloInterno: null,
      mensajeDiagnostico:
        "Estructura de guía de otra transportadora detectada. Pendiente de vinculación a paquete interno.",
    };
  }

  // D. Código Desconocido
  return {
    codigoLimpio,
    clasificacion: "CODIGO_DESCONOCIDO",
    transportadoraDetectada: null,
    encontradoEnBaseDatos: false,
    paquete: null,
    guiaExterna: null,
    rotuloInterno: null,
    mensajeDiagnostico:
      "Código desconocido: no coincide con guía de Coordinadora, otra transportadora ni rótulo interno de Conecta Express.",
  };
}
