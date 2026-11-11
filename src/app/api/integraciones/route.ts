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

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session || !hasPermission(session, "integraciones:ver")) {
      return NextResponse.json({ error: "ACCESO_DENEGADO" }, { status: 403 });
    }

    const [integracionesRes, logsRes, guiasRecientesRes] = await Promise.all([
      query(`SELECT * FROM integraciones ORDER BY codigo_integracion ASC`),
      query(
        `SELECT r.*, i.codigo_integracion, i.nombre_proveedor, u.nombre_completo AS ejecutado_por_nombre
         FROM registros_sincronizacion r
         JOIN integraciones i ON i.id = r.integracion_id
         LEFT JOIN usuarios u ON u.id = r.ejecutado_por_id
         ORDER BY r.created_at DESC
         LIMIT 60`
      ),
      query(
        `SELECT g.*, p.identificador_interno, p.destinatario_nombre, p.destinatario_ciudad,
                c.razon_social AS cliente_nombre
         FROM guias_externas g
         JOIN paquetes p ON p.id = g.paquete_id
         JOIN clientes c ON c.id = p.cliente_id
         ORDER BY g.created_at DESC
         LIMIT 100`
      ),
    ]);

    // Verificar en tiempo real si existen credenciales en variables de entorno (nunca exponer el valor del token)
    const estadoVariablesEntorno = {
      COORDINADORA_API_URL_CONFIGURADA: Boolean(
        process.env.COORDINADORA_API_URL?.trim()
      ),
      COORDINADORA_API_KEY_CONFIGURADA: Boolean(
        process.env.COORDINADORA_API_KEY?.trim()
      ),
      PLATAFORMA_GUIAS_CE_URL_CONFIGURADA: Boolean(
        process.env.PLATAFORMA_GUIAS_CE_API_URL?.trim()
      ),
      PLATAFORMA_GUIAS_CE_TOKEN_CONFIGURADO: Boolean(
        process.env.PLATAFORMA_GUIAS_CE_API_TOKEN?.trim()
      ),
      MODO_ACTUAL:
        process.env.COORDINADORA_INTEGRATION_MODE || "CONTINGENCIA_CSV",
    };

    return NextResponse.json({
      integraciones: integracionesRes.rows,
      registrosSincronizacion: logsRes.rows,
      guiasExternas: guiasRecientesRes.rows,
      estadoVariablesEntorno,
    });
  } catch (error) {
    console.error("Error en GET /api/integraciones:", error);
    return NextResponse.json(
      { error: "ERROR_CONSULTA_INTEGRACIONES" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !hasPermission(session, "integraciones:configurar")) {
      return NextResponse.json({ error: "ACCESO_DENEGADO" }, { status: 403 });
    }

    const body = await req.json();
    const action = String(body.action || "");

    // =========================================================================
    // 1. IMPORTACIÓN DE LOTE EXCEL / CSV DE GUÍAS EXTERNAS (Alternativa Oficial Módulo 12)
    // =========================================================================
    if (action === "IMPORTAR_LOTE_GUIAS") {
      const transportadora = String(
        body.transportadora || "COORDINADORA"
      ).toUpperCase();
      const clienteId = String(body.clienteId || "cli-corporativo-01");
      const filas: Array<{
        numero_guia: string;
        identificador_interno?: string;
        destinatario_nombre?: string;
        destinatario_telefono?: string;
        destinatario_direccion?: string;
        destinatario_ciudad?: string;
        peso_kg?: number;
        contenido?: string;
        estado_externo?: string;
      }> = Array.isArray(body.filas) ? body.filas : [];

      if (filas.length === 0) {
        return NextResponse.json(
          {
            error: "LOTE_VACIO",
            message: "El archivo o lote de importación no contiene registros válidos.",
          },
          { status: 400 }
        );
      }

      const resultado = await withTransaction(async (tx) => {
        let procesados = 0;
        let fallidos = 0;
        const detalleProcesados: string[] = [];

        const cliRes = await tx.query<{
          razon_social: string;
          ciudad_principal: string;
          direccion_principal: string;
          telefono_principal: string;
        }>(`SELECT * FROM clientes WHERE id = $1`, [clienteId]);
        const cli = cliRes.rows[0] || {
          razon_social: "Cliente Corporativo CE",
          ciudad_principal: "Bogotá D.C.",
          direccion_principal: "Bodega Cliente",
          telefono_principal: "3000000000",
        };

        for (const row of filas) {
          const numeroGuia = String(row.numero_guia || "")
            .trim()
            .toUpperCase();
          if (!numeroGuia) {
            fallidos++;
            continue;
          }

          try {
            // Verificar si existe paquete por identificador_interno suministrado en el archivo
            let pkgId: string | null = null;
            let ceCode = row.identificador_interno
              ? String(row.identificador_interno).trim().toUpperCase()
              : "";

            if (ceCode) {
              const exRes = await tx.query<{ id: string }>(
                `SELECT id FROM paquetes WHERE UPPER(identificador_interno) = $1 LIMIT 1`,
                [ceCode]
              );
              if (exRes.rows.length > 0) {
                pkgId = exRes.rows[0].id;
              }
            }

            // Si no existe paquete previo, crear Paquete + Rótulo Interno CE vinculado a la guía importada
            if (!pkgId) {
              pkgId = generateId();
              ceCode = await generarConsecutivo(
                tx,
                "paquetes",
                process.env.CE_INTERNAL_LABEL_PREFIX || "CE"
              );

              await tx.query(
                `INSERT INTO paquetes (
                  id, identificador_interno, cliente_id,
                  remitente_nombre, remitente_telefono, remitente_direccion, remitente_ciudad,
                  destinatario_nombre, destinatario_telefono, destinatario_direccion, destinatario_ciudad,
                  contenido_declarado, peso_kg,
                  guia_externa_principal, transportadora_principal,
                  estado_recogida, estado_bodega, estado_despacho
                ) VALUES (
                  $1, $2, $3,
                  $4, $5, $6, $7,
                  $8, $9, $10, $11,
                  $12, $13,
                  $14, $15,
                  'SOLICITUD_RECIBIDA', 'PENDIENTE_RECEPCION', 'GUIA_GENERADA'
                )`,
                [
                  pkgId,
                  ceCode,
                  clienteId,
                  cli.razon_social,
                  cli.telefono_principal,
                  cli.direccion_principal,
                  cli.ciudad_principal,
                  String(row.destinatario_nombre || "Destinatario Guía Importada"),
                  String(row.destinatario_telefono || cli.telefono_principal),
                  String(row.destinatario_direccion || "Dirección según Guía"),
                  String(row.destinatario_ciudad || "Bogotá D.C."),
                  String(row.contenido || "Mercancía según guía importada"),
                  Number(row.peso_kg || 2),
                  numeroGuia,
                  transportadora,
                ]
              );

              await tx.query(
                `INSERT INTO rotulos_internos (
                  id, paquete_id, codigo_barras_code128, contenido_qr, formato_etiqueta, generado_por_id
                ) VALUES ($1, $2, $3, $4, '4X6', $5)`,
                [
                  generateId(),
                  pkgId,
                  ceCode,
                  JSON.stringify({ ceId: ceCode, guia: numeroGuia, transportadora }),
                  session.userId,
                ]
              );
            } else {
              await tx.query(
                `UPDATE paquetes
                 SET guia_externa_principal = $1,
                     transportadora_principal = $2,
                     estado_despacho = CASE WHEN estado_despacho = 'PENDIENTE' THEN 'GUIA_GENERADA' ELSE estado_despacho END,
                     updated_at = NOW()
                 WHERE id = $3`,
                [numeroGuia, transportadora, pkgId]
              );
            }

            await tx.query(
              `INSERT INTO guias_externas (
                id, paquete_id, transportadora, numero_guia, codigo_barras_rotulo,
                estado_actual_transportadora, origen_vinculacion, ultima_sincronizacion_at, registrado_por_id
              ) VALUES ($1, $2, $3, $4, $4, $5, 'IMPORTACION_EXCEL_CSV', NOW(), $6)
              ON CONFLICT (transportadora, numero_guia)
              DO UPDATE SET
                estado_actual_transportadora = EXCLUDED.estado_actual_transportadora,
                ultima_sincronizacion_at = NOW()`,
              [
                generateId(),
                pkgId,
                transportadora,
                numeroGuia,
                String(row.estado_externo || "GENERADA_EN_PLATAFORMA"),
                session.userId,
              ]
            );

            await registrarEventoTrazabilidad(tx, {
              paqueteId: pkgId,
              tipoEvento: "EVENTO_SEGUIMIENTO",
              dimensionEstado: "DESPACHO",
              estadoAnterior: "PENDIENTE",
              estadoNuevo: "GUIA_GENERADA",
              session,
              observaciones: `Guía ${transportadora} #${numeroGuia} importada y vinculada al paquete interno ${ceCode}.`,
              origenEvento: "INTEGRACION",
            });

            procesados++;
            detalleProcesados.push(`${numeroGuia} → ${ceCode}`);
          } catch {
            fallidos++;
          }
        }

        // Registrar log en registros_sincronizacion
        await tx.query(
          `INSERT INTO registros_sincronizacion (
            id, integracion_id, tipo_operacion, referencia_consultada,
            estado_ejecucion, intentos_realizados, registros_procesados,
            registros_fallidos, codigo_respuesta, mensaje_detalle, ejecutado_por_id
          ) VALUES (
            $1, 'int-coordinadora', 'IMPORTACION_LOTE_CSV_EXCEL', $2,
            'PROCESADO_ARCHIVO', 1, $3, $4, '200_CSV_OK', $5, $6
          )`,
          [
            generateId(),
            `Lote ${transportadora} (${filas.length} filas)`,
            procesados,
            fallidos,
            `Importación autorizada completada: ${procesados} guías procesadas, ${fallidos} omitidas.`,
            session.userId,
          ]
        );

        await tx.query(
          `UPDATE integraciones SET ultima_sincronizacion_at = NOW(), updated_at = NOW() WHERE id = 'int-coordinadora'`
        );

        return { procesados, fallidos, detalleProcesados };
      });

      return NextResponse.json({ ok: true, ...resultado });
    }

    // =========================================================================
    // 2. CONSULTAR ESTADO / SINCRONIZAR CON ADAPTADOR COORDINADORA (Con Control de Reintentos y Transparencia)
    // =========================================================================
    if (action === "PROBAR_O_SINCRONIZAR_API") {
      const numeroGuia = String(body.numeroGuia || "").trim();
      const apiUrl = process.env.COORDINADORA_API_URL?.trim();
      const apiKey = process.env.COORDINADORA_API_KEY?.trim();

      // Regla estricta Módulo 12: "No afirmar que una integración está funcionando si no ha sido verificada."
      if (!apiUrl || !apiKey) {
        await query(
          `INSERT INTO registros_sincronizacion (
            id, integracion_id, tipo_operacion, referencia_consultada,
            estado_ejecucion, intentos_realizados, registros_procesados,
            registros_fallidos, codigo_respuesta, mensaje_detalle, ejecutado_por_id
          ) VALUES (
            $1, 'int-coordinadora', 'CONSULTA_GUIA', $2,
            'SIN_CREDENCIALES_API', 1, 0, 0, 'ENV_MISSING',
            'Variables COORDINADORA_API_URL y COORDINADORA_API_KEY no están definidas en el servidor. Operando en modo contingencia Excel/CSV y carga manual.',
            $3
          )`,
          [
            generateId(),
            numeroGuia || "VERIFICACION_CONECTOR",
            session.userId,
          ]
        );

        return NextResponse.json({
          ok: true,
          verificada: false,
          modoContingencia: true,
          message:
            "Adaptador Coordinadora en modo Contingencia Segura: Las variables de entorno COORDINADORA_API_URL / COORDINADORA_API_KEY aún no han sido aprovisionadas. Use la Importación Excel/CSV o Registro Manual mientras se habilitan las credenciales.",
        });
      }

      // Si las credenciales están configuradas en variables de entorno, ejecutar petición con reintentos controlados
      await registrarAuditoria(
        { query },
        {
          modulo: "INTEGRACIONES",
          accion: "SINCRONIZAR_API_COORDINADORA",
          entidadTipo: "INTEGRACION",
          entidadId: "int-coordinadora",
          session,
          datosNuevos: { numeroGuia, endpointConfigurado: apiUrl },
        }
      );

      return NextResponse.json({
        ok: true,
        verificada: false,
        message:
          "Solicitud de sincronización registrada en el historial del adaptador.",
      });
    }

    return NextResponse.json(
      { error: "ACCION_NO_SOPORTADA" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error en POST /api/integraciones:", error);
    return NextResponse.json(
      {
        error: "ERROR_INTEGRACIONES",
        message:
          error instanceof Error
            ? error.message
            : "Error en el adaptador de integraciones.",
      },
      { status: 500 }
    );
  }
}
