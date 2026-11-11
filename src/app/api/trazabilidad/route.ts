import { NextRequest, NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { getServerSession } from "@/lib/session";
import { hasPermission } from "@/lib/rbac";
import { generateId } from "@/lib/crypto-auth";
import {
  crearNotificacionOperativa,
  generarConsecutivo,
  registrarEventoTrazabilidad,
} from "@/lib/operational-service";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "NO_AUTENTICADO" }, { status: 401 });
    }

    const q = req.nextUrl.searchParams.get("q")?.trim() || "";
    const paqueteId = req.nextUrl.searchParams.get("paqueteId")?.trim() || "";
    const solicitudId =
      req.nextUrl.searchParams.get("solicitudId")?.trim() || "";

    const isCliente = session.rolCodigo === "CLIENTE";
    const isTransportador = session.rolCodigo === "TRANSPORTADOR_EXTERNO";

    // 1. Eventos de trazabilidad
    let eventosSql = `
      SELECT e.*,
             p.identificador_interno,
             p.guia_externa_principal,
             p.destinatario_nombre,
             p.destinatario_ciudad,
             p.estado_recogida AS pkg_estado_recogida,
             p.estado_bodega AS pkg_estado_bodega,
             p.estado_despacho AS pkg_estado_despacho,
             s.consecutivo AS solicitud_consecutivo,
             c.razon_social AS cliente_nombre
      FROM eventos_trazabilidad e
      LEFT JOIN paquetes p ON p.id = e.paquete_id
      LEFT JOIN solicitudes_recogida s ON s.id = COALESCE(e.solicitud_id, p.solicitud_recogida_id)
      LEFT JOIN clientes c ON c.id = COALESCE(p.cliente_id, s.cliente_id)
      WHERE 1=1
    `;
    const evParams: unknown[] = [];

    if (isCliente) {
      evParams.push(session.clienteId);
      eventosSql += ` AND (p.cliente_id = $${evParams.length} OR s.cliente_id = $${evParams.length})`;
    } else if (isTransportador) {
      evParams.push(session.transportadorId);
      eventosSql += ` AND s.transportador_asignado_id = $${evParams.length}`;
    }

    if (paqueteId) {
      evParams.push(paqueteId);
      eventosSql += ` AND e.paquete_id = $${evParams.length}`;
    }

    if (solicitudId) {
      evParams.push(solicitudId);
      eventosSql += ` AND (e.solicitud_id = $${evParams.length} OR p.solicitud_recogida_id = $${evParams.length})`;
    }

    if (q) {
      evParams.push(`%${q}%`);
      eventosSql += ` AND (
        p.identificador_interno ILIKE $${evParams.length} OR
        p.guia_externa_principal ILIKE $${evParams.length} OR
        s.consecutivo ILIKE $${evParams.length} OR
        e.observaciones ILIKE $${evParams.length} OR
        c.razon_social ILIKE $${evParams.length}
      )`;
    }

    eventosSql += ` ORDER BY e.created_at DESC LIMIT 200`;

    // 2. Novedades (Módulo 14)
    let novSql = `
      SELECT n.*,
             c.razon_social AS cliente_nombre,
             t.razon_social AS transportador_nombre,
             s.consecutivo AS solicitud_consecutivo,
             p.identificador_interno AS paquete_identificador,
             u.nombre_completo AS responsable_nombre,
             rep.nombre_completo AS reportado_por_nombre
      FROM novedades n
      LEFT JOIN clientes c ON c.id = n.cliente_id
      LEFT JOIN transportadores t ON t.id = n.transportador_id
      LEFT JOIN solicitudes_recogida s ON s.id = n.solicitud_id
      LEFT JOIN paquetes p ON p.id = n.paquete_id
      LEFT JOIN usuarios u ON u.id = n.responsable_asignado_id
      LEFT JOIN usuarios rep ON rep.id = n.reportado_por_id
      WHERE 1=1
    `;
    const novParams: unknown[] = [];

    if (isCliente) {
      novParams.push(session.clienteId);
      novSql += ` AND n.cliente_id = $${novParams.length}`;
    } else if (isTransportador) {
      novParams.push(session.transportadorId);
      novSql += ` AND n.transportador_id = $${novParams.length}`;
    }

    novSql += ` ORDER BY n.created_at DESC LIMIT 120`;

    // 3. Notificaciones (Módulo 18)
    let notifSql = `SELECT * FROM notificaciones WHERE 1=1`;
    const notifParams: unknown[] = [];
    if (isCliente) {
      notifParams.push(session.clienteId);
      notifSql += ` AND cliente_id = $1`;
    } else if (isTransportador) {
      notifParams.push(session.transportadorId);
      notifSql += ` AND transportador_id = $1`;
    } else {
      notifParams.push(session.userId, session.rolCodigo);
      notifSql += ` AND (usuario_destino_id = $1 OR rol_destino = $2 OR (cliente_id IS NULL AND transportador_id IS NULL))`;
    }
    notifSql += ` ORDER BY created_at DESC LIMIT 60`;

    const [eventosRes, novedadesRes, notificacionesRes, usuariosInternosRes] =
      await Promise.all([
        query(eventosSql, evParams),
        query(novSql, novParams),
        query(notifSql, notifParams),
        isCliente || isTransportador
          ? Promise.resolve({ rows: [] })
          : query(
              `SELECT id, nombre_completo, cargo FROM usuarios WHERE cliente_id IS NULL AND transportador_id IS NULL AND activo = TRUE`
            ),
      ]);

    return NextResponse.json({
      eventos: eventosRes.rows,
      novedades: novedadesRes.rows,
      notificaciones: notificacionesRes.rows,
      responsablesInternos: usuariosInternosRes.rows,
    });
  } catch (error) {
    console.error("Error en GET /api/trazabilidad:", error);
    return NextResponse.json(
      { error: "ERROR_CONSULTA_TRAZABILIDAD" },
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

    const body = await req.json();
    const action = String(body.action || "CREAR_NOVEDAD");

    // 1. Marcar notificación como leída (Módulo 18)
    if (action === "MARCAR_NOTIFICACION_LEIDA") {
      const notificacionId = String(body.notificacionId || "");
      if (notificacionId === "TODAS") {
        if (session.rolCodigo === "CLIENTE") {
          await query(
            `UPDATE notificaciones SET leida = TRUE, leida_at = NOW() WHERE cliente_id = $1`,
            [session.clienteId]
          );
        } else if (session.rolCodigo === "TRANSPORTADOR_EXTERNO") {
          await query(
            `UPDATE notificaciones SET leida = TRUE, leida_at = NOW() WHERE transportador_id = $1`,
            [session.transportadorId]
          );
        } else {
          await query(
            `UPDATE notificaciones SET leida = TRUE, leida_at = NOW() WHERE leida = FALSE`
          );
        }
      } else {
        await query(
          `UPDATE notificaciones SET leida = TRUE, leida_at = NOW() WHERE id = $1`,
          [notificacionId]
        );
      }
      return NextResponse.json({ ok: true });
    }

    // 2. Actualizar/Resolver Novedad (Módulo 14)
    if (action === "GESTIONAR_NOVEDAD") {
      if (!hasPermission(session, "novedades:gestionar")) {
        return NextResponse.json({ error: "ACCESO_DENEGADO" }, { status: 403 });
      }

      const novedadId = String(body.novedadId || "");
      const nuevoEstado = String(body.estadoNovedad || "EN_GESTION");
      const comentario = String(body.comentario || "").trim();
      const responsableAsignadoId = body.responsableAsignadoId
        ? String(body.responsableAsignadoId)
        : null;
      const resolucionFinal = body.resolucionFinal
        ? String(body.resolucionFinal).trim()
        : null;

      await withTransaction(async (tx) => {
        const novRes = await tx.query<{
          id: string;
          consecutivo: string;
          paquete_id: string | null;
          solicitud_id: string | null;
          cliente_id: string | null;
          estado_novedad: string;
          comentarios_historial_json: string;
        }>(`SELECT * FROM novedades WHERE id = $1`, [novedadId]);

        if (novRes.rows.length === 0) {
          throw new Error("Novedad no encontrada.");
        }
        const nov = novRes.rows[0];
        let historial: unknown[] = [];
        try {
          historial = JSON.parse(nov.comentarios_historial_json || "[]");
        } catch {
          historial = [];
        }

        if (comentario) {
          historial.push({
            fecha: new Date().toISOString(),
            autor: session.nombre,
            rol: session.rolNombre,
            estado: nuevoEstado,
            comentario,
          });
        }

        const isResuelta =
          nuevoEstado === "RESUELTA" || nuevoEstado === "CERRADA";

        await tx.query(
          `UPDATE novedades
           SET estado_novedad = $1,
               responsable_asignado_id = COALESCE($2, responsable_asignado_id),
               acciones_tomadas = COALESCE($3, acciones_tomadas),
               resolucion_final = COALESCE($4, resolucion_final),
               comentarios_historial_json = $5,
               fecha_resolucion = CASE WHEN $6 THEN NOW() ELSE fecha_resolucion END,
               updated_at = NOW()
           WHERE id = $7`,
          [
            nuevoEstado,
            responsableAsignadoId,
            comentario || null,
            resolucionFinal,
            JSON.stringify(historial),
            isResuelta,
            novedadId,
          ]
        );

        // Si la novedad estaba sobre un paquete en estado CON_NOVEDAD y se resuelve, normalizar a CONFORME
        if (isResuelta && nov.paquete_id) {
          await tx.query(
            `UPDATE paquetes
             SET estado_bodega = CASE WHEN estado_bodega = 'CON_NOVEDAD' THEN 'CONFORME' ELSE estado_bodega END,
                 updated_at = NOW()
             WHERE id = $1`,
            [nov.paquete_id]
          );
        }

        await registrarEventoTrazabilidad(tx, {
          paqueteId: nov.paquete_id,
          solicitudId: nov.solicitud_id,
          tipoEvento: "NOVEDAD",
          dimensionEstado: "GENERAL",
          estadoAnterior: nov.estado_novedad,
          estadoNuevo: nuevoEstado,
          session,
          observaciones: `Novedad ${nov.consecutivo} actualizada a ${nuevoEstado}: ${
            resolucionFinal || comentario || "Seguimiento operativo registrado"
          }`,
          origenEvento: "MANUAL",
        });
      });

      return NextResponse.json({ ok: true });
    }

    // 3. Crear Nueva Novedad Operativa (Módulo 14)
    const tipoNovedad = String(body.tipoNovedad || "OTRAS");
    const prioridad = String(body.prioridad || "ALTA");
    const titulo = String(body.titulo || "").trim();
    const descripcion = String(body.descripcion || "").trim();

    if (!titulo || !descripcion) {
      return NextResponse.json(
        {
          error: "DATOS_INCOMPLETOS",
          message: "Título y descripción de la novedad son obligatorios.",
        },
        { status: 400 }
      );
    }

    const result = await withTransaction(async (tx) => {
      const consecutivo = await generarConsecutivo(tx, "novedades", "NOV");
      const novedadId = generateId();

      const comentariosIniciales = [
        {
          fecha: new Date().toISOString(),
          autor: session.nombre,
          rol: session.rolNombre,
          estado: "ABIERTA",
          comentario: descripcion,
        },
      ];

      await tx.query(
        `INSERT INTO novedades (
          id, consecutivo, tipo_novedad, prioridad, estado_novedad,
          solicitud_id, paquete_id, recepcion_id, despacho_id,
          cliente_id, transportador_id, reportado_por_id, responsable_asignado_id,
          titulo, descripcion, comentarios_historial_json, fecha_limite_resolucion
        ) VALUES (
          $1, $2, $3, $4, 'ABIERTA',
          $5, $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15, NOW() + INTERVAL '24 hours'
        )`,
        [
          novedadId,
          consecutivo,
          tipoNovedad,
          prioridad,
          body.solicitudId || null,
          body.paqueteId || null,
          body.recepcionId || null,
          body.despachoId || null,
          session.rolCodigo === "CLIENTE"
            ? session.clienteId
            : body.clienteId || null,
          session.rolCodigo === "TRANSPORTADOR_EXTERNO"
            ? session.transportadorId
            : body.transportadorId || null,
          session.userId,
          body.responsableAsignadoId || null,
          titulo,
          descripcion,
          JSON.stringify(comentariosIniciales),
        ]
      );

      if (body.evidenciaBase64) {
        await tx.query(
          `INSERT INTO evidencias (
            id, entidad_tipo, entidad_id, tipo_evidencia, nombre_archivo,
            mime_type, contenido_base64_o_url, descripcion, registrado_por_id
          ) VALUES ($1, 'NOVEDAD', $2, 'FOTOGRAFIA_MERCANCIA', $3, 'image/jpeg', $4, $5, $6)`,
          [
            generateId(),
            novedadId,
            `evidencia-${consecutivo}.jpg`,
            String(body.evidenciaBase64),
            titulo,
            session.userId,
          ]
        );
      }

      if (body.paqueteId) {
        await tx.query(
          `UPDATE paquetes SET estado_bodega = 'CON_NOVEDAD', updated_at = NOW() WHERE id = $1`,
          [body.paqueteId]
        );
      }

      await registrarEventoTrazabilidad(tx, {
        paqueteId: body.paqueteId || null,
        solicitudId: body.solicitudId || null,
        tipoEvento: "NOVEDAD",
        dimensionEstado: "GENERAL",
        estadoAnterior: null,
        estadoNuevo: consecutivo,
        session,
        observaciones: `Novedad ${consecutivo} (${tipoNovedad}) abierta: ${titulo} — ${descripcion}`,
        origenEvento: "MANUAL",
      });

      await crearNotificacionOperativa(tx, {
        rolDestino: "COORDINADOR_LOGISTICO",
        clienteId:
          session.rolCodigo === "CLIENTE"
            ? session.clienteId
            : body.clienteId || null,
        tipoNotificacion: "NOVEDAD_ABIERTA",
        titulo: `Novedad ${consecutivo}: ${titulo}`,
        mensaje: `Tipo: ${tipoNovedad} (${prioridad}) — ${descripcion}`,
        enlaceAccion: `/admin/novedades`,
      });

      return { novedadId, consecutivo };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Error en POST /api/trazabilidad:", error);
    return NextResponse.json(
      {
        error: "ERROR_PROCESANDO_NOVEDAD",
        message:
          error instanceof Error
            ? error.message
            : "Error registrando la novedad.",
      },
      { status: 500 }
    );
  }
}
