"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Phone,
  CheckCircle2,
  Navigation,
  ScanBarcode,
  Camera,
  PenTool,
  AlertTriangle,
  LogOut,
  RefreshCw,
  Package,
  Eraser,
  ArrowLeft,
  Check,
  Trash2,
} from "lucide-react";
import { StateBadge, formatReadableStatus } from "@/components/ui/StateBadge";

interface PaqueteMedidaItem {
  codigo: string;
  identificadorInterno?: string;
  clasificacion: string;
  largoCm: number;
  anchoCm: number;
  altoCm: number;
  pesoKg: number;
}

export default function PortalTransportadorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [filtroLista, setFiltroLista] = useState<"PENDIENTES" | "HISTORIAL">(
    "PENDIENTES"
  );
  const [user, setUser] = useState<{
    userId: string;
    nombre: string;
    email: string;
    rolCodigo: string;
    transportadorId: string | null;
    transportador?: {
      razon_social: string;
      nit: string;
      codigo_transportador: string;
    } | null;
  } | null>(null);

  const [solicitudesAsignadas, setSolicitudesAsignadas] = useState<
    Record<string, unknown>[]
  >([]);
  const [paquetesDeSolicitudes, setPaquetesDeSolicitudes] = useState<
    Record<string, unknown>[]
  >([]);
  const [selectedSolicitud, setSelectedSolicitud] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [modoAccion, setModoAccion] = useState<
    "DETALLE" | "COMPLETAR" | "FALLIDA"
  >("DETALLE");

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );

  // Estado para escanear paquetes y registrar medidas (largo, ancho, alto y peso)
  const [codigoInput, setCodigoInput] = useState("");
  const [paquetesMedidas, setPaquetesMedidas] = useState<PaqueteMedidaItem[]>(
    []
  );
  const [cantidadReal, setCantidadReal] = useState<number>(1);
  const [nombreQuienEntrega, setNombreQuienEntrega] = useState("");
  const [documentoQuienEntrega, setDocumentoQuienEntrega] = useState("");
  const [observacionesConductor, setObservacionesConductor] = useState("");
  const [fotoMercanciaBase64, setFotoMercanciaBase64] = useState("");
  const [fotoNombre, setFotoNombre] = useState("");

  // Estado para reportar recogida fallida / novedad
  const [tipoCausalFallida, setTipoCausalFallida] =
    useState("CLIENTE_AUSENTE");
  const [motivoFallida, setMotivoFallida] = useState("");

  // Canvas de Firma Digital en pantalla táctil
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<{
    type: "OK" | "ERROR";
    text: string;
  } | null>(null);

  const cargarServiciosAsignados = useCallback(async () => {
    setLoading(true);
    try {
      const sesRes = await fetch("/api/auth/session");
      const sesData = await sesRes.json();
      if (!sesData.authenticated || !sesData.user) {
        router.push("/login");
        return;
      }
      setUser(sesData.user);

      const recRes = await fetch("/api/recogidas");
      if (recRes.ok) {
        const data = await recRes.json();
        const rows = data.solicitudes || [];
        setSolicitudesAsignadas(rows);
        setPaquetesDeSolicitudes(data.paquetesSolicitud || []);
        if (selectedSolicitud) {
          const updated = rows.find(
            (r: Record<string, unknown>) => r.id === selectedSolicitud.id
          );
          if (updated) setSelectedSolicitud(updated);
        }
      }
    } catch (e) {
      console.error("Error cargando servicios del transportador:", e);
    } finally {
      setLoading(false);
    }
  }, [router, selectedSolicitud]);

  useEffect(() => {
    cargarServiciosAsignados();
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
          });
        },
        () => {
          // Geolocalización opcional
        }
      );
    }
  }, [cargarServiciosAsignados]);

  function abrirServicio(sol: Record<string, unknown>) {
    setSelectedSolicitud(sol);
    const est = String(sol.estado_recogida || "");
    setModoAccion(est === "EN_PUNTO_RECOGIDA" ? "COMPLETAR" : "DETALLE");
    setCantidadReal(Number(sol.cantidad_estimada_paquetes || 1));
    setNombreQuienEntrega(String(sol.contacto_nombre || ""));
    setDocumentoQuienEntrega("");
    setPaquetesMedidas([]);
    setFotoMercanciaBase64("");
    setFotoNombre("");
    setHasSignature(false);
    setBanner(null);
  }

  async function cambiarEstadoEnRuta(
    operacion:
      | "ACEPTAR_SERVICIO"
      | "CONFIRMAR_DESPLAZAMIENTO"
      | "CONFIRMAR_LLEGADA"
  ) {
    if (!selectedSolicitud) return;
    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/recogidas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId: selectedSolicitud.id,
          operacion,
          latitud: coords?.lat ?? null,
          longitud: coords?.lng ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({
          type: "ERROR",
          text: data.message || "Error actualizando el estado.",
        });
      } else {
        setBanner({
          type: "OK",
          text: `Estado actualizado: ${formatReadableStatus(data.estadoNuevo)}.`,
        });
        if (operacion === "CONFIRMAR_LLEGADA") {
          setModoAccion("COMPLETAR");
        }
        await cargarServiciosAsignados();
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Escanea e identifica el paquete vinculándolo a la solicitud, sin cambiar el estado aún
  async function agregarPaquetePorCodigo(rawCode: string) {
    const clean = rawCode.trim().toUpperCase();
    if (!clean) return;
    if (paquetesMedidas.some((p) => p.codigo === clean)) {
      setBanner({
        type: "ERROR",
        text: `El paquete ${clean} ya está en la lista de esta recogida.`,
      });
      setCodigoInput("");
      return;
    }

    let largoInicial = 30;
    let anchoInicial = 25;
    let altoInicial = 20;
    let pesoInicial = 2.5;
    let clasificacion = clean.startsWith("CE-")
      ? "Rótulo Conecta Express"
      : "Guía Transportadora";
    let idInterno: string | undefined;

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
      if (res.ok) {
        const data = await res.json();
        const r = data.resultado;
        if (r?.clasificacion) {
          clasificacion = formatReadableStatus(String(r.clasificacion));
        }
        if (r?.paquete) {
          largoInicial = Number(r.paquete.largo_cm || 30);
          anchoInicial = Number(r.paquete.ancho_cm || 25);
          altoInicial = Number(r.paquete.alto_cm || 20);
          pesoInicial = Number(r.paquete.peso_kg || 2.5);
          idInterno = String(r.paquete.identificador_interno || "");
        }
      }
    } catch {
      // Continúa con valores base
    }

    const nuevoItem: PaqueteMedidaItem = {
      codigo: clean,
      identificadorInterno: idInterno,
      clasificacion,
      largoCm: largoInicial,
      anchoCm: anchoInicial,
      altoCm: altoInicial,
      pesoKg: pesoInicial,
    };

    const nuevaLista = [...paquetesMedidas, nuevoItem];
    setPaquetesMedidas(nuevaLista);
    setCantidadReal(Math.max(cantidadReal, nuevaLista.length));
    setCodigoInput("");
    setBanner({
      type: "OK",
      text: `Paquete ${clean} identificado. Verifique o ajuste sus medidas (largo, ancho, alto y peso).`,
    });
  }

  async function handleEscanearPaqueteEnSitio(e: React.FormEvent) {
    e.preventDefault();
    await agregarPaquetePorCodigo(codigoInput);
  }

  function actualizarMedidaPaquete(
    codigo: string,
    campo: "largoCm" | "anchoCm" | "altoCm" | "pesoKg",
    valor: number
  ) {
    setPaquetesMedidas((prev) =>
      prev.map((item) =>
        item.codigo === codigo ? { ...item, [campo]: valor } : item
      )
    );
  }

  function quitarPaqueteEscaneado(codigo: string) {
    setPaquetesMedidas((prev) => prev.filter((item) => item.codigo !== codigo));
  }

  function handleFotoMercancia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFotoNombre(file.name);
      setFotoMercanciaBase64(String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  }

  // Funciones del Canvas de Firma Digital
  function startDrawing(
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX =
      "touches" in e ? e.touches[0].clientX : e.nativeEvent.clientX;
    const clientY =
      "touches" in e ? e.touches[0].clientY : e.nativeEvent.clientY;
    ctx.strokeStyle = "#171717";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
    setHasSignature(true);
  }

  function draw(
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX =
      "touches" in e ? e.touches[0].clientX : e.nativeEvent.clientX;
    const clientY =
      "touches" in e ? e.touches[0].clientY : e.nativeEvent.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  }

  function stopDrawing() {
    setIsDrawing(false);
  }

  function limpiarFirma() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  async function handleConfirmarRecogidaCompleta(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSolicitud) return;

    let firmaDataUrl = "";
    if (hasSignature && canvasRef.current) {
      firmaDataUrl = canvasRef.current.toDataURL("image/png");
    }

    if (!firmaDataUrl && paquetesMedidas.length === 0) {
      setBanner({
        type: "ERROR",
        text: "Por favor escanee al menos un paquete o registre la firma en pantalla para confirmar la recogida.",
      });
      return;
    }

    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/recogidas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId: selectedSolicitud.id,
          operacion: "COMPLETAR_RECOGIDA_FISICA",
          cantidadRecogidaReal: cantidadReal,
          nombreQuienEntrega,
          documentoQuienEntrega,
          firmaRecibidoData: firmaDataUrl,
          codigosEscaneados: paquetesMedidas.map((p) => p.codigo),
          paquetesMedidas,
          fotoMercanciaBase64,
          observaciones: observacionesConductor,
          latitud: coords?.lat ?? null,
          longitud: coords?.lng ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({
          type: "ERROR",
          text: data.message || "Error registrando la recogida.",
        });
      } else {
        setBanner({
          type: "OK",
          text: `Recogida ${String(
            selectedSolicitud.consecutivo
          )} confirmada con medidas de paquetes y evidencia.`,
        });
        setModoAccion("DETALLE");
        setSelectedSolicitud(null);
        await cargarServiciosAsignados();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmarRecogidaFallida(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSolicitud || !motivoFallida.trim()) return;
    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/recogidas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId: selectedSolicitud.id,
          operacion: "REPORTAR_RECOGIDA_FALLIDA",
          tipoCausal: tipoCausalFallida,
          motivoFallo: motivoFallida,
          latitud: coords?.lat ?? null,
          longitud: coords?.lng ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({
          type: "ERROR",
          text: data.message || "Error reportando inconveniente.",
        });
      } else {
        setBanner({
          type: "OK",
          text: `Recogida fallida reportada a Conecta Express (${data.novConsecutivo}).`,
        });
        setModoAccion("DETALLE");
        setSelectedSolicitud(null);
        await cargarServiciosAsignados();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const pendientes = solicitudesAsignadas.filter(
    (s) =>
      !["RECOGIDA_COMPLETADA", "RECOGIDA_FALLIDA", "CANCELADA"].includes(
        String(s.estado_recogida)
      )
  );
  const historial = solicitudesAsignadas.filter((s) =>
    ["RECOGIDA_COMPLETADA", "RECOGIDA_FALLIDA", "CANCELADA"].includes(
      String(s.estado_recogida)
    )
  );
  const listaVisible =
    filtroLista === "PENDIENTES" ? pendientes : historial;

  const estadoActual = String(
    selectedSolicitud?.estado_recogida || ""
  ).toUpperCase();

  const paquetesEsperadosSolicitud = selectedSolicitud
    ? paquetesDeSolicitudes.filter(
        (p) => String(p.solicitud_recogida_id) === String(selectedSolicitud.id)
      )
    : [];

  return (
    <div className="min-h-screen bg-[#F4F4F6] flex flex-col max-w-lg mx-auto border-x border-[#E4E4E7] shadow-sm">
      {/* Encabezado Móvil Corporativo con Logotipo Oficial (.SVG) */}
      <header className="bg-gradient-to-r from-[#DE1025] via-[#C90E22] to-[#A80C1C] text-white p-4 sticky top-0 z-20 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div>
            <img
              src="/logo-conecta.svg"
              alt="Conecta Express - Recogidas"
              width={190}
              height={28}
              className="h-7 w-auto object-contain select-none"
            />
            <div className="text-[11px] text-white/90 mt-1 font-medium">
              Portal de Transportadores • {user?.nombre || "Conductor"}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={cargarServiciosAsignados}
              className="p-2 bg-white/15 hover:bg-white/25 rounded-lg text-white border border-white/25 transition-colors"
              title="Actualizar"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            {user?.rolCodigo === "SUPERADMIN" && (
              <button
                type="button"
                onClick={() => router.push("/admin")}
                className="px-2.5 py-1.5 bg-white/15 hover:bg-white/25 border border-white/25 rounded-lg text-xs font-semibold text-white transition-colors"
              >
                Admin
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 bg-white text-[#DE1025] hover:bg-[#FFF1F2] rounded-lg shadow-2xs transition-colors"
              title="Salir"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Móvil */}
      <main className="p-4 flex-1 space-y-4">
        {banner && (
          <div
            className={`p-3.5 rounded-md border-l-4 text-xs font-semibold flex items-center justify-between bg-white shadow-sm ${
              banner.type === "OK"
                ? "border-[#171717] text-[#171717]"
                : "border-[#DE1025] text-[#DE1025]"
            }`}
          >
            <span>{banner.text}</span>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="underline ml-3 font-bold"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* LISTA DE RECOGIDAS DEL CONDUCTOR */}
        {!selectedSolicitud && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 bg-white p-1.5 rounded-lg border border-[#E5E5E5]">
              <button
                type="button"
                onClick={() => setFiltroLista("PENDIENTES")}
                className={`py-2.5 px-3 rounded-md text-xs font-bold transition-colors ${
                  filtroLista === "PENDIENTES"
                    ? "bg-[#DE1025] text-white"
                    : "text-[#404040] hover:bg-[#F5F5F5]"
                }`}
              >
                Por Recoger ({pendientes.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroLista("HISTORIAL")}
                className={`py-2.5 px-3 rounded-md text-xs font-bold transition-colors ${
                  filtroLista === "HISTORIAL"
                    ? "bg-[#DE1025] text-white"
                    : "text-[#404040] hover:bg-[#F5F5F5]"
                }`}
              >
                Completadas ({historial.length})
              </button>
            </div>

            {listaVisible.length === 0 ? (
              <div className="bg-white rounded-lg border border-[#E5E5E5] p-8 text-center space-y-2">
                <Package className="w-8 h-8 text-[#A3A3A3] mx-auto" />
                <div className="text-sm font-bold text-[#262626]">
                  {filtroLista === "PENDIENTES"
                    ? "No tiene recogidas pendientes en este momento"
                    : "Aún no hay recogidas finalizadas"}
                </div>
                <p className="text-xs text-[#737373]">
                  {filtroLista === "PENDIENTES"
                    ? "Cuando Conecta Express le asigne una recogida, aparecerá aquí con la dirección y el contacto del cliente."
                    : "Las recogidas completadas aparecerán en este historial."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {listaVisible.map((sol) => (
                  <div
                    key={String(sol.id)}
                    onClick={() => abrirServicio(sol)}
                    className="bg-white rounded-lg border border-[#D4D4D4] p-4 space-y-3 cursor-pointer hover:border-[#DE1025] transition-colors shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sm text-[#171717]">
                        {String(sol.consecutivo)}
                      </span>
                      <StateBadge
                        estado={String(sol.estado_recogida)}
                        dimension="RECOGIDA"
                      />
                    </div>

                    <div>
                      <div className="text-sm font-bold text-[#171717]">
                        {String(sol.direccion_texto)}
                      </div>
                      <div className="text-xs text-[#525252] mt-0.5">
                        {String(sol.ciudad)} • Cliente:{" "}
                        {String(sol.cliente_nombre)}
                      </div>
                    </div>

                    <div className="p-2.5 bg-[#FAFAFA] rounded border border-[#E5E5E5] flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#262626]">
                        📦 {Number(sol.cantidad_estimada_paquetes)} paquetes (
                        {Number(sol.peso_estimado_kg)} kg)
                      </span>
                      <span className="text-[#525252]">
                        🕒 {String(sol.franja_horaria)}
                      </span>
                    </div>

                    <div className="w-full py-2.5 bg-[#DE1025] text-white rounded text-center font-bold text-xs uppercase tracking-wider">
                      Abrir Recogida →
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DETALLE Y GESTIÓN DE LA RECOGIDA SELECCIONADA */}
        {selectedSolicitud && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setSelectedSolicitud(null)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs font-bold text-[#262626]"
            >
              <ArrowLeft className="w-4 h-4 text-[#DE1025]" />
              <span>Volver a mis recogidas</span>
            </button>

            <div className="bg-white rounded-lg border border-[#D4D4D4] p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
                <div>
                  <span className="text-[11px] uppercase text-[#737373] font-bold">
                    Solicitud de Recogida
                  </span>
                  <div className="font-mono font-bold text-base text-[#171717]">
                    {String(selectedSolicitud.consecutivo)}
                  </div>
                </div>
                <StateBadge
                  estado={String(selectedSolicitud.estado_recogida)}
                  dimension="RECOGIDA"
                />
              </div>

              <div className="p-3.5 bg-[#FAFAFA] rounded-md border border-[#E5E5E5] space-y-2.5 text-xs">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-5 h-5 text-[#DE1025] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[11px] uppercase font-bold text-[#737373]">
                      Dirección de recogida:
                    </div>
                    <div className="font-bold text-sm text-[#171717]">
                      {String(selectedSolicitud.direccion_texto)}
                    </div>
                    <div className="text-[#525252]">
                      {String(selectedSolicitud.ciudad)} •{" "}
                      {String(selectedSolicitud.cliente_nombre)}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E5E5E5] flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-[#737373]">
                      Contacto en sitio:
                    </div>
                    <div className="font-bold text-[#171717]">
                      {String(selectedSolicitud.contacto_nombre)}
                    </div>
                  </div>
                  <a
                    href={`tel:${String(selectedSolicitud.contacto_telefono)}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#D4D4D4] rounded font-bold text-[#171717] hover:border-[#DE1025]"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#DE1025]" />
                    <span>Llamar: {String(selectedSolicitud.contacto_telefono)}</span>
                  </a>
                </div>

                <div className="pt-2 border-t border-[#E5E5E5] flex items-center justify-between text-[#404040]">
                  <span className="font-semibold">
                    📦 {Number(selectedSolicitud.cantidad_estimada_paquetes)}{" "}
                    paquetes estimados ({String(selectedSolicitud.tipo_mercancia)})
                  </span>
                  <span>🕒 {String(selectedSolicitud.franja_horaria)}</span>
                </div>
              </div>

              {/* Etapas sin numeración decorativa */}
              <div className="grid grid-cols-4 gap-1.5 text-center text-[11px]">
                {[
                  {
                    label: "Asignada",
                    done: [
                      "ACEPTADA",
                      "EN_CAMINO",
                      "EN_PUNTO_RECOGIDA",
                      "RECOGIDA_COMPLETADA",
                    ].includes(estadoActual),
                  },
                  {
                    label: "En camino",
                    done: [
                      "EN_CAMINO",
                      "EN_PUNTO_RECOGIDA",
                      "RECOGIDA_COMPLETADA",
                    ].includes(estadoActual),
                  },
                  {
                    label: "En proceso",
                    done: [
                      "EN_PUNTO_RECOGIDA",
                      "RECOGIDA_COMPLETADA",
                    ].includes(estadoActual),
                  },
                  {
                    label: "Recogida",
                    done: estadoActual === "RECOGIDA_COMPLETADA",
                  },
                ].map((step) => (
                  <div
                    key={step.label}
                    className={`p-2 rounded border ${
                      step.done
                        ? "bg-[#DE1025] text-white border-[#DE1025] font-bold"
                        : "bg-[#FAFAFA] text-[#737373] border-[#E5E5E5]"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      {step.done && <Check className="w-3 h-3 text-white" />}
                      <span>{step.label}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* ACCIÓN PRINCIPAL SEGÚN EL ESTADO ACTUAL */}
              {modoAccion === "DETALLE" &&
                estadoActual !== "RECOGIDA_COMPLETADA" &&
                estadoActual !== "RECOGIDA_FALLIDA" && (
                  <div className="pt-2 space-y-3">
                    {(estadoActual === "ASIGNADA" ||
                      estadoActual === "PROGRAMADA" ||
                      estadoActual === "SOLICITADA" ||
                      estadoActual === "SOLICITUD_RECIBIDA") && (
                      <div className="p-4 bg-[#FAFAFA] rounded-lg border-2 border-[#DE1025] space-y-3">
                        <div className="text-xs font-bold text-[#171717]">
                          Confirme que recibió esta asignación de recogida
                        </div>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            cambiarEstadoEnRuta("ACEPTAR_SERVICIO")
                          }
                          className="w-full py-3.5 bg-[#DE1025] text-white rounded-md font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Aceptar Recogida</span>
                        </button>
                      </div>
                    )}

                    {estadoActual === "ACEPTADA" && (
                      <div className="p-4 bg-[#FAFAFA] rounded-lg border-2 border-[#DE1025] space-y-3">
                        <div className="text-xs font-bold text-[#171717]">
                          Indique cuando inicie su desplazamiento hacia la dirección del cliente
                        </div>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            cambiarEstadoEnRuta("CONFIRMAR_DESPLAZAMIENTO")
                          }
                          className="w-full py-3.5 bg-[#DE1025] text-white rounded-md font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm"
                        >
                          <Navigation className="w-4 h-4" />
                          <span>Confirmar Transportador en Camino</span>
                        </button>
                      </div>
                    )}

                    {estadoActual === "EN_CAMINO" && (
                      <div className="p-4 bg-[#FAFAFA] rounded-lg border-2 border-[#DE1025] space-y-3">
                        <div className="text-xs font-bold text-[#171717]">
                          Al llegar a la dirección del cliente, inicie la recogida en sitio
                        </div>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            cambiarEstadoEnRuta("CONFIRMAR_LLEGADA")
                          }
                          className="w-full py-3.5 bg-[#DE1025] text-white rounded-md font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm"
                        >
                          <MapPin className="w-4 h-4" />
                          <span>Confirmar Llegada e Iniciar Recogida</span>
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setModoAccion("COMPLETAR")}
                      className="w-full py-3 bg-[#DE1025] text-white rounded-md font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm"
                    >
                      <ScanBarcode className="w-4 h-4" />
                      <span>Escanear Paquetes y Registrar Medidas</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModoAccion("FALLIDA")}
                      className="w-full py-2.5 bg-white border border-[#D4D4D4] text-[#DE1025] rounded-md font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#FAFAFA]"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      <span>Reportar Recogida Fallida o Novedad</span>
                    </button>
                  </div>
                )}
            </div>

            {/* ESCANEO DE PAQUETES, REGISTRO DE MEDIDAS Y EVIDENCIA */}
            {modoAccion === "COMPLETAR" && (
              <div className="bg-white rounded-lg border-2 border-[#DE1025] p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-[#DE1025]">
                      Recogida en Proceso
                    </span>
                    <h2 className="text-sm font-bold text-[#171717]">
                      Escanear Paquetes, Registrar Medidas y Confirmar
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModoAccion("DETALLE")}
                    className="text-xs text-[#525252] font-semibold underline"
                  >
                    Volver
                  </button>
                </div>

                {/* Escáner de Códigos de Barras de los Paquetes */}
                <form
                  onSubmit={handleEscanearPaqueteEnSitio}
                  className="space-y-2.5 bg-[#FAFAFA] p-3.5 rounded-md border border-[#E5E5E5]"
                >
                  <label className="block text-xs font-bold text-[#171717]">
                    Escanear código de barras del paquete (Rótulo CE o Guía)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={codigoInput}
                      onChange={(e) => setCodigoInput(e.target.value)}
                      placeholder="Escanee o escriba CE-... o Nº de guía"
                      className="flex-1 px-3 py-2 bg-white border border-[#D4D4D4] rounded text-xs font-mono"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#DE1025] text-white rounded text-xs font-bold"
                    >
                      Escanear
                    </button>
                  </div>

                  {/* Botones rápidos con los paquetes asociados a esta solicitud */}
                  {paquetesEsperadosSolicitud.length > 0 && (
                    <div className="pt-1 space-y-1">
                      <span className="block text-[11px] text-[#525252]">
                        Paquetes registrados en esta solicitud (toque para escanear):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {paquetesEsperadosSolicitud.map((p) => {
                          const code = String(p.identificador_interno);
                          const yaAgregado = paquetesMedidas.some(
                            (pm) => pm.codigo === code
                          );
                          return (
                            <button
                              key={String(p.id)}
                              type="button"
                              onClick={() => agregarPaquetePorCodigo(code)}
                              className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold border ${
                                yaAgregado
                                  ? "bg-[#DE1025] text-white border-[#DE1025]"
                                  : "bg-white text-[#171717] border-[#D4D4D4]"
                              }`}
                            >
                              {yaAgregado ? `✓ ${code}` : `+ ${code}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </form>

                {/* Tarjetas de Medidas por cada Paquete Escaneado (Largo, Ancho, Alto y Peso) */}
                {paquetesMedidas.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold text-[#171717]">
                      Medidas de los paquetes escaneados ({paquetesMedidas.length})
                    </div>
                    {paquetesMedidas.map((pm) => (
                      <div
                        key={pm.codigo}
                        className="p-3 bg-[#FAFAFA] rounded border border-[#D4D4D4] space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono font-bold text-xs text-[#171717]">
                              {pm.codigo}
                            </span>
                            <span className="ml-2 text-[11px] text-[#525252]">
                              ({pm.clasificacion})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => quitarPaqueteEscaneado(pm.codigo)}
                            className="text-[#DE1025] p-1"
                            title="Quitar paquete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-[11px]">
                          <div>
                            <label className="block font-semibold text-[#525252] mb-0.5">
                              Largo (cm)
                            </label>
                            <input
                              type="number"
                              min={1}
                              step="0.5"
                              value={pm.largoCm}
                              onChange={(e) =>
                                actualizarMedidaPaquete(
                                  pm.codigo,
                                  "largoCm",
                                  Number(e.target.value)
                                )
                              }
                              className="w-full px-2 py-1.5 bg-white border border-[#D4D4D4] rounded font-bold text-xs"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-[#525252] mb-0.5">
                              Ancho (cm)
                            </label>
                            <input
                              type="number"
                              min={1}
                              step="0.5"
                              value={pm.anchoCm}
                              onChange={(e) =>
                                actualizarMedidaPaquete(
                                  pm.codigo,
                                  "anchoCm",
                                  Number(e.target.value)
                                )
                              }
                              className="w-full px-2 py-1.5 bg-white border border-[#D4D4D4] rounded font-bold text-xs"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-[#525252] mb-0.5">
                              Alto (cm)
                            </label>
                            <input
                              type="number"
                              min={1}
                              step="0.5"
                              value={pm.altoCm}
                              onChange={(e) =>
                                actualizarMedidaPaquete(
                                  pm.codigo,
                                  "altoCm",
                                  Number(e.target.value)
                                )
                              }
                              className="w-full px-2 py-1.5 bg-white border border-[#D4D4D4] rounded font-bold text-xs"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-[#525252] mb-0.5">
                              Peso (kg)
                            </label>
                            <input
                              type="number"
                              min={0.1}
                              step="0.1"
                              value={pm.pesoKg}
                              onChange={(e) =>
                                actualizarMedidaPaquete(
                                  pm.codigo,
                                  "pesoKg",
                                  Number(e.target.value)
                                )
                              }
                              className="w-full px-2 py-1.5 bg-white border border-[#D4D4D4] rounded font-bold text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Confirmación de Cantidad Real, Quién Entrega, Foto y Firma */}
                <form
                  onSubmit={handleConfirmarRecogidaCompleta}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#171717] mb-1">
                        Cantidad real de paquetes recogidos *
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={cantidadReal}
                        onChange={(e) =>
                          setCantidadReal(Number(e.target.value))
                        }
                        className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#171717] mb-1">
                        Documento de quien entrega
                      </label>
                      <input
                        type="text"
                        value={documentoQuienEntrega}
                        onChange={(e) =>
                          setDocumentoQuienEntrega(e.target.value)
                        }
                        placeholder="Nº documento"
                        className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#171717] mb-1">
                      Nombre de la persona que entrega *
                    </label>
                    <input
                      type="text"
                      required
                      value={nombreQuienEntrega}
                      onChange={(e) => setNombreQuienEntrega(e.target.value)}
                      className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#171717] mb-1">
                      Evidencia fotográfica de los paquetes
                    </label>
                    <label className="flex items-center justify-center gap-2 py-3 px-3 border-2 border-dashed border-[#D4D4D4] rounded bg-[#FAFAFA] cursor-pointer text-xs font-semibold text-[#262626]">
                      <Camera className="w-4 h-4 text-[#DE1025]" />
                      <span>
                        {fotoNombre
                          ? `Foto adjunta: ${fotoNombre}`
                          : "Tomar o adjuntar fotografía de la mercancía"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFotoMercancia}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-[#171717] flex items-center gap-1">
                        <PenTool className="w-3.5 h-3.5 text-[#DE1025]" />
                        <span>Firma de quien entrega</span>
                      </label>
                      <button
                        type="button"
                        onClick={limpiarFirma}
                        className="text-xs text-[#525252] flex items-center gap-1 underline"
                      >
                        <Eraser className="w-3 h-3" />
                        <span>Borrar firma</span>
                      </button>
                    </div>
                    <canvas
                      ref={canvasRef}
                      width={380}
                      height={130}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-32 bg-[#FAFAFA] border-2 border-[#D4D4D4] rounded touch-none cursor-crosshair"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#171717] mb-1">
                      Observaciones de la recogida
                    </label>
                    <input
                      type="text"
                      value={observacionesConductor}
                      onChange={(e) =>
                        setObservacionesConductor(e.target.value)
                      }
                      placeholder="Ej. Paquetes verificados y medidos en sitio"
                      className="w-full px-3 py-2 border border-[#D4D4D4] rounded text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 bg-[#DE1025] text-white rounded-md font-bold text-xs uppercase tracking-wider shadow-sm"
                  >
                    {submitting
                      ? "Guardando Recogida..."
                      : "Confirmar Mercancía Recogida"}
                  </button>
                </form>
              </div>
            )}

            {/* FORMULARIO PARA REPORTAR RECOGIDA FALLIDA O NOVEDAD */}
            {modoAccion === "FALLIDA" && (
              <form
                onSubmit={handleConfirmarRecogidaFallida}
                className="bg-white rounded-lg border-2 border-[#DE1025] p-4 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
                  <h2 className="text-sm font-bold text-[#DE1025]">
                    Reportar Recogida Fallida o Novedad
                  </h2>
                  <button
                    type="button"
                    onClick={() => setModoAccion("DETALLE")}
                    className="text-xs text-[#525252] font-semibold underline"
                  >
                    Cancelar
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#171717] mb-1">
                    Motivo por el que no se pudo recoger *
                  </label>
                  <select
                    value={tipoCausalFallida}
                    onChange={(e) => setTipoCausalFallida(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-[#D4D4D4] rounded text-xs"
                  >
                    <option value="CLIENTE_AUSENTE">
                      El lugar estaba cerrado / Nadie atendió
                    </option>
                    <option value="MERCANCIA_NO_PREPARADA">
                      El cliente aún no tenía lista la mercancía
                    </option>
                    <option value="DIRECCION_INCORRECTA">
                      No fue posible ubicar la dirección
                    </option>
                    <option value="RECOGIDA_FALLIDA">Otro inconveniente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#171717] mb-1">
                    Observaciones detalladas *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={motivoFallida}
                    onChange={(e) => setMotivoFallida(e.target.value)}
                    placeholder="Describa qué ocurrió en el punto de recogida..."
                    className="w-full px-3 py-2 border border-[#D4D4D4] rounded text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 bg-[#DE1025] text-white rounded-md font-bold text-xs uppercase tracking-wider"
                >
                  {submitting
                    ? "Enviando Reporte..."
                    : "Confirmar Recogida Fallida"}
                </button>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
