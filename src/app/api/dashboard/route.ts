import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "NO_AUTENTICADO" }, { status: 401 });
    }

    // Si es CLIENTE, filtrar todos los indicadores exclusivamente a su tenant
    const isCliente = session.rolCodigo === "CLIENTE";
    const clienteFilterSql = isCliente ? `WHERE cliente_id = $1` : "";
    const clienteParams = isCliente ? [session.clienteId] : [];

    // 1. KPIs de Solicitudes y Recogidas
    const solicitudesStats = await query<{
      solicitudes_recibidas: number;
      recogidas_pendientes: number;
      recogidas_programadas: number;
      recogidas_asignadas: number;
      recogidas_en_proceso: number;
      recogidas_completadas: number;
      recogidas_fallidas: number;
    }>(
      `SELECT
        COUNT(*)::int AS solicitudes_recibidas,
        COUNT(*) FILTER (WHERE estado_recogida IN ('SOLICITUD_RECIBIDA', 'PENDIENTE_PROGRAMACION', 'REPROGRAMADA'))::int AS recogidas_pendientes,
        COUNT(*) FILTER (WHERE estado_recogida = 'PROGRAMADA')::int AS recogidas_programadas,
        COUNT(*) FILTER (WHERE estado_recogida = 'ASIGNADA')::int AS recogidas_asignadas,
        COUNT(*) FILTER (WHERE estado_recogida IN ('ACEPTADA', 'EN_CAMINO', 'EN_PUNTO_RECOGIDA'))::int AS recogidas_en_proceso,
        COUNT(*) FILTER (WHERE estado_recogida = 'RECOGIDA_COMPLETADA')::int AS recogidas_completadas,
        COUNT(*) FILTER (WHERE estado_recogida = 'RECOGIDA_FALLIDA')::int AS recogidas_fallidas
       FROM solicitudes_recogida
       ${clienteFilterSql}`,
      clienteParams
    );

    // 2. KPIs de Paquetes, Bodega y Envíos
    const paquetesStats = await query<{
      paquetes_recogidos: number;
      paquetes_pendientes_recepcion: number;
      paquetes_recibidos_bodega: number;
      paquetes_almacenados: number;
      paquetes_pendientes_despacho: number;
      envios_en_transito: number;
      alertas_sin_ubicacion: number;
    }>(
      `SELECT
        COUNT(*) FILTER (WHERE recogido_verificado = TRUE OR estado_recogida = 'RECOGIDA_COMPLETADA')::int AS paquetes_recogidos,
        COUNT(*) FILTER (WHERE estado_recogida = 'RECOGIDA_COMPLETADA' AND estado_bodega = 'PENDIENTE_RECEPCION')::int AS paquetes_pendientes_recepcion,
        COUNT(*) FILTER (WHERE recibido_bodega_verificado = TRUE OR estado_bodega IN ('RECIBIDO', 'EN_VERIFICACION', 'CONFORME', 'CLASIFICADO', 'ALMACENADO'))::int AS paquetes_recibidos_bodega,
        COUNT(*) FILTER (WHERE estado_bodega = 'ALMACENADO')::int AS paquetes_almacenados,
        COUNT(*) FILTER (WHERE recibido_bodega_verificado = TRUE AND estado_despacho IN ('PENDIENTE', 'EN_PREPARACION', 'CONSOLIDADO', 'GUIA_GENERADA', 'LISTO_PARA_DESPACHO'))::int AS paquetes_pendientes_despacho,
        COUNT(*) FILTER (WHERE estado_despacho IN ('ENTREGADO_AL_TRANSPORTADOR', 'EN_TRANSITO'))::int AS envios_en_transito,
        COUNT(*) FILTER (WHERE recibido_bodega_verificado = TRUE AND ubicacion_actual_id IS NULL AND estado_despacho NOT IN ('ENTREGADO_AL_TRANSPORTADOR', 'EN_TRANSITO', 'ENTREGADO'))::int AS alertas_sin_ubicacion
       FROM paquetes
       ${clienteFilterSql}`,
      clienteParams
    );

    // 3. KPIs de Despachos y Novedades
    const [despachosStats, novedadesStats] = await Promise.all([
      query<{ despachos_realizados: number }>(
        isCliente
          ? `SELECT COUNT(DISTINCT dp.despacho_id)::int AS despachos_realizados
             FROM despachos_paquetes dp
             JOIN paquetes p ON p.id = dp.paquete_id
             JOIN despachos d ON d.id = dp.despacho_id
             WHERE p.cliente_id = $1 AND d.estado_despacho IN ('ENTREGADO_AL_TRANSPORTADOR', 'EN_TRANSITO', 'ENTREGADO')`
          : `SELECT COUNT(*) FILTER (WHERE estado_despacho IN ('ENTREGADO_AL_TRANSPORTADOR', 'EN_TRANSITO', 'ENTREGADO'))::int AS despachos_realizados
             FROM despachos`,
        clienteParams
      ),
      query<{ novedades_abiertas: number }>(
        `SELECT COUNT(*) FILTER (WHERE estado_novedad IN ('ABIERTA', 'EN_GESTION', 'PENDIENTE_CLIENTE'))::int AS novedades_abiertas
         FROM novedades
         ${clienteFilterSql}`,
        clienteParams
      ),
    ]);

    // 4. Series Analíticas (Por Fecha, Cliente, Ciudad, Transportador, Tipo de Servicio y Productividad)
    const [porFecha, porCliente, porCiudad, porTransportador, porServicio, ultimosEventos] =
      await Promise.all([
        query(
          `SELECT fecha_solicitada::text AS fecha,
                  COUNT(*)::int AS solicitudes,
                  COUNT(*) FILTER (WHERE estado_recogida = 'RECOGIDA_COMPLETADA')::int AS completadas,
                  COALESCE(SUM(cantidad_estimada_paquetes), 0)::int AS paquetes
           FROM solicitudes_recogida
           ${clienteFilterSql}
           GROUP BY fecha_solicitada
           ORDER BY fecha_solicitada DESC
           LIMIT 7`,
          clienteParams
        ),
        isCliente
          ? Promise.resolve({ rows: [] })
          : query(
              `SELECT c.razon_social AS cliente,
                      COUNT(s.id)::int AS solicitudes,
                      COALESCE(SUM(s.cantidad_estimada_paquetes), 0)::int AS paquetes_estimados
               FROM clientes c
               LEFT JOIN solicitudes_recogida s ON s.cliente_id = c.id
               GROUP BY c.id, c.razon_social
               ORDER BY solicitudes DESC
               LIMIT 6`
            ),
        query(
          `SELECT ciudad,
                  COUNT(*)::int AS solicitudes,
                  COALESCE(SUM(cantidad_estimada_paquetes), 0)::int AS paquetes
           FROM solicitudes_recogida
           ${clienteFilterSql}
           GROUP BY ciudad
           ORDER BY solicitudes DESC
           LIMIT 6`,
          clienteParams
        ),
        isCliente
          ? Promise.resolve({ rows: [] })
          : query(
              `SELECT t.razon_social AS transportador,
                      t.cumplimiento_sla_pct AS sla_pct,
                      COUNT(s.id)::int AS asignadas,
                      COUNT(s.id) FILTER (WHERE s.estado_recogida = 'RECOGIDA_COMPLETADA')::int AS completadas,
                      COUNT(s.id) FILTER (WHERE s.estado_recogida = 'RECOGIDA_FALLIDA')::int AS fallidas
               FROM transportadores t
               LEFT JOIN solicitudes_recogida s ON s.transportador_asignado_id = t.id
               GROUP BY t.id, t.razon_social, t.cumplimiento_sla_pct
               ORDER BY asignadas DESC`
            ),
        query(
          `SELECT tipo_servicio AS servicio,
                  COUNT(*)::int AS total_solicitudes,
                  COALESCE(SUM(cantidad_estimada_paquetes), 0)::int AS paquetes
           FROM solicitudes_recogida
           ${clienteFilterSql}
           GROUP BY tipo_servicio
           ORDER BY total_solicitudes DESC`,
          clienteParams
        ),
        query(
          isCliente
            ? `SELECT e.id, e.tipo_evento, e.dimension_estado, e.estado_nuevo, e.usuario_nombre,
                      e.rol_usuario, e.ubicacion_texto, e.observaciones, e.origen_evento, e.created_at,
                      p.identificador_interno, s.consecutivo AS solicitud_consecutivo
               FROM eventos_trazabilidad e
               LEFT JOIN paquetes p ON p.id = e.paquete_id
               LEFT JOIN solicitudes_recogida s ON s.id = e.solicitud_id
               WHERE p.cliente_id = $1 OR s.cliente_id = $1
               ORDER BY e.created_at DESC
               LIMIT 15`
            : `SELECT e.id, e.tipo_evento, e.dimension_estado, e.estado_nuevo, e.usuario_nombre,
                      e.rol_usuario, e.ubicacion_texto, e.observaciones, e.origen_evento, e.created_at,
                      p.identificador_interno, s.consecutivo AS solicitud_consecutivo
               FROM eventos_trazabilidad e
               LEFT JOIN paquetes p ON p.id = e.paquete_id
               LEFT JOIN solicitudes_recogida s ON s.id = e.solicitud_id
               ORDER BY e.created_at DESC
               LIMIT 15`,
          clienteParams
        ),
      ]);

    const sRow = solicitudesStats.rows[0] || {};
    const pRow = paquetesStats.rows[0] || {};
    const dRow = despachosStats.rows[0] || {};
    const nRow = novedadesStats.rows[0] || {};

    return NextResponse.json({
      kpis: {
        solicitudesRecibidas: Number(sRow.solicitudes_recibidas || 0),
        recogidasPendientes: Number(sRow.recogidas_pendientes || 0),
        recogidasProgramadas: Number(sRow.recogidas_programadas || 0),
        recogidasAsignadas: Number(sRow.recogidas_asignadas || 0),
        recogidasEnProceso: Number(sRow.recogidas_en_proceso || 0),
        recogidasCompletadas: Number(sRow.recogidas_completadas || 0),
        recogidasFallidas: Number(sRow.recogidas_fallidas || 0),
        paquetesRecogidos: Number(pRow.paquetes_recogidos || 0),
        paquetesPendientesRecepcion: Number(
          pRow.paquetes_pendientes_recepcion || 0
        ),
        paquetesRecibidosBodega: Number(pRow.paquetes_recibidos_bodega || 0),
        paquetesAlmacenados: Number(pRow.paquetes_almacenados || 0),
        paquetesPendientesDespacho: Number(
          pRow.paquetes_pendientes_despacho || 0
        ),
        despachosRealizados: Number(dRow.despachos_realizados || 0),
        enviosEnTransito: Number(pRow.envios_en_transito || 0),
        novedadesAbiertas: Number(nRow.novedades_abiertas || 0),
        alertasSinUbicacion: Number(pRow.alertas_sin_ubicacion || 0),
      },
      graficos: {
        porFecha: porFecha.rows,
        porCliente: porCliente.rows,
        porCiudad: porCiudad.rows,
        porTransportador: porTransportador.rows,
        porServicio: porServicio.rows,
      },
      ultimosEventos: ultimosEventos.rows,
    });
  } catch (error) {
    console.error("Error en GET /api/dashboard:", error);
    return NextResponse.json(
      { error: "ERROR_DASHBOARD" },
      { status: 500 }
    );
  }
}
