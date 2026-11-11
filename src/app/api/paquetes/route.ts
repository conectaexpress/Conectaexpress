import { NextRequest, NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { getServerSession } from "@/lib/session";
import { hasPermission } from "@/lib/rbac";
import { generateId } from "@/lib/crypto-auth";
import {
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

    if (!hasPermission(session, "paquetes:ver")) {
      return NextResponse.json({ error: "ACCESO_DENEGADO" }, { status: 403 });
    }

    const q = req.nextUrl.searchParams.get("q")?.trim() || "";
    const estadoBodega =
      req.nextUrl.searchParams.get("estadoBodega")?.trim() || "";
    const estadoDespacho =
      req.nextUrl.searchParams.get("estadoDespacho")?.trim() || "";
    const solicitudId =
      req.nextUrl.searchParams.get("solicitudId")?.trim() || "";

    const params: unknown[] = [];
    let whereSql = "WHERE 1=1";

    // Aislamiento estricto por Rol CLIENTE
    if (session.rolCodigo === "CLIENTE") {
      params.push(session.clienteId);
      whereSql += ` AND p.cliente_id = $${params.length}`;
    }

    if (solicitudId) {
      params.push(solicitudId);
      whereSql += ` AND p.solicitud_recogida_id = $${params.length}`;
    }

    if (estadoBodega) {
      params.push(estadoBodega);
      whereSql += ` AND p.estado_bodega = $${params.length}`;
    }

    if (estadoDespacho) {
      params.push(estadoDespacho);
      whereSql += ` AND p.estado_despacho = $${params.length}`;
    }

    if (q) {
      params.push(`%${q}%`);
      whereSql += ` AND (
        p.identificador_interno ILIKE $${params.length} OR
        p.guia_externa_principal ILIKE $${params.length} OR
        p.destinatario_nombre ILIKE $${params.length} OR
        p.destinatario_ciudad ILIKE $${params.length} OR
        c.razon_social ILIKE $${params.length} OR
        s.consecutivo ILIKE $${params.length}
      )`;
    }

    const paquetesRes = await query(
      `SELECT p.*,
        c.razon_social AS cliente_nombre,
        c.codigo_cliente AS cliente_codigo,
        s.consecutivo AS solicitud_consecutivo,
        b.nombre AS bodega_nombre,
        b.codigo AS bodega_codigo,
        z.nombre AS zona_nombre,
        u.codigo_ubicacion AS ubicacion_codigo,
        d.consecutivo AS despacho_consecutivo,
        r.id AS rotulo_id,
        r.codigo_barras_code128,
        r.formato_etiqueta,
        r.contador_impresiones,
        r.ultima_impresion_at
       FROM paquetes p
       JOIN clientes c ON c.id = p.cliente_id
       LEFT JOIN solicitudes_recogida s ON s.id = p.solicitud_recogida_id
       LEFT JOIN bodegas b ON b.id = p.bodega_actual_id
       LEFT JOIN zonas z ON z.id = p.zona_actual_id
       LEFT JOIN ubicaciones u ON u.id = p.ubicacion_actual_id
       LEFT JOIN despachos d ON d.id = p.despacho_actual_id
       LEFT JOIN rotulos_internos r ON r.paquete_id = p.id
       ${whereSql}
       ORDER BY p.created_at DESC
       LIMIT 250`,
      params
    );

    // Obtener las guías externas vinculadas (Relación N:1 con paquete)
    const guiasRes = await query(
      session.rolCodigo === "CLIENTE"
        ? `SELECT g.* FROM guias_externas g
           JOIN paquetes p ON p.id = g.paquete_id
           WHERE p.cliente_id = $1
           ORDER BY g.created_at DESC`
        : `SELECT g.* FROM guias_externas g ORDER BY g.created_at DESC LIMIT 400`,
      session.rolCodigo === "CLIENTE" ? [session.clienteId] : []
    );

    return NextResponse.json({
      paquetes: paquetesRes.rows,
      guiasExternas: guiasRes.rows,
    });
  } catch (error) {
    console.error("Error en GET /api/paquetes:", error);
    return NextResponse.json(
      { error: "ERROR_CONSULTA_PAQUETES" },
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

    if (!hasPermission(session, "paquetes:crear_rotulo")) {
      return NextResponse.json(
        {
          error: "ACCESO_DENEGADO",
          message: "No tiene permisos para generar paquetes o rótulos internos.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const action = String(body.action || "CREAR_PAQUETE_Y_ROTULO");

    // 0. ACTUALIZAR MEDIDAS REALES Y CONFIRMAR ESTADO VERIFICABLE DEL PAQUETE
    if (action === "ACTUALIZAR_MEDIDAS_Y_ESTADO") {
      const paqueteId = String(body.paqueteId || "");
      const largoCm = Math.max(1, Number(body.largoCm || 30));
      const anchoCm = Math.max(1, Number(body.anchoCm || 25));
      const altoCm = Math.max(1, Number(body.altoCm || 20));
      const pesoKg = Math.max(0.1, Number(body.pesoKg || 2));
      const pesoVol = Number(((largoCm * anchoCm * altoCm) / 5000).toFixed(2));
      const eventoConfirmado = String(body.eventoConfirmado || "");
      const observaciones = String(
        body.observaciones || "Actualización verificada de medidas y estado del paquete."
      ).trim();

      if (!paqueteId) {
        return NextResponse.json(
          { error: "PAQUETE_REQUERIDO", message: "Debe seleccionar un paquete." },
          { status: 400 }
        );
      }

      await withTransaction(async (tx) => {
        const pkgRes = await tx.query<{
          id: string;
          identificador_interno: string;
          solicitud_recogida_id: string | null;
          estado_recogida: string;
          estado_bodega: string;
          estado_despacho: string;
        }>(
          `SELECT id, identificador_interno, solicitud_recogida_id, estado_recogida, estado_bodega, estado_despacho
           FROM paquetes WHERE id = $1`,
          [paqueteId]
        );

        if (pkgRes.rows.length === 0) {
          throw new Error("Paquete no encontrado.");
        }
        const pkg = pkgRes.rows[0];

        let nRec = pkg.estado_recogida;
        let nBod = pkg.estado_bodega;
        let nDesp = pkg.estado_despacho;
        let dim: "RECOGIDA" | "BODEGA" | "DESPACHO" | "GENERAL" = "GENERAL";
        let estAnt = pkg.estado_recogida;
        let estNue = pkg.estado_recogida;

        if (eventoConfirmado === "MERCANCIA_RECOGIDA") {
          nRec = "RECOGIDA_COMPLETADA";
          dim = "RECOGIDA";
          estAnt = pkg.estado_recogida;
          estNue = "RECOGIDA_COMPLETADA";
        } else if (eventoConfirmado === "ENTREGADA_CONECTA_EXPRESS") {
          nRec = "RECOGIDA_COMPLETADA";
          nBod = "RECIBIDO";
          dim = "BODEGA";
          estAnt = pkg.estado_bodega;
          estNue = "RECIBIDO";
        } else if (eventoConfirmado === "ENTREGADA_TRANSPORTADORA") {
          nRec = "RECOGIDA_COMPLETADA";
          nBod = "CONFORME";
          nDesp = "ENTREGADO_AL_TRANSPORTADOR";
          dim = "DESPACHO";
          estAnt = pkg.estado_despacho;
          estNue = "ENTREGADO_AL_TRANSPORTADOR";
        } else if (eventoConfirmado === "EN_TRANSITO") {
          nDesp = "EN_TRANSITO";
          dim = "DESPACHO";
          estAnt = pkg.estado_despacho;
          estNue = "EN_TRANSITO";
        } else if (eventoConfirmado === "ENTREGADA_DESTINATARIO") {
          nDesp = "ENTREGADO";
          dim = "DESPACHO";
          estAnt = pkg.estado_despacho;
          estNue = "ENTREGADO";
        } else if (eventoConfirmado === "NOVEDAD_REPORTADA") {
          nBod = "CON_NOVEDAD";
          dim = "BODEGA";
          estAnt = pkg.estado_bodega;
          estNue = "CON_NOVEDAD";
        }

        await tx.query(
          `UPDATE paquetes
           SET largo_cm = $1,
               ancho_cm = $2,
               alto_cm = $3,
               peso_kg = $4,
               peso_volumetrico_kg = $5,
               estado_recogida = $6,
               estado_bodega = $7,
               estado_despacho = $8,
               recogido_verificado = CASE WHEN $6 = 'RECOGIDA_COMPLETADA' THEN TRUE ELSE recogido_verificado END,
               recibido_bodega_verificado = CASE WHEN $7 IN ('RECIBIDO', 'CONFORME') THEN TRUE ELSE recibido_bodega_verificado END,
               version = version + 1,
               updated_at = NOW()
           WHERE id = $9`,
          [largoCm, anchoCm, altoCm, pesoKg, pesoVol, nRec, nBod, nDesp, paqueteId]
        );

        await registrarEventoTrazabilidad(tx, {
          paqueteId,
          solicitudId: pkg.solicitud_recogida_id,
          tipoEvento: "PREPARACION",
          dimensionEstado: dim,
          estadoAnterior: estAnt,
          estadoNuevo: estNue,
          session,
          observaciones: `${observaciones} — Medidas: ${largoCm}x${anchoCm}x${altoCm} cm, Peso: ${pesoKg} kg.`,
          origenEvento: "MANUAL",
        });
      });

      return NextResponse.json({ ok: true });
    }

    // 1. ASOCIAR GUÍA EXTERNA A UN PAQUETE INTERNO EXISTENTE (Regla 1 y 2)
    if (action === "ASOCIAR_GUIA_EXTERNA") {
      const paqueteId = String(body.paqueteId || "");
      const numeroGuia = String(body.numeroGuia || "")
        .trim()
        .toUpperCase();
      const transportadora = String(
        body.transportadora || "COORDINADORA"
      ).toUpperCase();
      const codigoBarrasRotulo = String(
        body.codigoBarrasRotulo || numeroGuia
      )
        .trim()
        .toUpperCase();

      if (!paqueteId || !numeroGuia) {
        return NextResponse.json(
          {
            error: "DATOS_INCOMPLETOS",
            message: "Debe indicar el paquete interno y el número de guía externa.",
          },
          { status: 400 }
        );
      }

      await withTransaction(async (tx) => {
        const pkgRes = await tx.query<{
          id: string;
          identificador_interno: string;
          estado_despacho: string;
        }>(`SELECT id, identificador_interno, estado_despacho FROM paquetes WHERE id = $1`, [
          paqueteId,
        ]);

        if (pkgRes.rows.length === 0) {
          throw new Error("Paquete interno no encontrado.");
        }
        const pkg = pkgRes.rows[0];

        await tx.query(
          `INSERT INTO guias_externas (
            id, paquete_id, transportadora, numero_guia, codigo_barras_rotulo,
            estado_actual_transportadora, origen_vinculacion, registrado_por_id
          ) VALUES ($1, $2, $3, $4, $5, 'VINCULADA_CONECTA', $6, $7)`,
          [
            generateId(),
            paqueteId,
            transportadora,
            numeroGuia,
            codigoBarrasRotulo,
            String(body.origenVinculacion || "CARGA_MANUAL"),
            session.userId,
          ]
        );

        const nuevoEstadoDespacho =
          pkg.estado_despacho === "PENDIENTE" ||
          pkg.estado_despacho === "EN_PREPARACION" ||
          pkg.estado_despacho === "CONSOLIDADO"
            ? "GUIA_GENERADA"
            : pkg.estado_despacho;

        await tx.query(
          `UPDATE paquetes
           SET guia_externa_principal = $1,
               transportadora_principal = $2,
               estado_despacho = $3,
               version = version + 1,
               updated_at = NOW()
           WHERE id = $4`,
          [numeroGuia, transportadora, nuevoEstadoDespacho, paqueteId]
        );

        await registrarEventoTrazabilidad(tx, {
          paqueteId,
          tipoEvento: "PREPARACION",
          dimensionEstado: "DESPACHO",
          estadoAnterior: pkg.estado_despacho,
          estadoNuevo: nuevoEstadoDespacho,
          session,
          observaciones: `Guía externa #${numeroGuia} (${transportadora}) asociada al paquete interno ${pkg.identificador_interno}.`,
          origenEvento: "MANUAL",
        });
      });

      return NextResponse.json({ ok: true });
    }

    // 2. REIMPRIMIR RÓTULO INTERNO CON PERMISOS Y AUDITORÍA (Módulo 7)
    if (action === "REIMPRIMIR_ROTULO") {
      if (!hasPermission(session, "paquetes:reimprimir_rotulo")) {
        return NextResponse.json(
          {
            error: "PERMISO_REIMPRESION_REQUERIDO",
            message:
              "Su rol no cuenta con autorización para reimprimir rótulos internos (paquetes:reimprimir_rotulo).",
          },
          { status: 403 }
        );
      }

      const paqueteId = String(body.paqueteId || "");
      const motivoReimpresion = String(
        body.motivoReimpresion || "Deterioro de etiqueta en operación"
      ).trim();
      const formatoEtiqueta =
        body.formatoEtiqueta === "4X2" ? "4X2" : "4X6";

      await withTransaction(async (tx) => {
        const rotRes = await tx.query<{
          id: string;
          codigo_barras_code128: string;
          contador_impresiones: number;
        }>(`SELECT * FROM rotulos_internos WHERE paquete_id = $1`, [paqueteId]);

        if (rotRes.rows.length === 0) {
          throw new Error("El paquete no tiene rótulo interno registrado.");
        }

        const rot = rotRes.rows[0];
        await tx.query(
          `UPDATE rotulos_internos
           SET contador_impresiones = contador_impresiones + 1,
               formato_etiqueta = $1,
               ultima_reimpresion_por_id = $2,
               motivo_reimpresion = $3,
               ultima_impresion_at = NOW()
           WHERE id = $4`,
          [formatoEtiqueta, session.userId, motivoReimpresion, rot.id]
        );

        await registrarAuditoria(tx, {
          modulo: "IDENTIFICACION_INTERNA_PAQUETES",
          accion: "REIMPRIMIR_ROTULO",
          entidadTipo: "PAQUETE",
          entidadId: paqueteId,
          session,
          datosNuevos: {
            codigo: rot.codigo_barras_code128,
            impresionNumero: rot.contador_impresiones + 1,
            formatoEtiqueta,
          },
          justificacion: motivoReimpresion,
        });
      });

      return NextResponse.json({ ok: true });
    }

    // 3. CREAR NUEVO PAQUETE Y RÓTULO INTERNO CONECTA EXPRESS (Módulo 7)
    const clienteId = String(body.clienteId || "");
    const destinatarioNombre = String(body.destinatarioNombre || "").trim();
    const destinatarioTelefono = String(body.destinatarioTelefono || "").trim();
    const destinatarioDireccion = String(
      body.destinatarioDireccion || ""
    ).trim();
    const destinatarioCiudad = String(
      body.destinatarioCiudad || "Bogotá D.C."
    ).trim();
    const contenidoDeclarado = String(
      body.contenidoDeclarado || "Mercancía General"
    ).trim();

    if (
      !clienteId ||
      !destinatarioNombre ||
      !destinatarioDireccion ||
      !destinatarioCiudad
    ) {
      return NextResponse.json(
        {
          error: "DATOS_INCOMPLETOS",
          message:
            "Cliente, destinatario, dirección y ciudad de destino son obligatorios.",
        },
        { status: 400 }
      );
    }

    const created = await withTransaction(async (tx) => {
      const cliRes = await tx.query<{
        razon_social: string;
        telefono_principal: string;
        direccion_principal: string;
        ciudad_principal: string;
      }>(`SELECT * FROM clientes WHERE id = $1`, [clienteId]);

      if (cliRes.rows.length === 0) {
        throw new Error("Cliente no encontrado.");
      }
      const cli = cliRes.rows[0];

      const pkgId = generateId();
      const identificadorInterno = await generarConsecutivo(
        tx,
        "paquetes",
        process.env.CE_INTERNAL_LABEL_PREFIX || "CE"
      );

      const largo = Math.max(1, Number(body.largoCm || 25));
      const ancho = Math.max(1, Number(body.anchoCm || 25));
      const alto = Math.max(1, Number(body.altoCm || 20));
      const pesoKg = Math.max(0.1, Number(body.pesoKg || 2.5));
      const pesoVolumetrico = Number(((largo * ancho * alto) / 5000).toFixed(2));
      const guiaExterna = body.numeroGuiaExterna
        ? String(body.numeroGuiaExterna).trim().toUpperCase()
        : null;
      const transportadora = String(
        body.transportadora || "COORDINADORA"
      ).toUpperCase();

      await tx.query(
        `INSERT INTO paquetes (
          id, identificador_interno, solicitud_recogida_id, cliente_id,
          remitente_nombre, remitente_telefono, remitente_direccion, remitente_ciudad,
          destinatario_nombre, destinatario_telefono, destinatario_direccion,
          destinatario_ciudad, destinatario_departamento,
          contenido_declarado, tipo_mercancia, tipo_servicio,
          peso_kg, largo_cm, ancho_cm, alto_cm, peso_volumetrico_kg, valor_declarado,
          guia_externa_principal, transportadora_principal,
          estado_recogida, estado_bodega, estado_despacho,
          observaciones
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, $10, $11,
          $12, $13,
          $14, $15, $16,
          $17, $18, $19, $20, $21, $22,
          $23, $24,
          $25, $26, $27,
          $28
        )`,
        [
          pkgId,
          identificadorInterno,
          body.solicitudRecogidaId || null,
          clienteId,
          cli.razon_social,
          cli.telefono_principal,
          cli.direccion_principal,
          cli.ciudad_principal,
          destinatarioNombre,
          destinatarioTelefono || cli.telefono_principal,
          destinatarioDireccion,
          destinatarioCiudad,
          String(body.destinatarioDepartamento || "Nacional"),
          contenidoDeclarado,
          String(body.tipoMercancia || "PAQUETERIA_ESTANDAR"),
          String(body.tipoServicio || "TERRESTRE_NACIONAL"),
          pesoKg,
          largo,
          ancho,
          alto,
          pesoVolumetrico,
          Number(body.valorDeclarado || 100000),
          guiaExterna,
          transportadora,
          body.ingresaDirectoBodega ? "RECOGIDA_COMPLETADA" : "SOLICITUD_RECIBIDA",
          body.ingresaDirectoBodega ? "RECIBIDO" : "PENDIENTE_RECEPCION",
          guiaExterna ? "GUIA_GENERADA" : "PENDIENTE",
          body.observaciones ? String(body.observaciones) : null,
        ]
      );

      const qrPayload = JSON.stringify({
        ceId: identificadorInterno,
        cliente: cli.razon_social,
        destino: destinatarioCiudad,
        destinatario: destinatarioNombre,
        pesoKg,
        guia: guiaExterna || "INTERNO_CE",
      });

      await tx.query(
        `INSERT INTO rotulos_internos (
          id, paquete_id, codigo_barras_code128, contenido_qr,
          formato_etiqueta, generado_por_id
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          generateId(),
          pkgId,
          identificadorInterno,
          qrPayload,
          body.formatoEtiqueta === "4X2" ? "4X2" : "4X6",
          session.userId,
        ]
      );

      if (guiaExterna) {
        await tx.query(
          `INSERT INTO guias_externas (
            id, paquete_id, transportadora, numero_guia, codigo_barras_rotulo,
            estado_actual_transportadora, origen_vinculacion, registrado_por_id
          ) VALUES ($1, $2, $3, $4, $4, 'ACTIVA', 'PLATAFORMA_ACTUAL', $5)
          ON CONFLICT (transportadora, numero_guia) DO NOTHING`,
          [generateId(), pkgId, transportadora, guiaExterna, session.userId]
        );
      }

      await registrarEventoTrazabilidad(tx, {
        paqueteId: pkgId,
        solicitudId: body.solicitudRecogidaId || null,
        tipoEvento: "PREPARACION",
        dimensionEstado: "GENERAL",
        estadoAnterior: null,
        estadoNuevo: identificadorInterno,
        session,
        ubicacionTexto: cli.ciudad_principal,
        observaciones: `Paquete identificado con rótulo interno Conecta Express ${identificadorInterno}${
          guiaExterna ? ` y guía externa ${guiaExterna} (${transportadora})` : " (ingreso sin guía externa)"
        }.`,
        origenEvento: "MANUAL",
      });

      return { pkgId, identificadorInterno };
    });

    return NextResponse.json({ ok: true, ...created });
  } catch (error) {
    console.error("Error en POST /api/paquetes:", error);
    return NextResponse.json(
      {
        error: "ERROR_CREACION_PAQUETE",
        message:
          error instanceof Error
            ? error.message
            : "Error registrando el paquete.",
      },
      { status: 500 }
    );
  }
}
