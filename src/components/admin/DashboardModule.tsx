"use client";

import React from "react";
import {
  ClipboardList,
  Truck,
  Package,
  AlertTriangle,
  ScanBarcode,
  ArrowRight,
  Clock,
} from "lucide-react";
import { StateBadge } from "@/components/ui/StateBadge";

interface DashboardProps {
  kpis: Record<string, number>;
  graficos: {
    porFecha: Record<string, unknown>[];
    porCliente: Record<string, unknown>[];
    porCiudad: Record<string, unknown>[];
    porTransportador: Record<string, unknown>[];
    porServicio: Record<string, unknown>[];
  };
  ultimosEventos: Record<string, unknown>[];
  solicitudes?: Record<string, unknown>[];
  paquetes?: Record<string, unknown>[];
  onNavigate: (mod: string) => void;
}

export function DashboardModule({
  kpis,
  ultimosEventos,
  solicitudes = [],
  paquetes = [],
  onNavigate,
}: DashboardProps) {
  const solicitudesPorAsignar = solicitudes.filter((s) =>
    [
      "SOLICITUD_RECIBIDA",
      "SOLICITADA",
      "PENDIENTE_PROGRAMACION",
      "EN_REVISION",
      "PROGRAMADA",
      "REPROGRAMADA",
    ].includes(String(s.estado_recogida || ""))
  );

  const tarjetasResumen = [
    {
      categoria: "Solicitudes",
      titulo: "Pendientes de Asignación",
      valor: solicitudesPorAsignar.length,
      subtexto: `${kpis.solicitudesRecibidas ?? solicitudes.length} solicitudes registradas`,
      botonTexto: "Gestionar Recogidas",
      destino: "RECOGIDAS",
      icono: ClipboardList,
      destacado: solicitudesPorAsignar.length > 0,
    },
    {
      categoria: "Transportadores",
      titulo: "Recogidas en Proceso",
      valor:
        (kpis.recogidasAsignadas ?? 0) + (kpis.recogidasEnProceso ?? 0),
      subtexto: `${kpis.recogidasCompletadas ?? 0} recogidas completadas`,
      botonTexto: "Ver Recogidas Asignadas",
      destino: "RECOGIDAS",
      icono: Truck,
      destacado: false,
    },
    {
      categoria: "Mercancía",
      titulo: "Paquetes y Guías",
      valor: paquetes.length || (kpis.paquetesRecogidos ?? 0),
      subtexto: `${kpis.paquetesRecogidos ?? 0} paquetes con recogida confirmada`,
      botonTexto: "Consultar Paquetes y Guías",
      destino: "PAQUETES",
      icono: Package,
      destacado: false,
    },
    {
      categoria: "Seguimiento",
      titulo: "Novedades Reportadas",
      valor: kpis.novedadesAbiertas ?? 0,
      subtexto: `${kpis.recogidasFallidas ?? 0} recogidas fallidas`,
      botonTexto: "Revisar Novedades",
      destino: "NOVEDADES",
      icono: AlertTriangle,
      destacado: (kpis.novedadesAbiertas ?? 0) > 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Encabezado Principal Operativo en Rojo Corporativo #DE1025 con Logo .SVG Integrado */}
      <div className="bg-[#DE1025] text-white rounded-2xl p-6 sm:p-7 shadow-[0_12px_30px_-8px_rgba(222,16,37,0.32)] border border-[#B80D1F] flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex flex-col md:flex-row md:items-center gap-5 md:gap-6">
          <div className="shrink-0 md:pr-6 md:border-r md:border-white/25 flex items-center">
            <img
              src="/logo-conecta.svg"
              alt="Conecta Express"
              width={240}
              height={35}
              className="h-8 sm:h-9 w-auto object-contain select-none"
            />
          </div>

          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/90">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span>Gestión de Recogidas y Trazabilidad</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1">
              Panel Operativo Conecta Express
            </h2>
            <p className="text-xs sm:text-sm text-white/90 mt-1.5 max-w-2xl leading-relaxed">
              Administre las solicitudes de recogida, asigne transportadores terceros, escanee paquetes con sus medidas y consulte la trazabilidad en tiempo real.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate("RECOGIDAS")}
            className="px-4 py-2.5 bg-white hover:bg-[#FFF1F2] text-[#DE1025] rounded-xl text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <ClipboardList className="w-4 h-4 text-[#DE1025]" />
            <span>Solicitudes y Recogidas</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate("ESCANER")}
            className="px-4 py-2.5 bg-white/15 hover:bg-white/25 border border-white/35 text-white rounded-xl text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 transition-all cursor-pointer"
          >
            <ScanBarcode className="w-4 h-4 text-white" />
            <span>Escanear Paquetes</span>
          </button>
        </div>
      </div>

      {/* Tarjetas de Indicadores Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tarjetasResumen.map((item) => {
          const Icon = item.icono;
          return (
            <div
              key={item.titulo}
              className={`bg-white rounded-2xl p-5 border flex flex-col justify-between transition-all shadow-2xs ${item.destacado
                  ? "border-[#DE1025] border-t-4 border-t-[#DE1025]"
                  : "border-[#E4E4E7] hover:border-[#D4D4D8]"
                }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#71717A]">
                    {item.categoria}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-[#FFF1F2] border border-[#FCD4D8] flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[#DE1025]" />
                  </div>
                </div>
                <div
                  className={`text-3xl font-bold mt-2.5 ${item.destacado ? "text-[#DE1025]" : "text-[#18181B]"
                    }`}
                >
                  {item.valor}
                </div>
                <div className="text-sm font-bold text-[#18181B] mt-1">
                  {item.titulo}
                </div>
                <div className="text-xs text-[#71717A] mt-0.5">
                  {item.subtexto}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate(item.destino)}
                className={`mt-4 w-full py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${item.destacado
                    ? "bg-[#DE1025] hover:bg-[#B80D1F] text-white"
                    : "bg-[#F4F4F6] text-[#27272A] hover:bg-[#FFF1F2] hover:text-[#DE1025]"
                  }`}
              >
                <span>{item.botonTexto}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Dos Columnas: Solicitudes por Asignar y Últimos Paquetes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-3.5">
            <div>
              <h3 className="text-sm font-bold text-[#18181B]">
                Solicitudes Pendientes de Asignar Transportador (
                {solicitudesPorAsignar.length})
              </h3>
              <p className="text-xs text-[#71717A] mt-0.5">
                Solicitudes recibidas que requieren asignación de transportador tercero.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("RECOGIDAS")}
              className="text-xs font-bold text-[#DE1025] hover:underline shrink-0 cursor-pointer"
            >
              Ver todas →
            </button>
          </div>

          {solicitudesPorAsignar.length === 0 ? (
            <div className="p-6 bg-[#F8F8FA] rounded-xl border border-[#E4E4E7] text-center text-xs text-[#52525B]">
              Todas las solicitudes actuales ya tienen transportador asignado.
            </div>
          ) : (
            <div className="space-y-2.5">
              {solicitudesPorAsignar.slice(0, 5).map((sol) => (
                <div
                  key={String(sol.id)}
                  className="p-3.5 bg-[#F8F8FA] hover:bg-[#FFF8F9] rounded-xl border border-[#E4E4E7] flex items-center justify-between gap-3 text-xs transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#18181B]">
                        {String(sol.consecutivo)}
                      </span>
                      <span className="font-semibold text-[#27272A]">
                        {String(sol.cliente_nombre)}
                      </span>
                    </div>
                    <div className="text-[#52525B] mt-1">
                      📍 {String(sol.direccion_texto)} ({String(sol.ciudad)}) • 📦{" "}
                      {Number(sol.cantidad_estimada_paquetes)} paq.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate("RECOGIDAS")}
                    className="px-3.5 py-2 bg-[#DE1025] hover:bg-[#B80D1F] text-white rounded-lg text-xs font-bold shrink-0 transition-colors cursor-pointer"
                  >
                    Asignar Transportador
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-3.5">
            <div>
              <h3 className="text-sm font-bold text-[#18181B]">
                Paquetes Recientes y Medidas Registradas ({paquetes.length})
              </h3>
              <p className="text-xs text-[#71717A] mt-0.5">
                Paquetes identificados con rótulo Conecta Express o guía de transportadora.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("PAQUETES")}
              className="text-xs font-bold text-[#DE1025] hover:underline shrink-0 cursor-pointer"
            >
              Ver paquetes →
            </button>
          </div>

          {paquetes.length === 0 ? (
            <div className="p-6 bg-[#F8F8FA] rounded-xl border border-[#E4E4E7] text-center text-xs text-[#52525B]">
              No hay paquetes registrados aún.
            </div>
          ) : (
            <div className="space-y-2.5">
              {paquetes.slice(0, 5).map((pkg) => (
                <div
                  key={String(pkg.id)}
                  className="p-3.5 bg-[#F8F8FA] hover:bg-[#FFF8F9] rounded-xl border border-[#E4E4E7] flex items-center justify-between gap-3 text-xs transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#18181B]">
                        {String(pkg.identificador_interno)}
                      </span>
                      <span className="text-[#52525B] font-mono">
                        ({Number(pkg.largo_cm || 20)}×{Number(pkg.ancho_cm || 20)}×
                        {Number(pkg.alto_cm || 20)} cm • {Number(pkg.peso_kg)} kg)
                      </span>
                    </div>
                    <div className="text-[#52525B] mt-1">
                      Cliente: {String(pkg.cliente_nombre)} • Solicitud:{" "}
                      <strong>
                        {String(pkg.solicitud_consecutivo || "Directo")}
                      </strong>
                    </div>
                  </div>
                  <StateBadge estado={String(pkg.estado_recogida)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Últimos Eventos de Trazabilidad */}
      <div className="bg-white rounded-2xl border border-[#E4E4E7] p-5 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-3.5">
          <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#FFF1F2] border border-[#FCD4D8] flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-[#DE1025]" />
            </div>
            <span>Últimas Actualizaciones de Estado y Trazabilidad</span>
          </h3>
          <button
            type="button"
            onClick={() => onNavigate("TRAZABILIDAD")}
            className="text-xs font-bold text-[#DE1025] hover:underline cursor-pointer"
          >
            Ver trazabilidad completa →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ultimosEventos.slice(0, 6).map((ev) => (
            <div
              key={String(ev.id)}
              className="p-3.5 bg-[#F8F8FA] hover:bg-[#FFF8F9] rounded-xl border border-[#E4E4E7] text-xs flex items-start justify-between gap-3 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[#18181B]">
                    {String(
                      ev.identificador_interno ||
                      ev.solicitud_consecutivo ||
                      "Operación"
                    )}
                  </span>
                  <StateBadge estado={String(ev.estado_nuevo)} />
                </div>
                <p className="text-[#3F3F46]">{String(ev.observaciones)}</p>
                <div className="text-[11px] text-[#71717A]">
                  Responsable: {String(ev.usuario_nombre)}
                </div>
              </div>
              <span className="text-[11px] text-[#71717A] shrink-0 font-mono">
                {new Date(String(ev.created_at)).toLocaleTimeString("es-CO", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
