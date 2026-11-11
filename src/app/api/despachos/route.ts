import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
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

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session || !hasPermission(session, "despachos:ver")) {
      return NextResponse.json({ error: "ACCESO_DENEGADO" }, { status: 403 });
    }

    const [despachosRes, detalleRes, manifiestosRes, paquetesDisponiblesRes] =
      await Promise.all([
        query(
          `SELECT d.*, b.nombre AS bodega_nombre, b.codigo AS bodega_codigo,
                  c.razon_social AS cliente_consolidado_nombre,
                  u.nombre_completo AS responsable_nombre
           FROM despachos d
           JOIN bodegas b ON b.id = d.bodega_origen_id
           LEFT JOIN clientes c ON c.id = d.cliente_consolidado_id
           LEFT JOIN usuarios u ON u.id = d.responsable_id
           ORDER BY d.created_at DESC`
        ),
        query(
          `SELECT dp.*, p.identificador_interno, p.guia_externa_principal,
                  p.destinatario_nombre, p.destinatario_ciudad, p.peso_kg,
                  p.estado_bodega, p.estado_despacho,
                  c.razon_social AS cliente_nombre
           FROM despachos_paquetes dp
           JOIN paquetes p ON p.id = dp.paquete_id
           JOIN clientes c ON c.id = p.cliente_id
           ORDER BY dp.created_at DESC`
        ),
        query(
          `SELECT m.*, d.consecutivo AS despacho_consecutivo, u.nombre_completo AS generado_por_nombre
           FROM manifiestos m
           JOIN despachos d ON d.id = m.despacho_id
           JOIN usuarios u ON u.id = m.generado_por_id
           ORDER BY m.created_at DESC`
        ),
        // Paquetes recibidos en bodega disponibles para consolidar en un Despacho
        query(
          `SELECT p.*, c.razon_social AS cliente_nombre, u.codigo_ubicacion AS ubicacion_codigo
           FROM paquetes p
           JOIN clientes c ON c.id = p.cliente_id
           LEFT JOIN ubicaciones u ON u.id = p.ubicacion_actual_id
           WHERE p.recibido_bodega_verificado = TRUE
             AND p.despacho_actual_id IS NULL
             AND p.estado_despacho IN ('PENDIENTE', 'EN_PREPARACION', 'GUIA_GENERADA')
           ORDER BY p.destinatario_ciudad ASC, p.created_at DESC`
        ),
      ]);

    return NextResponse.json({
      despachos: despachosRes.rows,
      despachosPaquetes: detalleRes.rows,
      manifiestos: manifiestosRes.rows,
      paquetesDisponibles: paquetesDisponiblesRes.rows,
    });
  } catch (error) {
    console.error("Error en GET /api/despachos:", error);
    return NextResponse.json(
      { error: "ERROR_CONSULTA_DESPACHOS" },
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
    const action = String(body.action || "CREAR_DESPACHO");

    // =========================================================================
    // 1. CREAR DESPACHO Y CONSOLIDAR PAQUETES (Módulo 10 y 11)
    // =========================================================================
    if (action === "CREAR_DESPACHO") {
      if (!hasPermission(session, "despachos:crear")) {
        return NextResponse.json({ error: "ACCESO_DENEGADO" }, { status: 403 });
      }

      const transportadoraAliada = String(
        body.transportadoraAliada || "COORDINADORA"
      ).toUpperCase();
      const ciudadDestino = String(body.ciudadDestino || "Nacional").trim();
      const tipoServicio = String(
        body.tipoServicio || "TERRESTRE_NACIONAL"
      ).trim();
      const fechaProgramadaSalida = String(
        body.fechaProgramadaSalida || new Date().toISOString().slice(0, 10)
      );
      const paquetesIds: string[] = Array.isArray(body.paquetesIds)
        ? body.paquetesIds.map(String)
        : [];

      const created = await withTransaction(async (tx) => {
        const consecutivo = await generarConsecutivo(tx, "despachos", "DSP");
        const despachoId = generateId();

        let pesoTotal = 0;
        if (paquetesIds.length > 0) {
          const placeholders = paquetesIds
            .map((_, idx) => `$${idx + 1}`)
            .join(", ");
          const sumRes = await tx.query<{ peso: number }>(
            `SELECT COALESCE(SUM(peso_kg), 0)::numeric AS peso FROM paquetes WHERE id IN (${placeholders})`,
            paquetesIds
          );
          pesoTotal = Number(sumRes.rows[0]?.peso || 0);
        }

        await tx.query(
          `INSERT INTO despachos (
            id, consecutivo, bodega_origen_id, transportadora_aliada,
            ciudad_destino, tipo_servicio, fecha_programada_salida,
            total_paquetes_incluidos, total_paquetes_verificados, peso_total_kg,
            estado_despacho, responsable_id, placa_vehiculo_transportadora,
            conductor_transportadora_nombre, conductor_transportadora_cedula, observaciones
          ) VALUES (
            $1, $2, 'bod-bog-01', $3,
            $4, $5, $6,
            $7, 0, $8,
            $9, $10, $11,
            $12, $13, $14
          )`,
          [
            despachoId,
            consecutivo,
            transportadoraAliada,
            ciudadDestino,
            tipoServicio,
            fechaProgramadaSalida,
            paquetesIds.length,
            pesoTotal,
            paquetesIds.length > 0 ? "CONSOLIDADO" : "EN_PREPARACION",
            session.userId,
            body.placaVehiculo
              ? String(body.placaVehiculo).toUpperCase()
              : null,
            body.conductorNombre ? String(body.conductorNombre) : null,
            body.conductorCedula ? String(body.conductorCedula) : null,
            body.observaciones ? String(body.observaciones) : null,
          ]
        );

        for (const pkgId of paquetesIds) {
          await tx.query(
            `INSERT INTO despachos_paquetes (
              id, despacho_id, paquete_id, estado_en_despacho, escaneado_salida
            ) VALUES ($1, $2, $3, 'CONSOLIDADO', FALSE)
            ON CONFLICT (despacho_id, paquete_id) DO NOTHING`,
            [generateId(), despachoId, pkgId]
          );

          await tx.query(
            `UPDATE paquetes
             SET despacho_actual_id = $1,
                 estado_bodega = 'CLASIFICADO',
                 estado_despacho = 'CONSOLIDADO',
                 despacho_salida_verificado = FALSE,
                 version = version + 1,
                 updated_at = NOW()
             WHERE id = $2`,
            [despachoId, pkgId]
          );

          await registrarEventoTrazabilidad(tx, {
            paqueteId: pkgId,
            despachoId,
            tipoEvento: "PREPARACION",
            dimensionEstado: "DESPACHO",
            estadoAnterior: "PENDIENTE",
            estadoNuevo: "CONSOLIDADO",
            session,
            ubicacionTexto: "Bahía de Consolidación Bodega Bogotá",
            observaciones: `Paquete consolidado en el despacho ${consecutivo} con destino ${ciudadDestino} (${transportadoraAliada}).`,
            origenEvento: "MANUAL",
          });
        }

        // Generar Manifiesto Inicial
        const numManifiesto = await generarConsecutivo(
          tx,
          "manifiestos",
          "MAN"
        );
        const hashVerificacion = crypto
          .createHash("sha256")
          .update(`${consecutivo}-${numManifiesto}-${Date.now()}`)
          .digest("hex")
          .slice(0, 24)
          .toUpperCase();

        await tx.query(
          `INSERT INTO manifiestos (
            id, numero_manifiesto, despacho_id, transportadora, ciudad_destino,
            total_paquetes, peso_total_kg, hash_verificacion, generado_por_id, datos_snapshot_json
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            generateId(),
            numManifiesto,
            despachoId,
            transportadoraAliada,
            ciudadDestino,
            paquetesIds.length,
            pesoTotal,
            hashVerificacion,
            session.userId,
            JSON.stringify({ consecutivo, paquetesIds, fechaProgramadaSalida }),
          ]
        );

        return { despachoId, consecutivo, numManifiesto };
      });

      return NextResponse.json({ ok: true, ...created });
    }

    // =========================================================================
    // 2. AGREGAR PAQUETE A DESPACHO O DESCONSOLIDAR CON AUDITORÍA (Módulo 10)
    // "Un paquete puede pertenecer a un despacho y posteriormente ser separado con un registro de auditoría."
    // =========================================================================
    if (action === "DESCONSOLIDAR_PAQUETE") {
      if (!hasPermission(session, "clasificacion:operar")) {
        return NextResponse.json({ error: "ACCESO_DENEGADO" }, { status: 403 });
      }

      const despachoId = String(body.despachoId || "");
      const paqueteId = String(body.paqueteId || "");
      const motivoDesconsolidacion = String(
        body.motivoDesconsolidacion || ""
      ).trim();

      if (!despachoId || !paqueteId || !motivoDesconsolidacion) {
        return NextResponse.json(
          {
            error: "MOTIVO_AUDITORIA_REQUERIDO",
            message:
              "Para separar/desconsolidar un paquete de un despacho es obligatorio registrar el motivo de auditoría.",
          },
          { status: 400 }
        );
      }

      await withTransaction(async (tx) => {
        await tx.query(
          `UPDATE despachos_paquetes
           SET estado_en_despacho = 'DESCONSOLIDADO',
               escaneado_salida = FALSE,
               fecha_desconsolidacion = NOW(),
               desconsolidado_por_id = $1,
               motivo_desconsolidacion = $2
           WHERE despacho_id = $3 AND paquete_id = $4`,
          [session.userId, motivoDesconsolidacion, despachoId, paqueteId]
        );

        await tx.query(
          `UPDATE paquetes
           SET despacho_actual_id = NULL,
               estado_despacho = 'PENDIENTE',
               despacho_salida_verificado = FALSE,
               version = version + 1,
               updated_at = NOW()
           WHERE id = $1`,
          [paqueteId]
        );

        // Recalcular conteo de paquetes del despacho
        await tx.query(
          `UPDATE despachos
           SET total_paquetes_incluidos = (
                 SELECT COUNT(*)::int FROM despachos_paquetes
                 WHERE despacho_id = $1 AND estado_en_despacho != 'DESCONSOLIDADO'
               ),
               total_paquetes_verificados = (
                 SELECT COUNT(*)::int FROM despachos_paquetes
                 WHERE despacho_id = $1 AND estado_en_despacho = 'ESCANEADO_SALIDA_OK'
               ),
               updated_at = NOW()
           WHERE id = $1`,
          [despachoId]
        );

        await registrarEventoTrazabilidad(tx, {
          paqueteId,
          despachoId,
          tipoEvento: "DESCONSOLIDACION",
          dimensionEstado: "DESPACHO",
          estadoAnterior: "CONSOLIDADO",
          estadoNuevo: "PENDIENTE",
          session,
          observaciones: `Paquete desconsolidado del despacho con registro de auditoría: ${motivoDesconsolidacion}`,
          origenEvento: "MANUAL",
        });

        await registrarAuditoria(tx, {
          modulo: "CLASIFICACION_Y_CONSOLIDACION",
          accion: "DESCONSOLIDAR_PAQUETE",
          entidadTipo: "DESPACHO_PAQUETE",
          entidadId: `${despachoId}:${paqueteId}`,
          session,
          justificacion: motivoDesconsolidacion,
        });
      });

      return NextResponse.json({ ok: true });
    }

    // =========================================================================
    // 3. ESCANEAR PAQUETE ANTES DE SALIDA DE DESPACHO (Módulo 11)
    // =========================================================================
    if (action === "ESCANEAR_VERIFICACION_SALIDA") {
      if (!hasPermission(session, "despachos:crear")) {
        return NextResponse.json({ error: "ACCESO_DENEGADO" }, { status: 403 });
      }

      const despachoId = String(body.despachoId || "");
      const codigoEscaneado = String(body.codigoEscaneado || "")
        .trim()
        .toUpperCase();

      if (!despachoId || !codigoEscaneado) {
        return NextResponse.json(
          { error: "DATOS_INCOMPLETOS" },
          { status: 400 }
        );
      }

      const verified = await withTransaction(async (tx) => {
        const dpRes = await tx.query<{
          id: string;
          paquete_id: string;
          identificador_interno: string;
          guia_externa_principal: string | null;
          escaneado_salida: boolean;
        }>(
          `SELECT dp.id, dp.paquete_id, p.identificador_interno, p.guia_externa_principal, dp.escaneado_salida
           FROM despachos_paquetes dp
           JOIN paquetes p ON p.id = dp.paquete_id
           WHERE dp.despacho_id = $1
             AND dp.estado_en_despacho != 'DESCONSOLIDADO'
             AND (UPPER(p.identificador_interno) = $2 OR UPPER(COALESCE(p.guia_externa_principal, '')) = $2)
           LIMIT 1`,
          [despachoId, codigoEscaneado]
        );

        if (dpRes.rows.length === 0) {
          throw new Error(
            `El código ${codigoEscaneado} NO pertenece a este despacho o fue desconsolidado.`
          );
        }

        const item = dpRes.rows[0];
        if (item.escaneado_salida) {
          return {
            yaVerificado: true,
            identificadorInterno: item.identificador_interno,
          };
        }

        await tx.query(
          `UPDATE despachos_paquetes
           SET estado_en_despacho = 'ESCANEADO_SALIDA_OK',
               escaneado_salida = TRUE,
               fecha_escaneo_salida = NOW(),
               escaneado_por_id = $1
           WHERE id = $2`,
          [session.userId, item.id]
        );

        await tx.query(
          `UPDATE paquetes
           SET estado_despacho = 'LISTO_PARA_DESPACHO',
               despacho_salida_verificado = TRUE,
               updated_at = NOW()
           WHERE id = $1`,
          [item.paquete_id]
        );

        await tx.query(
          `UPDATE despachos
           SET total_paquetes_verificados = (
                 SELECT COUNT(*)::int FROM despachos_paquetes
                 WHERE despacho_id = $1 AND escaneado_salida = TRUE AND estado_en_despacho != 'DESCONSOLIDADO'
               ),
               estado_despacho = 'LISTO_PARA_DESPACHO',
               updated_at = NOW()
           WHERE id = $1`,
          [despachoId]
        );

        await registrarEventoTrazabilidad(tx, {
          paqueteId: item.paquete_id,
          despachoId,
          tipoEvento: "ESCANEO",
          dimensionEstado: "DESPACHO",
          estadoAnterior: "CONSOLIDADO",
          estadoNuevo: "LISTO_PARA_DESPACHO",
          session,
          ubicacionTexto: "Muelle de Salida Bodega Bogotá",
          observaciones: `Paquete ${item.identificador_interno} verificado por escáner antes de salida de despacho.`,
          origenEvento: "ESCANER",
        });

        return {
          yaVerificado: false,
          identificadorInterno: item.identificador_interno,
        };
      });

      return NextResponse.json({ ok: true, ...verified });
    }

    // =========================================================================
    // 4. CERRAR DESPACHO Y ENTREGAR AL TRANSPORTADOR (Regla 10 y Módulo 11)
    // "No permitir cerrar un despacho sin verificar los paquetes incluidos."
    // "No cerrar despachos con diferencias sin resolver o autorización registrada."
    // =========================================================================
    if (action === "CERRAR_Y_ENTREGAR_DESPACHO") {
      if (!hasPermission(session, "despachos:cerrar")) {
        return NextResponse.json({ error: "ACCESO_DENEGADO" }, { status: 403 });
      }

      const despachoId = String(body.despachoId || "");
      const motivoAutorizacionDiferencias = body.motivoAutorizacionDiferencias
        ? String(body.motivoAutorizacionDiferencias).trim()
        : "";

      await withTransaction(async (tx) => {
        const dspRes = await tx.query<{
          id: string;
          consecutivo: string;
          transportadora_aliada: string;
          ciudad_destino: string;
          total_paquetes_incluidos: number;
          total_paquetes_verificados: number;
          estado_despacho: string;
        }>(`SELECT * FROM despachos WHERE id = $1`, [despachoId]);

        if (dspRes.rows.length === 0) {
          throw new Error("Despacho no encontrado.");
        }

        const dsp = dspRes.rows[0];
        if (dsp.total_paquetes_incluidos === 0) {
          throw new Error(
            "No es posible cerrar un despacho sin paquetes incluidos."
          );
        }

        const pendientesVerificar =
          dsp.total_paquetes_incluidos - dsp.total_paquetes_verificados;

        if (pendientesVerificar > 0) {
          if (
            !motivoAutorizacionDiferencias ||
            !hasPermission(session, "despachos:autorizar_diferencias")
          ) {
            throw new Error(
              `REGLA OPERATIVA #10: No se permite cerrar el despacho ${dsp.consecutivo} porque faltan ${pendientesVerificar} paquete(s) por escanear en muelle de salida. Escaneélos todos o desconsolide los faltantes.`
            );
          }
        }

        await tx.query(
          `UPDATE despachos
           SET estado_despacho = 'ENTREGADO_AL_TRANSPORTADOR',
               placa_vehiculo_transportadora = COALESCE($1, placa_vehiculo_transportadora),
               conductor_transportadora_nombre = COALESCE($2, conductor_transportadora_nombre),
               precinto_seguridad = COALESCE($3, precinto_seguridad),
               autorizado_con_diferencias_por = $4,
               motivo_autorizacion_diferencias = $5,
               fecha_cierre_despacho = NOW(),
               version = version + 1,
               updated_at = NOW()
           WHERE id = $6`,
          [
            body.placaVehiculo ? String(body.placaVehiculo).toUpperCase() : null,
            body.conductorNombre ? String(body.conductorNombre) : null,
            body.precintoSeguridad ? String(body.precintoSeguridad) : null,
            pendientesVerificar > 0 ? session.userId : null,
            pendientesVerificar > 0 ? motivoAutorizacionDiferencias : null,
            despachoId,
          ]
        );

        const pkgsDespacho = await tx.query<{ paquete_id: string }>(
          `SELECT paquete_id FROM despachos_paquetes
           WHERE despacho_id = $1 AND estado_en_despacho = 'ESCANEADO_SALIDA_OK'`,
          [despachoId]
        );

        for (const row of pkgsDespacho.rows) {
          await tx.query(
            `UPDATE paquetes
             SET estado_despacho = 'ENTREGADO_AL_TRANSPORTADOR',
                 fecha_salida_despacho = NOW(),
                 version = version + 1,
                 updated_at = NOW()
             WHERE id = $1`,
            [row.paquete_id]
          );

          await registrarEventoTrazabilidad(tx, {
            paqueteId: row.paquete_id,
            despachoId,
            tipoEvento: "ENTREGA_TRANSPORTADOR",
            dimensionEstado: "DESPACHO",
            estadoAnterior: "LISTO_PARA_DESPACHO",
            estadoNuevo: "ENTREGADO_AL_TRANSPORTADOR",
            session,
            ubicacionTexto: `Muelle Despacho → ${dsp.transportadora_aliada} (${dsp.ciudad_destino})`,
            observaciones: `Paquete despachado y entregado a transportadora ${dsp.transportadora_aliada} en manifiesto del despacho ${dsp.consecutivo}.`,
            origenEvento: "ESCANER",
          });
        }

        await crearNotificacionOperativa(tx, {
          rolDestino: "COORDINADOR_LOGISTICO",
          tipoNotificacion: "DESPACHO_GENERADO",
          titulo: `Despacho ${dsp.consecutivo} Entregado a ${dsp.transportadora_aliada}`,
          mensaje: `${dsp.total_paquetes_verificados} paquete(s) despachados hacia ${dsp.ciudad_destino}.`,
          enlaceAccion: `/admin/despachos`,
        });
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "ACCION_NO_RECONOCIDA" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error en POST /api/despachos:", error);
    return NextResponse.json(
      {
        error: "ERROR_OPERACION_DESPACHO",
        message:
          error instanceof Error
            ? error.message
            : "Error procesando el despacho.",
      },
      { status: 400 }
    );
  }
}
