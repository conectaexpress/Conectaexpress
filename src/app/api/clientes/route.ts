import { NextRequest, NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { getServerSession } from "@/lib/session";
import { hasPermission } from "@/lib/rbac";
import { generateId, hashPassword } from "@/lib/crypto-auth";
import { registrarAuditoria } from "@/lib/operational-service";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "NO_AUTENTICADO" }, { status: 401 });
    }

    const search = req.nextUrl.searchParams.get("q")?.trim() || "";

    // Aislamiento estricto para Rol CLIENTE
    if (session.rolCodigo === "CLIENTE") {
      if (!session.clienteId) {
        return NextResponse.json(
          { error: "SIN_CLIENTE_VINCULADO" },
          { status: 403 }
        );
      }

      const [cliRes, dirRes, cntRes] = await Promise.all([
        query(`SELECT * FROM clientes WHERE id = $1`, [session.clienteId]),
        query(
          `SELECT * FROM direcciones WHERE cliente_id = $1 AND activa = TRUE ORDER BY es_frecuente DESC, created_at DESC`,
          [session.clienteId]
        ),
        query(
          `SELECT * FROM contactos WHERE cliente_id = $1 AND activo = TRUE ORDER BY es_principal DESC, created_at DESC`,
          [session.clienteId]
        ),
      ]);

      return NextResponse.json({
        clientes: cliRes.rows,
        direcciones: dirRes.rows,
        contactos: cntRes.rows,
      });
    }

    if (!hasPermission(session, "clientes:ver")) {
      return NextResponse.json({ error: "ACCESO_DENEGADO" }, { status: 403 });
    }

    const params: unknown[] = [];
    let whereSql = "WHERE 1=1";
    if (search) {
      params.push(`%${search}%`);
      whereSql += ` AND (c.razon_social ILIKE $1 OR c.nit ILIKE $1 OR c.codigo_cliente ILIKE $1 OR c.ciudad_principal ILIKE $1)`;
    }

    const clientesRes = await query(
      `SELECT c.*,
        (SELECT COUNT(*)::int FROM solicitudes_recogida s WHERE s.cliente_id = c.id) AS total_solicitudes,
        (SELECT COUNT(*)::int FROM solicitudes_recogida s WHERE s.cliente_id = c.id AND s.estado_recogida = 'RECOGIDA_COMPLETADA') AS recogidas_completadas,
        (SELECT COUNT(*)::int FROM paquetes p WHERE p.cliente_id = c.id) AS total_paquetes,
        (SELECT COUNT(*)::int FROM paquetes p WHERE p.cliente_id = c.id AND p.estado_despacho IN ('ENTREGADO_AL_TRANSPORTADOR', 'EN_TRANSITO', 'ENTREGADO')) AS envios_despachados,
        (SELECT COUNT(*)::int FROM usuarios u WHERE u.cliente_id = c.id AND u.activo = TRUE) AS usuarios_activos
       FROM clientes c
       ${whereSql}
       ORDER BY c.created_at DESC`,
      params
    );

    const [direccionesRes, contactosRes] = await Promise.all([
      query(
        `SELECT d.*, c.razon_social AS cliente_nombre
         FROM direcciones d
         JOIN clientes c ON c.id = d.cliente_id
         WHERE d.activa = TRUE
         ORDER BY d.es_frecuente DESC, d.created_at DESC`
      ),
      query(
        `SELECT ct.*, c.razon_social AS cliente_nombre
         FROM contactos ct
         JOIN clientes c ON c.id = ct.cliente_id
         WHERE ct.activo = TRUE
         ORDER BY ct.es_principal DESC, ct.created_at DESC`
      ),
    ]);

    return NextResponse.json({
      clientes: clientesRes.rows,
      direcciones: direccionesRes.rows,
      contactos: contactosRes.rows,
    });
  } catch (error) {
    console.error("Error en GET /api/clientes:", error);
    return NextResponse.json(
      { error: "ERROR_CONSULTA_CLIENTES" },
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
    const action = String(body.action || "CREAR_CLIENTE");

    // 1. Crear Dirección Frecuente (Permitido al Cliente sobre su propio tenant o a Admin)
    if (action === "CREAR_DIRECCION") {
      const targetClienteId =
        session.rolCodigo === "CLIENTE"
          ? session.clienteId
          : String(body.clienteId || "");

      if (!targetClienteId) {
        return NextResponse.json(
          { error: "CLIENTE_REQUERIDO", message: "Debe indicar el cliente." },
          { status: 400 }
        );
      }

      if (
        session.rolCodigo !== "CLIENTE" &&
        !hasPermission(session, "clientes:gestionar")
      ) {
        return NextResponse.json({ error: "ACCESO_DENEGADO" }, { status: 403 });
      }

      const id = generateId();
      await query(
        `INSERT INTO direcciones (
          id, cliente_id, alias, direccion_completa, complemento, barrio,
          ciudad, departamento, zona_logistica, codigo_dane, latitud, longitud,
          contacto_local_nombre, contacto_local_telefono, horario_atencion, es_frecuente
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, TRUE)`,
        [
          id,
          targetClienteId,
          String(body.alias || "Sede Operativa").trim(),
          String(body.direccionCompleta || "").trim(),
          body.complemento ? String(body.complemento).trim() : null,
          body.barrio ? String(body.barrio).trim() : null,
          String(body.ciudad || "Bogotá D.C.").trim(),
          String(body.departamento || "Cundinamarca").trim(),
          String(body.zonaLogistica || "ZONA_CENTRO").trim(),
          body.codigoDane ? String(body.codigoDane).trim() : null,
          body.latitud ? Number(body.latitud) : null,
          body.longitud ? Number(body.longitud) : null,
          body.contactoNombre ? String(body.contactoNombre).trim() : null,
          body.contactoTelefono ? String(body.contactoTelefono).trim() : null,
          String(body.horarioAtencion || "08:00 - 17:30").trim(),
        ]
      );

      return NextResponse.json({ ok: true, id });
    }

    // 2. Crear Contacto Frecuente
    if (action === "CREAR_CONTACTO") {
      const targetClienteId =
        session.rolCodigo === "CLIENTE"
          ? session.clienteId
          : String(body.clienteId || "");

      if (!targetClienteId) {
        return NextResponse.json(
          { error: "CLIENTE_REQUERIDO" },
          { status: 400 }
        );
      }

      if (
        session.rolCodigo !== "CLIENTE" &&
        !hasPermission(session, "clientes:gestionar")
      ) {
        return NextResponse.json({ error: "ACCESO_DENEGADO" }, { status: 403 });
      }

      const id = generateId();
      await query(
        `INSERT INTO contactos (
          id, cliente_id, nombre_completo, cargo, telefono, email, ciudad, es_principal
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          targetClienteId,
          String(body.nombreCompleto || "").trim(),
          body.cargo ? String(body.cargo).trim() : "Contacto Logístico",
          String(body.telefono || "").trim(),
          body.email ? String(body.email).trim() : null,
          String(body.ciudad || "Bogotá D.C.").trim(),
          Boolean(body.esPrincipal),
        ]
      );

      return NextResponse.json({ ok: true, id });
    }

    // 3. Crear Nuevo Cliente Corporativo (Módulo 15)
    if (!hasPermission(session, "clientes:gestionar")) {
      return NextResponse.json({ error: "ACCESO_DENEGADO" }, { status: 403 });
    }

    const razonSocial = String(body.razonSocial || "").trim();
    const nit = String(body.nit || "").trim();
    const emailCorporativo = String(body.emailCorporativo || "")
      .trim()
      .toLowerCase();
    const telefonoPrincipal = String(body.telefonoPrincipal || "").trim();
    const ciudadPrincipal = String(
      body.ciudadPrincipal || "Bogotá D.C."
    ).trim();
    const direccionPrincipal = String(body.direccionPrincipal || "").trim();

    if (
      !razonSocial ||
      !nit ||
      !emailCorporativo ||
      !telefonoPrincipal ||
      !direccionPrincipal
    ) {
      return NextResponse.json(
        {
          error: "DATOS_INCOMPLETOS",
          message:
            "Razón social, NIT, correo, teléfono y dirección principal son obligatorios.",
        },
        { status: 400 }
      );
    }

    const result = await withTransaction(async (tx) => {
      const countRes = await tx.query<{ total: number }>(
        "SELECT COUNT(*)::int AS total FROM clientes"
      );
      const nextNum = Number(countRes.rows[0]?.total || 0) + 1;
      const codigoCliente = `CLI-${String(nextNum).padStart(3, "0")}`;
      const clienteId = generateId();

      await tx.query(
        `INSERT INTO clientes (
          id, codigo_cliente, razon_social, nit, digito_verificacion, nombre_comercial,
          email_corporativo, telefono_principal, ciudad_principal, direccion_principal,
          servicios_habilitados, sla_recogida_horas, estado, observaciones
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ACTIVO', $13)`,
        [
          clienteId,
          codigoCliente,
          razonSocial,
          nit,
          body.digitoVerificacion ? String(body.digitoVerificacion) : null,
          body.nombreComercial ? String(body.nombreComercial) : razonSocial,
          emailCorporativo,
          telefonoPrincipal,
          ciudadPrincipal,
          direccionPrincipal,
          String(
            body.serviciosHabilitados || "PAQUETERIA,CARGA_MASIVA,CROSS_DOCKING"
          ),
          Number(body.slaRecogidaHoras || 4),
          body.observaciones ? String(body.observaciones) : null,
        ]
      );

      // Crear dirección principal como frecuente
      await tx.query(
        `INSERT INTO direcciones (
          id, cliente_id, alias, direccion_completa, ciudad, departamento,
          zona_logistica, contacto_local_nombre, contacto_local_telefono, es_frecuente
        ) VALUES ($1, $2, 'Sede Principal', $3, $4, $5, $6, $7, $8, TRUE)`,
        [
          generateId(),
          clienteId,
          direccionPrincipal,
          ciudadPrincipal,
          String(body.departamento || "Cundinamarca"),
          String(body.zonaLogistica || "ZONA_CENTRO"),
          String(body.contactoNombre || razonSocial),
          telefonoPrincipal,
        ]
      );

      // Crear contacto principal
      if (body.contactoNombre) {
        await tx.query(
          `INSERT INTO contactos (
            id, cliente_id, nombre_completo, cargo, telefono, email, ciudad, es_principal
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
          [
            generateId(),
            clienteId,
            String(body.contactoNombre),
            String(body.contactoCargo || "Coordinador de Despachos"),
            telefonoPrincipal,
            emailCorporativo,
            ciudadPrincipal,
          ]
        );
      }

      // Si se solicita crear credencial de Portal de Clientes automáticamente
      let usuarioCreadoEmail: string | null = null;
      if (body.crearUsuarioPortal && body.passwordPortal) {
        const userId = generateId();
        const passwordHash = hashPassword(String(body.passwordPortal));
        await tx.query(
          `INSERT INTO usuarios (
            id, email, password_hash, nombre_completo, telefono, cargo, activo, cliente_id
          ) VALUES ($1, $2, $3, $4, $5, 'Usuario Portal Cliente', TRUE, $6)`,
          [
            userId,
            emailCorporativo,
            passwordHash,
            String(body.contactoNombre || razonSocial),
            telefonoPrincipal,
            clienteId,
          ]
        );
        await tx.query(
          `INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES ($1, 'rol-cliente')`,
          [userId]
        );
        usuarioCreadoEmail = emailCorporativo;
      }

      await registrarAuditoria(tx, {
        modulo: "CLIENTES",
        accion: "CREAR_CLIENTE",
        entidadTipo: "CLIENTE",
        entidadId: clienteId,
        session,
        datosNuevos: { codigoCliente, razonSocial, nit, usuarioCreadoEmail },
      });

      return { clienteId, codigoCliente, usuarioCreadoEmail };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Error en POST /api/clientes:", error);
    return NextResponse.json(
      {
        error: "ERROR_CREACION_CLIENTE",
        message:
          error instanceof Error
            ? error.message
            : "Error registrando el cliente.",
      },
      { status: 500 }
    );
  }
}
