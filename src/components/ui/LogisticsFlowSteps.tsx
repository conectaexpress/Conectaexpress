import React from "react";
import { Check } from "lucide-react";

export interface LogisticsStageInfo {
  etapaNumero: number; // 1..6
  etapaTitulo: string;
  etapaDescripcion: string;
  tieneInconveniente: boolean;
}

const ETAPAS_FLUJO = [
  { numero: 1, corto: "Solicitud", titulo: "Solicitud recibida" },
  { numero: 2, corto: "Asignación", titulo: "Recogida asignada" },
  { numero: 3, corto: "Recogida", titulo: "Mercancía recogida" },
  {
    numero: 4,
    corto: "Conecta Express",
    titulo: "Entregada a Conecta Express",
  },
  { numero: 5, corto: "Transportadora", titulo: "Entregada a transportadora" },
  { numero: 6, corto: "Destino", titulo: "Entregada al destinatario" },
];

/**
 * Calcula en cuál etapa del proceso logístico real se encuentra una solicitud o paquete,
 * utilizando los estados sugeridos por Conecta Express.
 */
export function resolveLogisticsStage(item: {
  estado_recogida?: string;
  estado_bodega?: string;
  estado_despacho?: string;
}): LogisticsStageInfo {
  const rec = (item.estado_recogida || "").toUpperCase();
  const bod = (item.estado_bodega || "").toUpperCase();
  const desp = (item.estado_despacho || "").toUpperCase();

  const tieneInconveniente =
    rec === "RECOGIDA_FALLIDA" ||
    rec === "CANCELADA" ||
    bod === "CON_NOVEDAD" ||
    desp === "DEVUELTO";

  // Etapa 6: Entregada al destinatario
  if (desp === "ENTREGADO") {
    return {
      etapaNumero: 6,
      etapaTitulo: "Entregada al destinatario",
      etapaDescripcion:
        "El paquete fue entregado satisfactoriamente en la dirección del destinatario.",
      tieneInconveniente,
    };
  }

  // Etapa 5: Entregada a transportadora / En tránsito
  if (
    [
      "DESPACHADO",
      "ENTREGADO_AL_TRANSPORTADOR",
      "EN_TRANSITO",
      "LISTO_PARA_DESPACHO",
    ].includes(desp)
  ) {
    return {
      etapaNumero: 5,
      etapaTitulo:
        desp === "EN_TRANSITO"
          ? "En tránsito"
          : "Entregada a transportadora",
      etapaDescripcion:
        "La mercancía fue entregada a Coordinadora u otra transportadora aliada y viaja hacia su destino.",
      tieneInconveniente,
    };
  }

  // Etapa 4: Entregada a Conecta Express
  if (
    [
      "RECIBIDO",
      "EN_VERIFICACION",
      "CONFORME",
      "CON_NOVEDAD",
      "CLASIFICADO",
      "ALMACENADO",
      "EN_PREPARACION",
      "CONSOLIDADO",
    ].includes(bod) ||
    desp === "GUIA_GENERADA"
  ) {
    return {
      etapaNumero: 4,
      etapaTitulo:
        bod === "CON_NOVEDAD"
          ? "Novedad reportada"
          : "Entregada a Conecta Express",
      etapaDescripcion:
        "La mercancía fue recibida por Conecta Express y se encuentra lista para su envío por transportadora.",
      tieneInconveniente,
    };
  }

  // Etapa 3: Mercancía recogida
  if (["RECOGIDA_COMPLETADA", "RECOGIDA_PARCIAL"].includes(rec)) {
    return {
      etapaNumero: 3,
      etapaTitulo: "Mercancía recogida",
      etapaDescripcion:
        "El transportador escaneó los paquetes, registró sus medidas y confirmó la recogida en sitio.",
      tieneInconveniente,
    };
  }

  // Etapa 2: Recogida asignada / Transportador en camino / Recogida en proceso
  if (
    ["ASIGNADA", "ACEPTADA", "EN_CAMINO", "EN_PUNTO_RECOGIDA"].includes(rec)
  ) {
    return {
      etapaNumero: 2,
      etapaTitulo:
        rec === "EN_CAMINO"
          ? "Transportador en camino"
          : rec === "EN_PUNTO_RECOGIDA"
            ? "Recogida en proceso"
            : "Recogida asignada",
      etapaDescripcion:
        "Conecta Express asignó un transportador tercero para acudir a recoger la mercancía.",
      tieneInconveniente,
    };
  }

  // Etapa 1: Solicitud recibida / Pendiente de asignación / Recogida fallida
  return {
    etapaNumero: 1,
    etapaTitulo:
      rec === "RECOGIDA_FALLIDA"
        ? "Recogida fallida"
        : rec === "PROGRAMADA" || rec === "PENDIENTE_PROGRAMACION"
          ? "Pendiente de asignación"
          : "Solicitud recibida",
    etapaDescripcion:
      "La solicitud fue registrada en Conecta Express y está pendiente de asignación de transportador.",
    tieneInconveniente,
  };
}

export function LogisticsFlowSteps({
  estado_recogida,
  estado_bodega,
  estado_despacho,
  compact = false,
}: {
  estado_recogida?: string;
  estado_bodega?: string;
  estado_despacho?: string;
  compact?: boolean;
}) {
  const info = resolveLogisticsStage({
    estado_recogida,
    estado_bodega,
    estado_despacho,
  });

  if (compact) {
    return (
      <div className="flex flex-col gap-1.5 min-w-[190px]">
        <div className="flex items-center justify-between text-xs">
          <span
            className={`font-semibold ${
              info.tieneInconveniente ? "text-[#DE1025]" : "text-[#18181B]"
            }`}
          >
            {info.etapaTitulo}
          </span>
          <span className="text-[10px] font-bold text-[#71717A]">
            {info.etapaNumero}/6
          </span>
        </div>
        <div className="grid grid-cols-6 gap-1">
          {ETAPAS_FLUJO.map((e) => {
            const completada = e.numero < info.etapaNumero;
            const actual = e.numero === info.etapaNumero;
            return (
              <div
                key={e.numero}
                title={e.titulo}
                className={`h-1.5 rounded-full transition-colors ${
                  actual
                    ? "bg-[#DE1025]"
                    : completada
                      ? "bg-[#DE1025]/70"
                      : "bg-[#E4E4E7]"
                }`}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F8F8FA] border border-[#E4E4E7] rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#DE1025]">
            Estado actual del proceso
          </span>
          <h4 className="text-sm font-bold text-[#18181B] mt-0.5">
            {info.etapaTitulo}
          </h4>
        </div>
        <p className="text-xs text-[#52525B] max-w-md">
          {info.etapaDescripcion}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
        {ETAPAS_FLUJO.map((e) => {
          const completada = e.numero < info.etapaNumero;
          const actual = e.numero === info.etapaNumero;
          return (
            <div
              key={e.numero}
              className={`p-3 rounded-xl border text-xs flex flex-col justify-between transition-all ${
                actual
                  ? "bg-[#FFF1F2] border-[#DE1025] text-[#18181B] font-semibold shadow-2xs"
                  : completada
                    ? "bg-white border-[#D4D4D8] text-[#27272A]"
                    : "bg-[#F4F4F6] border-[#E4E4E7] text-[#A1A1AA]"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                    actual || completada
                      ? "bg-[#DE1025] text-white"
                      : "bg-[#E4E4E7] text-[#71717A]"
                  }`}
                >
                  {completada || actual ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#71717A]" />
                  )}
                </span>
                {actual && (
                  <span className="px-1.5 py-0.5 rounded bg-[#DE1025] text-white text-[9px] font-bold uppercase tracking-wider">
                    Actual
                  </span>
                )}
              </div>
              <span className="leading-snug">{e.titulo}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
