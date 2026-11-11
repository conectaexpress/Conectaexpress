import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { getServerSession } from "@/lib/session";
import { hasPermission } from "@/lib/rbac";
import { generateId } from "@/lib/crypto-auth";
import {
  clasificarYBuscarCodigoBarras,
  generarConsecutivo,
  registrarEventoTrazabilidad,
} from "@/lib/operational-service";

/**
 * MOTOR DE ESCÁNER DE CÓDIGOS DE BARRAS Y ACTUALIZACIÓN DE EVENTOS VERIFICADOS
 * Clasifica cada lectura en:
 * - GUIA_COORDINADORA
 * - GUIA_OTRA_TRANSPORTADORA
 * - ROTULO_INTERNO_CE
 * - CODIGO_DESCONOCIDO
 * Regla Operativa: Escanear un código por sí solo únicamente identifica el paquete;
 * el estado solo cambia cuando se confirma explícitamente el evento correspondiente.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !hasPermission(session, "escaner:operar")) {
      return NextResponse.json(
        {
          error: "ACCESO_DENEGADO",
          message: "No cuenta con permisos para operar el escáner.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const codigo = String(body.codigo || "").trim();
    // Por defecto solo identifica el paquete sin alterar su estado
    const modoOperacion = String(body.modoOperacion || "IDENTIFICAR_PAQUETE");
    const confirmarEvento = Boolean(body.confirmarEvento);
    const eventoConfirmado = String(body.eventoConfirmado || "");
    const solicitudRecogidaId = body.solicitudRecogidaId
      ? String(body.solicitudRecogidaId)
      : null;
    const largoCm = body.largoCm ? Math.max(1, Number(body.largoCm)) : null;
    const anchoCm = body.anchoCm ? Math.max(1, Number(body.anchoCm)) : null;
    const altoCm = body.altoCm ? Math.max(1, Number(body.altoCm)) : null;
    const pesoKg = body.pesoKg ? Math.max(0.1, Number(body.pesoKg)) : null;
    const observacionesEvento = body.observaciones
      ? String(body.observaciones).trim()
      : "";
    const registrarSiDesconocido = Boolean(body.registrarSiDesconocido);

    if (!codigo) {
      return NextResponse.json(
        { error: "CODIGO_VACIO", message: "El código escaneado está vacío." },
        { status: 400 }
      );
    }

    const clasificacionRes = await clasificarYBuscarCodigoBarras(codigo);

    // Si el paquete existe y el usuario confirmó explícitamente un evento o actualización de medidas
    if (
      clasificacionRes.encontradoEnBaseDatos &&
      clasificacionRes.paquete &&
      (confirmarEvento ||
        modoOperacion === "CONFIRMAR_EVENTO_VERIFICADO" ||
        largoCm !== null)
    ) {
      const pkg = clasificacionRes.paquete as {
        id: string;
        identificador_interno: string;
        solicitud_recogida_id: string | null;
        estado_recogida: string;
        estado_bodega: string;
        estado_despacho: string;
        largo_cm: number;
        ancho_cm: number;
        alto_cm: number;
        peso_kg: number;
      };

      await withTransaction(async (tx) => {
        const nuevoLargo = largoCm ?? Number(pkg.largo_cm || 25);
        const nuevoAncho = anchoCm ?? Number(pkg.ancho_cm || 25);
        const nuevoAlto = altoCm ?? Number(pkg.alto_cm || 20);
        const nuevoPeso = pesoKg ?? Number(pkg.peso_kg || 2);
        const pesoVol = Number(
          ((nuevoLargo * nuevoAncho * nuevoAlto) / 5000).toFixed(2)
        );

        let nuevoEstadoRecogida = pkg.estado_recogida;
        let nuevoEstadoBodega = pkg.estado_bodega;
        let nuevoEstadoDespacho = pkg.estado_despacho;
        let dimension: "RECOGIDA" | "BODEGA" | "DESPACHO" | "GENERAL" =
          "GENERAL";
        let estadoAnteriorAudit = pkg.estado_recogida;
        let estadoNuevoAudit = pkg.estado_recogida;

        if (eventoConfirmado === "MERCANCIA_RECOGIDA") {
          nuevoEstadoRecogida = "RECOGIDA_COMPLETADA";
          dimension = "RECOGIDA";
          estadoAnteriorAudit = pkg.estado_recogida;
          estadoNuevoAudit = "RECOGIDA_COMPLETADA";
        } else if (eventoConfirmado === "ENTREGADA_CONECTA_EXPRESS") {
          nuevoEstadoRecogida = "RECOGIDA_COMPLETADA";
          nuevoEstadoBodega = "RECIBIDO";
          dimension = "BODEGA";
          estadoAnteriorAudit = pkg.estado_bodega;
          estadoNuevoAudit = "RECIBIDO";
        } else if (eventoConfirmado === "ENTREGADA_TRANSPORTADORA") {
          nuevoEstadoRecogida = "RECOGIDA_COMPLETADA";
          nuevoEstadoBodega = "CONFORME";
          nuevoEstadoDespacho = "ENTREGADO_AL_TRANSPORTADOR";
          dimension = "DESPACHO";
          estadoAnteriorAudit = pkg.estado_despacho;
          estadoNuevoAudit = "ENTREGADO_AL_TRANSPORTADOR";
        } else if (eventoConfirmado === "EN_TRANSITO") {
          nuevoEstadoDespacho = "EN_TRANSITO";
          dimension = "DESPACHO";
          estadoAnteriorAudit = pkg.estado_despacho;
          estadoNuevoAudit = "EN_TRANSITO";
        } else if (eventoConfirmado === "ENTREGADA_DESTINATARIO") {
          nuevoEstadoDespacho = "ENTREGADO";
          dimension = "DESPACHO";
          estadoAnteriorAudit = pkg.estado_despacho;
          estadoNuevoAudit = "ENTREGADO";
        } else if (eventoConfirmado === "NOVEDAD_REPORTADA") {
          nuevoEstadoBodega = "CON_NOVEDAD";
          dimension = "BODEGA";
          estadoAnteriorAudit = pkg.estado_bodega;
          estadoNuevoAudit = "CON_NOVEDAD";
        }

        await tx.query(
          `UPDATE paquetes
           SET solicitud_recogida_id = COALESCE($1, solicitud_recogida_id),
               largo_cm = $2,
               ancho_cm = $3,
               alto_cm = $4,
               peso_kg = $5,
               peso_volumetrico_kg = $6,
               estado_recogida = $7,
               estado_bodega = $8,
               estado_despacho = $9,
               recogido_verificado = CASE WHEN $7 = 'RECOGIDA_COMPLETADA' THEN TRUE ELSE recogido_verificado END,
               recibido_bodega_verificado = CASE WHEN $8 IN ('RECIBIDO', 'CONFORME') THEN TRUE ELSE recibido_bodega_verificado END,
               fecha_recogida_fisica = CASE WHEN $7 = 'RECOGIDA_COMPLETADA' THEN COALESCE(fecha_recogida_fisica, NOW()) ELSE fecha_recogida_fisica END,
               fecha_recepcion_bodega = CASE WHEN $8 IN ('RECIBIDO', 'CONFORME') THEN COALESCE(fecha_recepcion_bodega, NOW()) ELSE fecha_recepcion_bodega END,
               fecha_salida_despacho = CASE WHEN $9 IN ('ENTREGADO_AL_TRANSPORTADOR', 'EN_TRANSITO', 'ENTREGADO') THEN COALESCE(fecha_salida_despacho, NOW()) ELSE fecha_salida_despacho END,
               fecha_entrega_final = CASE WHEN $9 = 'ENTREGADO' THEN NOW() ELSE fecha_entrega_final END,
               version = version + 1,
               updated_at = NOW()
           WHERE id = $10`,
          [
            solicitudRecogidaId,
            nuevoLargo,
            nuevoAncho,
            nuevoAlto,
            nuevoPeso,
            pesoVol,
            nuevoEstadoRecogida,
            nuevoEstadoBodega,
            nuevoEstadoDespacho,
            pkg.id,
          ]
        );

        const medidasTxt = `Medidas registradas: ${nuevoLargo}x${nuevoAncho}x${nuevoAlto} cm (${nuevoPeso} kg).`;
        await registrarEventoTrazabilidad(tx, {
          paqueteId: pkg.id,
          solicitudId: solicitudRecogidaId || pkg.solicitud_recogida_id,
          tipoEvento: "ESCANEO",
          dimensionEstado: dimension,
          estadoAnterior: estadoAnteriorAudit,
          estadoNuevo: estadoNuevoAudit,
          session,
          observaciones: `${
            observacionesEvento ||
            `Evento confirmado por escáner (${clasificacionRes.codigoLimpio}).`
          } ${medidasTxt}`,
          origenEvento: "ESCANER",
        });
      });

      const refreshed = await clasificarYBuscarCodigoBarras(codigo);
      return NextResponse.json({
        ok: true,
        eventoAplicado: true,
        resultado: refreshed,
      });
    }

    // Si NO existe en base de datos y se solicitó registrar y vincular el paquete (ej. código de guía o rótulo nuevo)
    if (!clasificacionRes.encontradoEnBaseDatos && registrarSiDesconocido) {
      const createdPkg = await withTransaction(async (tx) => {
        const pkgId = generateId();
        const identificadorInterno = await generarConsecutivo(
          tx,
          "paquetes",
          process.env.CE_INTERNAL_LABEL_PREFIX || "CE"
        );
        const esGuiaExterna =
          clasificacionRes.clasificacion === "GUIA_COORDINADORA" ||
          clasificacionRes.clasificacion === "GUIA_OTRA_TRANSPORTADORA";

        // Buscar datos de la solicitud si fue indicada
        let clienteId = "cli-corporativo-01";
        let remitenteNombre = "Cliente Conecta Express";
        let remitenteDireccion = "Dirección de Recogida";
        let remitenteCiudad = "Bogotá D.C.";

        if (solicitudRecogidaId) {
          const solRes = await tx.query<{
            cliente_id: string;
            direccion_texto: string;
            ciudad: string;
            contacto_nombre: string;
          }>(
            `SELECT cliente_id, direccion_texto, ciudad, contacto_nombre FROM solicitudes_recogida WHERE id = $1`,
            [solicitudRecogidaId]
          );
          if (solRes.rows.length > 0) {
            clienteId = solRes.rows[0].cliente_id;
            remitenteNombre = solRes.rows[0].contacto_nombre;
            remitenteDireccion = solRes.rows[0].direccion_texto;
            remitenteCiudad = solRes.rows[0].ciudad;
          }
        }

        const nLargo = largoCm ?? 30;
        const nAncho = anchoCm ?? 25;
        const nAlto = altoCm ?? 20;
        const nPeso = pesoKg ?? 2.5;
        const nPesoVol = Number(((nLargo * nAncho * nAlto) / 5000).toFixed(2));

        await tx.query(
          `INSERT INTO paquetes (
            id, identificador_interno, solicitud_recogida_id, cliente_id,
            remitente_nombre, remitente_direccion, remitente_ciudad,
            destinatario_nombre, destinatario_telefono, destinatario_direccion, destinatario_ciudad,
            contenido_declarado, tipo_mercancia,
            largo_cm, ancho_cm, alto_cm, peso_kg, peso_volumetrico_kg,
            guia_externa_principal, transportadora_principal,
            estado_recogida, estado_bodega, estado_despacho,
            recogido_verificado, recibido_bodega_verificado
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7,
            'Destinatario Registrado', '0000000000', 'Dirección Destino', 'Nacional',
            'Paquete registrado por escaneo', 'PAQUETERIA_ESTANDAR',
            $8, $9, $10, $11, $12,
            $13, $14,
            'SOLICITUD_RECIBIDA', 'PENDIENTE_RECEPCION', $15,
            FALSE, FALSE
          )`,
          [
            pkgId,
            identificadorInterno,
            solicitudRecogidaId,
            clienteId,
            remitenteNombre,
            remitenteDireccion,
            remitenteCiudad,
            nLargo,
            nAncho,
            nAlto,
            nPeso,
            nPesoVol,
            esGuiaExterna ? clasificacionRes.codigoLimpio : null,
            clasificacionRes.transportadoraDetectada || "COORDINADORA",
            esGuiaExterna ? "GUIA_GENERADA" : "PENDIENTE",
          ]
        );

        await tx.query(
          `INSERT INTO rotulos_internos (
            id, paquete_id, codigo_barras_code128, contenido_qr, formato_etiqueta, generado_por_id
          ) VALUES ($1, $2, $3, $4, '4X6', $5)`,
          [
            generateId(),
            pkgId,
            identificadorInterno,
            JSON.stringify({
              ceId: identificadorInterno,
              codigoOrigen: clasificacionRes.codigoLimpio,
            }),
            session.userId,
          ]
        );

        if (esGuiaExterna) {
          await tx.query(
            `INSERT INTO guias_externas (
              id, paquete_id, transportadora, numero_guia, codigo_barras_rotulo,
              estado_actual_transportadora, origen_vinculacion, registrado_por_id
            ) VALUES ($1, $2, $3, $4, $4, 'ACTIVA', 'ESCANEO_FISICO', $5)
            ON CONFLICT (transportadora, numero_guia) DO NOTHING`,
            [
              generateId(),
              pkgId,
              clasificacionRes.transportadoraDetectada || "COORDINADORA",
              clasificacionRes.codigoLimpio,
              session.userId,
            ]
          );
        }

        await registrarEventoTrazabilidad(tx, {
          paqueteId: pkgId,
          solicitudId: solicitudRecogidaId,
          tipoEvento: "ESCANEO",
          dimensionEstado: "RECOGIDA",
          estadoAnterior: null,
          estadoNuevo: "SOLICITUD_RECIBIDA",
          session,
          ubicacionTexto: remitenteCiudad,
          observaciones: `Paquete identificado y registrado mediante escáner (${clasificacionRes.codigoLimpio} → ${identificadorInterno}). Medidas: ${nLargo}x${nAncho}x${nAlto} cm, ${nPeso} kg.`,
          origenEvento: "ESCANER",
        });

        return identificadorInterno;
      });

      const resolvedNew = await clasificarYBuscarCodigoBarras(createdPkg);
      return NextResponse.json({
        ok: true,
        registradoEnCaliente: true,
        resultado: resolvedNew,
      });
    }

    // Lectura de identificación sin alterar el estado del paquete
    return NextResponse.json({
      ok: true,
      eventoAplicado: false,
      resultado: clasificacionRes,
    });
  } catch (error) {
    console.error("Error en POST /api/escaner:", error);
    return NextResponse.json(
      {
        error: "ERROR_MOTOR_ESCANER",
        message:
          error instanceof Error
            ? error.message
            : "Error procesando el código de barras.",
      },
      { status: 500 }
    );
  }
}
