"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  PlusCircle,
  ClipboardList,
  PackageSearch,
  AlertTriangle,
  MapPin,
  LogOut,
  FileDown,
  Printer,
  Search,
  Upload,
  CheckCircle2,
  Clock,
  Building2,
  Phone,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Check,
} from "lucide-react";
import { StateBadge, formatReadableStatus } from "@/components/ui/StateBadge";
import { LogisticsFlowSteps } from "@/components/ui/LogisticsFlowSteps";
import {
  descargarComprobanteSolicitudPDF,
  imprimirRotuloInternoPDF,
} from "@/lib/pdf-excel-generator";

type TabType =
  | "MIS_SOLICITUDES"
  | "NUEVA_RECOGIDA"
  | "GUIAS_SEGUIMIENTO"
  | "NOVEDADES"
  | "DIRECTORIO";

export default function PortalClientePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("MIS_SOLICITUDES");
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{
    userId: string;
    nombre: string;
    email: string;
    rolCodigo: string;
    rolNombre: string;
    clienteId: string | null;
    cliente?: {
      id: string;
      codigo_cliente: string;
      razon_social: string;
      nit: string;
      ciudad_principal: string;
      direccion_principal: string;
      telefono_principal: string;
    } | null;
  } | null>(null);

  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [solicitudes, setSolicitudes] = useState<Record<string, unknown>[]>([]);
  const [paquetes, setPaquetes] = useState<Record<string, unknown>[]>([]);
  const [eventos, setEventos] = useState<Record<string, unknown>[]>([]);
  const [novedades, setNovedades] = useState<Record<string, unknown>[]>([]);
  const [direcciones, setDirecciones] = useState<Record<string, unknown>[]>([]);
  const [contactos, setContactos] = useState<Record<string, unknown>[]>([]);

  // Filtros
  const [searchSolicitud, setSearchSolicitud] = useState("");
  const [searchTracking, setSearchTracking] = useState("");
  const [selectedPkgTracking, setSelectedPkgTracking] = useState<string | null>(
    null
  );

  // Estado formulario Nueva Solicitud de Recogida
  const [formRecogida, setFormRecogida] = useState({
    direccionRecogidaId: "",
    direccionTexto: "",
    ciudad: "Bogotá D.C.",
    departamento: "Cundinamarca",
    zonaLogistica: "ZONA_INDUSTRIAL_OCCIDENTE",
    latitud: "",
    longitud: "",
    contactoNombre: "",
    contactoTelefono: "",
    fechaSolicitada: new Date().toISOString().slice(0, 10),
    franjaHoraria: "08:00 - 12:00",
    cantidadEstimadaPaquetes: 2,
    tipoMercancia: "Paquetería Comercial Empacada",
    tipoServicio: "ESTANDAR_CONECTA",
    pesoEstimadoKg: 10,
    dimensionesEstimadas: "40x30x30 cm",
    valorDeclaradoTotal: 250000,
    destinatarioNombre: "",
    destinatarioTelefono: "",
    destinatarioDireccion: "",
    destinatarioCiudad: "Medellín",
    guiaExternaInicial: "",
    observaciones: "",
    evidenciaNombre: "",
    evidenciaMime: "",
    evidenciaBase64: "",
  });

  // Estado formulario Nueva Dirección Frecuente
  const [formDireccion, setFormDireccion] = useState({
    alias: "",
    direccionCompleta: "",
    complemento: "",
    barrio: "",
    ciudad: "Bogotá D.C.",
    departamento: "Cundinamarca",
    zonaLogistica: "ZONA_NORTE",
    contactoNombre: "",
    contactoTelefono: "",
    horarioAtencion: "08:00 - 17:00",
  });

  // Estado formulario Nuevo Contacto
  const [formContacto, setFormContacto] = useState({
    nombreCompleto: "",
    cargo: "",
    telefono: "",
    email: "",
    ciudad: "Bogotá D.C.",
  });

  const [submitting, setSubmitting] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: "OK" | "ERROR";
    text: string;
  } | null>(null);

  const cargarTodo = useCallback(async () => {
    setLoading(true);
    try {
      const sesRes = await fetch("/api/auth/session");
      const sesData = await sesRes.json();
      if (!sesData.authenticated || !sesData.user) {
        router.push("/login");
        return;
      }
      setUser(sesData.user);

      const [dashRes, recRes, pkgRes, trzRes, cliRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/recogidas"),
        fetch("/api/paquetes"),
        fetch("/api/trazabilidad"),
        fetch("/api/clientes"),
      ]);

      if (dashRes.ok) {
        const d = await dashRes.json();
        setKpis(d.kpis || {});
      }
      if (recRes.ok) {
        const r = await recRes.json();
        setSolicitudes(r.solicitudes || []);
      }
      if (pkgRes.ok) {
        const p = await pkgRes.json();
        setPaquetes(p.paquetes || []);
      }
      if (trzRes.ok) {
        const t = await trzRes.json();
        setEventos(t.eventos || []);
        setNovedades(t.novedades || []);
      }
      if (cliRes.ok) {
        const c = await cliRes.json();
        const dirs = c.direcciones || [];
        const cnts = c.contactos || [];
        setDirecciones(dirs);
        setContactos(cnts);

        if (dirs.length > 0) {
          const d0 = dirs[0] as Record<string, unknown>;
          setFormRecogida((prev) => ({
            ...prev,
            direccionRecogidaId:
              prev.direccionRecogidaId || String(d0.id || ""),
            direccionTexto:
              prev.direccionTexto || String(d0.direccion_completa || ""),
            ciudad: prev.ciudad || String(d0.ciudad || "Bogotá D.C."),
            departamento:
              prev.departamento || String(d0.departamento || "Cundinamarca"),
            zonaLogistica:
              prev.zonaLogistica || String(d0.zona_logistica || "ZONA_CENTRO"),
            contactoNombre:
              prev.contactoNombre ||
              String(d0.contacto_local_nombre || sesData.user.nombre || ""),
            contactoTelefono:
              prev.contactoTelefono ||
              String(d0.contacto_local_telefono || ""),
          }));
        }
      }
    } catch (e) {
      console.error("Error cargando portal de clientes:", e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  function iniciarSolicitudRecogida() {
    setWizardStep(1);
    setActiveTab("NUEVA_RECOGIDA");
  }

  function handleSelectDireccionFrecuente(dirId: string) {
    const found = direcciones.find((d) => String(d.id) === dirId);
    if (!found) {
      setFormRecogida((prev) => ({ ...prev, direccionRecogidaId: "" }));
      return;
    }
    setFormRecogida((prev) => ({
      ...prev,
      direccionRecogidaId: String(found.id),
      direccionTexto: String(found.direccion_completa || ""),
      ciudad: String(found.ciudad || "Bogotá D.C."),
      departamento: String(found.departamento || "Cundinamarca"),
      zonaLogistica: String(found.zona_logistica || "ZONA_CENTRO"),
      latitud: found.latitud ? String(found.latitud) : "",
      longitud: found.longitud ? String(found.longitud) : "",
      contactoNombre:
        String(found.contacto_local_nombre || "") || prev.contactoNombre,
      contactoTelefono:
        String(found.contacto_local_telefono || "") || prev.contactoTelefono,
    }));
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormRecogida((prev) => ({
        ...prev,
        evidenciaNombre: file.name,
        evidenciaMime: file.type || "application/octet-stream",
        evidenciaBase64: String(reader.result || ""),
      }));
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmitRecogida(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFeedbackBanner(null);

    try {
      const res = await fetch("/api/recogidas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formRecogida,
          clienteId: user?.clienteId || "cli-corporativo-01",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedbackBanner({
          type: "ERROR",
          text: data.message || "No fue posible registrar la solicitud.",
        });
        setSubmitting(false);
        return;
      }

      setFeedbackBanner({
        type: "OK",
        text: `¡Listo! Su solicitud de recogida ${data.consecutivo} fue recibida. Puede descargar el comprobante PDF o hacer seguimiento en esta lista.`,
      });
      setWizardStep(1);
      await cargarTodo();
      setActiveTab("MIS_SOLICITUDES");
    } catch {
      setFeedbackBanner({
        type: "ERROR",
        text: "Error de comunicación registrando la solicitud.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCrearDireccion(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFeedbackBanner(null);
    try {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREAR_DIRECCION",
          clienteId: user?.clienteId || "cli-corporativo-01",
          ...formDireccion,
        }),
      });
      if (res.ok) {
        setFeedbackBanner({
          type: "OK",
          text: "Dirección frecuente guardada correctamente.",
        });
        setFormDireccion({
          alias: "",
          direccionCompleta: "",
          complemento: "",
          barrio: "",
          ciudad: "Bogotá D.C.",
          departamento: "Cundinamarca",
          zonaLogistica: "ZONA_NORTE",
          contactoNombre: "",
          contactoTelefono: "",
          horarioAtencion: "08:00 - 17:00",
        });
        await cargarTodo();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCrearContacto(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFeedbackBanner(null);
    try {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREAR_CONTACTO",
          clienteId: user?.clienteId || "cli-corporativo-01",
          ...formContacto,
        }),
      });
      if (res.ok) {
        setFeedbackBanner({
          type: "OK",
          text: "Contacto guardado correctamente.",
        });
        setFormContacto({
          nombreCompleto: "",
          cargo: "",
          telefono: "",
          email: "",
          ciudad: "Bogotá D.C.",
        });
        await cargarTodo();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const solicitudesFiltradas = solicitudes.filter((s) => {
    if (!searchSolicitud.trim()) return true;
    const q = searchSolicitud.toLowerCase();
    return (
      String(s.consecutivo || "")
        .toLowerCase()
        .includes(q) ||
      String(s.direccion_texto || "")
        .toLowerCase()
        .includes(q) ||
      String(s.ciudad || "")
        .toLowerCase()
        .includes(q) ||
      String(s.estado_recogida || "")
        .toLowerCase()
        .includes(q)
    );
  });

  const paquetesFiltrados = paquetes.filter((p) => {
    if (!searchTracking.trim()) return true;
    const q = searchTracking.toLowerCase();
    return (
      String(p.identificador_interno || "")
        .toLowerCase()
        .includes(q) ||
      String(p.guia_externa_principal || "")
        .toLowerCase()
        .includes(q) ||
      String(p.destinatario_nombre || "")
        .toLowerCase()
        .includes(q) ||
      String(p.destinatario_ciudad || "")
        .toLowerCase()
        .includes(q) ||
      String(p.solicitud_consecutivo || "")
        .toLowerCase()
        .includes(q)
    );
  });

  const paqueteSeleccionadoObj = paquetes.find(
    (p) => String(p.id) === selectedPkgTracking
  );

  return (
    <div className="min-h-screen bg-[#F4F4F6] flex flex-col lg:flex-row">
      {/* Menú Lateral Corporativo con Logotipo Oficial (.SVG) */}
      <aside className="w-full lg:w-72 bg-white border-b lg:border-b-0 lg:border-r border-[#E4E4E7] flex flex-col justify-between shrink-0 shadow-[2px_0_16px_rgba(0,0,0,0.02)]">
        <div>
          {/* Cabecera Institucional con Logotipo Oficial .SVG */}
          <div className="bg-gradient-to-r from-[#DE1025] via-[#C90E22] to-[#A80C1C] px-5 py-4 border-b border-[#B80D1F]">
            <img
              src="/logo-conecta.svg"
              alt="Conecta Express - Recogidas"
              width={240}
              height={35}
              className="h-8 w-auto object-contain select-none"
            />
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-white/90 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span>Portal Corporativo de Clientes</span>
            </div>
          </div>

          {/* Información de la Empresa del Cliente */}
          <div className="px-5 py-3.5 bg-[#F8F8FA] border-b border-[#E4E4E7]">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#DE1025]">
              Cliente Conectado
            </div>
            <div className="text-sm font-bold text-[#18181B] truncate mt-0.5">
              {user?.cliente?.razon_social || user?.nombre || "Cargando..."}
            </div>
            <div className="text-xs text-[#71717A]">
              NIT: {user?.cliente?.nit || "900482910"}
            </div>
          </div>

          {/* Botón Principal Destacado: SOLICITAR RECOGIDA */}
          <div className="p-4 border-b border-[#E4E4E7]">
            <button
              type="button"
              onClick={iniciarSolicitudRecogida}
              className="w-full py-3 px-4 bg-[#DE1025] hover:bg-[#B80D1F] text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_6px_16px_-4px_rgba(222,16,37,0.3)] cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Solicitar Recogida</span>
            </button>
          </div>

          {/* Navegación Simple */}
          <nav className="p-3.5 space-y-1.5">
            {[
              {
                id: "MIS_SOLICITUDES" as TabType,
                label: "Mis Solicitudes y Comprobantes",
                icon: ClipboardList,
              },
              {
                id: "GUIAS_SEGUIMIENTO" as TabType,
                label: "Seguimiento de Envíos y Guías",
                icon: PackageSearch,
              },
              {
                id: "NOVEDADES" as TabType,
                label: "Novedades Reportadas",
                icon: AlertTriangle,
                badge:
                  (kpis.novedadesAbiertas ?? 0) > 0
                    ? kpis.novedadesAbiertas
                    : undefined,
              },
              {
                id: "DIRECTORIO" as TabType,
                label: "Direcciones Frecuentes",
                icon: MapPin,
              },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-[#FFF1F2] text-[#DE1025] border border-[#FCD4D8] shadow-2xs font-bold"
                      : "text-[#3F3F46] hover:bg-[#F8F8FA] hover:text-[#18181B] border border-transparent"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        active ? "text-[#DE1025]" : "text-[#71717A]"
                      }`}
                    />
                    <span>{item.label}</span>
                  </span>
                  {item.badge !== undefined && (
                    <span className="px-2 py-0.5 bg-[#DE1025] text-white rounded-full text-[10px] font-bold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Pie del Menú */}
        <div className="p-4 border-t border-[#E4E4E7] space-y-2 bg-[#FAFAFB]">
          {user?.rolCodigo === "SUPERADMIN" && (
            <button
              type="button"
              onClick={() => router.push("/admin")}
              className="w-full py-2 px-3 bg-white hover:bg-[#FFF1F2] hover:border-[#FCD4D8] border border-[#E4E4E7] text-[#27272A] rounded-xl text-xs font-semibold text-center transition-colors cursor-pointer"
            >
              Ir al Panel Administrativo
            </button>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-white hover:bg-[#FFF1F2] hover:border-[#FCD4D8] text-[#18181B] border border-[#E4E4E7] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-[#DE1025]" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Contenido Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Encabezado Superior Claro */}
        <header className="bg-white border-b border-neutral-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-neutral-900">
              {activeTab === "MIS_SOLICITUDES" &&
                "Mis Solicitudes de Recogida y Comprobantes"}
              {activeTab === "NUEVA_RECOGIDA" &&
                "Solicitar Nueva Recogida de Mercancía"}
              {activeTab === "GUIAS_SEGUIMIENTO" &&
                "Seguimiento de Envíos, Paquetes y Guías"}
              {activeTab === "NOVEDADES" && "Novedades e Incidencias"}
              {activeTab === "DIRECTORIO" &&
                "Mis Direcciones y Contactos Frecuentes"}
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              {activeTab === "MIS_SOLICITUDES" &&
                "Consulte el estado de sus recogidas, descargue comprobantes PDF o solicite una nueva recogida."}
              {activeTab === "NUEVA_RECOGIDA" &&
                "Complete los datos de dirección, mercancía y destino para programar su recogida."}
              {activeTab === "GUIAS_SEGUIMIENTO" &&
                "Vea en qué etapa del recorrido se encuentra cada paquete y descargue sus rótulos."}
              {activeTab === "NOVEDADES" &&
                "Consulte cualquier inconveniente reportado durante la recogida o el envío."}
              {activeTab === "DIRECTORIO" &&
                "Guarde sus sedes habituales para solicitar recogidas más rápido."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={cargarTodo}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-neutral-100 border border-neutral-300 rounded text-xs font-semibold text-neutral-700"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
              <span>Actualizar datos</span>
            </button>
            {activeTab !== "NUEVA_RECOGIDA" && (
              <button
                type="button"
                onClick={iniciarSolicitudRecogida}
                className="inline-flex items-center gap-2 px-4 py-2 bg-conecta text-white rounded text-xs font-bold uppercase tracking-wider hover:opacity-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Solicitar Recogida</span>
              </button>
            )}
          </div>
        </header>

        <main className="p-6 space-y-6 flex-1 overflow-y-auto max-w-6xl w-full mx-auto">
          {feedbackBanner && (
            <div
              className={`p-4 rounded-md border-l-4 flex items-center justify-between bg-white shadow-sm ${
                feedbackBanner.type === "OK"
                  ? "border-[#DE1025] text-[#171717]"
                  : "border-[#DE1025] text-[#DE1025]"
              }`}
            >
              <span className="text-xs font-semibold">
                {feedbackBanner.text}
              </span>
              <button
                type="button"
                onClick={() => setFeedbackBanner(null)}
                className="text-xs font-bold underline ml-4 text-[#DE1025]"
              >
                Entendido
              </button>
            </div>
          )}

          {/* VISTA PRINCIPAL: MIS SOLICITUDES, RESUMEN CLARO Y COMPROBANTES */}
          {activeTab === "MIS_SOLICITUDES" && (
            <div className="space-y-6">
              {/* Tarjeta de Acción Principal + 3 Indicadores Útiles */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-1 bg-white border-2 border-conecta rounded-lg p-5 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-conecta">
                      Acción Principal
                    </span>
                    <h2 className="text-base font-bold text-neutral-900 mt-1">
                      ¿Necesita enviar mercancía?
                    </h2>
                    <p className="text-xs text-neutral-600 mt-1">
                      Programe una recogida en su sede en menos de 1 minuto.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={iniciarSolicitudRecogida}
                    className="mt-4 w-full py-2.5 px-4 bg-conecta text-white rounded font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-95"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Solicitar Recogida</span>
                  </button>
                </div>

                <div className="bg-white border border-neutral-200 rounded-lg p-5 flex flex-col justify-between">
                  <div className="text-xs font-semibold text-neutral-500">
                    Recogidas Activas / En Curso
                  </div>
                  <div className="text-3xl font-bold text-neutral-900 mt-2">
                    {(kpis.recogidasPendientes ?? 0) +
                      (kpis.recogidasProgramadas ?? 0) +
                      (kpis.recogidasAsignadas ?? 0) +
                      (kpis.recogidasEnProceso ?? 0)}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-2">
                    Solicitudes pendientes o con conductor asignado
                  </div>
                </div>

                <div className="bg-white border border-neutral-200 rounded-lg p-5 flex flex-col justify-between">
                  <div className="text-xs font-semibold text-neutral-500">
                    Paquetes Registrados y en Seguimiento
                  </div>
                  <div className="text-3xl font-bold text-neutral-900 mt-2">
                    {paquetes.length}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("GUIAS_SEGUIMIENTO")}
                    className="text-left text-xs font-semibold text-conecta hover:underline mt-2"
                  >
                    Ver seguimiento de paquetes →
                  </button>
                </div>

                <div className="bg-white border border-neutral-200 rounded-lg p-5 flex flex-col justify-between">
                  <div className="text-xs font-semibold text-neutral-500">
                    Recogidas Completadas
                  </div>
                  <div className="text-3xl font-bold text-neutral-900 mt-2">
                    {kpis.recogidasCompletadas ?? 0}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-2">
                    Con comprobante PDF disponible
                  </div>
                </div>
              </div>

              {/* Listado Claro de Solicitudes */}
              <div className="bg-white rounded-lg border border-neutral-200 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-neutral-900">
                      Historial de Solicitudes ({solicitudesFiltradas.length})
                    </h2>
                    <p className="text-xs text-neutral-500">
                      Consulte en qué paso va cada solicitud y descargue su comprobante PDF.
                    </p>
                  </div>
                  <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchSolicitud}
                      onChange={(e) => setSearchSolicitud(e.target.value)}
                      placeholder="Buscar por número CE-REC, dirección o ciudad..."
                      className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-300 rounded text-xs"
                    />
                  </div>
                </div>

                {solicitudesFiltradas.length === 0 ? (
                  <div className="p-8 text-center bg-neutral-50 rounded border border-neutral-200">
                    <p className="text-sm text-neutral-700 font-medium">
                      No se encontraron solicitudes de recogida.
                    </p>
                    <button
                      type="button"
                      onClick={iniciarSolicitudRecogida}
                      className="mt-3 px-4 py-2 bg-conecta text-white rounded text-xs font-bold uppercase tracking-wider"
                    >
                      Solicitar mi primera recogida
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 font-semibold">
                          <th className="py-3 px-3">Nº Solicitud</th>
                          <th className="py-3 px-3">Dirección de Recogida</th>
                          <th className="py-3 px-3">Fecha y Horario</th>
                          <th className="py-3 px-3">Paquetes</th>
                          <th className="py-3 px-3">Transportador</th>
                          <th className="py-3 px-3">Etapa del Proceso</th>
                          <th className="py-3 px-3 text-right">Comprobante</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {solicitudesFiltradas.map((sol) => (
                          <tr
                            key={String(sol.id)}
                            className="hover:bg-neutral-50"
                          >
                            <td className="py-3.5 px-3 font-mono font-bold text-neutral-900">
                              {String(sol.consecutivo)}
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="font-semibold text-neutral-900">
                                {String(sol.direccion_texto)}
                              </div>
                              <div className="text-neutral-500">
                                {String(sol.ciudad)} • Contacto:{" "}
                                {String(sol.contacto_nombre)} (
                                {String(sol.contacto_telefono)})
                              </div>
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="font-semibold text-neutral-900">
                                {String(
                                  sol.fecha_programada || sol.fecha_solicitada
                                ).slice(0, 10)}
                              </div>
                              <div className="text-neutral-500">
                                {String(sol.franja_horaria)}
                              </div>
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="font-semibold text-neutral-900">
                                {Number(sol.cantidad_estimada_paquetes)}{" "}
                                paquetes
                              </div>
                              <div className="text-neutral-500">
                                {String(sol.tipo_mercancia)}
                              </div>
                            </td>
                            <td className="py-3.5 px-3">
                              {sol.transportador_nombre ? (
                                <div>
                                  <div className="font-semibold text-neutral-900">
                                    {String(sol.transportador_nombre)}
                                  </div>
                                  <div className="text-neutral-500">
                                    {String(
                                      sol.conductor_nombre ||
                                        "Conductor asignado"
                                    )}
                                    {sol.vehiculo_placa
                                      ? ` • Placa ${String(sol.vehiculo_placa)}`
                                      : ""}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-neutral-500">
                                  Pendiente por asignar
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-3">
                              <LogisticsFlowSteps
                                estado_recogida={String(sol.estado_recogida)}
                                compact
                              />
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  descargarComprobanteSolicitudPDF(
                                    sol as Parameters<
                                      typeof descargarComprobanteSolicitudPDF
                                    >[0]
                                  )
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 rounded text-xs font-semibold"
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
                )}
              </div>
            </div>
          )}

          {/* VISTA: SOLICITAR RECOGIDA GUIADA SIN NUMERACIÓN DECORATIVA */}
          {activeTab === "NUEVA_RECOGIDA" && (
            <div className="bg-white rounded-lg border border-neutral-200 p-6 max-w-3xl mx-auto space-y-6">
              {/* Indicador de pestañas del formulario */}
              <div className="grid grid-cols-3 gap-3 border-b border-neutral-200 pb-5">
                {[
                  {
                    step: 1,
                    title: "Dirección y Contacto",
                    desc: "¿Dónde recogemos?",
                  },
                  {
                    step: 2,
                    title: "Fecha y Mercancía",
                    desc: "¿Cuándo y cuántos paquetes?",
                  },
                  {
                    step: 3,
                    title: "Destino y Confirmación",
                    desc: "Revisión final",
                  },
                ].map((s) => {
                  const isCurrent = wizardStep === s.step;
                  const isDone = wizardStep > s.step;
                  return (
                    <button
                      key={s.step}
                      type="button"
                      onClick={() => setWizardStep(s.step as 1 | 2 | 3)}
                      className={`text-left p-3 rounded border transition-colors ${
                        isCurrent
                          ? "border-2 border-conecta bg-white"
                          : isDone
                            ? "border-neutral-300 bg-neutral-50"
                            : "border-neutral-200 bg-neutral-50 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${
                            isCurrent
                              ? "bg-[#DE1025] text-white"
                              : isDone
                                ? "bg-[#960A19] text-white"
                                : "bg-[#E5E5E5] text-[#525252]"
                          }`}
                        >
                          {isDone ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-current" />
                          )}
                        </span>
                        <span className="text-xs font-bold text-neutral-900">
                          {s.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-1 pl-7">
                        {s.desc}
                      </p>
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleSubmitRecogida} className="space-y-6">
                {/* DIRECCIÓN Y CONTACTO */}
                {wizardStep === 1 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-base font-bold text-neutral-900">
                        ¿En qué dirección debemos recoger la mercancía?
                      </h2>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Puede elegir una de sus sedes guardadas o escribir una dirección diferente.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2 bg-neutral-50 p-4 rounded border border-neutral-200">
                        <label className="block text-xs font-bold text-neutral-800 mb-1.5">
                          Elegir una sede o dirección frecuente (Opcional)
                        </label>
                        <select
                          value={formRecogida.direccionRecogidaId}
                          onChange={(e) =>
                            handleSelectDireccionFrecuente(e.target.value)
                          }
                          className="w-full px-3 py-2.5 bg-white border border-neutral-300 rounded text-xs text-neutral-900"
                        >
                          <option value="">
                            -- Escribir otra dirección manualmente --
                          </option>
                          {direcciones.map((d) => (
                            <option key={String(d.id)} value={String(d.id)}>
                              {String(d.alias)} —{" "}
                              {String(d.direccion_completa)} ({String(d.ciudad)}
                              )
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-neutral-800 mb-1">
                          Dirección exacta de recogida *
                        </label>
                        <input
                          type="text"
                          required
                          value={formRecogida.direccionTexto}
                          onChange={(e) =>
                            setFormRecogida({
                              ...formRecogida,
                              direccionTexto: e.target.value,
                            })
                          }
                          placeholder="Ej. Carrera 65B # 17A - 42 Bodega 3"
                          className="w-full px-3 py-2.5 bg-white border border-neutral-300 rounded text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-neutral-800 mb-1">
                          Ciudad *
                        </label>
                        <input
                          type="text"
                          required
                          value={formRecogida.ciudad}
                          onChange={(e) =>
                            setFormRecogida({
                              ...formRecogida,
                              ciudad: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2.5 bg-white border border-neutral-300 rounded text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-neutral-800 mb-1">
                          Sector o Zona de la Ciudad
                        </label>
                        <select
                          value={formRecogida.zonaLogistica}
                          onChange={(e) =>
                            setFormRecogida({
                              ...formRecogida,
                              zonaLogistica: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2.5 bg-white border border-neutral-300 rounded text-xs"
                        >
                          <option value="ZONA_INDUSTRIAL_OCCIDENTE">
                            Zona Industrial / Occidente
                          </option>
                          <option value="ZONA_NORTE">Zona Norte</option>
                          <option value="ZONA_CENTRO">Zona Centro</option>
                          <option value="ZONA_SUR">Zona Sur</option>
                          <option value="SABANA_OCCIDENTE">
                            Sabana / Municipios Cercanos
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-neutral-800 mb-1">
                          Nombre de la persona que entrega *
                        </label>
                        <input
                          type="text"
                          required
                          value={formRecogida.contactoNombre}
                          onChange={(e) =>
                            setFormRecogida({
                              ...formRecogida,
                              contactoNombre: e.target.value,
                            })
                          }
                          placeholder="Nombre del encargado en sitio"
                          className="w-full px-3 py-2.5 bg-white border border-neutral-300 rounded text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-neutral-800 mb-1">
                          Teléfono o celular de contacto *
                        </label>
                        <input
                          type="text"
                          required
                          value={formRecogida.contactoTelefono}
                          onChange={(e) =>
                            setFormRecogida({
                              ...formRecogida,
                              contactoTelefono: e.target.value,
                            })
                          }
                          placeholder="Ej. 310 555 0000"
                          className="w-full px-3 py-2.5 bg-white border border-neutral-300 rounded text-xs"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-neutral-200 flex justify-between">
                      <button
                        type="button"
                        onClick={() => setActiveTab("MIS_SOLICITUDES")}
                        className="px-4 py-2.5 bg-neutral-100 text-neutral-700 rounded text-xs font-semibold"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            !formRecogida.direccionTexto.trim() ||
                            !formRecogida.contactoNombre.trim() ||
                            !formRecogida.contactoTelefono.trim()
                          ) {
                            setFeedbackBanner({
                              type: "ERROR",
                              text: "Por favor complete la dirección, el nombre de contacto y el teléfono antes de continuar.",
                            });
                            return;
                          }
                          setFeedbackBanner(null);
                          setWizardStep(2);
                        }}
                        className="px-5 py-2.5 bg-conecta text-white rounded text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2"
                      >
                        <span>Continuar a Fecha y Mercancía</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* FECHA Y MERCANCÍA */}
                {wizardStep === 2 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-base font-bold text-neutral-900">
                        ¿Cuándo recogemos y qué mercancía va a entregar?
                      </h2>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Indique la fecha, la jornada preferida y la cantidad aproximada de paquetes.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-neutral-800 mb-1">
                          Fecha de recogida *
                        </label>
                        <input
                          type="date"
                          required
                          value={formRecogida.fechaSolicitada}
                          onChange={(e) =>
                            setFormRecogida({
                              ...formRecogida,
                              fechaSolicitada: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2.5 bg-white border border-neutral-300 rounded text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-neutral-800 mb-1">
                          Horario preferido *
                        </label>
                        <select
                          value={formRecogida.franjaHoraria}
                          onChange={(e) =>
                            setFormRecogida({
                              ...formRecogida,
                              franjaHoraria: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2.5 bg-white border border-neutral-300 rounded text-xs"
                        >
                          <option value="08:00 - 12:00">
                            En la mañana (08:00 a.m. - 12:00 m.)
                          </option>
                          <option value="13:00 - 17:00">
                            En la tarde (01:00 p.m. - 05:00 p.m.)
                          </option>
                          <option value="08:00 - 17:00">
                            Cualquier hora del día (08:00 a.m. - 05:00 p.m.)
                          </option>
                          <option value="URGENTE_2H">
                            Recogida prioritaria / urgente
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-neutral-800 mb-1">
                          Cantidad de paquetes o cajas *
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          required
                          value={formRecogida.cantidadEstimadaPaquetes}
                          onChange={(e) =>
                            setFormRecogida({
                              ...formRecogida,
                              cantidadEstimadaPaquetes: Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2.5 bg-white border border-neutral-300 rounded text-xs font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-neutral-800 mb-1">
                          Peso total aproximado (kg) *
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min={0.5}
                          required
                          value={formRecogida.pesoEstimadoKg}
                          onChange={(e) =>
                            setFormRecogida({
                              ...formRecogida,
                              pesoEstimadoKg: Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2.5 bg-white border border-neutral-300 rounded text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-neutral-800 mb-1">
                          ¿Qué tipo de mercancía es? *
                        </label>
                        <input
                          type="text"
                          required
                          value={formRecogida.tipoMercancia}
                          onChange={(e) =>
                            setFormRecogida({
                              ...formRecogida,
                              tipoMercancia: e.target.value,
                            })
                          }
                          placeholder="Ej. Cajas selladas, repuestos, confecciones"
                          className="w-full px-3 py-2.5 bg-white border border-neutral-300 rounded text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-neutral-800 mb-1">
                          Medidas aproximadas (Opcional)
                        </label>
                        <input
                          type="text"
                          value={formRecogida.dimensionesEstimadas}
                          onChange={(e) =>
                            setFormRecogida({
                              ...formRecogida,
                              dimensionesEstimadas: e.target.value,
                            })
                          }
                          placeholder="Ej. 40x30x30 cm"
                          className="w-full px-3 py-2.5 bg-white border border-neutral-300 rounded text-xs"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-neutral-200 flex justify-between">
                      <button
                        type="button"
                        onClick={() => setWizardStep(1)}
                        className="px-4 py-2.5 bg-neutral-100 text-neutral-800 rounded text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Volver a Dirección</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setWizardStep(3)}
                        className="px-5 py-2.5 bg-conecta text-white rounded text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2"
                      >
                        <span>Continuar a Confirmación</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* DESTINO OPCIONAL, ADJUNTOS Y CONFIRMACIÓN */}
                {wizardStep === 3 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-base font-bold text-neutral-900">
                        Datos de destino, observaciones y confirmación
                      </h2>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Si ya cuenta con guía de Coordinadora puede indicarla aquí; de lo contrario, Conecta Express generará rótulos internos automáticamente.
                      </p>
                    </div>

                    {/* Resumen de verificación */}
                    <div className="p-4 bg-neutral-50 rounded-md border border-neutral-200 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-neutral-500 block">
                          Lugar de recogida:
                        </span>
                        <span className="font-bold text-neutral-900">
                          {formRecogida.direccionTexto} ({formRecogida.ciudad})
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">
                          Fecha y horario:
                        </span>
                        <span className="font-bold text-neutral-900">
                          {formRecogida.fechaSolicitada} •{" "}
                          {formRecogida.franjaHoraria}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">
                          Mercancía a recoger:
                        </span>
                        <span className="font-bold text-neutral-900">
                          {formRecogida.cantidadEstimadaPaquetes} paquetes (
                          {formRecogida.pesoEstimadoKg} kg)
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-neutral-800 mb-1">
                          Ciudad de destino principal
                        </label>
                        <input
                          type="text"
                          value={formRecogida.destinatarioCiudad}
                          onChange={(e) =>
                            setFormRecogida({
                              ...formRecogida,
                              destinatarioCiudad: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-white border border-neutral-300 rounded text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-neutral-800 mb-1">
                          Nombre del destinatario (Opcional)
                        </label>
                        <input
                          type="text"
                          value={formRecogida.destinatarioNombre}
                          onChange={(e) =>
                            setFormRecogida({
                              ...formRecogida,
                              destinatarioNombre: e.target.value,
                            })
                          }
                          placeholder="Persona o empresa que recibe"
                          className="w-full px-3 py-2 bg-white border border-neutral-300 rounded text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-neutral-800 mb-1">
                          Dirección de entrega final (Opcional)
                        </label>
                        <input
                          type="text"
                          value={formRecogida.destinatarioDireccion}
                          onChange={(e) =>
                            setFormRecogida({
                              ...formRecogida,
                              destinatarioDireccion: e.target.value,
                            })
                          }
                          placeholder="Dirección de destino"
                          className="w-full px-3 py-2 bg-white border border-neutral-300 rounded text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-neutral-800 mb-1">
                          Nº de Guía Coordinadora (Opcional si ya la tiene)
                        </label>
                        <input
                          type="text"
                          value={formRecogida.guiaExternaInicial}
                          onChange={(e) =>
                            setFormRecogida({
                              ...formRecogida,
                              guiaExternaInicial: e.target.value,
                            })
                          }
                          placeholder="Dejar vacío si aún no tiene guía"
                          className="w-full px-3 py-2 bg-white border border-neutral-300 rounded text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-neutral-800 mb-1">
                          Observaciones o instrucciones para el conductor
                        </label>
                        <textarea
                          rows={3}
                          value={formRecogida.observaciones}
                          onChange={(e) =>
                            setFormRecogida({
                              ...formRecogida,
                              observaciones: e.target.value,
                            })
                          }
                          placeholder="Ej. Preguntar en portería 2, llevar carnet..."
                          className="w-full px-3 py-2 bg-white border border-neutral-300 rounded text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-neutral-800 mb-1">
                          Foto de la mercancía o remisión (Opcional)
                        </label>
                        <label className="flex flex-col items-center justify-center h-20 border-2 border-dashed border-neutral-300 rounded bg-neutral-50 hover:bg-neutral-100 cursor-pointer p-3 text-center">
                          <Upload className="w-4 h-4 text-conecta mb-1" />
                          <span className="text-xs font-medium text-neutral-700">
                            {formRecogida.evidenciaNombre
                              ? `Archivo cargado: ${formRecogida.evidenciaNombre}`
                              : "Haga clic para adjuntar foto o PDF"}
                          </span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-neutral-200 flex justify-between">
                      <button
                        type="button"
                        onClick={() => setWizardStep(2)}
                        className="px-4 py-2.5 bg-neutral-100 text-neutral-800 rounded text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Volver a Mercancía</span>
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-6 py-3 bg-conecta text-white rounded text-xs font-bold uppercase tracking-wider hover:opacity-95 disabled:opacity-50"
                      >
                        {submitting
                          ? "Registrando Solicitud..."
                          : "Confirmar y Solicitar Recogida"}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* VISTA 3: SEGUIMIENTO DE ENVÍOS Y GUÍAS */}
          {activeTab === "GUIAS_SEGUIMIENTO" && (
            <div className="space-y-6">
              {paqueteSeleccionadoObj && (
                <div className="bg-white rounded-lg border-2 border-[#DE1025] p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold uppercase text-conecta">
                        Seguimiento Detallado del Paquete
                      </span>
                      <h3 className="text-base font-bold text-neutral-900">
                        Código Conecta:{" "}
                        {String(paqueteSeleccionadoObj.identificador_interno)}
                        {paqueteSeleccionadoObj.guia_externa_principal
                          ? ` • Guía ${String(
                              paqueteSeleccionadoObj.transportadora_principal
                            )}: ${String(
                              paqueteSeleccionadoObj.guia_externa_principal
                            )}`
                          : ""}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPkgTracking(null)}
                      className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded text-xs font-semibold text-neutral-800"
                    >
                      Cerrar seguimiento
                    </button>
                  </div>

                  {/* Barra Visual de las 6 Etapas Logísticas */}
                  <LogisticsFlowSteps
                    estado_recogida={String(
                      paqueteSeleccionadoObj.estado_recogida
                    )}
                    estado_bodega={String(paqueteSeleccionadoObj.estado_bodega)}
                    estado_despacho={String(
                      paqueteSeleccionadoObj.estado_despacho
                    )}
                  />

                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold uppercase text-neutral-700">
                      Bitácora de movimientos registrados
                    </h4>
                    {eventos
                      .filter(
                        (ev) => String(ev.paquete_id) === selectedPkgTracking
                      )
                      .map((ev) => (
                        <div
                          key={String(ev.id)}
                          className="flex items-start gap-3 p-3 bg-neutral-50 rounded border border-neutral-200 text-xs"
                        >
                          <CheckCircle2 className="w-4 h-4 text-conecta shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-neutral-900">
                                {formatReadableStatus(String(ev.estado_nuevo))}
                              </span>
                              <span className="text-neutral-500">
                                {new Date(
                                  String(ev.created_at)
                                ).toLocaleString("es-CO")}
                              </span>
                            </div>
                            <p className="mt-1 text-neutral-700">
                              {String(ev.observaciones)}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg border border-neutral-200 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-neutral-900">
                      Mis Paquetes y Guías ({paquetesFiltrados.length})
                    </h2>
                    <p className="text-xs text-neutral-500">
                      Consulte en cuál de las 6 etapas del proceso logístico está cada paquete.
                    </p>
                  </div>
                  <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchTracking}
                      onChange={(e) => setSearchTracking(e.target.value)}
                      placeholder="Buscar por código CE, guía Coordinadora o ciudad..."
                      className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-300 rounded text-xs"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 font-semibold">
                        <th className="py-3 px-3">Código Paquete</th>
                        <th className="py-3 px-3">Guía Transportadora</th>
                        <th className="py-3 px-3">Medidas y Peso</th>
                        <th className="py-3 px-3">Destino</th>
                        <th className="py-3 px-3">Etapa Actual del Paquete</th>
                        <th className="py-3 px-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {paquetesFiltrados.map((pkg) => (
                        <tr
                          key={String(pkg.id)}
                          className="hover:bg-neutral-50"
                        >
                          <td className="py-3.5 px-3 font-mono font-bold text-neutral-900">
                            {String(pkg.identificador_interno)}
                            <div className="text-[11px] font-sans font-normal text-neutral-500">
                              Solicitud:{" "}
                              {String(pkg.solicitud_consecutivo || "Directo")}
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            {pkg.guia_externa_principal ? (
                              <div>
                                <span className="font-bold text-neutral-900 font-mono">
                                  {String(pkg.guia_externa_principal)}
                                </span>
                                <div className="text-[11px] text-neutral-500">
                                  {String(pkg.transportadora_principal)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-neutral-500">
                                Rótulo Interno Conecta Express
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="font-semibold text-neutral-900">
                              {Number(pkg.largo_cm || 30)} ×{" "}
                              {Number(pkg.ancho_cm || 30)} ×{" "}
                              {Number(pkg.alto_cm || 30)} cm
                            </div>
                            <div className="text-neutral-500">
                              Peso: {Number(pkg.peso_kg || 1)} kg
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="font-semibold text-neutral-900">
                              {String(pkg.destinatario_ciudad)}
                            </div>
                            <div className="text-neutral-500">
                              {String(pkg.destinatario_nombre)}
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
                          <td className="py-3.5 px-3 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() =>
                                imprimirRotuloInternoPDF(
                                  pkg as Parameters<
                                    typeof imprimirRotuloInternoPDF
                                  >[0]
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-neutral-100 border border-neutral-300 rounded text-xs font-semibold text-neutral-800"
                            >
                              <Printer className="w-3.5 h-3.5 text-conecta" />
                              <span>Descargar Rótulo</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedPkgTracking(String(pkg.id))
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#DE1025] hover:bg-[#B80D1F] text-white rounded text-xs font-semibold transition-colors"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span>Ver Paso a Paso</span>
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

          {/* VISTA 4: CONSULTA DE NOVEDADES */}
          {activeTab === "NOVEDADES" && (
            <div className="bg-white rounded-lg border border-neutral-200 p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-neutral-900">
                  Novedades de Mis Solicitudes y Paquetes ({novedades.length})
                </h2>
                <p className="text-xs text-neutral-500">
                  Aquí encontrará cualquier inconveniente reportado y la respuesta del equipo de Conecta Express.
                </p>
              </div>

              {novedades.length === 0 ? (
                <div className="p-8 text-center bg-neutral-50 rounded border border-neutral-200 text-xs text-neutral-600">
                  No tiene novedades ni inconvenientes reportados en sus envíos.
                </div>
              ) : (
                <div className="space-y-3">
                  {novedades.map((nov) => (
                    <div
                      key={String(nov.id)}
                      className="p-4 bg-neutral-50 rounded-md border border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-neutral-900">
                            {String(nov.consecutivo)}
                          </span>
                          <StateBadge estado={String(nov.estado_novedad)} />
                        </div>
                        <div className="font-bold text-sm text-neutral-900">
                          {String(nov.titulo)}
                        </div>
                        <p className="text-neutral-600">
                          {String(nov.descripcion)}
                        </p>
                        {Boolean(nov.resolucion_final) && (
                          <div className="mt-2 p-2.5 bg-white rounded border border-neutral-300 text-neutral-900 font-medium">
                            <strong>Solución aplicada:</strong>{" "}
                            {String(nov.resolucion_final)}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0 space-y-1 text-neutral-500">
                        <div>
                          Solicitud: {String(nov.solicitud_consecutivo || "N/A")}
                        </div>
                        <div>
                          Paquete: {String(nov.paquete_identificador || "N/A")}
                        </div>
                        <div>
                          {new Date(String(nov.created_at)).toLocaleDateString(
                            "es-CO"
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VISTA 5: DIRECCIONES FRECUENTES Y CONTACTOS */}
          {activeTab === "DIRECTORIO" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border border-neutral-200 p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
                  <Building2 className="w-4 h-4 text-conecta" />
                  <h2 className="text-sm font-bold text-neutral-900">
                    Mis Direcciones de Recogida ({direcciones.length})
                  </h2>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {direcciones.map((d) => (
                    <div
                      key={String(d.id)}
                      className="p-3 bg-neutral-50 rounded border border-neutral-200 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-neutral-900">
                          {String(d.alias)}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 bg-white border border-neutral-300 rounded font-semibold">
                          {String(d.ciudad)}
                        </span>
                      </div>
                      <div className="text-neutral-700 mt-1">
                        {String(d.direccion_completa)}
                      </div>
                      <div className="text-neutral-500 mt-1">
                        Encargado: {String(d.contacto_local_nombre || "N/A")} •{" "}
                        {String(d.contacto_local_telefono || "")}
                      </div>
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={handleCrearDireccion}
                  className="pt-3 border-t border-neutral-200 space-y-3"
                >
                  <div className="text-xs font-bold text-neutral-900">
                    Guardar Nueva Dirección Frecuente
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      required
                      placeholder="Nombre (Ej. Bodega Principal)"
                      value={formDireccion.alias}
                      onChange={(e) =>
                        setFormDireccion({
                          ...formDireccion,
                          alias: e.target.value,
                        })
                      }
                      className="px-3 py-2 border border-neutral-300 rounded text-xs"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Ciudad"
                      value={formDireccion.ciudad}
                      onChange={(e) =>
                        setFormDireccion({
                          ...formDireccion,
                          ciudad: e.target.value,
                        })
                      }
                      className="px-3 py-2 border border-neutral-300 rounded text-xs"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Dirección completa"
                      value={formDireccion.direccionCompleta}
                      onChange={(e) =>
                        setFormDireccion({
                          ...formDireccion,
                          direccionCompleta: e.target.value,
                        })
                      }
                      className="col-span-2 px-3 py-2 border border-neutral-300 rounded text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Nombre de quien entrega"
                      value={formDireccion.contactoNombre}
                      onChange={(e) =>
                        setFormDireccion({
                          ...formDireccion,
                          contactoNombre: e.target.value,
                        })
                      }
                      className="px-3 py-2 border border-neutral-300 rounded text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Teléfono de contacto"
                      value={formDireccion.contactoTelefono}
                      onChange={(e) =>
                        setFormDireccion({
                          ...formDireccion,
                          contactoTelefono: e.target.value,
                        })
                      }
                      className="px-3 py-2 border border-neutral-300 rounded text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 bg-conecta text-white rounded text-xs font-bold uppercase tracking-wider hover:opacity-95"
                  >
                    Guardar Dirección
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-lg border border-neutral-200 p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
                  <Phone className="w-4 h-4 text-conecta" />
                  <h2 className="text-sm font-bold text-neutral-900">
                    Mis Contactos Autorizados ({contactos.length})
                  </h2>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {contactos.map((ct) => (
                    <div
                      key={String(ct.id)}
                      className="p-3 bg-neutral-50 rounded border border-neutral-200 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-neutral-900">
                          {String(ct.nombre_completo)}
                        </div>
                        <div className="text-neutral-600">
                          {String(ct.cargo || "Encargado")} • Tel:{" "}
                          {String(ct.telefono)}
                        </div>
                      </div>
                      {Boolean(ct.es_principal) && (
                        <span className="px-2 py-0.5 bg-[#DE1025] text-white text-[10px] font-bold uppercase rounded">
                          Principal
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={handleCrearContacto}
                  className="pt-3 border-t border-neutral-200 space-y-3"
                >
                  <div className="text-xs font-bold text-neutral-900">
                    Guardar Nuevo Contacto
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      required
                      placeholder="Nombre completo *"
                      value={formContacto.nombreCompleto}
                      onChange={(e) =>
                        setFormContacto({
                          ...formContacto,
                          nombreCompleto: e.target.value,
                        })
                      }
                      className="px-3 py-2 border border-neutral-300 rounded text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Cargo"
                      value={formContacto.cargo}
                      onChange={(e) =>
                        setFormContacto({
                          ...formContacto,
                          cargo: e.target.value,
                        })
                      }
                      className="px-3 py-2 border border-neutral-300 rounded text-xs"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Teléfono *"
                      value={formContacto.telefono}
                      onChange={(e) =>
                        setFormContacto({
                          ...formContacto,
                          telefono: e.target.value,
                        })
                      }
                      className="px-3 py-2 border border-neutral-300 rounded text-xs"
                    />
                    <input
                      type="email"
                      placeholder="Correo electrónico"
                      value={formContacto.email}
                      onChange={(e) =>
                        setFormContacto({
                          ...formContacto,
                          email: e.target.value,
                        })
                      }
                      className="px-3 py-2 border border-neutral-300 rounded text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 bg-[#DE1025] hover:bg-[#B80D1F] text-white rounded text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    Guardar Contacto
                  </button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
