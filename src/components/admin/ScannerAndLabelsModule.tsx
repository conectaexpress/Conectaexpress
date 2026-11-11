"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ScanBarcode,
  Volume2,
  VolumeX,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Link2,
  PlusCircle,
  Search,
  RotateCcw,
  Ruler,
} from "lucide-react";
import { StateBadge, formatReadableStatus } from "@/components/ui/StateBadge";
import { LogisticsFlowSteps } from "@/components/ui/LogisticsFlowSteps";
import { imprimirRotuloInternoPDF } from "@/lib/pdf-excel-generator";

interface ScannerAndLabelsProps {
  subView: "ESCANER" | "PAQUETES";
  paquetes: Record<string, unknown>[];
  guiasExternas: Record<string, unknown>[];
  clientes: Record<string, unknown>[];
  solicitudes: Record<string, unknown>[];
  onRefresh: () => Promise<void>;
}

interface ScanLogItem {
  timestamp: string;
  codigo: string;
  clasificacion: string;
  transportadora: string | null;
  encontrado: boolean;
  identificadorInterno: string | null;
  mensaje: string;
  paqueteData?: Record<string, unknown> | null;
}

const EVENTOS_VERIFICABLES = [
  { value: "MERCANCIA_RECOGIDA", label: "Mercancía recogida" },
  { value: "ENTREGADA_CONECTA_EXPRESS", label: "Entregada a Conecta Express" },
  { value: "ENTREGADA_TRANSPORTADORA", label: "Entregada a transportadora" },
  { value: "EN_TRANSITO", label: "En tránsito" },
  { value: "ENTREGADA_DESTINATARIO", label: "Entregada al destinatario" },
  { value: "NOVEDAD_REPORTADA", label: "Novedad reportada" },
];

export function ScannerAndLabelsModule({
  subView,
  paquetes,
  guiasExternas,
  clientes,
  solicitudes,
  onRefresh,
}: ScannerAndLabelsProps) {
  const scannerInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [codigoActual, setCodigoActual] = useState("");
  const [sonidoActivo, setSonidoActivo] = useState(true);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [scanLogs, setScanLogs] = useState<ScanLogItem[]>([]);
  const [ultimaLectura, setUltimaLectura] = useState<ScanLogItem | null>(null);
  const [procesandoLectura, setProcesandoLectura] = useState(false);

  // Formulario para confirmar medidas y evento verificable del paquete escaneado
  const [solicitudVinculadaScan, setSolicitudVinculadaScan] = useState("");
  const [largoScan, setLargoScan] = useState(30);
  const [anchoScan, setAnchoScan] = useState(25);
  const [altoScan, setAltoScan] = useState(20);
  const [pesoScan, setPesoScan] = useState(2.5);
  const [eventoVerificableScan, setEventoVerificableScan] = useState(
    "ENTREGADA_CONECTA_EXPRESS"
  );
  const [observacionesScan, setObservacionesScan] = useState("");

  // Estado Paquetes y Guías
  const [searchPkg, setSearchPkg] = useState("");
  const [showCrearPaquete, setShowCrearPaquete] = useState(false);
  const [paqueteParaGuia, setPaqueteParaGuia] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [paqueteParaMedidasEstado, setPaqueteParaMedidasEstado] =
    useState<Record<string, unknown> | null>(null);
  const [paqueteParaReimpresion, setPaqueteParaReimpresion] = useState<Record<
    string,
    unknown
  > | null>(null);

  const [formNuevoPaquete, setFormNuevoPaquete] = useState({
    clienteId: clientes[0]?.id ? String(clientes[0].id) : "cli-corporativo-01",
    solicitudRecogidaId: "",
    destinatarioNombre: "",
    destinatarioTelefono: "",
    destinatarioDireccion: "",
    destinatarioCiudad: "Medellín",
    contenidoDeclarado: "Paquetería Comercial",
    tipoMercancia: "PAQUETERIA_ESTANDAR",
    tipoServicio: "TERRESTRE_NACIONAL",
    pesoKg: 4.5,
    largoCm: 35,
    anchoCm: 25,
    altoCm: 25,
    valorDeclarado: 180000,
    numeroGuiaExterna: "",
    transportadora: "COORDINADORA",
    formatoEtiqueta: "4X6",
    ingresaDirectoBodega: false,
    observaciones: "",
  });

  const [formAsociarGuia, setFormAsociarGuia] = useState({
    transportadora: "COORDINADORA",
    numeroGuia: "",
    origenVinculacion: "PLATAFORMA_ACTUAL",
  });

  const [formEditarPaquete, setFormEditarPaquete] = useState({
    largoCm: 30,
    anchoCm: 25,
    altoCm: 20,
    pesoKg: 2.5,
    eventoConfirmado: "ENTREGADA_CONECTA_EXPRESS",
    observaciones: "",
  });

  const [formReimpresion, setFormReimpresion] = useState({
    formatoEtiqueta: "4X6" as "4X6" | "4X2",
    motivoReimpresion: "Etiqueta deteriorada en operación",
  });

  const [banner, setBanner] = useState<{
    type: "OK" | "ERROR";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (subView === "ESCANER") {
      scannerInputRef.current?.focus();
    }
  }, [subView]);

  function emitirSonido(tipo: "OK" | "ERROR") {
    if (!sonidoActivo || typeof window === "undefined") return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (tipo === "OK") {
        osc.frequency.value = 1046.5;
        gain.gain.value = 0.12;
        osc.start();
        osc.stop(ctx.currentTime + 0.09);
      } else {
        osc.type = "square";
        osc.frequency.value = 210;
        gain.gain.value = 0.15;
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {
      // Silencioso
    }
  }

  async function toggleCamaraEscaner() {
    if (camaraActiva) {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
      setCamaraActiva(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setCamaraActiva(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch {
      setBanner({
        type: "ERROR",
        text: "No se pudo activar la cámara. Utilice su lector de códigos de barras o ingrese el código.",
      });
    }
  }

  // Escanear código únicamente identifica el paquete y carga sus medidas sin cambiar el estado aún
  async function identificarCodigoEscaneado(rawCode: string) {
    const clean = rawCode.trim().toUpperCase();
    if (!clean) return;

    setProcesandoLectura(true);
    setBanner(null);
    try {
      const res = await fetch("/api/escaner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: clean,
          modoOperacion: "IDENTIFICAR_PAQUETE",
          confirmarEvento: false,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        emitirSonido("ERROR");
        return;
      }

      const r = data.resultado;
      const pkg = (r.paquete as Record<string, unknown> | null) || null;

      if (pkg) {
        setLargoScan(Number(pkg.largo_cm || 30));
        setAnchoScan(Number(pkg.ancho_cm || 25));
        setAltoScan(Number(pkg.alto_cm || 20));
        setPesoScan(Number(pkg.peso_kg || 2.5));
        setSolicitudVinculadaScan(String(pkg.solicitud_recogida_id || ""));
      }

      const item: ScanLogItem = {
        timestamp: new Date().toLocaleTimeString("es-CO"),
        codigo: r.codigoLimpio,
        clasificacion: r.clasificacion,
        transportadora: r.transportadoraDetectada,
        encontrado: Boolean(r.encontradoEnBaseDatos),
        identificadorInterno: pkg ? String(pkg.identificador_interno) : null,
        mensaje: r.mensajeDiagnostico,
        paqueteData: pkg,
      };

      emitirSonido(r.encontradoEnBaseDatos ? "OK" : "ERROR");
      setUltimaLectura(item);
      setScanLogs((prev) => [item, ...prev]);
      setCodigoActual("");
    } finally {
      setProcesandoLectura(false);
    }
  }

  async function handleFormScan(e: React.FormEvent) {
    e.preventDefault();
    await identificarCodigoEscaneado(codigoActual);
  }

  // Confirma explícitamente las medidas y el evento verificable del paquete escaneado
  async function handleConfirmarEventoPaqueteEscaneado(e: React.FormEvent) {
    e.preventDefault();
    if (!ultimaLectura) return;
    setProcesandoLectura(true);
    setBanner(null);
    try {
      const res = await fetch("/api/escaner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: ultimaLectura.codigo,
          modoOperacion: "CONFIRMAR_EVENTO_VERIFICADO",
          confirmarEvento: true,
          eventoConfirmado: eventoVerificableScan,
          solicitudRecogidaId: solicitudVinculadaScan || null,
          largoCm: largoScan,
          anchoCm: anchoScan,
          altoCm: altoScan,
          pesoKg: pesoScan,
          observaciones: observacionesScan,
          registrarSiDesconocido: !ultimaLectura.encontrado,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const r = data.resultado;
        const pkg = (r?.paquete as Record<string, unknown> | null) || null;
        setBanner({
          type: "OK",
          text: `Paquete ${
            pkg ? String(pkg.identificador_interno) : ultimaLectura.codigo
          } actualizado con medidas (${largoScan}x${anchoScan}x${altoScan} cm — ${pesoScan} kg) y evento verificado.`,
        });
        setObservacionesScan("");
        setUltimaLectura({
          ...ultimaLectura,
          encontrado: true,
          identificadorInterno: pkg ? String(pkg.identificador_interno) : null,
          paqueteData: pkg,
          mensaje: r?.mensajeDiagnostico || "Evento confirmado exitosamente.",
        });
        await onRefresh();
      } else {
        setBanner({
          type: "ERROR",
          text: data.message || "No se pudo confirmar el evento.",
        });
      }
    } finally {
      setProcesandoLectura(false);
    }
  }

  async function handleCrearPaqueteInterno(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    const res = await fetch("/api/paquetes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "CREAR_PAQUETE_Y_ROTULO",
        ...formNuevoPaquete,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBanner({
        type: "ERROR",
        text: data.message || "Error registrando paquete.",
      });
      return;
    }
    setBanner({
      type: "OK",
      text: `Paquete y Rótulo Conecta Express ${data.identificadorInterno} creados con sus medidas.`,
    });
    setShowCrearPaquete(false);
    await onRefresh();
  }

  async function handleAsociarGuiaExterna(e: React.FormEvent) {
    e.preventDefault();
    if (!paqueteParaGuia) return;
    const res = await fetch("/api/paquetes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ASOCIAR_GUIA_EXTERNA",
        paqueteId: paqueteParaGuia.id,
        ...formAsociarGuia,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBanner({
        type: "ERROR",
        text: data.message || "Error asociando guía.",
      });
      return;
    }
    setBanner({
      type: "OK",
      text: `Guía #${formAsociarGuia.numeroGuia} asociada al paquete ${String(
        paqueteParaGuia.identificador_interno
      )}.`,
    });
    setPaqueteParaGuia(null);
    setFormAsociarGuia({ ...formAsociarGuia, numeroGuia: "" });
    await onRefresh();
  }

  async function handleGuardarMedidasYEstadoTabla(e: React.FormEvent) {
    e.preventDefault();
    if (!paqueteParaMedidasEstado) return;
    const res = await fetch("/api/paquetes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ACTUALIZAR_MEDIDAS_Y_ESTADO",
        paqueteId: paqueteParaMedidasEstado.id,
        ...formEditarPaquete,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBanner({
        type: "ERROR",
        text: data.message || "Error actualizando paquete.",
      });
      return;
    }
    setBanner({
      type: "OK",
      text: `Paquete ${String(
        paqueteParaMedidasEstado.identificador_interno
      )} actualizado con medidas y evento registrado en trazabilidad.`,
    });
    setPaqueteParaMedidasEstado(null);
    await onRefresh();
  }

  async function handleConfirmarReimpresion(e: React.FormEvent) {
    e.preventDefault();
    if (!paqueteParaReimpresion) return;
    const res = await fetch("/api/paquetes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "REIMPRIMIR_ROTULO",
        paqueteId: paqueteParaReimpresion.id,
        ...formReimpresion,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBanner({
        type: "ERROR",
        text: data.message || "Permiso denegado para reimprimir rótulo.",
      });
      return;
    }
    await imprimirRotuloInternoPDF({
      ...(paqueteParaReimpresion as Parameters<
        typeof imprimirRotuloInternoPDF
      >[0]),
      formato: formReimpresion.formatoEtiqueta,
    });
    setBanner({
      type: "OK",
      text: `Rótulo ${String(
        paqueteParaReimpresion.identificador_interno
      )} descargado nuevamente.`,
    });
    setPaqueteParaReimpresion(null);
    await onRefresh();
  }

  const paquetesFiltrados = paquetes.filter((p) => {
    if (!searchPkg.trim()) return true;
    const q = searchPkg.toLowerCase();
    return (
      String(p.identificador_interno || "")
        .toLowerCase()
        .includes(q) ||
      String(p.guia_externa_principal || "")
        .toLowerCase()
        .includes(q) ||
      String(p.solicitud_consecutivo || "")
        .toLowerCase()
        .includes(q) ||
      String(p.cliente_nombre || "")
        .toLowerCase()
        .includes(q) ||
      String(p.destinatario_nombre || "")
        .toLowerCase()
        .includes(q) ||
      String(p.destinatario_ciudad || "")
        .toLowerCase()
        .includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {banner && (
        <div
          className={`p-4 rounded-md border-l-4 bg-white flex items-center justify-between text-xs font-semibold shadow-sm ${
            banner.type === "OK"
              ? "border-[#171717] text-[#171717]"
              : "border-[#DE1025] text-[#DE1025]"
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
      {/* ESCÁNER DE PAQUETES, REGISTRO DE MEDIDAS Y EVENTOS VERIFICADOS         */}
      {/* ===================================================================== */}
      {subView === "ESCANER" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E4E4E7] border-t-4 border-t-[#DE1025] p-6 space-y-5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 bg-[#DE1025] rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                  <ScanBarcode className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#DE1025]">
                      Control Operativo de Mercancía
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-[#18181B]">
                    Escáner de Paquetes y Registro de Medidas
                  </h2>
                  <p className="text-xs text-[#52525B]">
                    Escanee el código de barras (Conecta Express, Coordinadora u otra transportadora) para identificar el paquete, registrar sus medidas y confirmar su estado.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSonidoActivo(!sonidoActivo)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    sonidoActivo
                      ? "bg-[#FFF1F2] border-[#FCD4D8] text-[#B80D1F]"
                      : "bg-[#F4F4F6] border-[#E4E4E7] text-[#3F3F46]"
                  }`}
                >
                  {sonidoActivo ? (
                    <Volume2 className="w-4 h-4 text-[#DE1025]" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-[#71717A]" />
                  )}
                  <span>Sonido: {sonidoActivo ? "Activado" : "Silencio"}</span>
                </button>

                <button
                  type="button"
                  onClick={toggleCamaraEscaner}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    camaraActiva
                      ? "bg-[#DE1025] border-[#DE1025] text-white"
                      : "bg-white hover:bg-[#FFF1F2] border-[#FCD4D8] text-[#DE1025]"
                  }`}
                >
                  <Camera
                    className={`w-4 h-4 ${
                      camaraActiva ? "text-white" : "text-[#DE1025]"
                    }`}
                  />
                  <span>{camaraActiva ? "Cerrar Cámara" : "Usar Cámara"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setScanLogs([]);
                    setUltimaLectura(null);
                    scannerInputRef.current?.focus();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E4E4E7] hover:border-[#FCD4D8] hover:bg-[#FFF1F2] rounded-xl text-xs font-semibold text-[#3F3F46] hover:text-[#DE1025] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpiar lectura</span>
                </button>
              </div>
            </div>

            {camaraActiva && (
              <div className="p-3 bg-[#FAFAFA] rounded border border-[#E5E5E5] flex flex-col items-center">
                <video
                  ref={videoRef}
                  className="w-full max-w-md h-48 object-cover rounded border border-[#DE1025]"
                  muted
                  playsInline
                />
                <span className="text-xs text-[#525252] mt-1">
                  Enfoque el código de barras o QR frente a la cámara.
                </span>
              </div>
            )}

            {/* Caja de Lectura del Código */}
            <form onSubmit={handleFormScan} className="flex gap-3">
              <div className="relative flex-1">
                <ScanBarcode className="w-5 h-5 text-[#DE1025] absolute left-4 top-3.5" />
                <input
                  ref={scannerInputRef}
                  type="text"
                  value={codigoActual}
                  onChange={(e) => setCodigoActual(e.target.value)}
                  placeholder="Escanee aquí el código CE-..., guía de Coordinadora u otra transportadora..."
                  className="w-full pl-12 pr-4 py-3.5 bg-[#FAFAFA] text-[#171717] rounded-md font-mono text-sm font-bold border-2 border-[#D4D4D4] focus:border-[#DE1025] focus:bg-white focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={procesandoLectura}
                className="px-6 py-3.5 bg-[#DE1025] hover:bg-[#B80D1F] text-white rounded-md font-bold text-xs uppercase tracking-wider shrink-0 transition-colors shadow-sm"
              >
                {procesandoLectura ? "Identificando..." : "Identificar Paquete"}
              </button>
            </form>

            {/* Botones rápidos de prueba */}
            <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
              <span className="text-[#737373] font-medium">
                Códigos de prueba:
              </span>
              {paquetes.slice(0, 2).map((p) => (
                <button
                  key={String(p.id)}
                  type="button"
                  onClick={() =>
                    identificarCodigoEscaneado(String(p.identificador_interno))
                  }
                  className="px-2.5 py-1 bg-[#FDF2F3] hover:bg-[#DE1025] hover:text-white border border-[#F6C5CB] rounded font-mono text-[11px] font-semibold text-[#DE1025] transition-colors"
                >
                  {String(p.identificador_interno)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => identificarCodigoEscaneado("73920184910")}
                className="px-2.5 py-1 bg-[#FDF2F3] hover:bg-[#DE1025] hover:text-white border border-[#F6C5CB] rounded font-mono text-[11px] font-semibold text-[#DE1025] transition-colors"
              >
                Guía Coordinadora: 73920184910
              </button>
            </div>
          </div>

          {/* Tarjeta de Paquete Identificado: Registro de Medidas y Confirmación de Evento */}
          {ultimaLectura && (
            <form
              onSubmit={handleConfirmarEventoPaqueteEscaneado}
              className="p-6 rounded-lg border-2 border-[#DE1025] bg-white space-y-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E5E5E5] pb-4">
                <div className="flex items-start gap-3">
                  {ultimaLectura.encontrado ? (
                    <CheckCircle2 className="w-6 h-6 text-[#DE1025] shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-[#DE1025] shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-base text-[#171717]">
                        {ultimaLectura.codigo}
                      </span>
                      <StateBadge estado={ultimaLectura.clasificacion} />
                    </div>
                    <p className="text-xs text-[#404040] mt-1 font-medium">
                      {ultimaLectura.mensaje}
                    </p>
                    <p className="text-[11px] text-[#737373] mt-0.5">
                      El escaneo identificó el paquete sin cambiar su estado. Verifique las medidas y confirme abajo el evento correspondiente.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#171717] mb-1">
                    Solicitud de Recogida Relacionada
                  </label>
                  <select
                    value={solicitudVinculadaScan}
                    onChange={(e) => setSolicitudVinculadaScan(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs"
                  >
                    <option value="">-- Mantener actual / Sin solicitud --</option>
                    {solicitudes.map((s) => (
                      <option key={String(s.id)} value={String(s.id)}>
                        {String(s.consecutivo)} — {String(s.cliente_nombre)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#171717] mb-1">
                    Evento Verificable a Confirmar *
                  </label>
                  <select
                    value={eventoVerificableScan}
                    onChange={(e) => setEventoVerificableScan(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#DE1025] rounded text-xs font-bold"
                  >
                    {EVENTOS_VERIFICABLES.map((ev) => (
                      <option key={ev.value} value={ev.value}>
                        {ev.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#171717] mb-1">
                    Observaciones del Evento
                  </label>
                  <input
                    type="text"
                    value={observacionesScan}
                    onChange={(e) => setObservacionesScan(e.target.value)}
                    placeholder="Ej. Paquete verificado sin averías"
                    className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs"
                  />
                </div>
              </div>

              {/* Medidas del Paquete: Largo, Ancho, Alto y Peso */}
              <div className="p-4 bg-[#FAFAFA] rounded border border-[#E5E5E5] space-y-3">
                <div className="text-xs font-bold text-[#171717] flex items-center gap-1.5">
                  <Ruler className="w-4 h-4 text-[#DE1025]" />
                  <span>Medidas Reales del Paquete (Largo, Ancho, Alto y Peso)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#404040] mb-1">
                      Largo (cm) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      step="0.5"
                      required
                      value={largoScan}
                      onChange={(e) => setLargoScan(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#404040] mb-1">
                      Ancho (cm) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      step="0.5"
                      required
                      value={anchoScan}
                      onChange={(e) => setAnchoScan(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#404040] mb-1">
                      Alto (cm) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      step="0.5"
                      required
                      value={altoScan}
                      onChange={(e) => setAltoScan(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#404040] mb-1">
                      Peso (kg) *
                    </label>
                    <input
                      type="number"
                      min={0.1}
                      step="0.1"
                      required
                      value={pesoScan}
                      onChange={(e) => setPesoScan(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={procesandoLectura}
                  className="px-6 py-2.5 bg-[#DE1025] text-white rounded text-xs font-bold uppercase tracking-wider"
                >
                  Confirmar Medidas y Actualizar Estado
                </button>
              </div>
            </form>
          )}

          {/* Historial de lecturas de la sesión */}
          <div className="bg-white rounded-lg border border-[#E5E5E5] p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#171717]">
              Paquetes Escaneados en esta Sesión ({scanLogs.length})
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {scanLogs.length === 0 ? (
                <p className="text-xs text-[#737373] py-6 text-center">
                  Aún no se han escaneado códigos de barras en esta sesión.
                </p>
              ) : (
                scanLogs.map((log, index) => (
                  <div
                    key={`${log.codigo}-${index}`}
                    className="p-3 rounded border border-[#E5E5E5] bg-[#FAFAFA] text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#171717]">
                          {log.codigo}
                        </span>
                        <StateBadge estado={log.clasificacion} />
                      </div>
                      <div className="text-[#525252] mt-1">{log.mensaje}</div>
                    </div>
                    <span className="font-mono text-[11px] text-[#737373]">
                      {log.timestamp}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* GESTIÓN DE PAQUETES, MEDIDAS, RÓTULOS CONECTA EXPRESS Y GUÍAS         */}
      {/* ===================================================================== */}
      {subView === "PAQUETES" && (
        <div className="space-y-6">
          {/* Modal Asociar Guía Externa */}
          {paqueteParaGuia && (
            <form
              onSubmit={handleAsociarGuiaExterna}
              className="p-5 bg-white rounded-lg border-2 border-[#DE1025] space-y-3 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#171717]">
                  Asociar Guía de Coordinadora u otra Transportadora al Paquete{" "}
                  {String(paqueteParaGuia.identificador_interno)}
                </h3>
                <button
                  type="button"
                  onClick={() => setPaqueteParaGuia(null)}
                  className="text-xs font-semibold text-[#525252] underline"
                >
                  Cancelar
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select
                  value={formAsociarGuia.transportadora}
                  onChange={(e) =>
                    setFormAsociarGuia({
                      ...formAsociarGuia,
                      transportadora: e.target.value,
                    })
                  }
                  className="px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs font-bold"
                >
                  <option value="COORDINADORA">COORDINADORA</option>
                  <option value="SERVIENTREGA">SERVIENTREGA</option>
                  <option value="TCC">TCC</option>
                  <option value="INTERRAPIDISIMO">INTERRAPIDÍSIMO</option>
                </select>
                <input
                  type="text"
                  required
                  placeholder="Escriba el número de guía *"
                  value={formAsociarGuia.numeroGuia}
                  onChange={(e) =>
                    setFormAsociarGuia({
                      ...formAsociarGuia,
                      numeroGuia: e.target.value,
                    })
                  }
                  className="md:col-span-2 px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs font-mono"
                />
                <button
                  type="submit"
                  className="py-2 bg-[#DE1025] text-white rounded text-xs font-bold uppercase"
                >
                  Guardar Guía
                </button>
              </div>
            </form>
          )}

          {/* Modal Actualizar Medidas y Estado Verificable */}
          {paqueteParaMedidasEstado && (
            <form
              onSubmit={handleGuardarMedidasYEstadoTabla}
              className="p-5 bg-white rounded-lg border-2 border-[#DE1025] space-y-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#171717]">
                  Registrar Medidas y Confirmar Estado del Paquete{" "}
                  <span className="font-mono text-[#DE1025]">
                    {String(paqueteParaMedidasEstado.identificador_interno)}
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => setPaqueteParaMedidasEstado(null)}
                  className="text-xs font-semibold text-[#525252] underline"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#171717] mb-1">
                    Largo (cm) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="0.5"
                    required
                    value={formEditarPaquete.largoCm}
                    onChange={(e) =>
                      setFormEditarPaquete({
                        ...formEditarPaquete,
                        largoCm: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-[#D4D4D4] rounded text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#171717] mb-1">
                    Ancho (cm) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="0.5"
                    required
                    value={formEditarPaquete.anchoCm}
                    onChange={(e) =>
                      setFormEditarPaquete({
                        ...formEditarPaquete,
                        anchoCm: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-[#D4D4D4] rounded text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#171717] mb-1">
                    Alto (cm) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="0.5"
                    required
                    value={formEditarPaquete.altoCm}
                    onChange={(e) =>
                      setFormEditarPaquete({
                        ...formEditarPaquete,
                        altoCm: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-[#D4D4D4] rounded text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#171717] mb-1">
                    Peso (kg) *
                  </label>
                  <input
                    type="number"
                    min={0.1}
                    step="0.1"
                    required
                    value={formEditarPaquete.pesoKg}
                    onChange={(e) =>
                      setFormEditarPaquete({
                        ...formEditarPaquete,
                        pesoKg: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-[#D4D4D4] rounded text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#171717] mb-1">
                    Estado Verificable *
                  </label>
                  <select
                    value={formEditarPaquete.eventoConfirmado}
                    onChange={(e) =>
                      setFormEditarPaquete({
                        ...formEditarPaquete,
                        eventoConfirmado: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-[#DE1025] rounded text-xs font-bold"
                  >
                    {EVENTOS_VERIFICABLES.map((ev) => (
                      <option key={ev.value} value={ev.value}>
                        {ev.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-[#171717] mb-1">
                    Observaciones de la actualización *
                  </label>
                  <input
                    type="text"
                    required
                    value={formEditarPaquete.observaciones}
                    onChange={(e) =>
                      setFormEditarPaquete({
                        ...formEditarPaquete,
                        observaciones: e.target.value,
                      })
                    }
                    placeholder="Ej. Entregado a Coordinadora con guía verificada"
                    className="w-full px-3 py-2 border border-[#D4D4D4] rounded text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#DE1025] text-white rounded text-xs font-bold uppercase"
                >
                  Confirmar Actualización
                </button>
              </div>
            </form>
          )}

          {/* Modal Reimprimir Rótulo */}
          {paqueteParaReimpresion && (
            <form
              onSubmit={handleConfirmarReimpresion}
              className="p-5 bg-white border-2 border-[#DE1025] rounded-lg space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#171717]">
                  Reimprimir Rótulo del Paquete{" "}
                  {String(paqueteParaReimpresion.identificador_interno)}
                </h3>
                <button
                  type="button"
                  onClick={() => setPaqueteParaReimpresion(null)}
                  className="text-xs text-[#DE1025] font-semibold underline"
                >
                  Cancelar
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select
                  value={formReimpresion.formatoEtiqueta}
                  onChange={(e) =>
                    setFormReimpresion({
                      ...formReimpresion,
                      formatoEtiqueta: e.target.value as "4X6" | "4X2",
                    })
                  }
                  className="px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs"
                >
                  <option value="4X6">Tamaño 10x15 cm (4x6 pulgadas)</option>
                  <option value="4X2">Tamaño 10x5 cm (4x2 pulgadas)</option>
                </select>
                <input
                  type="text"
                  required
                  placeholder="Motivo de la reimpresión *"
                  value={formReimpresion.motivoReimpresion}
                  onChange={(e) =>
                    setFormReimpresion({
                      ...formReimpresion,
                      motivoReimpresion: e.target.value,
                    })
                  }
                  className="md:col-span-2 px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs"
                />
                <button
                  type="submit"
                  className="py-2 bg-[#DE1025] text-white rounded text-xs font-bold uppercase"
                >
                  Descargar Rótulo PDF
                </button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-lg border border-[#E5E5E5] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[#171717]">
                  Paquetes, Medidas, Rótulos Conecta Express y Guías ({paquetesFiltrados.length})
                </h2>
                <p className="text-xs text-[#525252]">
                  Registre paquetes con o sin guía externa, consulte sus medidas reales, asocie guías de Coordinadora y actualice su estado.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCrearPaquete(!showCrearPaquete)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#DE1025] text-white rounded text-xs font-bold uppercase tracking-wider"
              >
                <PlusCircle className="w-4 h-4" />
                <span>
                  {showCrearPaquete
                    ? "Cerrar Formulario"
                    : "Registrar Paquete y Crear Rótulo"}
                </span>
              </button>
            </div>

            {showCrearPaquete && (
              <form
                onSubmit={handleCrearPaqueteInterno}
                className="p-5 bg-[#FAFAFA] rounded-lg border border-[#D4D4D4] space-y-4"
              >
                <div className="text-sm font-bold text-[#171717]">
                  Registrar Paquete con Medidas y Generar Rótulo Conecta Express
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#171717] mb-1">
                      Cliente *
                    </label>
                    <select
                      value={formNuevoPaquete.clienteId}
                      onChange={(e) =>
                        setFormNuevoPaquete({
                          ...formNuevoPaquete,
                          clienteId: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs"
                    >
                      {clientes.map((c) => (
                        <option key={String(c.id)} value={String(c.id)}>
                          {String(c.razon_social)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#171717] mb-1">
                      Solicitud de Recogida (Opcional)
                    </label>
                    <select
                      value={formNuevoPaquete.solicitudRecogidaId}
                      onChange={(e) =>
                        setFormNuevoPaquete({
                          ...formNuevoPaquete,
                          solicitudRecogidaId: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs"
                    >
                      <option value="">-- Sin solicitud previa --</option>
                      {solicitudes.map((s) => (
                        <option key={String(s.id)} value={String(s.id)}>
                          {String(s.consecutivo)} — {String(s.cliente_nombre)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#171717] mb-1">
                      Nº Guía Externa (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Vacío si solo tiene rótulo CE"
                      value={formNuevoPaquete.numeroGuiaExterna}
                      onChange={(e) =>
                        setFormNuevoPaquete({
                          ...formNuevoPaquete,
                          numeroGuiaExterna: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#171717] mb-1">
                      Nombre del destinatario *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Persona o empresa que recibe"
                      value={formNuevoPaquete.destinatarioNombre}
                      onChange={(e) =>
                        setFormNuevoPaquete({
                          ...formNuevoPaquete,
                          destinatarioNombre: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#171717] mb-1">
                      Teléfono del destinatario *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Teléfono destino"
                      value={formNuevoPaquete.destinatarioTelefono}
                      onChange={(e) =>
                        setFormNuevoPaquete({
                          ...formNuevoPaquete,
                          destinatarioTelefono: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#171717] mb-1">
                      Ciudad de destino *
                    </label>
                    <input
                      type="text"
                      required
                      value={formNuevoPaquete.destinatarioCiudad}
                      onChange={(e) =>
                        setFormNuevoPaquete({
                          ...formNuevoPaquete,
                          destinatarioCiudad: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-[#171717] mb-1">
                      Dirección de entrega *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Dirección completa de destino"
                      value={formNuevoPaquete.destinatarioDireccion}
                      onChange={(e) =>
                        setFormNuevoPaquete({
                          ...formNuevoPaquete,
                          destinatarioDireccion: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#171717] mb-1">
                      Contenido del paquete *
                    </label>
                    <input
                      type="text"
                      required
                      value={formNuevoPaquete.contenidoDeclarado}
                      onChange={(e) =>
                        setFormNuevoPaquete({
                          ...formNuevoPaquete,
                          contenidoDeclarado: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs"
                    />
                  </div>
                </div>

                {/* Medidas del Paquete: Largo, Ancho, Alto y Peso */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#E5E5E5]">
                  <div>
                    <label className="block text-xs font-bold text-[#171717] mb-1">
                      Largo (cm) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      step="0.5"
                      required
                      value={formNuevoPaquete.largoCm}
                      onChange={(e) =>
                        setFormNuevoPaquete({
                          ...formNuevoPaquete,
                          largoCm: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#171717] mb-1">
                      Ancho (cm) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      step="0.5"
                      required
                      value={formNuevoPaquete.anchoCm}
                      onChange={(e) =>
                        setFormNuevoPaquete({
                          ...formNuevoPaquete,
                          anchoCm: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#171717] mb-1">
                      Alto (cm) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      step="0.5"
                      required
                      value={formNuevoPaquete.altoCm}
                      onChange={(e) =>
                        setFormNuevoPaquete({
                          ...formNuevoPaquete,
                          altoCm: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#171717] mb-1">
                      Peso (kg) *
                    </label>
                    <input
                      type="number"
                      min={0.1}
                      step="0.1"
                      required
                      value={formNuevoPaquete.pesoKg}
                      onChange={(e) =>
                        setFormNuevoPaquete({
                          ...formNuevoPaquete,
                          pesoKg: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCrearPaquete(false)}
                    className="px-4 py-2 bg-white border border-[#D4D4D4] rounded text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#DE1025] text-white rounded text-xs font-bold uppercase tracking-wider"
                  >
                    Crear Paquete y Rótulo
                  </button>
                </div>
              </form>
            )}

            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-[#737373] absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchPkg}
                onChange={(e) => setSearchPkg(e.target.value)}
                placeholder="Buscar por código CE-..., guía Coordinadora, solicitud REC-... o cliente..."
                className="w-full pl-9 pr-3 py-2 bg-[#FAFAFA] border border-[#D4D4D4] rounded text-xs"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-[#525252] font-semibold">
                    <th className="py-3 px-3">Código y Solicitud</th>
                    <th className="py-3 px-3">Medidas y Peso</th>
                    <th className="py-3 px-3">Guía Transportadora</th>
                    <th className="py-3 px-3">Cliente y Destino</th>
                    <th className="py-3 px-3">Estado y Trazabilidad</th>
                    <th className="py-3 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {paquetesFiltrados.map((pkg) => {
                    const guiasDeEstePaquete = guiasExternas.filter(
                      (g) => String(g.paquete_id) === String(pkg.id)
                    );
                    return (
                      <tr key={String(pkg.id)} className="hover:bg-[#FAFAFA]">
                        <td className="py-3.5 px-3">
                          <div className="font-mono font-bold text-[#171717] text-sm">
                            {String(pkg.identificador_interno)}
                          </div>
                          <div className="text-[11px] text-[#737373] font-mono">
                            Solicitud:{" "}
                            {String(pkg.solicitud_consecutivo || "Directo")}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-xs">
                          <div className="font-bold text-[#171717]">
                            {Number(pkg.largo_cm || 20)} ×{" "}
                            {Number(pkg.ancho_cm || 20)} ×{" "}
                            {Number(pkg.alto_cm || 20)} cm
                          </div>
                          <div className="text-[#525252]">
                            Peso: <strong>{Number(pkg.peso_kg)} kg</strong>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-mono">
                          {guiasDeEstePaquete.length > 0 ? (
                            <div className="space-y-1">
                              {guiasDeEstePaquete.map((g) => (
                                <div
                                  key={String(g.id)}
                                  className="px-2 py-0.5 bg-[#F5F5F5] border border-[#D4D4D4] rounded text-[11px] font-bold"
                                >
                                  {String(g.transportadora)} #
                                  {String(g.numero_guia)}
                                </div>
                              ))}
                            </div>
                          ) : pkg.guia_externa_principal ? (
                            <span className="font-bold">
                              {String(pkg.transportadora_principal)} #
                              {String(pkg.guia_externa_principal)}
                            </span>
                          ) : (
                            <span className="text-[#737373] font-sans">
                              Sin guía externa (Rótulo CE)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-[#171717]">
                            {String(pkg.cliente_nombre)}
                          </div>
                          <div className="text-[#525252]">
                            Destino: {String(pkg.destinatario_ciudad)} (
                            {String(pkg.destinatario_nombre)})
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <LogisticsFlowSteps
                            estado_recogida={String(pkg.estado_recogida)}
                            estado_bodega={String(pkg.estado_bodega)}
                            estado_despacho={String(pkg.estado_despacho)}
                            compact
                          />
                        </td>
                        <td className="py-3.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setPaqueteParaMedidasEstado(pkg);
                              setFormEditarPaquete({
                                largoCm: Number(pkg.largo_cm || 30),
                                anchoCm: Number(pkg.ancho_cm || 25),
                                altoCm: Number(pkg.alto_cm || 20),
                                pesoKg: Number(pkg.peso_kg || 2.5),
                                eventoConfirmado: "ENTREGADA_CONECTA_EXPRESS",
                                observaciones: "",
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#DE1025] text-white rounded text-xs font-bold"
                          >
                            <Ruler className="w-3.5 h-3.5" />
                            <span>Medidas / Estado</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPaqueteParaGuia(pkg)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-[#D4D4D4] text-[#171717] rounded text-xs font-semibold hover:border-[#DE1025]"
                          >
                            <Link2 className="w-3.5 h-3.5 text-[#DE1025]" />
                            <span>Asociar Guía</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              imprimirRotuloInternoPDF(
                                pkg as Parameters<
                                  typeof imprimirRotuloInternoPDF
                                >[0]
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-[#D4D4D4] text-[#171717] rounded text-xs font-semibold hover:border-[#DE1025]"
                          >
                            <Printer className="w-3.5 h-3.5 text-[#DE1025]" />
                            <span>Rótulo</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
