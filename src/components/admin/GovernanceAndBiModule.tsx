"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";
import {
  Plug,
  Upload,
  Clock,
  AlertTriangle,
  Building2,
  FileSpreadsheet,
  FileDown,
  Users,
  ShieldCheck,
  Bell,
  Search,
  Package,
} from "lucide-react";
import { StateBadge, formatReadableStatus } from "@/components/ui/StateBadge";
import { LogisticsFlowSteps } from "@/components/ui/LogisticsFlowSteps";
import {
  exportarReportePDF,
  exportarTablaExcel,
} from "@/lib/pdf-excel-generator";

interface GovernanceAndBiProps {
  subView:
  | "INTEGRACIONES"
  | "TRAZABILIDAD"
  | "NOVEDADES"
  | "CLIENTES"
  | "REPORTES"
  | "USUARIOS"
  | "NOTIFICACIONES";
  integraciones: Record<string, unknown>[];
  registrosSincronizacion: Record<string, unknown>[];
  estadoVariablesEntorno: Record<string, unknown>;
  eventos: Record<string, unknown>[];
  novedades: Record<string, unknown>[];
  notificaciones: Record<string, unknown>[];
  responsablesInternos: Record<string, unknown>[];
  clientes: Record<string, unknown>[];
  direcciones: Record<string, unknown>[];
  contactos: Record<string, unknown>[];
  usuarios: Record<string, unknown>[];
  roles: Record<string, unknown>[];
  matrizPermisos: Record<string, string[]>;
  auditoria: Record<string, unknown>[];
  solicitudes: Record<string, unknown>[];
  paquetes: Record<string, unknown>[];
  despachos: Record<string, unknown>[];
  movimientos: Record<string, unknown>[];
  transportadores: Record<string, unknown>[];
  onRefresh: () => Promise<void>;
}

const TIPOS_NOVEDAD_CATALOGO = [
  "CLIENTE_AUSENTE",
  "DIRECCION_INCORRECTA",
  "MERCANCIA_NO_PREPARADA",
  "RECOGIDA_FALLIDA",
  "DIFERENCIA_DE_UNIDADES",
  "PAQUETE_AVERIADO",
  "CODIGO_ILEGIBLE",
  "PAQUETE_SIN_IDENTIFICAR",
  "FALTANTE",
  "SOBRANTE",
  "RETRASO",
  "ERROR_DE_DESPACHO",
  "DEVOLUCION",
  "OTRAS",
];

export function GovernanceAndBiModule({
  subView,
  integraciones,
  registrosSincronizacion,
  estadoVariablesEntorno,
  eventos,
  novedades,
  notificaciones,
  responsablesInternos,
  clientes,
  usuarios,
  roles,
  matrizPermisos,
  auditoria,
  solicitudes,
  paquetes,
  despachos,
  movimientos,
  transportadores,
  onRefresh,
}: GovernanceAndBiProps) {
  const [banner, setBanner] = useState<{
    type: "OK" | "ERROR";
    text: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Importación de Guías Externas
  const [transportadoraImport, setTransportadoraImport] =
    useState("COORDINADORA");
  const [clienteIdImport, setClienteIdImport] = useState("cli-corporativo-01");
  const [manualGuiaNum, setManualGuiaNum] = useState("");
  const [manualDestinatario, setManualDestinatario] = useState("");
  const [manualCiudadDestino, setManualCiudadDestino] = useState("Medellín");
  const [manualDireccionDestino, setManualDireccionDestino] = useState("");

  // Trazabilidad y Novedades
  const [searchTrazabilidad, setSearchTrazabilidad] = useState("");
  const [formNovedad, setFormNovedad] = useState({
    tipoNovedad: "PAQUETE_AVERIADO",
    prioridad: "ALTA",
    solicitudId: "",
    paqueteId: "",
    responsableAsignadoId: "usr-coordinador",
    titulo: "",
    descripcion: "",
  });
  const [novedadSeleccionada, setNovedadSeleccionada] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [comentarioResolucion, setComentarioResolucion] = useState("");
  const [nuevoEstadoNovedad, setNuevoEstadoNovedad] = useState("EN_GESTION");

  // Clientes
  const [formCliente, setFormCliente] = useState({
    razonSocial: "",
    nit: "",
    digitoVerificacion: "",
    emailCorporativo: "",
    telefonoPrincipal: "",
    ciudadPrincipal: "Bogotá D.C.",
    direccionPrincipal: "",
    contactoNombre: "",
    slaRecogidaHoras: 4,
    crearUsuarioPortal: true,
    passwordPortal: "Conecta2026*",
  });

  // Usuarios
  const [formUsuario, setFormUsuario] = useState({
    nombreCompleto: "",
    email: "",
    password: "Conecta2026*",
    telefono: "",
    cargo: "",
    rolCodigo: "OPERARIO_BODEGA",
    clienteId: "cli-corporativo-01",
    transportadorId: "trp-aliado-01",
  });

  function handleArchivoExcelCsvGuias(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          workbook.Sheets[sheetName]
        );

        const filasNormalizadas = rows.map((r) => ({
          numero_guia: String(
            r.numero_guia || r.guia || r.GUIA || r.NumeroGuia || ""
          ).trim(),
          identificador_interno: String(
            r.identificador_interno || r.codigo_ce || ""
          ).trim(),
          destinatario_nombre: String(
            r.destinatario || r.destinatario_nombre || "Destinatario Importado"
          ),
          destinatario_ciudad: String(
            r.ciudad || r.destinatario_ciudad || "Nacional"
          ),
          destinatario_direccion: String(
            r.direccion || r.destinatario_direccion || "Dirección Guía"
          ),
          peso_kg: Number(r.peso || r.peso_kg || 2),
          contenido: String(r.contenido || "Mercancía importada"),
        }));

        const res = await fetch("/api/integraciones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "IMPORTAR_LOTE_GUIAS",
            transportadora: transportadoraImport,
            clienteId: clienteIdImport,
            filas: filasNormalizadas,
          }),
        });
        const resp = await res.json();
        if (res.ok) {
          setBanner({
            type: "OK",
            text: `Archivo Excel/CSV importado: ${resp.procesados} guías vinculadas con código interno CE.`,
          });
          await onRefresh();
        }
      } catch {
        setBanner({
          type: "ERROR",
          text: "No se pudo procesar el archivo Excel/CSV. Verifique las columnas.",
        });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleCargaManualGuia(e: React.FormEvent) {
    e.preventDefault();
    if (!manualGuiaNum.trim()) return;
    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/integraciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "IMPORTAR_LOTE_GUIAS",
          transportadora: transportadoraImport,
          clienteId: clienteIdImport,
          filas: [
            {
              numero_guia: manualGuiaNum.trim(),
              destinatario_nombre: manualDestinatario || "Destinatario Guía",
              destinatario_ciudad: manualCiudadDestino,
              destinatario_direccion:
                manualDireccionDestino || "Dirección Guía Externa",
              peso_kg: 3,
              contenido: "Mercancía vinculada con guía de transportadora",
            },
          ],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBanner({
          type: "OK",
          text: `Guía ${manualGuiaNum} importada y vinculada (${(
            data.detalleProcesados || []
          ).join(", ")}).`,
        });
        setManualGuiaNum("");
        setManualDestinatario("");
        setManualDireccionDestino("");
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProbarAdaptadorCoordinadora() {
    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/integraciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "PROBAR_O_SINCRONIZAR_API",
          numeroGuia: manualGuiaNum || "VERIFICACION_ESTADO",
        }),
      });
      const data = await res.json();
      setBanner({
        type: data.verificada ? "OK" : "ERROR",
        text: data.message,
      });
      await onRefresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCrearNovedad(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/trazabilidad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREAR_NOVEDAD",
          ...formNovedad,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBanner({
          type: "OK",
          text: `Novedad ${data.consecutivo} registrada correctamente.`,
        });
        setFormNovedad({
          ...formNovedad,
          titulo: "",
          descripcion: "",
        });
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGestionarNovedad(e: React.FormEvent) {
    e.preventDefault();
    if (!novedadSeleccionada) return;
    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/trazabilidad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "GESTIONAR_NOVEDAD",
          novedadId: novedadSeleccionada.id,
          estadoNovedad: nuevoEstadoNovedad,
          comentario: comentarioResolucion,
          resolucionFinal:
            nuevoEstadoNovedad === "RESUELTA" ||
              nuevoEstadoNovedad === "CERRADA"
              ? comentarioResolucion
              : null,
        }),
      });
      if (res.ok) {
        setBanner({
          type: "OK",
          text: `Novedad ${String(
            novedadSeleccionada.consecutivo
          )} actualizada a ${formatReadableStatus(nuevoEstadoNovedad)}.`,
        });
        setNovedadSeleccionada(null);
        setComentarioResolucion("");
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCrearCliente(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREAR_CLIENTE",
          ...formCliente,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({
          type: "ERROR",
          text: data.message || "Error creando cliente.",
        });
      } else {
        setBanner({
          type: "OK",
          text: `Cliente ${data.codigoCliente} creado exitosamente${data.usuarioCreadoEmail
            ? ` con usuario de portal (${data.usuarioCreadoEmail})`
            : ""
            }.`,
        });
        setFormCliente({
          ...formCliente,
          razonSocial: "",
          nit: "",
          emailCorporativo: "",
          telefonoPrincipal: "",
          direccionPrincipal: "",
          contactoNombre: "",
        });
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCrearUsuario(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formUsuario),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({
          type: "ERROR",
          text: data.message || "Error creando usuario.",
        });
      } else {
        setBanner({
          type: "OK",
          text: `Usuario ${formUsuario.email} creado correctamente.`,
        });
        setFormUsuario({
          ...formUsuario,
          nombreCompleto: "",
          email: "",
          telefono: "",
          cargo: "",
        });
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const catalogo13Reportes = [
    {
      id: "REP-RECOGIDAS-PERIODO",
      nombre: "Recogidas por Periodo",
      descripcion:
        "Consolidado de solicitudes de recogida, fechas programadas, horarios y estados.",
      datos: solicitudes.map((s) => ({
        Consecutivo: String(s.consecutivo),
        Fecha_Solicitada: String(s.fecha_solicitada).slice(0, 10),
        Fecha_Programada: String(
          s.fecha_programada || s.fecha_solicitada
        ).slice(0, 10),
        Franja: String(s.franja_horaria),
        Ciudad: String(s.ciudad),
        Estado: formatReadableStatus(String(s.estado_recogida)),
        Paquetes_Estimados: Number(s.cantidad_estimada_paquetes),
        Paquetes_Recogidos: Number(s.cantidad_recogida_real || 0),
      })),
    },
    {
      id: "REP-RECOGIDAS-CLIENTE",
      nombre: "Recogidas por Cliente",
      descripcion:
        "Detalle de recogidas agrupadas por empresa cliente y dirección.",
      datos: solicitudes.map((s) => ({
        Cliente: String(s.cliente_nombre),
        NIT: String(s.cliente_nit || ""),
        Consecutivo: String(s.consecutivo),
        Direccion: String(s.direccion_texto),
        Ciudad: String(s.ciudad),
        Unidades: Number(s.cantidad_estimada_paquetes),
        Estado: formatReadableStatus(String(s.estado_recogida)),
      })),
    },
    {
      id: "REP-RECOGIDAS-TRANSPORTADOR",
      nombre: "Recogidas por Transportador",
      descripcion:
        "Cumplimiento de recogidas asignadas a empresas transportadoras terceras y conductores.",
      datos: solicitudes.map((s) => ({
        Transportador: String(s.transportador_nombre || "Sin asignar"),
        Conductor: String(s.conductor_nombre || "N/A"),
        Placa: String(s.vehiculo_placa || "N/A"),
        Solicitud: String(s.consecutivo),
        Ciudad: String(s.ciudad),
        Estado: formatReadableStatus(String(s.estado_recogida)),
      })),
    },
    {
      id: "REP-PAQUETES-MEDIDAS",
      nombre: "Paquetes Recogidos y Medidas Registradas",
      descripcion:
        "Relación de paquetes con sus medidas (largo, ancho, alto y peso), solicitud y guía asociada.",
      datos: paquetes.map((p) => ({
        Identificador_CE: String(p.identificador_interno),
        Solicitud: String(p.solicitud_consecutivo || "Directo"),
        Cliente: String(p.cliente_nombre),
        Dimensiones_cm: `${Number(p.largo_cm || 20)}x${Number(p.ancho_cm || 20)}x${Number(p.alto_cm || 20)}`,
        Peso_Kg: Number(p.peso_kg),
        Guia_Externa: String(p.guia_externa_principal || "Rótulo CE"),
        Estado: formatReadableStatus(String(p.estado_recogida)),
      })),
    },
    {
      id: "REP-CUMPLIMIENTO-TRANSPORTADORES",
      nombre: "Cumplimiento de Transportadores",
      descripcion:
        "Indicadores de efectividad de recogidas por empresa transportadora.",
      datos: transportadores.map((t) => ({
        Codigo: String(t.codigo_transportador),
        Transportador: String(t.razon_social),
        Ciudad_Base: String(t.ciudad_base),
        Servicios_Asignados: Number(t.total_servicios || 0),
        Exitosas: Number(t.recogidas_exitosas || 0),
        Fallidas: Number(t.recogidas_fallidas || 0),
        Cumplimiento: `${Number(t.cumplimiento_sla_pct || 100)}%`,
      })),
    },
    {
      id: "REP-NOVEDADES",
      nombre: "Reporte de Novedades",
      descripcion:
        "Listado de novedades e inconvenientes reportados y su resolución.",
      datos: novedades.map((n) => ({
        Consecutivo: String(n.consecutivo),
        Tipo: formatReadableStatus(String(n.tipo_novedad)),
        Prioridad: String(n.prioridad),
        Estado: formatReadableStatus(String(n.estado_novedad)),
        Titulo: String(n.titulo),
        Solicitud: String(n.solicitud_consecutivo || "N/A"),
        Paquete: String(n.paquete_identificador || "N/A"),
      })),
    },
    {
      id: "REP-TRAZABILIDAD-TIEMPOS",
      nombre: "Tiempos de Operación y Trazabilidad",
      descripcion:
        "Fechas de solicitud, recogida física y entrega por paquete.",
      datos: paquetes.map((p) => ({
        Identificador_CE: String(p.identificador_interno),
        Creado: String(p.created_at).slice(0, 19),
        Recogida_Fisica: p.fecha_recogida_fisica
          ? String(p.fecha_recogida_fisica).slice(0, 19)
          : "Pendiente",
        Salida_Transportadora: p.fecha_salida_despacho
          ? String(p.fecha_salida_despacho).slice(0, 19)
          : "Pendiente",
      })),
    },
  ];

  // Paquete coincidente en el buscador de Trazabilidad para mostrar su etapa visual
  const paqueteEncontradoTrazabilidad = searchTrazabilidad.trim()
    ? paquetes.find(
      (p) =>
        String(p.identificador_interno || "")
          .toLowerCase()
          .includes(searchTrazabilidad.trim().toLowerCase()) ||
        String(p.guia_externa_principal || "")
          .toLowerCase()
          .includes(searchTrazabilidad.trim().toLowerCase()) ||
        String(p.solicitud_consecutivo || "")
          .toLowerCase()
          .includes(searchTrazabilidad.trim().toLowerCase())
    )
    : paquetes[0];

  return (
    <div className="space-y-6">
      {banner && (
        <div
          className={`p-4 rounded border-l-4 bg-white shadow-sm flex items-center justify-between text-xs font-semibold ${banner.type === "OK"
            ? "border-[#DE1025] text-[#171717]"
            : "border-[#DE1025] text-[#DE1025]"
            }`}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="underline ml-4 text-[#DE1025]"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* IMPORTACIÓN DE GUÍAS DE COORDINADORA Y PLATAFORMA ACTUAL              */}
      {/* ===================================================================== */}
      {subView === "INTEGRACIONES" && (
        <div className="space-y-6">
          <div className="bg-white rounded border border-neutral-200 p-5 space-y-5">
            <div className="border-l-4 border-conecta pl-3">
              <h2 className="text-base font-bold text-neutral-900">
                Conexión e Importación de Guías (Coordinadora y Plataforma de Guías)
              </h2>
              <p className="text-xs text-neutral-600 mt-0.5">
                Importe archivos Excel/CSV de guías generadas en su plataforma actual o registre números de guía manualmente para vincularlos con los paquetes de bodega.
              </p>
            </div>

            {/* Opciones Principales: Excel/CSV y Manual */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-5 bg-neutral-50 rounded border border-neutral-200 space-y-3">
                <h3 className="text-xs font-bold uppercase text-neutral-900 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-conecta" />
                  <span>
                    Subir Archivo Excel (.xlsx) o CSV de Guías
                  </span>
                </h3>
                <p className="text-xs text-neutral-600">
                  Suba el archivo exportado desde la plataforma de guías de Conecta Express o Coordinadora.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                      Transportadora
                    </label>
                    <select
                      value={transportadoraImport}
                      onChange={(e) => setTransportadoraImport(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white border border-neutral-300 rounded text-xs font-bold"
                    >
                      <option value="COORDINADORA">COORDINADORA</option>
                      <option value="SERVIENTREGA">SERVIENTREGA</option>
                      <option value="TCC">TCC</option>
                      <option value="INTERRAPIDISIMO">INTERRAPIDÍSIMO</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                      Empresa Cliente
                    </label>
                    <select
                      value={clienteIdImport}
                      onChange={(e) => setClienteIdImport(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white border border-neutral-300 rounded text-xs"
                    >
                      {clientes.map((c) => (
                        <option key={String(c.id)} value={String(c.id)}>
                          {String(c.razon_social)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="flex items-center justify-center gap-2 py-3.5 px-4 border-2 border-dashed border-neutral-400 rounded bg-white hover:bg-neutral-100 cursor-pointer text-xs font-bold text-neutral-800">
                  <FileSpreadsheet className="w-4 h-4 text-conecta" />
                  <span>Seleccionar Archivo Excel (.xlsx / .csv)</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleArchivoExcelCsvGuias}
                    className="hidden"
                  />
                </label>
              </div>

              <form
                onSubmit={handleCargaManualGuia}
                className="p-5 bg-neutral-50 rounded border border-neutral-200 space-y-3"
              >
                <h3 className="text-xs font-bold uppercase text-neutral-900">
                  Registrar una Guía Manualmente
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    placeholder="Número de Guía (Ej. 73920184999) *"
                    value={manualGuiaNum}
                    onChange={(e) => setManualGuiaNum(e.target.value)}
                    className="px-3 py-2 bg-white border border-neutral-300 rounded text-xs font-mono"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Ciudad Destino *"
                    value={manualCiudadDestino}
                    onChange={(e) => setManualCiudadDestino(e.target.value)}
                    className="px-3 py-2 bg-white border border-neutral-300 rounded text-xs"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Nombre del Destinatario *"
                    value={manualDestinatario}
                    onChange={(e) => setManualDestinatario(e.target.value)}
                    className="px-3 py-2 bg-white border border-neutral-300 rounded text-xs"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Dirección de Entrega *"
                    value={manualDireccionDestino}
                    onChange={(e) => setManualDireccionDestino(e.target.value)}
                    className="px-3 py-2 bg-white border border-neutral-300 rounded text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-[#DE1025] hover:bg-[#B80D1F] text-white rounded text-xs font-bold transition-colors"
                >
                  Guardar Guía y Crear Paquete en Sistema
                </button>
              </form>
            </div>

            {/* Estado de Conexión API */}
            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Plug className="w-4 h-4 text-conecta" />
                <span className="font-bold text-neutral-900">
                  Estado de Conexión Automática con Coordinadora:
                </span>
                <span className="text-neutral-600">
                  {estadoVariablesEntorno.COORDINADORA_API_KEY_CONFIGURADA
                    ? "Conectado por API"
                    : "Modo Importación de Archivos Activo"}
                </span>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={handleProbarAdaptadorCoordinadora}
                className="px-3.5 py-1.5 bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-800 rounded font-bold text-xs"
              >
                Probar Conexión API
              </button>
            </div>
          </div>

          {/* Historial de Importaciones */}
          <div className="bg-white rounded border border-neutral-200 p-5 space-y-3">
            <h3 className="text-sm font-bold text-neutral-900">
              Historial de Guías Importadas ({registrosSincronizacion.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 uppercase">
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Sistema</th>
                    <th className="py-2.5 px-3">Acción</th>
                    <th className="py-2.5 px-3">Guía / Referencia</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {registrosSincronizacion.map((log) => (
                    <tr key={String(log.id)}>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {new Date(String(log.created_at)).toLocaleString(
                          "es-CO"
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        {String(log.codigo_integracion)}
                      </td>
                      <td className="py-2.5 px-3">
                        {formatReadableStatus(String(log.tipo_operacion))}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {String(log.referencia_consultada || "N/A")}
                      </td>
                      <td className="py-2.5 px-3">
                        <StateBadge estado={String(log.estado_ejecucion)} />
                      </td>
                      <td className="py-2.5 px-3 text-neutral-600">
                        {String(log.mensaje_detalle)}
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
      {/* TRAZABILIDAD Y SEGUIMIENTO PASO A PASO DE PAQUETES                    */}
      {/* ===================================================================== */}
      {subView === "TRAZABILIDAD" && (
        <div className="space-y-6">
          <div className="bg-white rounded border border-neutral-200 p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="border-l-4 border-conecta pl-3">
                <h2 className="text-base font-bold text-neutral-900">
                  Seguimiento y Trazabilidad de Paquetes
                </h2>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Consulte en qué etapa se encuentra cualquier paquete o solicitud y revise todos sus movimientos registrados.
                </p>
              </div>

              <div className="relative w-full md:w-96">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTrazabilidad}
                  onChange={(e) => setSearchTrazabilidad(e.target.value)}
                  placeholder="Buscar por código CE-..., guía Coordinadora o REC-..."
                  className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-300 rounded text-xs focus:outline-none focus:border-conecta"
                />
              </div>
            </div>

            {/* Barra de Progreso de las 6 Etapas del Paquete Consultado */}
            {paqueteEncontradoTrazabilidad && (
              <div className="p-4 bg-neutral-50 rounded border border-neutral-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-conecta" />
                    <span className="font-mono text-sm font-bold text-neutral-900">
                      {String(
                        paqueteEncontradoTrazabilidad.identificador_interno
                      )}
                    </span>
                    <span className="text-xs text-neutral-600">
                      • Cliente:{" "}
                      <strong>
                        {String(paqueteEncontradoTrazabilidad.cliente_nombre)}
                      </strong>
                    </span>
                  </div>
                  <div className="text-xs text-neutral-600 font-mono">
                    Guía:{" "}
                    <strong>
                      {String(
                        paqueteEncontradoTrazabilidad.guia_externa_principal ||
                        "Rótulo Interno CE"
                      )}
                    </strong>{" "}
                    • Destino:{" "}
                    <strong>
                      {String(
                        paqueteEncontradoTrazabilidad.destinatario_ciudad
                      )}
                    </strong>
                  </div>
                </div>
                <LogisticsFlowSteps
                  estado_recogida={String(
                    paqueteEncontradoTrazabilidad.estado_recogida || ""
                  )}
                  estado_bodega={String(
                    paqueteEncontradoTrazabilidad.estado_bodega || ""
                  )}
                  estado_despacho={String(
                    paqueteEncontradoTrazabilidad.estado_despacho || ""
                  )}
                />
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 uppercase">
                    <th className="py-3 px-3">Fecha y Hora</th>
                    <th className="py-3 px-3">Paquete / Solicitud</th>
                    <th className="py-3 px-3">Estado Actualizado</th>
                    <th className="py-3 px-3">Registrado Por</th>
                    <th className="py-3 px-3">Detalle del Movimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {eventos
                    .filter((ev) => {
                      if (!searchTrazabilidad.trim()) return true;
                      const q = searchTrazabilidad.toLowerCase();
                      return (
                        String(ev.identificador_interno || "")
                          .toLowerCase()
                          .includes(q) ||
                        String(ev.solicitud_consecutivo || "")
                          .toLowerCase()
                          .includes(q) ||
                        String(ev.guia_externa_principal || "")
                          .toLowerCase()
                          .includes(q) ||
                        String(ev.observaciones || "")
                          .toLowerCase()
                          .includes(q)
                      );
                    })
                    .map((ev) => (
                      <tr key={String(ev.id)} className="hover:bg-neutral-50">
                        <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                          {new Date(String(ev.created_at)).toLocaleString(
                            "es-CO"
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <div className="font-bold text-neutral-900">
                            {String(ev.identificador_interno || "SOLICITUD")}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {String(ev.solicitud_consecutivo || "")}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <StateBadge estado={String(ev.estado_nuevo)} />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-neutral-900">
                            {String(ev.usuario_nombre)}
                          </div>
                          <div className="text-[10px] text-neutral-500">
                            {formatReadableStatus(String(ev.origen_evento))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-700 max-w-md">
                          {String(ev.observaciones)}
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
      {/* GESTIÓN DE NOVEDADES E INCONVENIENTES                                 */}
      {/* ===================================================================== */}
      {subView === "NOVEDADES" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formulario Registrar Nueva Novedad */}
            <form
              onSubmit={handleCrearNovedad}
              className="bg-white rounded border border-neutral-200 p-5 space-y-3.5"
            >
              <div className="flex items-center gap-2 border-b border-neutral-200 pb-2.5">
                <AlertTriangle className="w-4 h-4 text-conecta" />
                <h2 className="text-sm font-bold text-neutral-900">
                  Reportar Nueva Novedad
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Motivo *
                  </label>
                  <select
                    value={formNovedad.tipoNovedad}
                    onChange={(e) =>
                      setFormNovedad({
                        ...formNovedad,
                        tipoNovedad: e.target.value,
                      })
                    }
                    className="w-full px-2 py-2 bg-white border border-neutral-300 rounded text-xs"
                  >
                    {TIPOS_NOVEDAD_CATALOGO.map((t) => (
                      <option key={t} value={t}>
                        {formatReadableStatus(t)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Prioridad *
                  </label>
                  <select
                    value={formNovedad.prioridad}
                    onChange={(e) =>
                      setFormNovedad({
                        ...formNovedad,
                        prioridad: e.target.value,
                      })
                    }
                    className="w-full px-2 py-2 bg-white border border-neutral-300 rounded text-xs font-bold"
                  >
                    <option value="CRITICA">Urgente / Crítica</option>
                    <option value="ALTA">Alta</option>
                    <option value="MEDIA">Media</option>
                    <option value="BAJA">Baja</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={formNovedad.solicitudId}
                  onChange={(e) =>
                    setFormNovedad({
                      ...formNovedad,
                      solicitudId: e.target.value,
                    })
                  }
                  className="px-2 py-2 bg-white border border-neutral-300 rounded text-xs"
                >
                  <option value="">-- Solicitud (Opcional) --</option>
                  {solicitudes.map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>
                      {String(s.consecutivo)}
                    </option>
                  ))}
                </select>

                <select
                  value={formNovedad.paqueteId}
                  onChange={(e) =>
                    setFormNovedad({
                      ...formNovedad,
                      paqueteId: e.target.value,
                    })
                  }
                  className="px-2 py-2 bg-white border border-neutral-300 rounded text-xs"
                >
                  <option value="">-- Paquete (Opcional) --</option>
                  {paquetes.map((p) => (
                    <option key={String(p.id)} value={String(p.id)}>
                      {String(p.identificador_interno)}
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={formNovedad.responsableAsignadoId}
                onChange={(e) =>
                  setFormNovedad({
                    ...formNovedad,
                    responsableAsignadoId: e.target.value,
                  })
                }
                className="w-full px-2.5 py-2 bg-white border border-neutral-300 rounded text-xs"
              >
                {responsablesInternos.map((r) => (
                  <option key={String(r.id)} value={String(r.id)}>
                    Responsable: {String(r.nombre_completo)} ({String(r.cargo)})
                  </option>
                ))}
              </select>

              <input
                type="text"
                required
                placeholder="Resumen corto del inconveniente *"
                value={formNovedad.titulo}
                onChange={(e) =>
                  setFormNovedad({ ...formNovedad, titulo: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded text-xs"
              />

              <textarea
                rows={3}
                required
                placeholder="Explique qué ocurrió con el paquete o la recogida *"
                value={formNovedad.descripcion}
                onChange={(e) =>
                  setFormNovedad({
                    ...formNovedad,
                    descripcion: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded text-xs"
              />

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-[#DE1025] hover:bg-[#B80D1F] text-white rounded text-xs font-bold transition-colors"
              >
                Guardar Novedad
              </button>
            </form>

            {/* Listado y Resolución de Novedades */}
            <div className="lg:col-span-2 bg-white rounded border border-neutral-200 p-5 space-y-4">
              <h3 className="text-sm font-bold text-neutral-900">
                Novedades Reportadas ({novedades.length})
              </h3>

              {novedadSeleccionada && (
                <form
                  onSubmit={handleGestionarNovedad}
                  className="p-4 bg-neutral-50 rounded border-2 border-conecta space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-900">
                      Dar Solución a la Novedad{" "}
                      <span className="text-conecta font-mono">
                        {String(novedadSeleccionada.consecutivo)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setNovedadSeleccionada(null)}
                      className="text-xs text-neutral-600 underline"
                    >
                      Cancelar
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <select
                      value={nuevoEstadoNovedad}
                      onChange={(e) => setNuevoEstadoNovedad(e.target.value)}
                      className="px-3 py-2 bg-white border border-neutral-300 rounded text-xs font-bold"
                    >
                      <option value="EN_GESTION">En Revisión</option>
                      <option value="PENDIENTE_CLIENTE">
                        Esperando Respuesta del Cliente
                      </option>
                      <option value="RESUELTA">
                        Resuelta (Continuar Proceso)
                      </option>
                      <option value="CERRADA">Cerrada Definitivamente</option>
                    </select>
                    <input
                      type="text"
                      required
                      placeholder="Escriba la solución o respuesta aplicada *"
                      value={comentarioResolucion}
                      onChange={(e) => setComentarioResolucion(e.target.value)}
                      className="md:col-span-2 px-3 py-2 bg-white border border-neutral-300 rounded text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-conecta text-white rounded text-xs font-bold"
                  >
                    Guardar Solución
                  </button>
                </form>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 uppercase">
                      <th className="py-2.5 px-3">Código / Motivo</th>
                      <th className="py-2.5 px-3">Solicitud / Paquete</th>
                      <th className="py-2.5 px-3">Descripción y Solución</th>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {novedades.map((n) => (
                      <tr key={String(n.id)}>
                        <td className="py-2.5 px-3">
                          <div className="font-mono font-bold text-neutral-900">
                            {String(n.consecutivo)}
                          </div>
                          <div className="text-[11px] font-semibold text-conecta">
                            {formatReadableStatus(String(n.tipo_novedad))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          <div>
                            Sol: {String(n.solicitud_consecutivo || "N/A")}
                          </div>
                          <div>
                            Paq: {String(n.paquete_identificador || "N/A")}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-neutral-900">
                            {String(n.titulo)}
                          </div>
                          <div className="text-neutral-600">
                            {String(n.descripcion)}
                          </div>
                          {Boolean(n.resolucion_final) && (
                            <div className="mt-1 text-neutral-900 font-semibold">
                              ✓ Solución: {String(n.resolucion_final)}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <StateBadge estado={String(n.estado_novedad)} />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setNovedadSeleccionada(n)}
                            className="px-3 py-1.5 bg-[#DE1025] hover:bg-[#B80D1F] text-white rounded text-xs font-bold transition-colors"
                          >
                            Resolver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DIRECTORIO DE CLIENTES                                                */}
      {/* ===================================================================== */}
      {subView === "CLIENTES" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleCrearCliente}
            className="bg-white rounded border border-neutral-200 p-5 space-y-3"
          >
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-2.5">
              <Building2 className="w-4 h-4 text-conecta" />
              <h2 className="text-sm font-bold text-neutral-900">
                Registrar Nuevo Cliente
              </h2>
            </div>

            <input
              type="text"
              required
              placeholder="Nombre de la Empresa *"
              value={formCliente.razonSocial}
              onChange={(e) =>
                setFormCliente({ ...formCliente, razonSocial: e.target.value })
              }
              className="w-full px-3 py-2 border border-neutral-300 rounded text-xs"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                required
                placeholder="NIT *"
                value={formCliente.nit}
                onChange={(e) =>
                  setFormCliente({ ...formCliente, nit: e.target.value })
                }
                className="col-span-2 px-3 py-2 border border-neutral-300 rounded text-xs"
              />
              <input
                type="text"
                placeholder="DV"
                value={formCliente.digitoVerificacion}
                onChange={(e) =>
                  setFormCliente({
                    ...formCliente,
                    digitoVerificacion: e.target.value,
                  })
                }
                className="px-3 py-2 border border-neutral-300 rounded text-xs"
              />
            </div>
            <input
              type="email"
              required
              placeholder="Correo Electrónico del Cliente *"
              value={formCliente.emailCorporativo}
              onChange={(e) =>
                setFormCliente({
                  ...formCliente,
                  emailCorporativo: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-neutral-300 rounded text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="Teléfono *"
                value={formCliente.telefonoPrincipal}
                onChange={(e) =>
                  setFormCliente({
                    ...formCliente,
                    telefonoPrincipal: e.target.value,
                  })
                }
                className="px-3 py-2 border border-neutral-300 rounded text-xs"
              />
              <input
                type="text"
                required
                placeholder="Ciudad *"
                value={formCliente.ciudadPrincipal}
                onChange={(e) =>
                  setFormCliente({
                    ...formCliente,
                    ciudadPrincipal: e.target.value,
                  })
                }
                className="px-3 py-2 border border-neutral-300 rounded text-xs"
              />
            </div>
            <input
              type="text"
              required
              placeholder="Dirección Principal de Recogida *"
              value={formCliente.direccionPrincipal}
              onChange={(e) =>
                setFormCliente({
                  ...formCliente,
                  direccionPrincipal: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-neutral-300 rounded text-xs"
            />
            <input
              type="text"
              placeholder="Persona de Contacto"
              value={formCliente.contactoNombre}
              onChange={(e) =>
                setFormCliente({
                  ...formCliente,
                  contactoNombre: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-neutral-300 rounded text-xs"
            />

            <label className="flex items-center gap-2 text-xs text-neutral-700 pt-1">
              <input
                type="checkbox"
                checked={formCliente.crearUsuarioPortal}
                onChange={(e) =>
                  setFormCliente({
                    ...formCliente,
                    crearUsuarioPortal: e.target.checked,
                  })
                }
                className="accent-conecta"
              />
              <span>
                Crear usuario de acceso al Portal de Clientes (Clave: Conecta2026*)
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-[#DE1025] hover:bg-[#B80D1F] text-white rounded text-xs font-bold transition-colors"
            >
              Guardar Cliente
            </button>
          </form>

          <div className="lg:col-span-2 bg-white rounded border border-neutral-200 p-5 space-y-4">
            <h3 className="text-sm font-bold text-neutral-900">
              Clientes Registrados ({clientes.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 uppercase">
                    <th className="py-2.5 px-3">Código / NIT</th>
                    <th className="py-2.5 px-3">Empresa y Contacto</th>
                    <th className="py-2.5 px-3">Dirección Principal</th>
                    <th className="py-2.5 px-3">Resumen Operativo</th>
                    <th className="py-2.5 px-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {clientes.map((c) => (
                    <tr key={String(c.id)}>
                      <td className="py-2.5 px-3 font-mono">
                        <div className="font-bold text-neutral-900">
                          {String(c.codigo_cliente)}
                        </div>
                        <div className="text-neutral-500">
                          NIT: {String(c.nit)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-neutral-900">
                          {String(c.razon_social)}
                        </div>
                        <div className="text-neutral-500">
                          {String(c.email_corporativo)} •{" "}
                          {String(c.telefono_principal)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-neutral-800">
                          {String(c.ciudad_principal)}
                        </div>
                        <div className="text-neutral-500">
                          {String(c.direccion_principal)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-xs">
                        <strong>{Number(c.total_solicitudes || 0)}</strong>{" "}
                        solicitudes •{" "}
                        <strong>{Number(c.total_paquetes || 0)}</strong> paquetes
                      </td>
                      <td className="py-2.5 px-3">
                        <StateBadge estado={String(c.estado)} />
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
      {/* REPORTES DESCARGABLES EN EXCEL Y PDF                                  */}
      {/* ===================================================================== */}
      {subView === "REPORTES" && (
        <div className="bg-white rounded border border-neutral-200 p-5 space-y-5">
          <div className="border-l-4 border-conecta pl-3">
            <h2 className="text-base font-bold text-neutral-900">
              Descargar Reportes en Excel y PDF
            </h2>
            <p className="text-xs text-neutral-600 mt-0.5">
              Seleccione el informe que necesita y descárguelo directamente en formato Excel (.xlsx) o PDF.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {catalogo13Reportes.map((rep) => (
              <div
                key={rep.id}
                className="p-4 bg-neutral-50 rounded border border-neutral-200 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold uppercase text-conecta">
                      {rep.id}
                    </span>
                    <span className="text-[11px] font-mono text-neutral-500">
                      {rep.datos.length} registros
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-neutral-900 mt-1">
                    {rep.nombre}
                  </h3>
                  <p className="text-[11px] text-neutral-600 mt-1">
                    {rep.descripcion}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-neutral-200">
                  <button
                    type="button"
                    onClick={() =>
                      exportarTablaExcel(
                        `${rep.id}_ConectaExpress`,
                        rep.id,
                        rep.datos.length > 0
                          ? rep.datos
                          : [{ Estado: "Sin registros en el filtro actual" }]
                      )
                    }
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-900 rounded text-xs font-bold"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-conecta" />
                    <span>Descargar Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const sample = rep.datos[0] || { Info: "Sin datos" };
                      const cols = Object.keys(sample);
                      const rows = rep.datos.map((r) =>
                        cols.map((k) =>
                          String((r as Record<string, unknown>)[k] ?? "")
                        )
                      );
                      exportarReportePDF({
                        tituloReporte: rep.nombre,
                        codigoReporte: rep.id,
                        columnas: cols,
                        filas: rows,
                      });
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 bg-[#DE1025] hover:bg-[#B80D1F] text-white rounded text-xs font-bold transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Descargar PDF</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* USUARIOS Y PERMISOS DE ACCESO                                         */}
      {/* ===================================================================== */}
      {subView === "USUARIOS" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form
              onSubmit={handleCrearUsuario}
              className="bg-white rounded border border-neutral-200 p-5 space-y-3"
            >
              <div className="flex items-center gap-2 border-b border-neutral-200 pb-2.5">
                <Users className="w-4 h-4 text-conecta" />
                <h2 className="text-sm font-bold text-neutral-900">
                  Crear Usuario del Sistema
                </h2>
              </div>

              <input
                type="text"
                required
                placeholder="Nombre Completo *"
                value={formUsuario.nombreCompleto}
                onChange={(e) =>
                  setFormUsuario({
                    ...formUsuario,
                    nombreCompleto: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded text-xs"
              />
              <input
                type="email"
                required
                placeholder="Correo Electrónico *"
                value={formUsuario.email}
                onChange={(e) =>
                  setFormUsuario({ ...formUsuario, email: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="password"
                  required
                  placeholder="Contraseña *"
                  value={formUsuario.password}
                  onChange={(e) =>
                    setFormUsuario({ ...formUsuario, password: e.target.value })
                  }
                  className="px-3 py-2 border border-neutral-300 rounded text-xs"
                />
                <input
                  type="text"
                  placeholder="Teléfono"
                  value={formUsuario.telefono}
                  onChange={(e) =>
                    setFormUsuario({ ...formUsuario, telefono: e.target.value })
                  }
                  className="px-3 py-2 border border-neutral-300 rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                  Perfil de Usuario *
                </label>
                <select
                  value={formUsuario.rolCodigo}
                  onChange={(e) =>
                    setFormUsuario({
                      ...formUsuario,
                      rolCodigo: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-neutral-300 rounded text-xs font-bold"
                >
                  {roles.map((r) => (
                    <option key={String(r.codigo)} value={String(r.codigo)}>
                      {String(r.nombre)}
                    </option>
                  ))}
                </select>
              </div>

              {formUsuario.rolCodigo === "CLIENTE" && (
                <div>
                  <label className="block text-[11px] font-bold text-conecta mb-1">
                    Empresa Cliente Asociada *
                  </label>
                  <select
                    value={formUsuario.clienteId}
                    onChange={(e) =>
                      setFormUsuario({
                        ...formUsuario,
                        clienteId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-conecta rounded text-xs"
                  >
                    {clientes.map((c) => (
                      <option key={String(c.id)} value={String(c.id)}>
                        {String(c.razon_social)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formUsuario.rolCodigo === "TRANSPORTADOR_EXTERNO" && (
                <div>
                  <label className="block text-[11px] font-bold text-conecta mb-1">
                    Transportador Asociado *
                  </label>
                  <select
                    value={formUsuario.transportadorId}
                    onChange={(e) =>
                      setFormUsuario({
                        ...formUsuario,
                        transportadorId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-conecta rounded text-xs"
                  >
                    {transportadores.map((t) => (
                      <option key={String(t.id)} value={String(t.id)}>
                        {String(t.razon_social)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-[#DE1025] hover:bg-[#B80D1F] text-white rounded text-xs font-bold transition-colors"
              >
                Guardar Usuario
              </button>
            </form>

            {/* Tabla de Usuarios */}
            <div className="lg:col-span-2 bg-white rounded border border-neutral-200 p-5 space-y-4">
              <h3 className="text-sm font-bold text-neutral-900">
                Usuarios Registrados ({usuarios.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 uppercase">
                      <th className="py-2.5 px-3">Nombre y Correo</th>
                      <th className="py-2.5 px-3">Perfil</th>
                      <th className="py-2.5 px-3">Empresa Asignada</th>
                      <th className="py-2.5 px-3">Permisos</th>
                      <th className="py-2.5 px-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {usuarios.map((u) => {
                      const perms =
                        matrizPermisos[String(u.rol_codigo)] || [];
                      return (
                        <tr key={String(u.id)}>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-neutral-900">
                              {String(u.nombre_completo)}
                            </div>
                            <div className="font-mono text-neutral-500">
                              {String(u.email)}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-bold">
                            {String(u.rol_nombre)}
                          </td>
                          <td className="py-2.5 px-3">
                            {u.cliente_nombre ? (
                              <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-300 rounded font-semibold">
                                Cliente: {String(u.cliente_nombre)}
                              </span>
                            ) : u.transportador_nombre ? (
                              <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-300 rounded font-semibold">
                                Transp.: {String(u.transportador_nombre)}
                              </span>
                            ) : (
                              <span className="text-neutral-500">
                                Personal Conecta Express
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            {perms.length} activos
                          </td>
                          <td className="py-2.5 px-3">
                            <StateBadge
                              estado={u.activo ? "ACTIVO" : "INACTIVO"}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Registro de Actividades */}
          <div className="bg-white rounded border border-neutral-200 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-conecta" />
              <h3 className="text-sm font-bold text-neutral-900">
                Historial de Acciones Administrativas ({auditoria.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 uppercase">
                    <th className="py-2 px-3">Fecha</th>
                    <th className="py-2 px-3">Acción Realizada</th>
                    <th className="py-2 px-3">Usuario</th>
                    <th className="py-2 px-3">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {auditoria.map((a) => (
                    <tr key={String(a.id)}>
                      <td className="py-2 px-3 font-mono text-[11px]">
                        {new Date(String(a.created_at)).toLocaleString("es-CO")}
                      </td>
                      <td className="py-2 px-3 font-bold">
                        {String(a.modulo)} — {String(a.accion)}
                      </td>
                      <td className="py-2 px-3">
                        {String(a.usuario_email)}
                      </td>
                      <td className="py-2 px-3 text-neutral-600">
                        {String(a.justificacion || "Operación estándar")}
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
      {/* AVISOS Y NOTIFICACIONES                                               */}
      {/* ===================================================================== */}
      {subView === "NOTIFICACIONES" && (
        <div className="bg-white rounded border border-neutral-200 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
            <div className="border-l-4 border-conecta pl-3">
              <h2 className="text-base font-bold text-neutral-900">
                Avisos y Notificaciones ({notificaciones.length})
              </h2>
              <p className="text-xs text-neutral-600">
                Alertas de nuevas solicitudes, recogidas completadas, ingresos a bodega, novedades y despachos.
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/trazabilidad", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "MARCAR_NOTIFICACION_LEIDA",
                    notificacionId: "TODAS",
                  }),
                });
                await onRefresh();
              }}
              className="px-3.5 py-2 bg-[#DE1025] hover:bg-[#B80D1F] text-white rounded text-xs font-bold transition-colors"
            >
              Marcar Todas como Leídas
            </button>
          </div>

          <div className="space-y-2.5">
            {notificaciones.map((n) => (
              <div
                key={String(n.id)}
                className={`p-3.5 rounded border text-xs flex items-center justify-between ${n.leida
                  ? "bg-neutral-50 border-neutral-200"
                  : "bg-white border-conecta"
                  }`}
              >
                <div className="flex items-start gap-3">
                  <Bell className="w-4 h-4 text-conecta shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-neutral-900">
                        {String(n.titulo)}
                      </span>
                      <StateBadge estado={String(n.tipo_notificacion)} />
                    </div>
                    <p className="text-neutral-700 mt-1">{String(n.mensaje)}</p>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-neutral-500">
                  {new Date(String(n.created_at)).toLocaleString("es-CO")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
