import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto-auth";
import { setServerSessionCookie } from "@/lib/session";
import { getHomeRouteForRole, ROLE_PERMISSIONS_MAP, RoleCode } from "@/lib/rbac";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json(
        {
          error: "CREDENCIALES_INCOMPLETAS",
          message: "Ingrese su correo corporativo y contraseña.",
        },
        { status: 400 }
      );
    }

    const userRes = await query<{
      id: string;
      email: string;
      password_hash: string;
      nombre_completo: string;
      activo: boolean;
      cliente_id: string | null;
      transportador_id: string | null;
      rol_codigo: string;
      rol_nombre: string;
    }>(
      `SELECT u.id, u.email, u.password_hash, u.nombre_completo, u.activo,
              u.cliente_id, u.transportador_id,
              r.codigo AS rol_codigo, r.nombre AS rol_nombre
       FROM usuarios u
       JOIN usuarios_roles ur ON ur.usuario_id = u.id
       JOIN roles r ON r.id = ur.rol_id
       WHERE LOWER(u.email) = $1
       ORDER BY r.nivel_jerarquia DESC
       LIMIT 1`,
      [email]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json(
        {
          error: "CREDENCIALES_INVALIDAS",
          message: "Correo o contraseña incorrectos.",
        },
        { status: 401 }
      );
    }

    const user = userRes.rows[0];
    if (!user.activo) {
      return NextResponse.json(
        {
          error: "CUENTA_INACTIVA",
          message:
            "Su cuenta se encuentra deshabilitada. Contacte al administrador de Conecta Express.",
        },
        { status: 403 }
      );
    }

    const valid = verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json(
        {
          error: "CREDENCIALES_INVALIDAS",
          message: "Correo o contraseña incorrectos.",
        },
        { status: 401 }
      );
    }

    await query(`UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1`, [
      user.id,
    ]);

    const sessionData = {
      userId: user.id,
      email: user.email,
      nombre: user.nombre_completo,
      rolCodigo: user.rol_codigo,
      rolNombre: user.rol_nombre,
      clienteId: user.cliente_id,
      transportadorId: user.transportador_id,
    };

    await setServerSessionCookie(sessionData);

    return NextResponse.json({
      ok: true,
      user: {
        ...sessionData,
        permisos: ROLE_PERMISSIONS_MAP[user.rol_codigo as RoleCode] || [],
      },
      redirectTo: getHomeRouteForRole(user.rol_codigo),
    });
  } catch (error) {
    console.error("Error en /api/auth/login:", error);
    return NextResponse.json(
      {
        error: "ERROR_INTERNO",
        message: "Error procesando la solicitud de autenticación.",
      },
      { status: 500 }
    );
  }
}
