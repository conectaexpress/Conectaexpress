import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SessionPayload,
  signSessionToken,
  verifySessionToken,
} from "./crypto-auth";
import { hasPermission, PermissionKey } from "./rbac";

export const SESSION_COOKIE_NAME = "conecta_express_session";

export async function getServerSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setServerSessionCookie(
  payload: Omit<SessionPayload, "exp">
): Promise<string> {
  const token = signSessionToken(payload);
  const cookieStore = await cookies();
  const ttlHours = Number(process.env.AUTH_SESSION_TTL_HOURS || "12");
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ttlHours * 3600,
  });
  return token;
}

export async function clearServerSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function requireApiPermission(
  permission: PermissionKey
): Promise<
  | { authorized: true; session: SessionPayload }
  | { authorized: false; response: NextResponse }
> {
  const session = await getServerSession();
  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "NO_AUTENTICADO", message: "Debe iniciar sesión para continuar." },
        { status: 401 }
      ),
    };
  }
  if (!hasPermission(session, permission)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: "ACCESO_DENEGADO",
          message: `Su rol (${session.rolNombre}) no cuenta con el permiso requerido (${permission}).`,
        },
        { status: 403 }
      ),
    };
  }
  return { authorized: true, session };
}
