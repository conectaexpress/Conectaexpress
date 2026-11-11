import { NextRequest, NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { getServerSession } from "@/lib/session";
import { hasPermission } from "@/lib/rbac";
import { generateId } from "@/lib/crypto-auth";
import {
  clasificarYBuscarCodigoBarras,
  crearNotificacionOperativa,
  generarConsecutivo,
  registrarAuditoria,
  registrarEventoTrazabilidad,
} from "@/lib/operational-service";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session || !hasPermission(session, "inventario_wms:ver")) {
      return NextResponse.json({ error: "ACCESO_DENEGADO" }, { status: 403 });
    }

    const [
      bodegasRes,
      zonasRes,
      ubicacionesRes,
      recepcionesRes,
      paquetesEsperadosRes,
      paquetesEnBodegaRes,
      movimientosRes,
    ] = await Promise.all([
      query(
        `SELECT b.*,
          (SELECT COUNT(*)::int FROM paquetes p WHERE p.bodega_actual_id = b.id AND p.recibido_bodega_verificado = TRUE AND p.estado_despacho NOT IN ('ENTREGADO_AL_TRANSPORTADOR', 'EN_TRANSITO', 'ENTREGADO')) AS ocupacion_actual_paquetes
         FROM bodegas b
         ORDER BY b.created_at ASC`
      ),
      query(
        `SELECT z.*, b.nombre AS bodega_nombre, b.codigo AS bodega_codigo
         FROM zonas z
         JOIN bodegas b ON b.id = z.bodega_id
         ORDER BY z.codigo ASC`
      ),
      query(
        `SELECT u.*, z.nombre AS zona_nombre, z.tipo_zona, b.codigo AS bodega_codigo,
          (SELECT COUNT(*)::int FROM paquetes p WHERE p.ubicacion_actual_id = u.id AND p.estado_despacho NOT IN ('ENTREGADO_AL_TRANSPORTADOR', 'EN_TRANSITO', 'ENTREGADO')) AS paquetes_en_ubicacion
         FROM ubicaciones u
         JOIN zonas z ON z.id = u.zona_id
         JOIN bodegas b ON b.id = u.bodega_id
         ORDER BY u.codigo_ubicacion ASC`
      ),
      query(
        `SELECT r.*, b.nombre AS bodega_nombre, s.consecutivo AS solicitud_consecutivo,
                c.razon_social AS cliente_nombre, t.razon_social AS transportador_nombre,
                u.nombre_completo AS recibido_por_nombre
         FROM recepciones r
         JOIN bodegas b ON b.id = r.bodega_id
         LEFT JOIN solicitudes_recogida s ON s.id = r.solicitud_recogida_id
         LEFT JOIN clientes c ON c.id = r.cliente_id
         LEFT JOIN transportadores t ON t.id = r.transportador_id
         JOIN usuarios u ON u.id = r.recibido_por_id
         ORDER BY r.created_at DESC
         LIMIT 50`
      ),
      // Paquetes esperados para Recepción en Bodega (Módulo 8)
      query(
        `SELECT p.*, c.razon_social AS cliente_nombre, s.consecutivo AS solicitud_consecutivo,
                t.razon_social AS transportador_nombre
         FROM paquetes p
         JOIN clientes c ON c.id = p.cliente_id
         LEFT JOIN solicitudes_recogida s ON s.id = p.solicitud_recogida_id
         LEFT JOIN transportadores t ON t.id = s.transportador_asignado_id
         WHERE p.estado_bodega = 'PENDIENTE_RECEPCION'
         ORDER BY
           CASE WHEN p.estado_recogida = 'RECOGIDA_COMPLETADA' THEN 0 ELSE 1 END ASC,
           p.created_at DESC`
      ),
      // Paquetes actualmente dentro de Bodega (Módulo 9 y 10)
      query(
        `SELECT p.*, c.razon_social AS cliente_nombre, s.consecutivo AS solicitud_consecutivo,
                b.codigo AS bodega_codigo, z.nombre AS zona_nombre,
                u.codigo_ubicacion AS ubicacion_codigo, d.consecutivo AS despacho_consecutivo,
                EXTRACT(EPOCH FROM (NOW() - COALESCE(p.fecha_recepcion_bodega, p.created_at))) / 3600 AS horas_en_bodega
         FROM paquetes p
         JOIN clientes c ON c.id = p.cliente_id
         LEFT JOIN solicitudes_recogida s ON s.id = p.solicitud_recogida_id
         LEFT JOIN bodegas b ON b.id = p.bodega_actual_id
         LEFT JOIN zonas z ON z.id = p.zona_actual_id
         LEFT JOIN ubicaciones u ON u.id = p.ubicacion_actual_id
         LEFT JOIN despachos d ON d.id = p.despacho_actual_id
         WHERE p.recibido_bodega_verificado = TRUE
           AND p.estado_despacho NOT IN ('ENTREGADO_AL_TRANSPORTADOR', 'EN_TRANSITO', 'ENTREGADO')
         ORDER BY p.fecha_recepcion_bodega DESC NULLS LAST`
      ),
      query(
        `SELECT m.*, p.identificador_interno, b.codigo AS bodega_codigo,
                uo.codigo_ubicacion AS ubicacion_origen_codigo,
                ud.codigo_ubicacion AS ubicacion_destino_codigo,
                u.nombre_completo AS ejecutado_por_nombre
         FROM movimientos_inventario m
         JOIN paquetes p ON p.id = m.paquete_id
         JOIN bodegas b ON b.id = m.bodega_id
         LEFT JOIN ubicaciones uo ON uo.id = m.ubicacion_origen_id
         LEFT JOIN ubicaciones ud ON ud.id = m.ubicacion_destino_id
         JOIN usuarios u ON u.id = m.ejecutado_por_id
         ORDER BY m.created_at DESC
         LIMIT 80`
      ),
    ]);

    return NextResponse.json({
      bodegas: bodegasRes.rows,
      zonas: zonasRes.rows,
      ubicaciones: ubicacionesRes.rows,
      recepciones: recepcionesRes.rows,
      paquetesEsperados: paquetesEsperadosRes.rows,
      paquetesEnBodega: paquetesEnBodegaRes.rows,
      movimientos: movimientosRes.rows,
    });
  } catch (error) {
    console.error("Error en GET /api/bodega:", error);
    return NextResponse.json(
      { error: "ERROR_CONSULTA_BODEGA_WMS" },
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
    const action = String(body.action || "");

    // =========================================================================
    // 1. MÓDULO 8: RECEPCIÓN MASIVA EN BODEGA (Separado de Recogida Física)
    // =========================================================================
    if (action === "REGISTRAR_RECEPCION_BODEGA") {
      if (!hasPermission(session, "bodega_recepcion:operar")) {
        return NextResponse.json({ error: "ACCESO_DENEGADO" }, { status: 403 });
      }

      const bodegaId = String(body.bodegaId || "bod-bog-01");
      const solicitudRecogidaId = body.solicitudRecogidaId
        ? String(body.solicitudRecogidaId)
        : null;
      const ubicacionRecepcionId = String(
        body.ubicacionRecepcionId || "ubi-rec-01"
      );
      const unidadesEsperadas = Math.max(
        0,
        Number(body.unidadesEsperadas || 0)
      );
      const itemsEscaneados: Array<{
        codigo: string;
        estadoFisico: "CONFORME" | "AVERIADO" | "SOBRANTE" | "NO_IDENTIFICADO";
        observacion?: string;
      }> = Array.isArray(body.itemsEscaneados) ? body.itemsEscaneados : [];

      if (itemsEscaneados.length === 0 && Number(body.unidadesFaltantes || 0) === 0) {
        return NextResponse.json(
          {
            error: "RECEPCION_VACIA",
            message:
              "Debe escanear al menos un paquete o reportar las diferencias para registrar el acta de recepción.",
          },
          { status: 400 }
        );
      }

      const result = await withTransaction(async (tx) => {
        const recepcionConsecutivo = await generarConsecutivo(
          tx,
          "recepciones",
          "RBO"
        );
        const recepcionId = generateId();

        let conformesCount = 0;
        let averiadosCount = 0;
        let sobrantesCount = 0;
        let noIdentificadosCount = 0;

        for (const item of itemsEscaneados) {
          if (item.estadoFisico === "AVERIADO") averiadosCount++;
          else if (item.estadoFisico === "SOBRANTE") sobrantesCount++;
          else if (item.estadoFisico === "NO_IDENTIFICADO")
            noIdentificadosCount++;
          else conformesCount++;
        }

        const totalRecibidos = itemsEscaneados.length;
        const faltantesCount = Math.max(
          0,
          unidadesEsperadas - (conformesCount + averiadosCount)
        );

        const hayDiferenciasONovedades =
          faltantesCount > 0 ||
          sobrantesCount > 0 ||
          averiadosCount > 0 ||
          noIdentificadosCount > 0;

        const estadoRecepcion = hayDiferenciasONovedades
          ? "CERRADA_CON_NOVEDAD"
          : "CERRADA_CONFORME";

        let clienteIdAsociado: string | null = body.clienteId || null;
        let transportadorIdAsociado: string | null =
          body.transportadorId || null;

        if (solicitudRecogidaId) {
          const solRes = await tx.query<{
            cliente_id: string;
            transportador_asignado_id: string | null;
          }>(
            `SELECT cliente_id, transportador_asignado_id FROM solicitudes_recogida WHERE id = $1`,
            [solicitudRecogidaId]
          );
          if (solRes.rows.length > 0) {
            clienteIdAsociado = solRes.rows[0].cliente_id;
            transportadorIdAsociado = solRes.rows[0].transportador_asignado_id;
          }
        }

        await tx.query(
          `INSERT INTO recepciones (
            id, consecutivo, bodega_id, solicitud_recogida_id, cliente_id,
            transportador_id, placa_vehiculo, recibido_por_id,
            unidades_esperadas, unidades_escaneadas_conformes,
            unidades_faltantes, unidades_sobrantes, unidades_averiadas,
            unidades_no_identificadas, estado_recepcion, observaciones, fecha_cierre
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8,
            $9, $10,
            $11, $12, $13,
            $14, $15, $16, NOW()
          )`,
          [
            recepcionId,
            recepcionConsecutivo,
            bodegaId,
            solicitudRecogidaId,
            clienteIdAsociado,
            transportadorIdAsociado,
            body.placaVehiculo ? String(body.placaVehiculo).toUpperCase() : null,
            session.userId,
            unidadesEsperadas,
            conformesCount,
            faltantesCount,
            sobrantesCount,
            averiadosCount,
            noIdentificadosCount,
            estadoRecepcion,
            body.observaciones ? String(body.observaciones) : null,
          ]
        );

        // Procesar cada paquete escaneado en la recepción
        for (const item of itemsEscaneados) {
          const clasif = await clasificarYBuscarCodigoBarras(item.codigo);
          let pkgId: string | null = clasif.paquete
            ? String((clasif.paquete as { id: string }).id)
            : null;
          let pkgIdentificador = clasif.paquete
            ? String(
                (clasif.paquete as { identificador_interno: string })
                  .identificador_interno
              )
            : "";

          // Regla Operativa #5: "Todo paquete recibido debe quedar identificado."
          // Si no existía previamente en BD, crearle de inmediato su Paquete e Identificador Interno CE
          if (!pkgId) {
            pkgId = generateId();
            pkgIdentificador = await generarConsecutivo(
              tx,
              "paquetes",
              process.env.CE_INTERNAL_LABEL_PREFIX || "CE"
            );

            await tx.query(
              `INSERT INTO paquetes (
                id, identificador_interno, solicitud_recogida_id, cliente_id,
                remitente_nombre, remitente_direccion, remitente_ciudad,
                destinatario_nombre, destinatario_telefono, destinatario_direccion, destinatario_ciudad,
                contenido_declarado, tipo_mercancia,
                bodega_actual_id, zona_actual_id, ubicacion_actual_id,
                guia_externa_principal, transportadora_principal,
                estado_recogida, estado_bodega, estado_despacho,
                recogido_verificado, recibido_bodega_verificado,
                es_mercancia_no_identificada, fecha_recepcion_bodega
              ) VALUES (
                $1, $2, $3, $4,
                'Recibido en Muelle Bodega', 'Bodega Conecta Express', 'Bogotá D.C.',
                'Por Verificar en Bodega', '0000000000', 'Por Verificar', 'Nacional',
                'Ingreso en Recepción Masiva', 'PAQUETERIA_ESTANDAR',
                $5, 'zon-bog-rec', $6,
                $7, $8,
                'RECOGIDA_COMPLETADA', $9, 'PENDIENTE',
                TRUE, TRUE,
                $10, NOW()
              )`,
              [
                pkgId,
                pkgIdentificador,
                solicitudRecogidaId,
                clienteIdAsociado || "cli-corporativo-01",
                bodegaId,
                ubicacionRecepcionId,
                clasif.clasificacion === "GUIA_COORDINADORA" ||
                  clasif.clasificacion === "GUIA_OTRA_TRANSPORTADORA"
                  ? clasif.codigoLimpio
                  : null,
                clasif.transportadoraDetectada || "COORDINADORA",
                item.estadoFisico === "CONFORME" ? "CONFORME" : "CON_NOVEDAD",
                item.estadoFisico === "NO_IDENTIFICADO" ||
                  clasif.clasificacion === "CODIGO_DESCONOCIDO",
              ]
            );

            await tx.query(
              `INSERT INTO rotulos_internos (
                id, paquete_id, codigo_barras_code128, contenido_qr, formato_etiqueta, generado_por_id
              ) VALUES ($1, $2, $3, $4, '4X6', $5)`,
              [
                generateId(),
                pkgId,
                pkgIdentificador,
                JSON.stringify({
                  ceId: pkgIdentificador,
                  recepcion: recepcionConsecutivo,
                  lecturaOriginal: clasif.codigoLimpio,
                }),
                session.userId,
              ]
            );
          } else {
            // Actualizar el paquete existente a recibido y verificado en bodega
            const nuevoEstadoBodega =
              item.estadoFisico === "CONFORME" ? "CONFORME" : "CON_NOVEDAD";

            await tx.query(
              `UPDATE paquetes
               SET estado_bodega = $1,
                   recibido_bodega_verificado = TRUE,
                   bodega_actual_id = $2,
                   zona_actual_id = 'zon-bog-rec',
                   ubicacion_actual_id = $3,
                   fecha_recepcion_bodega = NOW(),
                   version = version + 1,
                   updated_at = NOW()
               WHERE id = $4`,
              [nuevoEstadoBodega, bodegaId, ubicacionRecepcionId, pkgId]
            );
          }

          await tx.query(
            `INSERT INTO recepciones_detalle (
              id, recepcion_id, paquete_id, codigo_leido,
              clasificacion_lectura, estado_fisico, observacion_item, escaneado_por_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              generateId(),
              recepcionId,
              pkgId,
              clasif.codigoLimpio,
              clasif.clasificacion,
              item.estadoFisico,
              item.observacion || null,
              session.userId,
            ]
          );

          // Registrar Movimiento de Entrada en Inventario WMS (Módulo 9)
          const movConsecutivo = await generarConsecutivo(
            tx,
            "movimientos_inventario",
            "MOV"
          );
          await tx.query(
            `INSERT INTO movimientos_inventario (
              id, consecutivo_movimiento, paquete_id, bodega_id,
              ubicacion_origen_id, ubicacion_destino_id, tipo_movimiento,
              motivo, ejecutado_por_id, metodo_captura
            ) VALUES ($1, $2, $3, $4, NULL, $5, 'INGRESO_RECEPCION', $6, $7, 'ESCANER')`,
            [
              generateId(),
              movConsecutivo,
              pkgId,
              bodegaId,
              ubicacionRecepcionId,
              `Ingreso por Acta de Recepción ${recepcionConsecutivo} (${item.estadoFisico})`,
              session.userId,
            ]
          );

          await registrarEventoTrazabilidad(tx, {
            paqueteId: pkgId,
            solicitudId: solicitudRecogidaId,
            recepcionId,
            tipoEvento: "RECEPCION",
            dimensionEstado: "BODEGA",
            estadoAnterior: "PENDIENTE_RECEPCION",
            estadoNuevo:
              item.estadoFisico === "CONFORME" ? "CONFORME" : "CON_NOVEDAD",
            session,
            ubicacionTexto: "Muelle de Recepción Bodega Conecta Express",
            observaciones: `Recepción en bodega confirmada (${recepcionConsecutivo}) para paquete ${pkgIdentificador} [Estado físico: ${item.estadoFisico}].`,
            origenEvento: "ESCANER",
          });
        }

        // Si hubo faltantes, sobrantes, averiados o no identificados, abrir Novedad Automática (Módulo 8 y 14)
        if (hayDiferenciasONovedades) {
          const novConsecutivo = await generarConsecutivo(
            tx,
            "novedades",
            "NOV"
          );
          const tipoNov =
            averiadosCount > 0
              ? "PAQUETE_AVERIADO"
              : faltantesCount > 0
              ? "FALTANTE"
              : sobrantesCount > 0
              ? "SOBRANTE"
              : "PAQUETE_SIN_IDENTIFICAR";

          await tx.query(
            `INSERT INTO novedades (
              id, consecutivo, tipo_novedad, prioridad, estado_novedad,
              solicitud_id, recepcion_id, cliente_id, transportador_id,
              reportado_por_id, titulo, descripcion
            ) VALUES ($1, $2, $3, 'ALTA', 'ABIERTA', $4, $5, $6, $7, $8, $9, $10)`,
            [
              generateId(),
              novConsecutivo,
              tipoNov,
              solicitudRecogidaId,
              recepcionId,
              clienteIdAsociado,
              transportadorIdAsociado,
              session.userId,
              `Diferencias en Recepción de Bodega ${recepcionConsecutivo}`,
              `Esperadas: ${unidadesEsperadas} | Conformes: ${conformesCount} | Faltantes: ${faltantesCount} | Sobrantes: ${sobrantesCount} | Averiadas: ${averiadosCount} | No identificadas: ${noIdentificadosCount}.`,
            ]
          );
        }

        await crearNotificacionOperativa(tx, {
          clienteId: clienteIdAsociado,
          rolDestino: "RESPONSABLE_DESPACHO",
          tipoNotificacion: "MERCANCIA_RECIBIDA",
          titulo: `Recepción en Bodega ${recepcionConsecutivo} Registrada`,
          mensaje: `Se recibieron ${totalRecibidos} paquetes en bodega (${conformesCount} conformes). Estado: ${estadoRecepcion}.`,
          enlaceAccion: `/admin/bodega`,
        });

        return {
          recepcionId,
          recepcionConsecutivo,
          estadoRecepcion,
          totalRecibidos,
          faltantesCount,
        };
      });

      return NextResponse.json({ ok: true, ...result });
    }

    // =========================================================================
    // 2. MÓDULO 9: CREAR NUEVA UBICACIÓN FÍSICA WMS (Sede/Bodega/Zona/Pasillo/Estantería/Nivel)
    // =========================================================================
    if (action === "CREAR_UBICACION_WMS") {
      if (!hasPermission(session, "inventario_wms:mover")) {
        return NextResponse.json({ error: "ACCESO_DENEGADO" }, { status: 403 });
      }

      const bodegaId = String(body.bodegaId || "bod-bog-01");
      const zonaId = String(body.zonaId || "zon-bog-alm");
      const pasillo = String(body.pasillo || "P01")
        .trim()
        .toUpperCase();
      const estanteria = String(body.estanteria || "E01")
        .trim()
        .toUpperCase();
      const nivel = String(body.nivel || "N01")
        .trim()
        .toUpperCase();
      const posicion = String(body.posicion || "01")
        .trim()
        .toUpperCase();
      const capacidadMax = Math.max(1, Number(body.capacidadMaxPaquetes || 60));

      const codigoUbicacion = `BOG-${pasillo}-${estanteria}-${nivel}-${posicion}`;
      const id = generateId();

      await query(
        `INSERT INTO ubicaciones (
          id, bodega_id, zona_id, codigo_ubicacion, codigo_barras_ubicacion,
          pasillo, estanteria, nivel, posicion, capacidad_max_paquetes
        ) VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          bodegaId,
          zonaId,
          codigoUbicacion,
          pasillo,
          estanteria,
          nivel,
          posicion,
          capacidadMax,
        ]
      );

      return NextResponse.json({ ok: true, id, codigoUbicacion });
    }

    // =========================================================================
    // 3. MÓDULO 9 & 10: UBICAR, TRASLADAR O CLASIFICAR PAQUETE EN BODEGA
    // =========================================================================
    if (action === "MOVER_O_CLASIFICAR_PAQUETE") {
      if (!hasPermission(session, "inventario_wms:mover")) {
        return NextResponse.json({ error: "ACCESO_DENEGADO" }, { status: 403 });
      }

      const paqueteId = String(body.paqueteId || "");
      const ubicacionDestinoId = String(body.ubicacionDestinoId || "");
      const nuevoEstadoBodega =
        body.nuevoEstadoBodega === "CLASIFICADO" ? "CLASIFICADO" : "ALMACENADO";
      const motivo = String(
        body.motivo || `Movimiento interno WMS a ${nuevoEstadoBodega}`
      );

      if (!paqueteId || !ubicacionDestinoId) {
        return NextResponse.json(
          { error: "PARAMETROS_INCOMPLETOS" },
          { status: 400 }
        );
      }

      await withTransaction(async (tx) => {
        const [pkgRes, ubiRes] = await Promise.all([
          tx.query<{
            id: string;
            identificador_interno: string;
            estado_bodega: string;
            ubicacion_actual_id: string | null;
          }>(`SELECT * FROM paquetes WHERE id = $1`, [paqueteId]),
          tx.query<{
            id: string;
            bodega_id: string;
            zona_id: string;
            codigo_ubicacion: string;
          }>(`SELECT * FROM ubicaciones WHERE id = $1`, [ubicacionDestinoId]),
        ]);

        if (pkgRes.rows.length === 0 || ubiRes.rows.length === 0) {
          throw new Error("Paquete o ubicación física no encontrados.");
        }

        const pkg = pkgRes.rows[0];
        const ubi = ubiRes.rows[0];

        await tx.query(
          `UPDATE paquetes
           SET bodega_actual_id = $1,
               zona_actual_id = $2,
               ubicacion_actual_id = $3,
               estado_bodega = $4,
               fecha_ubicacion_bodega = NOW(),
               version = version + 1,
               updated_at = NOW()
           WHERE id = $5`,
          [ubi.bodega_id, ubi.zona_id, ubi.id, nuevoEstadoBodega, pkg.id]
        );

        const movConsecutivo = await generarConsecutivo(
          tx,
          "movimientos_inventario",
          "MOV"
        );
        await tx.query(
          `INSERT INTO movimientos_inventario (
            id, consecutivo_movimiento, paquete_id, bodega_id,
            ubicacion_origen_id, ubicacion_destino_id, tipo_movimiento,
            motivo, ejecutado_por_id, metodo_captura
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ESCANER')`,
          [
            generateId(),
            movConsecutivo,
            pkg.id,
            ubi.bodega_id,
            pkg.ubicacion_actual_id,
            ubi.id,
            nuevoEstadoBodega === "CLASIFICADO"
              ? "CLASIFICACION_ZONA"
              : "TRASLADO_INTERNO",
            motivo,
            session.userId,
          ]
        );

        await registrarEventoTrazabilidad(tx, {
          paqueteId: pkg.id,
          tipoEvento:
            nuevoEstadoBodega === "CLASIFICADO"
              ? "CLASIFICACION"
              : "TRASLADO_INTERNO",
          dimensionEstado: "BODEGA",
          estadoAnterior: pkg.estado_bodega,
          estadoNuevo: nuevoEstadoBodega,
          session,
          ubicacionTexto: ubi.codigo_ubicacion,
          observaciones: `${motivo} → Ubicación física: ${ubi.codigo_ubicacion}.`,
          origenEvento: "ESCANER",
        });

        await registrarAuditoria(tx, {
          modulo: "WMS_INVENTARIO_Y_CLASIFICACION",
          accion: nuevoEstadoBodega,
          entidadTipo: "PAQUETE",
          entidadId: pkg.id,
          session,
          datosNuevos: {
            ubicacionDestino: ubi.codigo_ubicacion,
            estadoBodega: nuevoEstadoBodega,
          },
          justificacion: motivo,
        });
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "ACCION_NO_SOPORTADA" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error en POST /api/bodega:", error);
    return NextResponse.json(
      {
        error: "ERROR_OPERACION_BODEGA",
        message:
          error instanceof Error
            ? error.message
            : "Error procesando operación de bodega.",
      },
      { status: 500 }
    );
  }
}
