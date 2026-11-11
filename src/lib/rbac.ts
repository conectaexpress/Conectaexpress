import { SessionPayload } from "./crypto-auth";

export type RoleCode =
  | "SUPERADMIN"
  | "ADMIN"
  | "COORDINADOR_LOGISTICO"
  | "OPERARIO_BODEGA"
  | "RESPONSABLE_DESPACHO"
  | "TRANSPORTADOR_EXTERNO"
  | "CLIENTE"
  | "CONSULTA";

export interface RoleDefinition {
  id: string;
  codigo: RoleCode;
  nombre: string;
  descripcion: string;
  nivel_jerarquia: number;
  entorno_principal: "ADMIN" | "CLIENTE" | "TRANSPORTADOR";
}

export const ROLES_CATALOG: RoleDefinition[] = [
  {
    id: "rol-superadmin",
    codigo: "SUPERADMIN",
    nombre: "Superadministrador",
    descripcion:
      "Control total de la plataforma, configuración de integraciones, seguridad, usuarios, permisos y operaciones.",
    nivel_jerarquia: 100,
    entorno_principal: "ADMIN",
  },
  {
    id: "rol-admin",
    codigo: "ADMIN",
    nombre: "Administrador Operativo",
    descripcion:
      "Administración integral de clientes, transportadores, recogidas, bodega, despachos, reportes y usuarios.",
    nivel_jerarquia: 90,
    entorno_principal: "ADMIN",
  },
  {
    id: "rol-coordinador",
    codigo: "COORDINADOR_LOGISTICO",
    nombre: "Coordinador Logístico",
    descripcion:
      "Programación de solicitudes, asignación de transportadores, control de recogidas, novedades y trazabilidad.",
    nivel_jerarquia: 75,
    entorno_principal: "ADMIN",
  },
  {
    id: "rol-bodega",
    codigo: "OPERARIO_BODEGA",
    nombre: "Operario de Bodega",
    descripcion:
      "Escaneo continuo, recepción en bodega, generación de rótulos internos, almacenamiento, ubicaciones y clasificación.",
    nivel_jerarquia: 60,
    entorno_principal: "ADMIN",
  },
  {
    id: "rol-despacho",
    codigo: "RESPONSABLE_DESPACHO",
    nombre: "Responsable de Despacho",
    descripcion:
      "Consolidación, creación de despachos, manifiestos, verificación de salida por escaneo y entrega a transportadoras.",
    nivel_jerarquia: 65,
    entorno_principal: "ADMIN",
  },
  {
    id: "rol-transportador",
    codigo: "TRANSPORTADOR_EXTERNO",
    nombre: "Transportador Externo",
    descripcion:
      "Acceso exclusivo al Portal Móvil de Transportadores para gestionar únicamente las recogidas que le fueron asignadas.",
    nivel_jerarquia: 40,
    entorno_principal: "TRANSPORTADOR",
  },
  {
    id: "rol-cliente",
    codigo: "CLIENTE",
    nombre: "Cliente Corporativo",
    descripcion:
      "Acceso exclusivo al Portal de Clientes para solicitar recogidas, consultar sus guías/envíos, novedades y comprobantes.",
    nivel_jerarquia: 30,
    entorno_principal: "CLIENTE",
  },
  {
    id: "rol-consulta",
    codigo: "CONSULTA",
    nombre: "Auditor / Consulta",
    descripcion:
      "Acceso de solo lectura al dashboard administrativo, trazabilidad, inventario y exportación de reportes.",
    nivel_jerarquia: 20,
    entorno_principal: "ADMIN",
  },
];

export type PermissionKey =
  | "dashboard:ver"
  | "portal_cliente:acceder"
  | "portal_transportador:acceder"
  | "recogidas:ver"
  | "recogidas:crear"
  | "recogidas:programar"
  | "recogidas:asignar"
  | "recogidas:cancelar"
  | "transportadores:ver"
  | "transportadores:gestionar"
  | "escaner:operar"
  | "paquetes:ver"
  | "paquetes:crear_rotulo"
  | "paquetes:reimprimir_rotulo"
  | "bodega_recepcion:operar"
  | "inventario_wms:ver"
  | "inventario_wms:mover"
  | "clasificacion:operar"
  | "despachos:ver"
  | "despachos:crear"
  | "despachos:cerrar"
  | "despachos:autorizar_diferencias"
  | "integraciones:ver"
  | "integraciones:configurar"
  | "trazabilidad:ver"
  | "novedades:ver"
  | "novedades:gestionar"
  | "clientes:ver"
  | "clientes:gestionar"
  | "reportes:exportar"
  | "usuarios:gestionar"
  | "notificaciones:ver";

export const ROLE_PERMISSIONS_MAP: Record<RoleCode, PermissionKey[]> = {
  SUPERADMIN: [
    "dashboard:ver",
    "portal_cliente:acceder",
    "portal_transportador:acceder",
    "recogidas:ver",
    "recogidas:crear",
    "recogidas:programar",
    "recogidas:asignar",
    "recogidas:cancelar",
    "transportadores:ver",
    "transportadores:gestionar",
    "escaner:operar",
    "paquetes:ver",
    "paquetes:crear_rotulo",
    "paquetes:reimprimir_rotulo",
    "bodega_recepcion:operar",
    "inventario_wms:ver",
    "inventario_wms:mover",
    "clasificacion:operar",
    "despachos:ver",
    "despachos:crear",
    "despachos:cerrar",
    "despachos:autorizar_diferencias",
    "integraciones:ver",
    "integraciones:configurar",
    "trazabilidad:ver",
    "novedades:ver",
    "novedades:gestionar",
    "clientes:ver",
    "clientes:gestionar",
    "reportes:exportar",
    "usuarios:gestionar",
    "notificaciones:ver",
  ],
  ADMIN: [
    "dashboard:ver",
    "recogidas:ver",
    "recogidas:crear",
    "recogidas:programar",
    "recogidas:asignar",
    "recogidas:cancelar",
    "transportadores:ver",
    "transportadores:gestionar",
    "escaner:operar",
    "paquetes:ver",
    "paquetes:crear_rotulo",
    "paquetes:reimprimir_rotulo",
    "bodega_recepcion:operar",
    "inventario_wms:ver",
    "inventario_wms:mover",
    "clasificacion:operar",
    "despachos:ver",
    "despachos:crear",
    "despachos:cerrar",
    "despachos:autorizar_diferencias",
    "integraciones:ver",
    "integraciones:configurar",
    "trazabilidad:ver",
    "novedades:ver",
    "novedades:gestionar",
    "clientes:ver",
    "clientes:gestionar",
    "reportes:exportar",
    "usuarios:gestionar",
    "notificaciones:ver",
  ],
  COORDINADOR_LOGISTICO: [
    "dashboard:ver",
    "recogidas:ver",
    "recogidas:crear",
    "recogidas:programar",
    "recogidas:asignar",
    "recogidas:cancelar",
    "transportadores:ver",
    "transportadores:gestionar",
    "escaner:operar",
    "paquetes:ver",
    "paquetes:crear_rotulo",
    "inventario_wms:ver",
    "despachos:ver",
    "integraciones:ver",
    "trazabilidad:ver",
    "novedades:ver",
    "novedades:gestionar",
    "clientes:ver",
    "clientes:gestionar",
    "reportes:exportar",
    "notificaciones:ver",
  ],
  OPERARIO_BODEGA: [
    "dashboard:ver",
    "recogidas:ver",
    "escaner:operar",
    "paquetes:ver",
    "paquetes:crear_rotulo",
    "bodega_recepcion:operar",
    "inventario_wms:ver",
    "inventario_wms:mover",
    "clasificacion:operar",
    "trazabilidad:ver",
    "novedades:ver",
    "novedades:gestionar",
    "notificaciones:ver",
  ],
  RESPONSABLE_DESPACHO: [
    "dashboard:ver",
    "escaner:operar",
    "paquetes:ver",
    "paquetes:crear_rotulo",
    "paquetes:reimprimir_rotulo",
    "inventario_wms:ver",
    "inventario_wms:mover",
    "clasificacion:operar",
    "despachos:ver",
    "despachos:crear",
    "despachos:cerrar",
    "integraciones:ver",
    "trazabilidad:ver",
    "novedades:ver",
    "novedades:gestionar",
    "reportes:exportar",
    "notificaciones:ver",
  ],
  TRANSPORTADOR_EXTERNO: [
    "portal_transportador:acceder",
    "recogidas:ver",
    "escaner:operar",
    "novedades:ver",
    "novedades:gestionar",
    "notificaciones:ver",
  ],
  CLIENTE: [
    "portal_cliente:acceder",
    "recogidas:ver",
    "recogidas:crear",
    "paquetes:ver",
    "trazabilidad:ver",
    "novedades:ver",
    "notificaciones:ver",
  ],
  CONSULTA: [
    "dashboard:ver",
    "recogidas:ver",
    "transportadores:ver",
    "paquetes:ver",
    "inventario_wms:ver",
    "despachos:ver",
    "integraciones:ver",
    "trazabilidad:ver",
    "novedades:ver",
    "clientes:ver",
    "reportes:exportar",
    "notificaciones:ver",
  ],
};

export function hasPermission(
  session: SessionPayload | null,
  permission: PermissionKey
): boolean {
  if (!session) return false;
  const rolePerms =
    ROLE_PERMISSIONS_MAP[session.rolCodigo as RoleCode] || [];
  return rolePerms.includes(permission);
}

export function getHomeRouteForRole(rolCodigo: string): string {
  if (rolCodigo === "CLIENTE") return "/portal-cliente";
  if (rolCodigo === "TRANSPORTADOR_EXTERNO") return "/transportador";
  return "/admin";
}
