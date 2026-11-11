"use client";

import React, { useState } from "react";
import {
  ScanBarcode,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  ArrowRightLeft,
  FileDown,
  Send,
  Unlink,
} from "lucide-react";
import { StateBadge } from "@/components/ui/StateBadge";
import { LogisticsFlowSteps } from "@/components/ui/LogisticsFlowSteps";
import { exportarReportePDF } from "@/lib/pdf-excel-generator";

interface WmsBodegaDespachosProps {
  subView:
    | "RECEPCION_BODEGA"
    | "INVENTARIO_WMS"
    | "CLASIFICACION"
    | "DESPACHOS";
  bodegas: Record<string, unknown>[];
  zonas: Record<string, unknown>[];
  ubicaciones: Record<string, unknown>[];
  recepciones: Record<string, unknown>[];
  paquetesEsperados: Record<string, unknown>[];
  paquetesEnBodega: Record<string, unknown>[];
  movimientos: Record<string, unknown>[];
  despachos: Record<string, unknown>[];
  despachosPaquetes: Record<string, unknown>[];
  manifiestos: Record<string, unknown>[];
  paquetesDisponiblesDespacho: Record<string, unknown>[];
  solicitudes: Record<string, unknown>[];
  onRefresh: () => Promise<void>;
}

export function WmsBodegaDespachosModule({
  subView,
  bodegas,
  zonas,
  ubicaciones,
  recepciones,
  paquetesEsperados,
  paquetesEnBodega,
  despachos,
  despachosPaquetes,
  manifiestos,
  paquetesDisponiblesDespacho,
  solicitudes,
  onRefresh,
}: WmsBodegaDespachosProps) {
  // Estado Recepción en Bodega
  const [solicitudRecepcionId, setSolicitudRecepcionId] = useState("");
  const [unidadesEsperadasRec, setUnidadesEsperadasRec] = useState(
    paquetesEsperados.length || 2
  );
  const [placaRecepcion, setPlacaRecepcion] = useState("WTR842");
  const [observacionesRecepcion, setObservacionesRecepcion] = useState("");
  const [codigoScanRecepcion, setCodigoScanRecepcion] = useState("");
  const [estadoFisicoScan, setEstadoFisicoScan] = useState<
    "CONFORME" | "AVERIADO" | "SOBRANTE" | "NO_IDENTIFICADO"
  >("CONFORME");
  const [itemsEscaneadosRecepcion, setItemsEscaneadosRecepcion] = useState<
    Array<{
      codigo: string;
      estadoFisico: "CONFORME" | "AVERIADO" | "SOBRANTE" | "NO_IDENTIFICADO";
      observacion?: string;
    }>
  >([]);

  // Estado Ubicaciones en Bodega
  const [formUbicacion, setFormUbicacion] = useState({
    zonaId: zonas[1]?.id ? String(zonas[1].id) : "zon-bog-alm",
    pasillo: "P03",
    estanteria: "E01",
    nivel: "N01",
    posicion: "01",
    capacidadMaxPaquetes: 60,
  });
  const [paqueteMoverId, setPaqueteMoverId] = useState("");
  const [ubicacionDestinoMoverId, setUbicacionDestinoMoverId] = useState(
    ubicaciones[1]?.id ? String(ubicaciones[1].id) : "ubi-alm-a1"
  );
  const [motivoMovimiento, setMotivoMovimiento] = useState(
    "Ubicación en estantería de bodega"
  );

  // Estado Clasificación y Despachos
  const [filtroCiudadConsolidar, setFiltroCiudadConsolidar] = useState("");
  const [selectedPkgIdsDespacho, setSelectedPkgIdsDespacho] = useState<
    string[]
  >([]);
  const [formDespacho, setFormDespacho] = useState({
    transportadoraAliada: "COORDINADORA",
    ciudadDestino: "Medellín",
    tipoServicio: "TERRESTRE_NACIONAL",
    fechaProgramadaSalida: new Date().toISOString().slice(0, 10),
    placaVehiculo: "TRK901",
    conductorNombre: "Jairo Alberto Castaño",
    conductorCedula: "71892410",
    observaciones: "Despacho desde Bodega Conecta Express",
  });

  const [despachoActivoId, setDespachoActivoId] = useState<string>("");
  const [codigoVerificacionSalida, setCodigoVerificacionSalida] = useState("");
  const [itemParaDesconsolidar, setItemParaDesconsolidar] = useState<{
    despachoId: string;
    paqueteId: string;
    identificador: string;
  } | null>(null);
  const [motivoDesconsolidacion, setMotivoDesconsolidacion] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<{
    type: "OK" | "ERROR";
    text: string;
  } | null>(null);

  function agregarItemScanRecepcion(e: React.FormEvent) {
    e.preventDefault();
    const clean = codigoScanRecepcion.trim().toUpperCase();
    if (!clean) return;
    if (itemsEscaneadosRecepcion.some((i) => i.codigo === clean)) {
      setBanner({
        type: "ERROR",
        text: `El paquete ${clean} ya fue agregado en esta recepción.`,
      });
      setCodigoScanRecepcion("");
      return;
    }
    setItemsEscaneadosRecepcion((prev) => [
      ...prev,
      { codigo: clean, estadoFisico: estadoFisicoScan },
    ]);
    setCodigoScanRecepcion("");
  }

  async function handleConfirmarRecepcionMasiva() {
    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/bodega", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REGISTRAR_RECEPCION_BODEGA",
          bodegaId: "bod-bog-01",
          solicitudRecogidaId: solicitudRecepcionId || null,
          unidadesEsperadas: unidadesEsperadasRec,
          placaVehiculo: placaRecepcion,
          itemsEscaneados: itemsEscaneadosRecepcion,
          observaciones: observacionesRecepcion,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({
          type: "ERROR",
          text: data.message || "Error registrando recepción.",
        });
      } else {
        setBanner({
          type: "OK",
          text: `Recepción en bodega ${data.recepcionConsecutivo} guardada. Paquetes recibidos: ${data.totalRecibidos}.`,
        });
        setItemsEscaneadosRecepcion([]);
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCrearUbicacionWms(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/bodega", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREAR_UBICACION_WMS",
          bodegaId: "bod-bog-01",
          ...formUbicacion,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBanner({
          type: "OK",
          text: `Estantería / ubicación ${data.codigoUbicacion} agregada a la bodega.`,
        });
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMoverPaqueteWms(
    e: React.FormEvent,
    nuevoEstadoBodega: "ALMACENADO" | "CLASIFICADO" = "ALMACENADO"
  ) {
    e.preventDefault();
    if (!paqueteMoverId || !ubicacionDestinoMoverId) return;
    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/bodega", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "MOVER_O_CLASIFICAR_PAQUETE",
          paqueteId: paqueteMoverId,
          ubicacionDestinoId: ubicacionDestinoMoverId,
          nuevoEstadoBodega,
          motivo: motivoMovimiento,
        }),
      });
      if (res.ok) {
        setBanner({
          type: "OK",
          text: "Paquete ubicado correctamente en la estantería seleccionada.",
        });
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function togglePkgConsolidacion(pkgId: string) {
    setSelectedPkgIdsDespacho((prev) =>
      prev.includes(pkgId)
        ? prev.filter((id) => id !== pkgId)
        : [...prev, pkgId]
    );
  }

  async function handleCrearDespachoConsolidado(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/despachos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREAR_DESPACHO",
          ...formDespacho,
          paquetesIds: selectedPkgIdsDespacho,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({
          type: "ERROR",
          text: data.message || "Error creando el despacho.",
        });
      } else {
        setBanner({
          type: "OK",
          text: `Despacho ${data.consecutivo} y Manifiesto ${data.numManifiesto} creados. Verifique los paquetes abajo antes de dar salida.`,
        });
        setSelectedPkgIdsDespacho([]);
        setDespachoActivoId(data.despachoId);
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmarDesconsolidacion(e: React.FormEvent) {
    e.preventDefault();
    if (!itemParaDesconsolidar || !motivoDesconsolidacion.trim()) return;
    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/despachos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DESCONSOLIDAR_PAQUETE",
          despachoId: itemParaDesconsolidar.despachoId,
          paqueteId: itemParaDesconsolidar.paqueteId,
          motivoDesconsolidacion,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({
          type: "ERROR",
          text: data.message || "Error retirando paquete del despacho.",
        });
      } else {
        setBanner({
          type: "OK",
          text: `Paquete ${itemParaDesconsolidar.identificador} retirado del despacho.`,
        });
        setItemParaDesconsolidar(null);
        setMotivoDesconsolidacion("");
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEscanearSalidaDespacho(e: React.FormEvent) {
    e.preventDefault();
    const targetDespachoId =
      despachoActivoId || (despachos[0] ? String(despachos[0].id) : "");
    if (!targetDespachoId || !codigoVerificacionSalida.trim()) return;
    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/despachos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ESCANEAR_VERIFICACION_SALIDA",
          despachoId: targetDespachoId,
          codigoEscaneado: codigoVerificacionSalida,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({
          type: "ERROR",
          text: data.message || "Error verificando paquete.",
        });
      } else {
        setBanner({
          type: "OK",
          text: `Paquete ${data.identificadorInterno} verificado para salida.`,
        });
        setCodigoVerificacionSalida("");
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCerrarDespacho(despachoId: string) {
    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/despachos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CERRAR_Y_ENTREGAR_DESPACHO",
          despachoId,
          motivoAutorizacionDiferencias:
            "Autorizado por operador de despachos",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({
          type: "ERROR",
          text: data.message || "Error confirmando salida del despacho.",
        });
      } else {
        setBanner({
          type: "OK",
          text: "¡Despacho entregado oficialmente a la transportadora!",
        });
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const paquetesSinUbicacion = paquetesEnBodega.filter(
    (p) => !p.ubicacion_actual_id
  );

  return (
    <div className="space-y-6">
      {banner && (
        <div
          className={`p-4 rounded-md border-l-4 bg-white flex items-center justify-between text-xs font-semibold shadow-sm ${
            banner.type === "OK"
              ? "border-neutral-900 text-neutral-900"
              : "border-conecta text-conecta"
          }`}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="underline ml-4 font-bold"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VISTA 1: RECEPCIÓN DE MERCANCÍA EN BODEGA                             */}
      {/* ===================================================================== */}
      {subView === "RECEPCION_BODEGA" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-neutral-200 p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Registrar Recepción de Mercancía en Bodega
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Cuando el transportador llega a la bodega, verifique los paquetes recibidos en 3 pasos sencillos.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Columna Izquierda: 3 Pasos de Recepción */}
              <div className="lg:col-span-2 space-y-4">
                {/* Paso 1 */}
                <div className="p-4 bg-neutral-50 rounded-md border border-neutral-200 space-y-3">
                  <div className="text-xs font-bold text-neutral-900">
                    Paso 1: ¿De qué recogida llegan los paquetes?
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                        Solicitud o cliente
                      </label>
                      <select
                        value={solicitudRecepcionId}
                        onChange={(e) => {
                          setSolicitudRecepcionId(e.target.value);
                          const sol = solicitudes.find(
                            (s) => String(s.id) === e.target.value
                          );
                          if (sol) {
                            setUnidadesEsperadasRec(
                              Number(
                                sol.cantidad_recogida_real ||
                                  sol.cantidad_estimada_paquetes ||
                                  1
                              )
                            );
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-neutral-300 rounded text-xs"
                      >
                        <option value="">
                          -- Ingreso general a bodega --
                        </option>
                        {solicitudes.map((s) => (
                          <option key={String(s.id)} value={String(s.id)}>
                            {String(s.consecutivo)} —{" "}
                            {String(s.cliente_nombre)} (
                            {Number(
                              s.cantidad_recogida_real ||
                                s.cantidad_estimada_paquetes
                            )}{" "}
                            paquetes)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                        Paquetes esperados
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={unidadesEsperadasRec}
                        onChange={(e) =>
                          setUnidadesEsperadasRec(Number(e.target.value))
                        }
                        className="w-full px-3 py-2 bg-white border border-neutral-300 rounded text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Paso 2 */}
                <form
                  onSubmit={agregarItemScanRecepcion}
                  className="p-4 bg-white border-2 border-conecta rounded-md space-y-3"
                >
                  <div className="text-xs font-bold text-neutral-900">
                    Paso 2: Escanee o agregue cada paquete que recibe en bodega
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <input
                      type="text"
                      value={codigoScanRecepcion}
                      onChange={(e) => setCodigoScanRecepcion(e.target.value)}
                      placeholder="Escanee código CE-... o Guía..."
                      className="md:col-span-2 px-3 py-2 bg-neutral-50 border border-neutral-300 rounded text-xs font-mono font-bold"
                    />
                    <select
                      value={estadoFisicoScan}
                      onChange={(e) =>
                        setEstadoFisicoScan(
                          e.target.value as
                            | "CONFORME"
                            | "AVERIADO"
                            | "SOBRANTE"
                            | "NO_IDENTIFICADO"
                        )
                      }
                      className="px-2.5 py-2 bg-white border border-neutral-300 rounded text-xs font-semibold"
                    >
                      <option value="CONFORME">En buen estado</option>
                      <option value="AVERIADO">Con avería / daño</option>
                      <option value="SOBRANTE">Paquete sobrante</option>
                      <option value="NO_IDENTIFICADO">Sin identificar</option>
                    </select>
                    <button
                      type="submit"
                      className="py-2 bg-neutral-900 text-white rounded text-xs font-bold uppercase"
                    >
                      + Agregar Paquete
                    </button>
                  </div>
                </form>

                {/* Contadores claros */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-neutral-50 border border-neutral-200 rounded">
                    <div className="text-xs text-neutral-500 font-semibold">
                      Paquetes Esperados
                    </div>
                    <div className="text-2xl font-bold text-neutral-900 mt-1">
                      {unidadesEsperadasRec}
                    </div>
                  </div>
                  <div className="p-3 bg-neutral-50 border border-neutral-200 rounded">
                    <div className="text-xs text-neutral-500 font-semibold">
                      Paquetes Recibidos
                    </div>
                    <div className="text-2xl font-bold text-neutral-900 mt-1">
                      {itemsEscaneadosRecepcion.length}
                    </div>
                  </div>
                  <div className="p-3 bg-neutral-50 border border-neutral-200 rounded">
                    <div className="text-xs text-neutral-500 font-semibold">
                      Pendientes / Faltantes
                    </div>
                    <div className="text-2xl font-bold text-conecta mt-1">
                      {Math.max(
                        0,
                        unidadesEsperadasRec - itemsEscaneadosRecepcion.length
                      )}
                    </div>
                  </div>
                </div>

                {itemsEscaneadosRecepcion.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-neutral-50 rounded border border-neutral-200">
                    {itemsEscaneadosRecepcion.map((item, idx) => (
                      <div
                        key={`${item.codigo}-${idx}`}
                        className="px-3 py-1 bg-white border border-neutral-300 rounded text-xs flex items-center gap-2"
                      >
                        <span className="font-mono font-bold">
                          ✓ {item.codigo}
                        </span>
                        <StateBadge estado={item.estadoFisico} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Paso 3 */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-200">
                  <input
                    type="text"
                    value={observacionesRecepcion}
                    onChange={(e) => setObservacionesRecepcion(e.target.value)}
                    placeholder="Observaciones opcionales de la recepción..."
                    className="flex-1 px-3 py-2.5 border border-neutral-300 rounded text-xs"
                  />
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleConfirmarRecepcionMasiva}
                    className="px-6 py-2.5 bg-conecta text-white rounded text-xs font-bold uppercase tracking-wider hover:opacity-95"
                  >
                    Paso 3: Confirmar Recepción en Bodega
                  </button>
                </div>
              </div>

              {/* Columna Derecha: Lista rápida de paquetes por recibir */}
              <div className="bg-neutral-50 rounded-md border border-neutral-200 p-4 space-y-3">
                <div className="text-xs font-bold text-neutral-900">
                  Paquetes Pendientes por Llegar ({paquetesEsperados.length})
                </div>
                <p className="text-[11px] text-neutral-500">
                  También puede hacer clic en <strong>+ Recibir</strong> sobre cada paquete cuando ingrese a la bodega:
                </p>

                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {paquetesEsperados.map((p) => (
                    <div
                      key={String(p.id)}
                      className="p-2.5 bg-white rounded border border-neutral-200 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-mono font-bold text-neutral-900">
                          {String(p.identificador_interno)}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          {String(p.cliente_nombre)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const code = String(p.identificador_interno);
                          if (
                            !itemsEscaneadosRecepcion.some(
                              (i) => i.codigo === code
                            )
                          ) {
                            setItemsEscaneadosRecepcion((prev) => [
                              ...prev,
                              { codigo: code, estadoFisico: "CONFORME" },
                            ]);
                          }
                        }}
                        className="px-3 py-1 bg-conecta text-white rounded text-xs font-bold"
                      >
                        + Recibir
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Historial de Recepciones */}
          <div className="bg-white rounded-lg border border-neutral-200 p-5 space-y-3">
            <h3 className="text-sm font-bold text-neutral-900">
              Recepciones Registradas en Bodega ({recepciones.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 font-semibold">
                    <th className="py-2.5 px-3">Nº Recepción</th>
                    <th className="py-2.5 px-3">Cliente / Solicitud</th>
                    <th className="py-2.5 px-3">Esperados vs Recibidos</th>
                    <th className="py-2.5 px-3">Recibido por</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3 text-right">Acta PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {recepciones.map((r) => (
                    <tr key={String(r.id)}>
                      <td className="py-2.5 px-3 font-mono font-bold">
                        {String(r.consecutivo)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-neutral-900">
                          {String(r.cliente_nombre || "Recepción General")}
                        </div>
                        <div className="text-neutral-500">
                          Solicitud:{" "}
                          {String(r.solicitud_consecutivo || "Directo")}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        {Number(r.unidades_esperadas)} esperados /{" "}
                        <strong>
                          {Number(r.unidades_escaneadas_conformes)} recibidos
                        </strong>
                      </td>
                      <td className="py-2.5 px-3">
                        {String(r.recibido_por_nombre)}
                      </td>
                      <td className="py-2.5 px-3">
                        <StateBadge estado={String(r.estado_recepcion)} />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            exportarReportePDF({
                              tituloReporte:
                                "Acta Oficial de Recepción en Bodega",
                              codigoReporte: String(r.consecutivo),
                              columnas: [
                                "Recepción",
                                "Cliente",
                                "Esperados",
                                "Recibidos",
                                "Faltantes",
                                "Estado",
                              ],
                              filas: [
                                [
                                  String(r.consecutivo),
                                  String(r.cliente_nombre || "General"),
                                  Number(r.unidades_esperadas),
                                  Number(r.unidades_escaneadas_conformes),
                                  Number(r.unidades_faltantes),
                                  String(r.estado_recepcion),
                                ],
                              ],
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-neutral-300 text-neutral-800 rounded text-xs font-semibold"
                        >
                          <FileDown className="w-3.5 h-3.5 text-conecta" />
                          <span>Descargar PDF</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VISTA 2: PAQUETES ALMACENADOS Y UBICACIÓN EN BODEGA                   */}
      {/* ===================================================================== */}
      {subView === "INVENTARIO_WMS" && (
        <div className="space-y-6">
          {paquetesSinUbicacion.length > 0 && (
            <div className="bg-white border-2 border-conecta rounded-lg p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-conecta shrink-0" />
              <div className="text-xs">
                <strong className="text-conecta uppercase">
                  Atención:
                </strong>{" "}
                Hay <strong>{paquetesSinUbicacion.length}</strong> paquete(s) en bodega que aún no tienen estantería asignada. Asígnelos en el recuadro de abajo.
              </div>
            </div>
          )}

          {/* Asignar Ubicación y Consultar Estanterías */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formulario Simple para Ubicar un Paquete */}
            <form
              onSubmit={(e) => handleMoverPaqueteWms(e, "ALMACENADO")}
              className="bg-white rounded-lg border-2 border-conecta p-5 space-y-3 shadow-sm"
            >
              <div className="flex items-center gap-2 border-b border-neutral-200 pb-2.5">
                <ArrowRightLeft className="w-4 h-4 text-conecta" />
                <h3 className="text-sm font-bold text-neutral-900">
                  Asignar Estantería a un Paquete
                </h3>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  1. Elija el paquete en bodega *
                </label>
                <select
                  required
                  value={paqueteMoverId}
                  onChange={(e) => setPaqueteMoverId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-neutral-300 rounded text-xs font-mono"
                >
                  <option value="">-- Seleccionar paquete --</option>
                  {paquetesEnBodega.map((p) => (
                    <option key={String(p.id)} value={String(p.id)}>
                      {String(p.identificador_interno)} (
                      {String(p.ubicacion_codigo || "Sin estantería")})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  2. Elija la estantería / ubicación *
                </label>
                <select
                  required
                  value={ubicacionDestinoMoverId}
                  onChange={(e) => setUbicacionDestinoMoverId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-neutral-300 rounded text-xs font-mono"
                >
                  {ubicaciones.map((u) => (
                    <option key={String(u.id)} value={String(u.id)}>
                      {String(u.codigo_ubicacion)} — {String(u.zona_nombre)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-conecta text-white rounded text-xs font-bold uppercase tracking-wider"
              >
                Guardar Ubicación del Paquete
              </button>
            </form>

            {/* Mapa Claro de Estanterías de la Bodega */}
            <div className="lg:col-span-2 bg-white rounded-lg border border-neutral-200 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-neutral-900">
                    Zonas y Estanterías de{" "}
                    {String(bodegas[0]?.nombre || "Bodega Principal")}
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Cantidad de paquetes guardados en cada ubicación física.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {ubicaciones.map((u) => (
                  <div
                    key={String(u.id)}
                    className="p-3 bg-neutral-50 rounded border border-neutral-200 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-neutral-900">
                        {String(u.codigo_ubicacion)}
                      </span>
                      <span className="px-2 py-0.5 bg-neutral-900 text-white rounded text-[10px] font-bold">
                        {Number(u.paquetes_en_ubicacion || 0)} paquetes
                      </span>
                    </div>
                    <div className="text-neutral-700 font-medium">
                      {String(u.zona_nombre)}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      Pasillo {String(u.pasillo)} • Estantería{" "}
                      {String(u.estanteria)}
                    </div>
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleCrearUbicacionWms}
                className="pt-3 border-t border-neutral-200 flex flex-wrap items-center gap-2"
              >
                <span className="text-xs font-bold text-neutral-700 flex items-center gap-1">
                  <PlusCircle className="w-3.5 h-3.5 text-conecta" />
                  <span>Nueva estantería:</span>
                </span>
                <select
                  value={formUbicacion.zonaId}
                  onChange={(e) =>
                    setFormUbicacion({
                      ...formUbicacion,
                      zonaId: e.target.value,
                    })
                  }
                  className="px-2.5 py-1.5 border border-neutral-300 rounded text-xs"
                >
                  {zonas.map((z) => (
                    <option key={String(z.id)} value={String(z.id)}>
                      {String(z.nombre)}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Pasillo (P03)"
                  value={formUbicacion.pasillo}
                  onChange={(e) =>
                    setFormUbicacion({
                      ...formUbicacion,
                      pasillo: e.target.value,
                    })
                  }
                  className="w-24 px-2 py-1.5 border border-neutral-300 rounded text-xs font-mono"
                />
                <input
                  type="text"
                  placeholder="Estant. (E01)"
                  value={formUbicacion.estanteria}
                  onChange={(e) =>
                    setFormUbicacion({
                      ...formUbicacion,
                      estanteria: e.target.value,
                    })
                  }
                  className="w-24 px-2 py-1.5 border border-neutral-300 rounded text-xs font-mono"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-neutral-900 text-white rounded text-xs font-bold"
                >
                  Agregar
                </button>
              </form>
            </div>
          </div>

          {/* Tabla Clara de Paquetes Almacenados en Bodega */}
          <div className="bg-white rounded-lg border border-neutral-200 p-5 space-y-4">
            <h3 className="text-base font-bold text-neutral-900">
              Paquetes Actualmente en Bodega ({paquetesEnBodega.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 font-semibold">
                    <th className="py-3 px-3">Código Paquete</th>
                    <th className="py-3 px-3">Cliente</th>
                    <th className="py-3 px-3">Ciudad Destino</th>
                    <th className="py-3 px-3">Estantería / Ubicación</th>
                    <th className="py-3 px-3">Etapa del Paquete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {paquetesEnBodega.map((p) => (
                    <tr key={String(p.id)} className="hover:bg-neutral-50">
                      <td className="py-3 px-3 font-mono font-bold text-neutral-900">
                        {String(p.identificador_interno)}
                      </td>
                      <td className="py-3 px-3">
                        {String(p.cliente_nombre)}
                      </td>
                      <td className="py-3 px-3 font-semibold text-neutral-900">
                        {String(p.destinatario_ciudad)} —{" "}
                        {String(p.destinatario_nombre)}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {p.ubicacion_codigo ? (
                          <span className="px-2.5 py-1 bg-neutral-100 border border-neutral-300 rounded font-bold">
                            {String(p.ubicacion_codigo)}
                          </span>
                        ) : (
                          <span className="text-conecta font-bold">
                            Sin estantería asignada
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <LogisticsFlowSteps
                          estado_recogida={String(p.estado_recogida)}
                          estado_bodega={String(p.estado_bodega)}
                          estado_despacho={String(p.estado_despacho)}
                          compact
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VISTA 3: CLASIFICACIÓN Y PREPARACIÓN DE DESPACHOS                     */}
      {/* ===================================================================== */}
      {(subView === "CLASIFICACION" || subView === "DESPACHOS") && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-neutral-200 p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Clasificar y Preparar Despachos de Salida (Coordinadora u Otras Transportadoras)
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Agrupe los paquetes almacenados en bodega para entregarlos a la transportadora final y descargue el manifiesto PDF.
              </p>
            </div>

            <form
              onSubmit={handleCrearDespachoConsolidado}
              className="p-5 bg-neutral-50 rounded-lg border border-neutral-300 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-neutral-900">
                  Paso 1: Elija la transportadora, el destino y marque los paquetes que van a salir (
                  {selectedPkgIdsDespacho.length} seleccionados)
                </span>
                <input
                  type="text"
                  value={filtroCiudadConsolidar}
                  onChange={(e) => setFiltroCiudadConsolidar(e.target.value)}
                  placeholder="Filtrar paquetes por ciudad o cliente..."
                  className="px-3 py-1.5 bg-white border border-neutral-300 rounded text-xs w-64"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-800 mb-1">
                    Transportadora de salida *
                  </label>
                  <select
                    value={formDespacho.transportadoraAliada}
                    onChange={(e) =>
                      setFormDespacho({
                        ...formDespacho,
                        transportadoraAliada: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded text-xs font-bold"
                  >
                    <option value="COORDINADORA">COORDINADORA</option>
                    <option value="SERVIENTREGA">SERVIENTREGA</option>
                    <option value="TCC">TCC</option>
                    <option value="INTERRAPIDISIMO">INTERRAPIDÍSIMO</option>
                    <option value="FLOTA_DEDICADA_CE">FLOTA PROPIA CE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-800 mb-1">
                    Ciudad de destino *
                  </label>
                  <input
                    type="text"
                    required
                    value={formDespacho.ciudadDestino}
                    onChange={(e) =>
                      setFormDespacho({
                        ...formDespacho,
                        ciudadDestino: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-800 mb-1">
                    Placa y conductor que recibe
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={formDespacho.placaVehiculo}
                      onChange={(e) =>
                        setFormDespacho({
                          ...formDespacho,
                          placaVehiculo: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-1/3 px-2 py-2 bg-white border border-neutral-300 rounded text-xs font-mono"
                    />
                    <input
                      type="text"
                      value={formDespacho.conductorNombre}
                      onChange={(e) =>
                        setFormDespacho({
                          ...formDespacho,
                          conductorNombre: e.target.value,
                        })
                      }
                      className="w-2/3 px-2 py-2 bg-white border border-neutral-300 rounded text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={submitting || selectedPkgIdsDespacho.length === 0}
                    className="w-full py-2.5 bg-conecta text-white rounded text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                  >
                    Crear Despacho ({selectedPkgIdsDespacho.length})
                  </button>
                </div>
              </div>

              {/* Lista de paquetes listos en bodega para despachar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 max-h-52 overflow-y-auto pt-2">
                {paquetesDisponiblesDespacho
                  .filter((p) => {
                    if (!filtroCiudadConsolidar.trim()) return true;
                    const q = filtroCiudadConsolidar.toLowerCase();
                    return (
                      String(p.destinatario_ciudad || "")
                        .toLowerCase()
                        .includes(q) ||
                      String(p.cliente_nombre || "")
                        .toLowerCase()
                        .includes(q) ||
                      String(p.identificador_interno || "")
                        .toLowerCase()
                        .includes(q)
                    );
                  })
                  .map((p) => {
                    const checked = selectedPkgIdsDespacho.includes(
                      String(p.id)
                    );
                    return (
                      <label
                        key={String(p.id)}
                        className={`p-3 rounded border text-xs flex items-center gap-2.5 cursor-pointer ${
                          checked
                            ? "bg-white border-2 border-conecta font-semibold"
                            : "bg-white border-neutral-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePkgConsolidacion(String(p.id))}
                          className="accent-conecta"
                        />
                        <div>
                          <div className="font-mono font-bold text-neutral-900">
                            {String(p.identificador_interno)} (
                            {Number(p.peso_kg)} kg)
                          </div>
                          <div className="text-[11px] text-neutral-600">
                            Destino: {String(p.destinatario_ciudad)} •{" "}
                            {String(p.cliente_nombre)}
                          </div>
                        </div>
                      </label>
                    );
                  })}
              </div>
            </form>

            {itemParaDesconsolidar && (
              <form
                onSubmit={handleConfirmarDesconsolidacion}
                className="p-4 bg-white border-2 border-conecta rounded-lg space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-conecta">
                    Retirar paquete {itemParaDesconsolidar.identificador} de este despacho
                  </span>
                  <button
                    type="button"
                    onClick={() => setItemParaDesconsolidar(null)}
                    className="text-xs underline"
                  >
                    Cancelar
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={motivoDesconsolidacion}
                    onChange={(e) => setMotivoDesconsolidacion(e.target.value)}
                    placeholder="Indique por qué retira este paquete del despacho *"
                    className="flex-1 px-3 py-2 border border-neutral-300 rounded text-xs"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-conecta text-white rounded text-xs font-bold uppercase"
                  >
                    Retirar Paquete
                  </button>
                </div>
              </form>
            )}

            {/* Paso 2: Verificación de salida con escáner */}
            {despachos.length > 0 && (
              <form
                onSubmit={handleEscanearSalidaDespacho}
                className="p-4 bg-white border-2 border-conecta rounded-lg flex flex-wrap items-center gap-3"
              >
                <ScanBarcode className="w-5 h-5 text-conecta shrink-0" />
                <select
                  value={despachoActivoId || String(despachos[0]?.id || "")}
                  onChange={(e) => setDespachoActivoId(e.target.value)}
                  className="px-3 py-2 bg-neutral-50 border border-neutral-300 rounded text-xs font-mono font-bold text-neutral-900"
                >
                  {despachos.map((d) => (
                    <option key={String(d.id)} value={String(d.id)}>
                      {String(d.consecutivo)} — {String(d.transportadora_aliada)}{" "}
                      ({Number(d.total_paquetes_verificados)}/
                      {Number(d.total_paquetes_incluidos)} verificados)
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={codigoVerificacionSalida}
                  onChange={(e) => setCodigoVerificacionSalida(e.target.value)}
                  placeholder="Paso 2: Escanee cada paquete aquí para verificar su salida..."
                  className="flex-1 px-3 py-2 bg-neutral-50 text-neutral-900 border border-neutral-300 rounded text-xs font-mono font-bold"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-neutral-900 text-white rounded text-xs font-bold uppercase"
                >
                  Verificar Paquete
                </button>
              </form>
            )}

            {/* Lista de Despachos Creados */}
            <div className="space-y-4">
              {despachos.map((d) => {
                const pkgsDelDespacho = despachosPaquetes.filter(
                  (dp) => String(dp.despacho_id) === String(d.id)
                );
                const manifiesto = manifiestos.find(
                  (m) => String(m.despacho_id) === String(d.id)
                );
                return (
                  <div
                    key={String(d.id)}
                    className="border border-neutral-300 rounded-lg p-4 space-y-3 bg-white"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-neutral-900">
                            {String(d.consecutivo)}
                          </span>
                          <StateBadge
                            estado={String(d.estado_despacho)}
                            dimension="DESPACHO"
                          />
                        </div>
                        <div className="text-xs text-neutral-600 mt-1">
                          Transportadora:{" "}
                          <strong>{String(d.transportadora_aliada)}</strong> →
                          Destino: <strong>{String(d.ciudad_destino)}</strong> •
                          Verificados:{" "}
                          <strong className="text-conecta">
                            {Number(d.total_paquetes_verificados)} de{" "}
                            {Number(d.total_paquetes_incluidos)} paquetes
                          </strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            exportarReportePDF({
                              tituloReporte: `Manifiesto de Despacho ${String(
                                d.consecutivo
                              )}`,
                              codigoReporte: String(
                                manifiesto?.numero_manifiesto || d.consecutivo
                              ),
                              columnas: [
                                "Paquete Conecta",
                                "Guía Externa",
                                "Cliente",
                                "Destinatario",
                                "Ciudad Destino",
                                "Estado",
                              ],
                              filas: pkgsDelDespacho.map((item) => [
                                String(item.identificador_interno),
                                String(
                                  item.guia_externa_principal || "Rótulo CE"
                                ),
                                String(item.cliente_nombre),
                                String(item.destinatario_nombre),
                                String(item.destinatario_ciudad),
                                String(item.estado_en_despacho),
                              ]),
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-neutral-100 border border-neutral-300 rounded text-xs font-semibold text-neutral-800"
                        >
                          <FileDown className="w-3.5 h-3.5 text-conecta" />
                          <span>Descargar Manifiesto PDF</span>
                        </button>

                        {d.estado_despacho !==
                          "ENTREGADO_AL_TRANSPORTADOR" && (
                          <button
                            type="button"
                            onClick={() => handleCerrarDespacho(String(d.id))}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-conecta text-white rounded text-xs font-bold uppercase hover:opacity-95"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Confirmar Entrega a Transportadora</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {pkgsDelDespacho.map((dp) => (
                        <div
                          key={String(dp.id)}
                          className="p-2.5 bg-neutral-50 rounded border border-neutral-200 text-xs flex items-center justify-between"
                        >
                          <div>
                            <div className="font-mono font-bold text-neutral-900">
                              {String(dp.identificador_interno)}
                            </div>
                            <div className="text-[11px] text-neutral-500">
                              {String(dp.destinatario_ciudad)}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {!dp.escaneado_salida &&
                              dp.estado_en_despacho !== "DESCONSOLIDADO" && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await fetch("/api/despachos", {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({
                                        action: "ESCANEAR_VERIFICACION_SALIDA",
                                        despachoId: d.id,
                                        codigoEscaneado:
                                          dp.identificador_interno,
                                      }),
                                    });
                                    await onRefresh();
                                  }}
                                  className="px-2.5 py-1 bg-neutral-900 text-white rounded text-[11px] font-bold"
                                >
                                  Verificar
                                </button>
                              )}
                            {Boolean(dp.escaneado_salida) && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-900">
                                <CheckCircle2 className="w-4 h-4 text-conecta" />
                                Listo
                              </span>
                            )}
                            {dp.estado_en_despacho !== "DESCONSOLIDADO" &&
                              d.estado_despacho !==
                                "ENTREGADO_AL_TRANSPORTADOR" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setItemParaDesconsolidar({
                                      despachoId: String(d.id),
                                      paqueteId: String(dp.paquete_id),
                                      identificador: String(
                                        dp.identificador_interno
                                      ),
                                    })
                                  }
                                  className="p-1 text-neutral-500 hover:text-conecta"
                                  title="Retirar paquete del despacho"
                                >
                                  <Unlink className="w-3.5 h-3.5" />
                                </button>
                              )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
