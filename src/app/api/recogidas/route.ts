import { NextRequest, NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { getServerSession } from "@/lib/session";
import { hasPermission } from "@/lib/rbac";
import { generateId } from "@/lib/crypto-auth";
import {
  crearNotificacionOperativa,
  generarConsecutivo,
  registrarAuditoria,
  registrarEventoTrazabilidad,
} from "@/lib/operational-service";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "NO_AUTENTICADO" }, { status: 401 });
    }

    if (!hasPermission(session, "recogidas:ver")) {
      return NextResponse.json({ error: "ACCESO_DENEGADO" }, { status: 403 });
    }

    const search = req.nextUrl.searchParams.get("q")?.trim() || "";
    const estado = req.nextUrl.searchParams.get("estado")?.trim() || "";
    const ciudad = req.nextUrl.searchParams.get("ciudad")?.trim() || "";
    const prioridad = req.nextUrl.searchParams.get("prioridad")?.trim() || "";
    const transportadorIdParam =
      req.nextUrl.searchParams.get("transportadorId")?.trim() || "";

    const params: unknown[] = [];
    let whereSql = "WHERE 1=1";

    // Aislamiento estricto por Rol (Regla 14 y Módulo 17)
    if (session.rolCodigo === "CLIENTE") {
      params.push(session.clienteId);
      whereSql += ` AND s.cliente_id = $${params.length}`;
    } else if (session.rolCodigo === "TRANSPORTADOR_EXTERNO") {
      params.push(session.transportadorId);
      whereSql += ` AND s.transportador_asignado_id = $${params.length}`;
    } else if (transportadorIdParam) {
      params.push(transportadorIdParam);
      whereSql += ` AND s.transportador_asignado_id = $${params.length}`;
    }

    if (estado) {
      params.push(estado);
      whereSql += ` AND s.estado_recogida = $${params.length}`;
    }

    if (ciudad) {
      params.push(`%${ciudad}%`);
      whereSql += ` AND s.ciudad ILIKE $${params.length}`;
    }

    if (prioridad) {
      params.push(prioridad);
      whereSql += ` AND s.prioridad = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      whereSql += ` AND (
        s.consecutivo ILIKE $${params.length} OR
        c.razon_social ILIKE $${params.length} OR
        s.direccion_texto ILIKE $${params.length} OR
        s.contacto_nombre ILIKE $${params.length} OR
        s.ciudad ILIKE $${params.length}
      )`;
    }

    const solicitudesRes = await query(
      `SELECT s.*,
        c.razon_social AS cliente_nombre,
        c.codigo_cliente AS cliente_codigo,
        c.nit AS cliente_nit,
        t.razon_social AS transportador_nombre,
        cd.nombre_completo AS conductor_nombre,
        cd.telefono AS conductor_telefono,
        v.placa AS vehiculo_placa,
        v.tipo_vehiculo AS vehiculo_tipo,
        u.nombre_completo AS responsable_nombre,
        (SELECT COUNT(*)::int FROM paquetes p WHERE p.solicitud_recogida_id = s.id) AS paquetes_registrados_count,
        (SELECT COUNT(*)::int FROM paquetes p WHERE p.solicitud_recogida_id = s.id AND p.recogido_verificado = TRUE) AS paquetes_recogidos_verificados,
        (SELECT COUNT(*)::int FROM evidencias ev WHERE ev.entidad_tipo = 'SOLICITUD' AND ev.entidad_id = s.id) AS evidencias_count
       FROM solicitudes_recogida s
       JOIN clientes c ON c.id = s.cliente_id
       LEFT JOIN transportadores t ON t.id = s.transportador_asignado_id
       LEFT JOIN conductores cd ON cd.id = s.conductor_asignado_id
       LEFT JOIN vehiculos v ON v.id = s.vehiculo_asignado_id
       LEFT JOIN usuarios u ON u.id = s.responsable_conecta_id
       ${whereSql}
       ORDER BY
         CASE s.prioridad
           WHEN 'CRITICA' THEN 1
           WHEN 'ALTA' THEN 2
           WHEN 'NORMAL' THEN 3
           ELSE 4
         END ASC,
         s.created_at DESC`,
      params
    );

    // Catálogos auxiliares para formularios según rol
    const [clientesCat, transportadoresCat, conductoresCat, vehiculosCat, evidenciasRes, historialRes, paquetesRes] =
      await Promise.all([
        session.rolCodigo === "CLIENTE"
          ? query(`SELECT id, codigo_cliente, razon_social, ciudad_principal, direccion_principal, telefono_principal FROM clientes WHERE id = $1`, [session.clienteId])
          : query(`SELECT id, codigo_cliente, razon_social, ciudad_principal, direccion_principal, telefono_principal FROM clientes WHERE estado = 'ACTIVO' ORDER BY razon_social`),
        session.rolCodigo === "CLIENTE"
          ? Promise.resolve({ rows: [] })
          : query(`SELECT id, codigo_transportador, razon_social, zonas_cobertura FROM transportadores WHERE estado = 'ACTIVO' ORDER BY razon_social`),
        session.rolCodigo === "CLIENTE"
          ? Promise.resolve({ rows: [] })
          : query(`SELECT id, transportador_id, nombre_completo, cedula, telefono, estado_operativo FROM conductores ORDER BY nombre_completo`),
        session.rolCodigo === "CLIENTE"
          ? Promise.resolve({ rows: [] })
          : query(`SELECT id, transportador_id, conductor_habitual_id, placa, tipo_vehiculo, capacidad_kg FROM vehiculos WHERE estado = 'ACTIVO' ORDER BY placa`),
        query(
          `SELECT id, entidad_id, tipo_evidencia, nombre_archivo, mime_type, contenido_base64_o_url, descripcion, created_at
           FROM evidencias
           WHERE entidad_tipo = 'SOLICITUD'
           ORDER BY created_at DESC
           LIMIT 100`
        ),
        query(
          `SELECT id, solicitud_id, paquete_id, tipo_evento, dimension_estado, estado_anterior, estado_nuevo,
                  usuario_nombre, rol_usuario, ubicacion_texto, observaciones, origen_evento, created_at
           FROM eventos_trazabilidad
           WHERE solicitud_id IS NOT NULL
           ORDER BY created_at DESC
           LIMIT 200`
        ),
        query(
          `SELECT id, identificador_interno, solicitud_recogida_id, guia_externa_principal, transportadora_principal,
                  largo_cm, ancho_cm, alto_cm, peso_kg, estado_recogida, estado_bodega, estado_despacho, recogido_verificado
           FROM paquetes
           WHERE solicitud_recogida_id IS NOT NULL
           ORDER BY unidad_numero ASC`
        ),
      ]);

    return NextResponse.json({
      solicitudes: solicitudesRes.rows,
      paquetesSolicitud: paquetesRes.rows,
      catalogos: {
        clientes: clientesCat.rows,
        transportadores: transportadoresCat.rows,
        conductores: conductoresCat.rows,
        vehiculos: vehiculosCat.rows,
      },
      evidencias: evidenciasRes.rows,
      historial: historialRes.rows,
    });
  } catch (error) {
    console.error("Error en GET /api/recogidas:", error);
    return NextResponse.json(
      { error: "ERROR_CONSULTA_RECOGIDAS" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "NO_AUTENTICADO" }, { status: 401 });
    }

    if (!hasPermission(session, "recogidas:crear")) {
      return NextResponse.json({ error: "ACCESO_DENEGADO" }, { status: 403 });
    }

    const body = await req.json();

    const clienteId =
      session.rolCodigo === "CLIENTE"
        ? session.clienteId
        : String(body.clienteId || "");

    if (!clienteId) {
      return NextResponse.json(
        {
          error: "CLIENTE_REQUERIDO",
          message: "Debe seleccionar el cliente titular de la recogida.",
        },
        { status: 400 }
      );
    }

    const direccionTexto = String(body.direccionTexto || "").trim();
    const ciudad = String(body.ciudad || "Bogotá D.C.").trim();
    const departamento = String(body.departamento || "Cundinamarca").trim();
    const zonaLogistica = String(body.zonaLogistica || "ZONA_NORTE").trim();
    const contactoNombre = String(body.contactoNombre || "").trim();
    const contactoTelefono = String(body.contactoTelefono || "").trim();
    const fechaSolicitada = String(
      body.fechaSolicitada || new Date().toISOString().slice(0, 10)
    );
    const franjaHoraria = String(body.franjaHoraria || "08:00 - 12:00").trim();
    const cantidadEstimada = Math.max(
      1,
      Number(body.cantidadEstimadaPaquetes || 1)
    );
    const tipoMercancia = String(
      body.tipoMercancia || "Paquetería Comercial"
    ).trim();
    const pesoEstimadoKg = Math.max(0.5, Number(body.pesoEstimadoKg || 5));
    const dimensionesEstimadas = String(
      body.dimensionesEstimadas || "40x30x30 cm"
    ).trim();
    const observaciones = body.observaciones
      ? String(body.observaciones).trim()
      : null;
    const prioridad =
      session.rolCodigo === "CLIENTE"
        ? "NORMAL"
        : String(body.prioridad || "NORMAL");

    if (!direccionTexto || !contactoNombre || !contactoTelefono) {
      return NextResponse.json(
        {
          error: "DATOS_INCOMPLETOS",
          message:
            "Dirección de recogida, nombre de contacto y teléfono son obligatorios.",
        },
        { status: 400 }
      );
    }

    const result = await withTransaction(async (tx) => {
      const consecutivo = await generarConsecutivo(
        tx,
        "solicitudes_recogida",
        "REC"
      );
      const solicitudId = generateId();

      const cliRes = await tx.query<{
        razon_social: string;
        ciudad_principal: string;
      }>(`SELECT razon_social, ciudad_principal FROM clientes WHERE id = $1`, [
        clienteId,
      ]);
      const clienteNombre =
        cliRes.rows[0]?.razon_social || "Cliente Conecta Express";

      const origenSolicitud =
        session.rolCodigo === "CLIENTE" ? "PORTAL_CLIENTE" : "ADMIN_INTERNO";

      await tx.query(
        `INSERT INTO solicitudes_recogida (
          id, consecutivo, cliente_id, direccion_recogida_id, direccion_texto,
          ciudad, departamento, zona_logistica, latitud, longitud,
          contacto_nombre, contacto_telefono, contacto_email,
          fecha_solicitada, fecha_programada, franja_horaria,
          cantidad_estimada_paquetes, tipo_mercancia, tipo_servicio,
          peso_estimado_kg, dimensiones_estimadas, valor_declarado_total,
          observaciones, prioridad, responsable_conecta_id, creado_por_id,
          origen_solicitud, estado_recogida
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13,
          $14, $15, $16,
          $17, $18, $19,
          $20, $21, $22,
          $23, $24, $25, $26,
          $27, 'SOLICITUD_RECIBIDA'
        )`,
        [
          solicitudId,
          consecutivo,
          clienteId,
          body.direccionRecogidaId || null,
          direccionTexto,
          ciudad,
          departamento,
          zonaLogistica,
          body.latitud ? Number(body.latitud) : null,
          body.longitud ? Number(body.longitud) : null,
          contactoNombre,
          contactoTelefono,
          body.contactoEmail ? String(body.contactoEmail) : session.email,
          fechaSolicitada,
          body.fechaProgramada || fechaSolicitada,
          franjaHoraria,
          cantidadEstimada,
          tipoMercancia,
          String(body.tipoServicio || "ESTANDAR_CONECTA"),
          pesoEstimadoKg,
          dimensionesEstimadas,
          Number(body.valorDeclaradoTotal || 100000),
          observaciones,
          prioridad,
          session.rolCodigo !== "CLIENTE" ? session.userId : null,
          session.userId,
          origenSolicitud,
        ]
      );

      // Si se adjuntó fotografía o documento de soporte al crear la solicitud
      if (body.evidenciaBase64 && body.evidenciaNombre) {
        await tx.query(
          `INSERT INTO evidencias (
            id, entidad_tipo, entidad_id, tipo_evidencia, nombre_archivo,
            mime_type, contenido_base64_o_url, descripcion, registrado_por_id
          ) VALUES ($1, 'SOLICITUD', $2, $3, $4, $5, $6, $7, $8)`,
          [
            generateId(),
            solicitudId,
            String(body.tipoEvidencia || "FOTOGRAFIA_MERCANCIA"),
            String(body.evidenciaNombre),
            String(body.evidenciaMime || "image/jpeg"),
            String(body.evidenciaBase64),
            "Adjunto inicial de solicitud de recogida",
            session.userId,
          ]
        );
      }

      // Pre-generación de paquetes esperados con Identificador Interno Conecta Express (Módulo 7)
      // Permite que los paquetes existan con su código CE-AAMM-XXXXXX antes o con guía externa opcional
      const paquetesGenerados: string[] = [];
      const cantidadPrecrear = Math.min(cantidadEstimada, 25); // Pre-generar hasta 25 unidades individuales para trazabilidad por bulto
      const guiaExternaOpcional = body.guiaExternaInicial
        ? String(body.guiaExternaInicial).trim().toUpperCase()
        : null;
      const destinatarioNombre = String(
        body.destinatarioNombre || "Por definir en recepción / guía"
      ).trim();
      const destinatarioCiudad = String(
        body.destinatarioCiudad || ciudad
      ).trim();
      const destinatarioDireccion = String(
        body.destinatarioDireccion || "Pendiente validación en bodega"
      ).trim();
      const destinatarioTelefono = String(
        body.destinatarioTelefono || contactoTelefono
      ).trim();

      const pesoUnitario = Number(
        (pesoEstimadoKg / cantidadPrecrear).toFixed(2)
      );

      for (let i = 1; i <= cantidadPrecrear; i++) {
        const pkgId = generateId();
        const identificadorInterno = await generarConsecutivo(
          tx,
          "paquetes",
          process.env.CE_INTERNAL_LABEL_PREFIX || "CE"
        );
        const guiaUnitaria =
          guiaExternaOpcional && i === 1 ? guiaExternaOpcional : null;

        await tx.query(
          `INSERT INTO paquetes (
            id, identificador_interno, solicitud_recogida_id, cliente_id,
            remitente_nombre, remitente_telefono, remitente_direccion, remitente_ciudad,
            destinatario_nombre, destinatario_telefono, destinatario_direccion, destinatario_ciudad,
            contenido_declarado, tipo_mercancia, tipo_servicio,
            unidad_numero, total_unidades_lote, peso_kg,
            guia_externa_principal, transportadora_principal,
            estado_recogida, estado_bodega, estado_despacho,
            recogido_verificado, recibido_bodega_verificado
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8,
            $9, $10, $11, $12,
            $13, $14, $15,
            $16, $17, $18,
            $19, 'COORDINADORA',
            'SOLICITUD_RECIBIDA', 'PENDIENTE_RECEPCION', 'PENDIENTE',
            FALSE, FALSE
          )`,
          [
            pkgId,
            identificadorInterno,
            solicitudId,
            clienteId,
            clienteNombre,
            contactoTelefono,
            direccionTexto,
            ciudad,
            destinatarioNombre,
            destinatarioTelefono,
            destinatarioDireccion,
            destinatarioCiudad,
            tipoMercancia,
            tipoMercancia,
            String(body.tipoServicio || "ESTANDAR"),
            i,
            cantidadEstimada,
            pesoUnitario,
            guiaUnitaria,
          ]
        );

        // Crear Rótulo Interno Conecta Express (Módulo 7)
        const qrPayload = JSON.stringify({
          ceId: identificadorInterno,
          solicitud: consecutivo,
          cliente: clienteNombre,
          unidad: `${i}/${cantidadEstimada}`,
          destino: destinatarioCiudad,
        });

        await tx.query(
          `INSERT INTO rotulos_internos (
            id, paquete_id, codigo_barras_code128, contenido_qr, formato_etiqueta, generado_por_id
          ) VALUES ($1, $2, $3, $4, '4X6', $5)`,
          [
            generateId(),
            pkgId,
            identificadorInterno,
            qrPayload,
            session.userId,
          ]
        );

        // Si el cliente o administrador indicó una guía externa preexistente para este paquete
        if (guiaUnitaria) {
          await tx.query(
            `INSERT INTO guias_externas (
              id, paquete_id, transportadora, numero_guia, codigo_barras_rotulo,
              estado_actual_transportadora, origen_vinculacion, registrado_por_id
            ) VALUES ($1, $2, 'COORDINADORA', $3, $3, 'GENERADA_PLATAFORMA_CE', 'PLATAFORMA_ACTUAL', $4)
            ON CONFLICT (transportadora, numero_guia) DO NOTHING`,
            [generateId(), pkgId, guiaUnitaria, session.userId]
          );
        }

        await registrarEventoTrazabilidad(tx, {
          paqueteId: pkgId,
          solicitudId,
          tipoEvento: "SOLICITUD",
          dimensionEstado: "RECOGIDA",
          estadoAnterior: null,
          estadoNuevo: "SOLICITUD_RECIBIDA",
          session,
          ubicacionTexto: `${direccionTexto}, ${ciudad}`,
          observaciones: `Paquete ${identificadorInterno} (${i}/${cantidadEstimada}) registrado en solicitud ${consecutivo}.`,
          origenEvento: "MANUAL",
        });

        paquetesGenerados.push(identificadorInterno);
      }

      // Evento general de la Solicitud
      await registrarEventoTrazabilidad(tx, {
        solicitudId,
        tipoEvento: "SOLICITUD",
        dimensionEstado: "RECOGIDA",
        estadoAnterior: null,
        estadoNuevo: "SOLICITUD_RECIBIDA",
        session,
        ubicacionTexto: `${direccionTexto}, ${ciudad}`,
        observaciones: `Solicitud de recogida ${consecutivo} creada por ${session.nombre} (${cantidadEstimada} paq. estimados - ${tipoMercancia}).`,
        origenEvento: "MANUAL",
      });

      // Notificación operativa en tiempo real (Módulo 18)
      await crearNotificacionOperativa(tx, {
        rolDestino: "COORDINADOR_LOGISTICO",
        clienteId,
        tipoNotificacion: "NUEVA_SOLICITUD",
        titulo: `Nueva Solicitud de Recogida ${consecutivo}`,
        mensaje: `${clienteNombre} solicitó recogida en ${ciudad} (${direccionTexto}) para ${cantidadEstimada} paquete(s). Franja: ${franjaHoraria}.`,
        enlaceAccion: `/admin/recogidas?q=${consecutivo}`,
      });

      return { solicitudId, consecutivo, paquetesGenerados };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Error en POST /api/recogidas:", error);
    return NextResponse.json(
      {
        error: "ERROR_CREACION_SOLICITUD",
        message:
          error instanceof Error
            ? error.message
            : "Error registrando la solicitud de recogida.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "NO_AUTENTICADO" }, { status: 401 });
    }

    const body = await req.json();
    const solicitudId = String(body.solicitudId || "");
    const operacion = String(body.operacion || "");

    if (!solicitudId || !operacion) {
      return NextResponse.json(
        { error: "PARAMETROS_INCOMPLETOS" },
        { status: 400 }
      );
    }

    const result = await withTransaction(async (tx) => {
      const solRes = await tx.query<{
        id: string;
        consecutivo: string;
        cliente_id: string;
        transportador_asignado_id: string | null;
        estado_recogida: string;
        direccion_texto: string;
        ciudad: string;
        cantidad_estimada_paquetes: number;
        version: number;
      }>(`SELECT * FROM solicitudes_recogida WHERE id = $1`, [solicitudId]);

      if (solRes.rows.length === 0) {
        throw new Error("Solicitud de recogida no encontrada.");
      }

      const sol = solRes.rows[0];

      // Verificar aislamiento de seguridad si es Transportador o Cliente
      if (
        session.rolCodigo === "TRANSPORTADOR_EXTERNO" &&
        sol.transportador_asignado_id !== session.transportadorId
      ) {
        throw new Error(
          "Acceso denegado: esta recogida no está asignada a su empresa transportadora."
        );
      }

      if (
        session.rolCodigo === "CLIENTE" &&
        sol.cliente_id !== session.clienteId
      ) {
        throw new Error("Acceso denegado a solicitud de otro cliente.");
      }

      // 1. ASIGNAR Y PROGRAMAR TRANSPORTADOR (Módulo 3 y 4)
      if (operacion === "ASIGNAR_TRANSPORTADOR") {
        if (!hasPermission(session, "recogidas:asignar")) {
          throw new Error("Sin permiso para asignar transportadores.");
        }

        const transportadorId = String(body.transportadorId || "");
        const conductorId = body.conductorId ? String(body.conductorId) : null;
        const vehiculoId = body.vehiculoId ? String(body.vehiculoId) : null;
        const fechaProgramada = String(
          body.fechaProgramada || new Date().toISOString().slice(0, 10)
        );
        const franjaHoraria = String(body.franjaHoraria || "08:00 - 12:00");
        const prioridad = String(body.prioridad || "NORMAL");

        if (!transportadorId) {
          throw new Error("Debe seleccionar la empresa transportadora.");
        }

        // Desactivar asignaciones previas si es una reasignación
        await tx.query(
          `UPDATE asignaciones SET activa = FALSE, estado_asignacion = 'REASIGNADA'
           WHERE solicitud_id = $1 AND activa = TRUE`,
          [solicitudId]
        );

        const ordenConsecutivo = await generarConsecutivo(
          tx,
          "asignaciones",
          "ORD"
        );
        const asignacionId = generateId();

        await tx.query(
          `INSERT INTO asignaciones (
            id, consecutivo_orden, solicitud_id, transportador_id, conductor_id,
            vehiculo_id, asignado_por_id, fecha_programada, franja_horaria,
            estado_asignacion, activa
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ASIGNADA', TRUE)`,
          [
            asignacionId,
            ordenConsecutivo,
            solicitudId,
            transportadorId,
            conductorId,
            vehiculoId,
            session.userId,
            fechaProgramada,
            franjaHoraria,
          ]
        );

        await tx.query(
          `UPDATE solicitudes_recogida
           SET transportador_asignado_id = $1,
               conductor_asignado_id = $2,
               vehiculo_asignado_id = $3,
               fecha_programada = $4,
               franja_horaria = $5,
               prioridad = $6,
               responsable_conecta_id = $7,
               estado_recogida = 'ASIGNADA',
               version = version + 1,
               updated_at = NOW()
           WHERE id = $8`,
          [
            transportadorId,
            conductorId,
            vehiculoId,
            fechaProgramada,
            franjaHoraria,
            prioridad,
            session.userId,
            solicitudId,
          ]
        );

        await tx.query(
          `UPDATE paquetes
           SET estado_recogida = 'ASIGNADA', updated_at = NOW()
           WHERE solicitud_recogida_id = $1`,
          [solicitudId]
        );

        await registrarEventoTrazabilidad(tx, {
          solicitudId,
          tipoEvento: "ASIGNACION",
          dimensionEstado: "RECOGIDA",
          estadoAnterior: sol.estado_recogida,
          estadoNuevo: "ASIGNADA",
          session,
          ubicacionTexto: `${sol.direccion_texto}, ${sol.ciudad}`,
          observaciones: `Recogida programada (${fechaProgramada} ${franjaHoraria}) y asignada mediante orden ${ordenConsecutivo}.`,
          origenEvento: "MANUAL",
        });

        await crearNotificacionOperativa(tx, {
          transportadorId,
          clienteId: sol.cliente_id,
          tipoNotificacion: "RECOGIDA_ASIGNADA",
          titulo: `Recogida ${sol.consecutivo} Asignada (${ordenConsecutivo})`,
          mensaje: `Se asignó la recogida en ${sol.direccion_texto} (${sol.ciudad}) para el ${fechaProgramada} (${franjaHoraria}).`,
          enlaceAccion: `/transportador`,
        });

        return { estadoNuevo: "ASIGNADA", ordenConsecutivo };
      }

      // 2. AVANCE OPERATIVO DEL TRANSPORTADOR EN CAMPO (Módulo 5)
      if (
        operacion === "ACEPTAR_SERVICIO" ||
        operacion === "CONFIRMAR_DESPLAZAMIENTO" ||
        operacion === "CONFIRMAR_LLEGADA"
      ) {
        const mapEstado: Record<
          string,
          {
            solicitudEstado: string;
            asignacionEstado: string;
            tipoEvento:
              | "ACEPTACION_TRANSPORTADOR"
              | "DESPLAZAMIENTO_RECOGIDA"
              | "LLEGADA_PUNTO_RECOGIDA";
            colFecha: string;
            obsDefault: string;
          }
        > = {
          ACEPTAR_SERVICIO: {
            solicitudEstado: "ACEPTADA",
            asignacionEstado: "ACEPTADA",
            tipoEvento: "ACEPTACION_TRANSPORTADOR",
            colFecha: "fecha_aceptacion",
            obsDefault:
              "Transportador aceptó el servicio de recolección asignado.",
          },
          CONFIRMAR_DESPLAZAMIENTO: {
            solicitudEstado: "EN_CAMINO",
            asignacionEstado: "EN_DESPLAZAMIENTO",
            tipoEvento: "DESPLAZAMIENTO_RECOGIDA",
            colFecha: "fecha_inicio_desplazamiento",
            obsDefault:
              "Vehículo en desplazamiento hacia la dirección de recogida del cliente.",
          },
          CONFIRMAR_LLEGADA: {
            solicitudEstado: "EN_PUNTO_RECOGIDA",
            asignacionEstado: "EN_SITIO",
            tipoEvento: "LLEGADA_PUNTO_RECOGIDA",
            colFecha: "fecha_llegada_sitio",
            obsDefault:
              "Conductor confirmó llegada física al punto de recogida del cliente.",
          },
        };

        const cfg = mapEstado[operacion];
        await tx.query(
          `UPDATE solicitudes_recogida
           SET estado_recogida = $1, version = version + 1, updated_at = NOW()
           WHERE id = $2`,
          [cfg.solicitudEstado, solicitudId]
        );

        await tx.query(
          `UPDATE asignaciones
           SET estado_asignacion = $1, ${cfg.colFecha} = NOW(),
               latitud_evento = COALESCE($2, latitud_evento),
               longitud_evento = COALESCE($3, longitud_evento)
           WHERE solicitud_id = $4 AND activa = TRUE`,
          [
            cfg.asignacionEstado,
            body.latitud ? Number(body.latitud) : null,
            body.longitud ? Number(body.longitud) : null,
            solicitudId,
          ]
        );

        await tx.query(
          `UPDATE paquetes
           SET estado_recogida = $1, updated_at = NOW()
           WHERE solicitud_recogida_id = $2`,
          [cfg.solicitudEstado, solicitudId]
        );

        await registrarEventoTrazabilidad(tx, {
          solicitudId,
          tipoEvento: cfg.tipoEvento,
          dimensionEstado: "RECOGIDA",
          estadoAnterior: sol.estado_recogida,
          estadoNuevo: cfg.solicitudEstado,
          session,
          ubicacionTexto: `${sol.direccion_texto}, ${sol.ciudad}`,
          latitud: body.latitud ? Number(body.latitud) : null,
          longitud: body.longitud ? Number(body.longitud) : null,
          observaciones: body.observaciones
            ? String(body.observaciones)
            : cfg.obsDefault,
          origenEvento: "MANUAL",
        });

        if (operacion === "ACEPTAR_SERVICIO") {
          await crearNotificacionOperativa(tx, {
            clienteId: sol.cliente_id,
            rolDestino: "COORDINADOR_LOGISTICO",
            tipoNotificacion: "RECOGIDA_ACEPTADA",
            titulo: `Recogida ${sol.consecutivo} Aceptada por Transportador`,
            mensaje: `El transportador confirmó aceptación de la recogida ${sol.consecutivo}.`,
            enlaceAccion: `/admin/recogidas?q=${sol.consecutivo}`,
          });
        }

        return { estadoNuevo: cfg.solicitudEstado };
      }

      // 3. CONFIRMAR RECOGIDA FÍSICA COMPLETADA CON ESCANEO, MEDIDAS Y EVENTO VERIFICABLE
      if (operacion === "COMPLETAR_RECOGIDA_FISICA") {
        const cantidadRecogidaReal = Number(body.cantidadRecogidaReal || 0);
        const nombreQuienEntrega = String(
          body.nombreQuienEntrega || ""
        ).trim();
        const documentoQuienEntrega = String(
          body.documentoQuienEntrega || ""
        ).trim();
        const firmaRecibidoData = String(body.firmaRecibidoData || "").trim();
        const codigosEscaneados: string[] = Array.isArray(
          body.codigosEscaneados
        )
          ? body.codigosEscaneados.map((c: unknown) =>
              String(c).trim().toUpperCase()
            )
          : [];
        const paquetesMedidas: Array<{
          codigo: string;
          largoCm: number;
          anchoCm: number;
          altoCm: number;
          pesoKg: number;
        }> = Array.isArray(body.paquetesMedidas)
          ? body.paquetesMedidas.map((pm: Record<string, unknown>) => ({
              codigo: String(pm.codigo || "").trim().toUpperCase(),
              largoCm: Math.max(1, Number(pm.largoCm || 30)),
              anchoCm: Math.max(1, Number(pm.anchoCm || 25)),
              altoCm: Math.max(1, Number(pm.altoCm || 20)),
              pesoKg: Math.max(0.1, Number(pm.pesoKg || 2)),
            }))
          : [];

        if (cantidadRecogidaReal <= 0) {
          throw new Error(
            "Debe registrar una cantidad real mayor a cero para completar la recogida."
          );
        }
        if (
          !nombreQuienEntrega ||
          (!firmaRecibidoData &&
            codigosEscaneados.length === 0 &&
            paquetesMedidas.length === 0)
        ) {
          throw new Error(
            "No se puede confirmar la recogida sin evidencia verificable (escaneo de paquetes o firma de quien entrega)."
          );
        }

        await tx.query(
          `UPDATE solicitudes_recogida
           SET estado_recogida = 'RECOGIDA_COMPLETADA',
               cantidad_recogida_real = $1,
               nombre_quien_entrega = $2,
               documento_quien_entrega = $3,
               firma_recibido_cliente_data = $4,
               fecha_cierre_recogida = NOW(),
               version = version + 1,
               updated_at = NOW()
           WHERE id = $5`,
          [
            cantidadRecogidaReal,
            nombreQuienEntrega,
            documentoQuienEntrega || null,
            firmaRecibidoData || "VERIFICADO_POR_ESCANEO",
            solicitudId,
          ]
        );

        await tx.query(
          `UPDATE asignaciones
           SET estado_asignacion = 'COMPLETADA',
               fecha_finalizacion = NOW(),
               unidades_recolectadas = $1,
               firma_remitente_data = $2,
               nombre_firmante = $3,
               cedula_firmante = $4,
               observaciones_conductor = $5
           WHERE solicitud_id = $6 AND activa = TRUE`,
          [
            cantidadRecogidaReal,
            firmaRecibidoData || null,
            nombreQuienEntrega,
            documentoQuienEntrega || null,
            body.observaciones ? String(body.observaciones) : null,
            solicitudId,
          ]
        );

        if (body.fotoMercanciaBase64) {
          await tx.query(
            `INSERT INTO evidencias (
              id, entidad_tipo, entidad_id, tipo_evidencia, nombre_archivo,
              mime_type, contenido_base64_o_url, descripcion, registrado_por_id
            ) VALUES ($1, 'SOLICITUD', $2, 'FOTOGRAFIA_MERCANCIA', $3, 'image/jpeg', $4, $5, $6)`,
            [
              generateId(),
              solicitudId,
              `foto-recogida-${sol.consecutivo}.jpg`,
              String(body.fotoMercanciaBase64),
              `Fotografía de mercancía recolectada (${cantidadRecogidaReal} paq.)`,
              session.userId,
            ]
          );
        }

        if (firmaRecibidoData) {
          await tx.query(
            `INSERT INTO evidencias (
              id, entidad_tipo, entidad_id, tipo_evidencia, nombre_archivo,
              mime_type, contenido_base64_o_url, descripcion, registrado_por_id
            ) VALUES ($1, 'SOLICITUD', $2, 'FIRMA_RECIBIDO', $3, 'image/png', $4, $5, $6)`,
            [
              generateId(),
              solicitudId,
              `firma-recogida-${sol.consecutivo}.png`,
              firmaRecibidoData,
              `Firma de entrega por ${nombreQuienEntrega} (${documentoQuienEntrega || "S/D"})`,
              session.userId,
            ]
          );
        }

        // Obtener paquetes pre-asociados a esta solicitud
        const pkgsSolicitud = await tx.query<{
          id: string;
          identificador_interno: string;
          guia_externa_principal: string | null;
          estado_recogida: string;
          largo_cm: number;
          ancho_cm: number;
          alto_cm: number;
          peso_kg: number;
        }>(
          `SELECT id, identificador_interno, guia_externa_principal, estado_recogida,
                  largo_cm, ancho_cm, alto_cm, peso_kg
           FROM paquetes WHERE solicitud_recogida_id = $1
           ORDER BY unidad_numero ASC`,
          [solicitudId]
        );

        const idsActualizados = new Set<string>();

        // 1. Procesar cada paquete escaneado con sus medidas (largo, ancho, alto y peso)
        for (let idx = 0; idx < paquetesMedidas.length; idx++) {
          const item = paquetesMedidas[idx];
          const pesoVol = Number(
            ((item.largoCm * item.anchoCm * item.altoCm) / 5000).toFixed(2)
          );

          // Buscar si el código coincide con un paquete existente (por código CE o guía externa)
          const matchExistente = await tx.query<{
            id: string;
            identificador_interno: string;
            estado_recogida: string;
          }>(
            `SELECT id, identificador_interno, estado_recogida
             FROM paquetes
             WHERE UPPER(identificador_interno) = $1
                OR UPPER(COALESCE(guia_externa_principal, '')) = $1
             LIMIT 1`,
            [item.codigo]
          );

          if (matchExistente.rows.length > 0) {
            const pRow = matchExistente.rows[0];
            idsActualizados.add(pRow.id);
            await tx.query(
              `UPDATE paquetes
               SET solicitud_recogida_id = $1,
                   largo_cm = $2,
                   ancho_cm = $3,
                   alto_cm = $4,
                   peso_kg = $5,
                   peso_volumetrico_kg = $6,
                   estado_recogida = 'RECOGIDA_COMPLETADA',
                   recogido_verificado = TRUE,
                   fecha_recogida_fisica = NOW(),
                   version = version + 1,
                   updated_at = NOW()
               WHERE id = $7`,
              [
                solicitudId,
                item.largoCm,
                item.anchoCm,
                item.altoCm,
                item.pesoKg,
                pesoVol,
                pRow.id,
              ]
            );

            await registrarEventoTrazabilidad(tx, {
              paqueteId: pRow.id,
              solicitudId,
              tipoEvento: "RECOGIDA",
              dimensionEstado: "RECOGIDA",
              estadoAnterior: pRow.estado_recogida,
              estadoNuevo: "RECOGIDA_COMPLETADA",
              session,
              ubicacionTexto: `${sol.direccion_texto}, ${sol.ciudad}`,
              observaciones: `Paquete ${pRow.identificador_interno} escaneado (${item.codigo}) y recogido. Medidas: ${item.largoCm}x${item.anchoCm}x${item.altoCm} cm — Peso: ${item.pesoKg} kg. Entregó: ${nombreQuienEntrega}.`,
              origenEvento: "ESCANER",
            });
          } else {
            // Si el código escaneado es una guía nueva, asignarla al siguiente paquete libre de la solicitud
            const pkgLibre = pkgsSolicitud.rows.find(
              (r) => !idsActualizados.has(r.id)
            );
            const esGuia = !item.codigo.startsWith("CE-");

            if (pkgLibre) {
              idsActualizados.add(pkgLibre.id);
              await tx.query(
                `UPDATE paquetes
                 SET guia_externa_principal = COALESCE($1, guia_externa_principal),
                     largo_cm = $2,
                     ancho_cm = $3,
                     alto_cm = $4,
                     peso_kg = $5,
                     peso_volumetrico_kg = $6,
                     estado_recogida = 'RECOGIDA_COMPLETADA',
                     recogido_verificado = TRUE,
                     fecha_recogida_fisica = NOW(),
                     version = version + 1,
                     updated_at = NOW()
                 WHERE id = $7`,
                [
                  esGuia ? item.codigo : null,
                  item.largoCm,
                  item.anchoCm,
                  item.altoCm,
                  item.pesoKg,
                  pesoVol,
                  pkgLibre.id,
                ]
              );

              if (esGuia && item.codigo) {
                await tx.query(
                  `INSERT INTO guias_externas (
                    id, paquete_id, transportadora, numero_guia, codigo_barras_rotulo,
                    estado_actual_transportadora, origen_vinculacion, registrado_por_id
                  ) VALUES ($1, $2, 'COORDINADORA', $3, $3, 'ESCANEADA_EN_RECOGIDA', 'ESCANEO_FISICO', $4)
                  ON CONFLICT (transportadora, numero_guia) DO NOTHING`,
                  [generateId(), pkgLibre.id, item.codigo, session.userId]
                );
              }

              await registrarEventoTrazabilidad(tx, {
                paqueteId: pkgLibre.id,
                solicitudId,
                tipoEvento: "RECOGIDA",
                dimensionEstado: "RECOGIDA",
                estadoAnterior: pkgLibre.estado_recogida,
                estadoNuevo: "RECOGIDA_COMPLETADA",
                session,
                ubicacionTexto: `${sol.direccion_texto}, ${sol.ciudad}`,
                observaciones: `Paquete ${pkgLibre.identificador_interno} vinculado con código ${item.codigo}. Medidas: ${item.largoCm}x${item.anchoCm}x${item.altoCm} cm — Peso: ${item.pesoKg} kg. Entregó: ${nombreQuienEntrega}.`,
                origenEvento: "ESCANER",
              });
            }
          }
        }

        // Actualizar los demás paquetes de la solicitud que no tenían lectura individual
        for (const pkg of pkgsSolicitud.rows) {
          if (idsActualizados.has(pkg.id)) continue;
          await tx.query(
            `UPDATE paquetes
             SET estado_recogida = 'RECOGIDA_COMPLETADA',
                 recogido_verificado = TRUE,
                 fecha_recogida_fisica = NOW(),
                 version = version + 1,
                 updated_at = NOW()
             WHERE id = $1`,
            [pkg.id]
          );

          await registrarEventoTrazabilidad(tx, {
            paqueteId: pkg.id,
            solicitudId,
            tipoEvento: "RECOGIDA",
            dimensionEstado: "RECOGIDA",
            estadoAnterior: pkg.estado_recogida,
            estadoNuevo: "RECOGIDA_COMPLETADA",
            session,
            ubicacionTexto: `${sol.direccion_texto}, ${sol.ciudad}`,
            observaciones: `Paquete ${pkg.identificador_interno} recogido en sitio. Medidas: ${pkg.largo_cm}x${pkg.ancho_cm}x${pkg.alto_cm} cm — Peso: ${pkg.peso_kg} kg. Entregó: ${nombreQuienEntrega}.`,
            origenEvento:
              codigosEscaneados.length > 0 ? "ESCANER" : "MANUAL",
          });
        }

        // Si hubo diferencia de unidades respecto a lo estimado, registrar Novedad informativa
        if (cantidadRecogidaReal !== sol.cantidad_estimada_paquetes) {
          const novConsecutivo = await generarConsecutivo(
            tx,
            "novedades",
            "NOV"
          );
          await tx.query(
            `INSERT INTO novedades (
              id, consecutivo, tipo_novedad, prioridad, estado_novedad,
              solicitud_id, cliente_id, transportador_id, reportado_por_id,
              titulo, descripcion
            ) VALUES ($1, $2, 'DIFERENCIA_DE_UNIDADES', 'MEDIA', 'ABIERTA', $3, $4, $5, $6, $7, $8)`,
            [
              generateId(),
              novConsecutivo,
              solicitudId,
              sol.cliente_id,
              sol.transportador_asignado_id,
              session.userId,
              `Diferencia de unidades en recogida ${sol.consecutivo}`,
              `La solicitud estimaba ${sol.cantidad_estimada_paquetes} paquete(s) y se recolectaron físicamente ${cantidadRecogidaReal} paquete(s) en punto de recogida.`,
            ]
          );
        }

        await registrarEventoTrazabilidad(tx, {
          solicitudId,
          tipoEvento: "RECOGIDA",
          dimensionEstado: "RECOGIDA",
          estadoAnterior: sol.estado_recogida,
          estadoNuevo: "RECOGIDA_COMPLETADA",
          session,
          ubicacionTexto: `${sol.direccion_texto}, ${sol.ciudad}`,
          observaciones: `Mercancía recogida (${cantidadRecogidaReal} paquetes verificados con medidas). Entregado por: ${nombreQuienEntrega}.`,
          origenEvento:
            codigosEscaneados.length > 0 || paquetesMedidas.length > 0
              ? "ESCANER"
              : "MANUAL",
        });

        await crearNotificacionOperativa(tx, {
          clienteId: sol.cliente_id,
          rolDestino: "COORDINADOR_LOGISTICO",
          tipoNotificacion: "RECOGIDA_COMPLETADA",
          titulo: `Mercancía Recogida ${sol.consecutivo} (${cantidadRecogidaReal} paq.)`,
          mensaje: `El transportador recogió ${cantidadRecogidaReal} paquete(s) en ${sol.direccion_texto} y registró sus medidas.`,
          enlaceAccion: `/admin`,
        });

        return { estadoNuevo: "RECOGIDA_COMPLETADA" };
      }

      // 4. REPORTAR RECOGIDA FALLIDA (Módulo 5 y Módulo 14)
      if (operacion === "REPORTAR_RECOGIDA_FALLIDA") {
        const tipoCausal = String(body.tipoCausal || "RECOGIDA_FALLIDA");
        const motivoFallo = String(
          body.motivoFallo || "Imposibilidad operativa en punto de recogida"
        ).trim();

        await tx.query(
          `UPDATE solicitudes_recogida
           SET estado_recogida = 'RECOGIDA_FALLIDA',
               motivo_fallo_o_cancelacion = $1,
               fecha_cierre_recogida = NOW(),
               version = version + 1,
               updated_at = NOW()
           WHERE id = $2`,
          [motivoFallo, solicitudId]
        );

        await tx.query(
          `UPDATE asignaciones
           SET estado_asignacion = 'FALLIDA',
               fecha_finalizacion = NOW(),
               observaciones_conductor = $1
           WHERE solicitud_id = $2 AND activa = TRUE`,
          [motivoFallo, solicitudId]
        );

        await tx.query(
          `UPDATE paquetes
           SET estado_recogida = 'RECOGIDA_FALLIDA', updated_at = NOW()
           WHERE solicitud_recogida_id = $1`,
          [solicitudId]
        );

        // Crear Novedad Automática en Centro de Incidencias (Módulo 14)
        const novConsecutivo = await generarConsecutivo(tx, "novedades", "NOV");
        const tipoNovedadValido = [
          "CLIENTE_AUSENTE",
          "DIRECCION_INCORRECTA",
          "MERCANCIA_NO_PREPARADA",
          "RECOGIDA_FALLIDA",
        ].includes(tipoCausal)
          ? tipoCausal
          : "RECOGIDA_FALLIDA";

        await tx.query(
          `INSERT INTO novedades (
            id, consecutivo, tipo_novedad, prioridad, estado_novedad,
            solicitud_id, cliente_id, transportador_id, reportado_por_id,
            titulo, descripcion
          ) VALUES ($1, $2, $3, 'ALTA', 'ABIERTA', $4, $5, $6, $7, $8, $9)`,
          [
            generateId(),
            novConsecutivo,
            tipoNovedadValido,
            solicitudId,
            sol.cliente_id,
            sol.transportador_asignado_id,
            session.userId,
            `Recogida Fallida en ${sol.consecutivo} (${tipoNovedadValido})`,
            motivoFallo,
          ]
        );

        await registrarEventoTrazabilidad(tx, {
          solicitudId,
          tipoEvento: "NOVEDAD",
          dimensionEstado: "RECOGIDA",
          estadoAnterior: sol.estado_recogida,
          estadoNuevo: "RECOGIDA_FALLIDA",
          session,
          ubicacionTexto: `${sol.direccion_texto}, ${sol.ciudad}`,
          observaciones: `Recogida fallida (${tipoNovedadValido}): ${motivoFallo}. Novedad generada: ${novConsecutivo}.`,
          origenEvento: "MANUAL",
        });

        await crearNotificacionOperativa(tx, {
          clienteId: sol.cliente_id,
          rolDestino: "COORDINADOR_LOGISTICO",
          tipoNotificacion: "RECOGIDA_FALLIDA",
          titulo: `Alerta: Recogida Fallida ${sol.consecutivo}`,
          mensaje: `Causal: ${tipoNovedadValido} — ${motivoFallo}. Novedad: ${novConsecutivo}.`,
          enlaceAccion: `/admin/novedades`,
        });

        return { estadoNuevo: "RECOGIDA_FALLIDA", novConsecutivo };
      }

      // 5. REPROGRAMAR O CANCELAR SOLICITUD (Módulo 3)
      if (operacion === "REPROGRAMAR" || operacion === "CANCELAR") {
        const nuevoEstado =
          operacion === "REPROGRAMAR" ? "REPROGRAMADA" : "CANCELADA";
        const motivo = String(
          body.motivo || `Operación ${operacion} ejecutada por ${session.nombre}`
        );

        await tx.query(
          `UPDATE solicitudes_recogida
           SET estado_recogida = $1,
               fecha_programada = COALESCE($2, fecha_programada),
               franja_horaria = COALESCE($3, franja_horaria),
               motivo_fallo_o_cancelacion = $4,
               version = version + 1,
               updated_at = NOW()
           WHERE id = $5`,
          [
            nuevoEstado,
            body.fechaProgramada || null,
            body.franjaHoraria || null,
            motivo,
            solicitudId,
          ]
        );

        await tx.query(
          `UPDATE paquetes
           SET estado_recogida = $1, updated_at = NOW()
           WHERE solicitud_recogida_id = $2`,
          [nuevoEstado, solicitudId]
        );

        await registrarEventoTrazabilidad(tx, {
          solicitudId,
          tipoEvento: "PROGRAMACION",
          dimensionEstado: "RECOGIDA",
          estadoAnterior: sol.estado_recogida,
          estadoNuevo: nuevoEstado,
          session,
          ubicacionTexto: `${sol.direccion_texto}, ${sol.ciudad}`,
          observaciones: `${operacion}: ${motivo}`,
          origenEvento: "MANUAL",
        });

        await registrarAuditoria(tx, {
          modulo: "GESTION_RECOGIDAS",
          accion: operacion,
          entidadTipo: "SOLICITUD_RECOGIDA",
          entidadId: solicitudId,
          session,
          justificacion: motivo,
        });

        return { estadoNuevo: nuevoEstado };
      }

      throw new Error(`Operación no reconocida: ${operacion}`);
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Error en PATCH /api/recogidas:", error);
    return NextResponse.json(
      {
        error: "ERROR_ACTUALIZACION_RECOGIDA",
        message:
          error instanceof Error
            ? error.message
            : "Error procesando la actualización de la recogida.",
      },
      { status: 400 }
    );
  }
}
