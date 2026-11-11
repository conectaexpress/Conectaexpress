import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/session";
import { ROLE_PERMISSIONS_MAP, RoleCode, getHomeRouteForRole } from "@/lib/rbac";
import { query } from "@/lib/db";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  let clienteInfo = null;
  let transportadorInfo = null;

  if (session.clienteId) {
    const cRes = await query(
      `SELECT id, codigo_cliente, razon_social, nit, ciudad_principal, direccion_principal, telefono_principal
       FROM clientes WHERE id = $1`,
      [session.clienteId]
    );
    clienteInfo = cRes.rows[0] || null;
  }

  if (session.transportadorId) {
    const tRes = await query(
      `SELECT id, codigo_transportador, razon_social, nit, ciudad_base, telefono_operaciones
       FROM transportadores WHERE id = $1`,
      [session.transportadorId]
    );
    transportadorInfo = tRes.rows[0] || null;
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      ...session,
      permisos: ROLE_PERMISSIONS_MAP[session.rolCodigo as RoleCode] || [],
      homeRoute: getHomeRouteForRole(session.rolCodigo),
      cliente: clienteInfo,
      transportador: transportadorInfo,
    },
  });
}
