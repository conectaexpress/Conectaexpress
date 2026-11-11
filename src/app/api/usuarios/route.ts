import { NextRequest, NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { requireApiPermission } from "@/lib/session";
import { generateId, hashPassword } from "@/lib/crypto-auth";
import { ROLES_CATALOG, ROLE_PERMISSIONS_MAP } from "@/lib/rbac";
import { registrarAuditoria } from "@/lib/operational-service";

export async function GET() {
  const auth = await requireApiPermission("usuarios:gestionar");
  if (!auth.authorized) return auth.response;

  const [usersRes, clientesRes, transpRes, auditRes] = await Promise.all([
    query(
      `SELECT u.id, u.email, u.nombre_completo, u.telefono, u.cargo, u.activo,
              u.cliente_id, u.transportador_id, u.ultimo_acceso, u.created_at,
              r.id AS rol_id, r.codigo AS rol_codigo, r.nombre AS rol_nombre,
              c.razon_social AS cliente_nombre,
              t.razon_social AS transportador_nombre
       FROM usuarios u
       JOIN usuarios_roles ur ON ur.usuario_id = u.id
       JOIN roles r ON r.id = ur.rol_id
       LEFT JOIN clientes c ON c.id = u.cliente_id
       LEFT JOIN transportadores t ON t.id = u.transportador_id
       ORDER BY u.created_at DESC`
    ),
    query(`SELECT id, codigo_cliente, razon_social FROM clientes ORDER BY razon_social`),
    query(`SELECT id, codigo_transportador, razon_social FROM transportadores ORDER BY razon_social`),
    query(
      `SELECT id, modulo, accion, entidad_tipo, usuario_email, rol_activo, justificacion, created_at
       FROM auditoria
       ORDER BY created_at DESC
       LIMIT 40`
    ),
  ]);

  return NextResponse.json({
    usuarios: usersRes.rows,
    roles: ROLES_CATALOG,
    matrizPermisos: ROLE_PERMISSIONS_MAP,
    clientes: clientesRes.rows,
    transportadores: transpRes.rows,
    auditoria: auditRes.rows,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiPermission("usuarios:gestionar");
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const nombreCompleto = String(body.nombreCompleto || "").trim();
    const telefono = String(body.telefono || "").trim();
    const cargo = String(body.cargo || "").trim();
    const rolCodigo = String(body.rolCodigo || "OPERARIO_BODEGA");
    const clienteId = body.clienteId ? String(body.clienteId) : null;
    const transportadorId = body.transportadorId
      ? String(body.transportadorId)
      : null;

    if (!email || !password || !nombreCompleto) {
      return NextResponse.json(
        {
          error: "DATOS_INCOMPLETOS",
          message: "Nombre, correo y contraseña son obligatorios.",
        },
        { status: 400 }
      );
    }

    if (rolCodigo === "CLIENTE" && !clienteId) {
      return NextResponse.json(
        {
          error: "CLIENTE_REQUERIDO",
          message:
            "Todo usuario con rol CLIENTE debe estar aislado y vinculado a una empresa cliente.",
        },
        { status: 400 }
      );
    }

    if (rolCodigo === "TRANSPORTADOR_EXTERNO" && !transportadorId) {
      return NextResponse.json(
        {
          error: "TRANSPORTADOR_REQUERIDO",
          message:
            "Todo usuario con rol TRANSPORTADOR_EXTERNO debe estar vinculado a una empresa transportadora.",
        },
        { status: 400 }
      );
    }

    const rolDef = ROLES_CATALOG.find((r) => r.codigo === rolCodigo);
    if (!rolDef) {
      return NextResponse.json({ error: "ROL_INVALIDO" }, { status: 400 });
    }

    const userId = generateId();
    const passwordHash = hashPassword(password);

    await withTransaction(async (tx) => {
      await tx.query(
        `INSERT INTO usuarios (
          id, email, password_hash, nombre_completo, telefono, cargo, activo, cliente_id, transportador_id
        ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8)`,
        [
          userId,
          email,
          passwordHash,
          nombreCompleto,
          telefono,
          cargo || rolDef.nombre,
          rolCodigo === "CLIENTE" ? clienteId : null,
          rolCodigo === "TRANSPORTADOR_EXTERNO" ? transportadorId : null,
        ]
      );

      await tx.query(
        `INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES ($1, $2)`,
        [userId, rolDef.id]
      );

      await registrarAuditoria(tx, {
        modulo: "USUARIOS_Y_PERMISOS",
        accion: "CREAR_USUARIO",
        entidadTipo: "USUARIO",
        entidadId: userId,
        session: auth.session,
        datosNuevos: { email, nombreCompleto, rolCodigo, clienteId, transportadorId },
      });
    });

    return NextResponse.json({ ok: true, id: userId });
  } catch (error) {
    console.error("Error en POST /api/usuarios:", error);
    return NextResponse.json(
      {
        error: "ERROR_CREAR_USUARIO",
        message:
          error instanceof Error
            ? error.message
            : "No fue posible crear el usuario.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApiPermission("usuarios:gestionar");
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const usuarioId = String(body.usuarioId || "");
    const activo = Boolean(body.activo);

    await withTransaction(async (tx) => {
      await tx.query(
        `UPDATE usuarios SET activo = $1, updated_at = NOW() WHERE id = $2`,
        [activo, usuarioId]
      );
      await registrarAuditoria(tx, {
        modulo: "USUARIOS_Y_PERMISOS",
        accion: activo ? "ACTIVAR_USUARIO" : "DESACTIVAR_USUARIO",
        entidadTipo: "USUARIO",
        entidadId: usuarioId,
        session: auth.session,
        datosNuevos: { activo },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error en PATCH /api/usuarios:", error);
    return NextResponse.json(
      { error: "ERROR_ACTUALIZAR_USUARIO" },
      { status: 500 }
    );
  }
}
