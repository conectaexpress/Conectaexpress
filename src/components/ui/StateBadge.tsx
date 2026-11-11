import React from "react";

/**
 * Diccionario de etiquetas en lenguaje claro y sencillo para todos los estados operativos.
 */
const ETIQUETAS_CLARAS: Record<string, string> = {
  SOLICITUD_RECIBIDA: "Solicitud recibida",
  SOLICITADA: "Solicitud recibida",
  PENDIENTE_PROGRAMACION: "Pendiente de asignación",
  EN_REVISION: "Pendiente de asignación",
  PROGRAMADA: "Pendiente de asignación",
  REPROGRAMADA: "Pendiente de asignación",
  ASIGNADA: "Recogida asignada",
  ACEPTADA: "Recogida asignada",
  EN_CAMINO: "Transportador en camino",
  EN_PUNTO_RECOGIDA: "Recogida en proceso",
  RECOGIDA_COMPLETADA: "Mercancía recogida",
  RECOGIDA_PARCIAL: "Mercancía recogida",
  RECOGIDA_FALLIDA: "Recogida fallida",
  CANCELADA: "Cancelada",
  NO_INGRESADO: "Pendiente de entrega",
  PENDIENTE_RECEPCION: "Mercancía recogida",
  RECIBIDO: "Entregada a Conecta Express",
  EN_VERIFICACION: "Entregada a Conecta Express",
  CONFORME: "Entregada a Conecta Express",
  CON_NOVEDAD: "Novedad reportada",
  CLASIFICADO: "Entregada a Conecta Express",
  ALMACENADO: "Entregada a Conecta Express",
  EN_PREPARACION: "Entregada a Conecta Express",
  CONSOLIDADO: "Entregada a Conecta Express",
  PENDIENTE: "Pendiente de despacho",
  PENDIENTE_GUIA: "Pendiente de guía",
  GUIA_GENERADA: "Guía asignada",
  LISTO_PARA_DESPACHO: "Lista para entrega a transportadora",
  DESPACHADO: "Entregada a transportadora",
  ENTREGADO_AL_TRANSPORTADOR: "Entregada a transportadora",
  EN_TRANSITO: "En tránsito",
  ENTREGADO: "Entregada al destinatario",
  DEVUELTO: "Novedad reportada",
  ABIERTA: "Novedad reportada",
  EN_GESTION: "En revisión",
  RESUELTA: "Solucionada",
  CERRADA: "Cerrada",
  CERRADA_CONFORME: "Completada",
  ROTULO_INTERNO_CE: "Rótulo Conecta Express",
  GUIA_COORDINADORA: "Guía Coordinadora",
  GUIA_OTRA_TRANSPORTADORA: "Guía transportadora aliada",
  ALTA: "Prioridad alta",
  CRITICA: "Urgente",
  NORMAL: "Normal",
  BAJA: "Baja",
};

export function formatReadableStatus(estado: string): string {
  const normalized = (estado || "PENDIENTE").toUpperCase();
  return ETIQUETAS_CLARAS[normalized] || normalized.replace(/_/g, " ");
}

/**
 * Etiqueta de estado corporativa:
 * Construida con la paleta #DE1025, #FFFFFF, tonalidades suaves de rojo (#FFF1F2) y grises claros.
 */
export function StateBadge({
  estado,
  dimension,
}: {
  estado: string;
  dimension?: "RECOGIDA" | "BODEGA" | "DESPACHO" | "PRIORIDAD" | "GENERAL";
}) {
  const normalized = (estado || "PENDIENTE").toUpperCase();

  // Estados críticos o de alerta: Fondo rojo muy suave #FFF1F2, borde #F9B4BB y texto #B80D1F
  const isCriticalOrAlert = [
    "RECOGIDA_FALLIDA",
    "CANCELADA",
    "CON_NOVEDAD",
    "DEVUELTO",
    "CRITICA",
    "ALTA",
    "ABIERTA",
    "FALTANTE",
    "AVERIADO",
    "NO_IDENTIFICADO",
    "CODIGO_DESCONOCIDO",
  ].includes(normalized);

  // Estados completados / finales verificados: Fondo rojo corporativo #DE1025 con texto blanco
  const isCompletedOrFinal = [
    "RECOGIDA_COMPLETADA",
    "CONFORME",
    "ENTREGADO_AL_TRANSPORTADOR",
    "ENTREGADO",
    "RESUELTA",
    "CERRADA",
    "CERRADA_CONFORME",
    "ACTIVO",
    "ROTULO_INTERNO_CE",
  ].includes(normalized);

  // Estados activos en tránsito / ejecución: Superficie blanca con borde suave y punto #DE1025
  const isActiveProgress = [
    "ASIGNADA",
    "ACEPTADA",
    "EN_CAMINO",
    "EN_PUNTO_RECOGIDA",
    "RECIBIDO",
    "EN_VERIFICACION",
    "CLASIFICADO",
    "EN_PREPARACION",
    "CONSOLIDADO",
    "GUIA_GENERADA",
    "LISTO_PARA_DESPACHO",
    "DESPACHADO",
    "EN_TRANSITO",
    "EN_PROCESO",
    "EN_GESTION",
    "GUIA_COORDINADORA",
  ].includes(normalized);

  let classes =
    "bg-[#F4F4F6] text-[#3F3F46] border border-[#E4E4E7] font-medium";
  let dotClass = "bg-[#71717A]";

  if (isCriticalOrAlert) {
    classes =
      "bg-[#FFF1F2] text-[#B80D1F] border border-[#FCD4D8] font-semibold";
    dotClass = "bg-[#DE1025]";
  } else if (isCompletedOrFinal) {
    classes =
      "bg-[#DE1025] text-white border border-[#DE1025] font-semibold shadow-2xs";
    dotClass = "bg-white";
  } else if (isActiveProgress) {
    classes =
      "bg-white text-[#18181B] border border-[#D4D4D8] font-semibold shadow-2xs";
    dotClass = "bg-[#DE1025]";
  }

  const label = formatReadableStatus(normalized);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] leading-none whitespace-nowrap ${classes}`}
      title={dimension ? `${dimension}: ${label}` : label}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
      {label}
    </span>
  );
}
