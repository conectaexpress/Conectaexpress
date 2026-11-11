"use client";

import React, { useState } from "react";
import {
  PlusCircle,
  Search,
  Truck,
  FileDown,
  CalendarClock,
  UserCheck,
  XCircle,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { StateBadge } from "@/components/ui/StateBadge";
import { LogisticsFlowSteps } from "@/components/ui/LogisticsFlowSteps";
import { descargarComprobanteSolicitudPDF } from "@/lib/pdf-excel-generator";

interface RecogidasTmsProps {
  subView: "RECOGIDAS" | "TRANSPORTADORES";
  solicitudes: Record<string, unknown>[];
  clientes: Record<string, unknown>[];
  transportadores: Record<string, unknown>[];
  conductores: Record<string, unknown>[];
  vehiculos: Record<string, unknown>[];
  asignaciones: Record<string, unknown>[];
  onRefresh: () => Promise<void>;
}

export function RecogidasTmsModule({
  subView,
  solicitudes,
  clientes,
  transportadores,
  conductores,
  vehiculos,
  onRefresh,
}: RecogidasTmsProps) {
  const [searchQ, setSearchQ] = useState("");
  const [filtroRapido, setFiltroRapido] = useState<
    "TODAS" | "SIN_ASIGNAR" | "EN_CURSO" | "COMPLETADAS"
  >("TODAS");
  const [showCrearModal, setShowCrearModal] = useState(false);
  const [solicitudParaAsignar, setSolicitudParaAsignar] = useState<Record<
    string,
    unknown
  > | null>(null);

  // Formulario Crear Solicitud desde Administración
  const [formAdminSol, setFormAdminSol] = useState({
    clienteId: clientes[0]?.id ? String(clientes[0].id) : "cli-corporativo-01",
    direccionTexto: "",
    ciudad: "Bogotá D.C.",
    zonaLogistica: "ZONA_INDUSTRIAL_OCCIDENTE",
    contactoNombre: "",
    contactoTelefono: "",
    fechaSolicitada: new Date().toISOString().slice(0, 10),
    fechaProgramada: new Date().toISOString().slice(0, 10),
    franjaHoraria: "08:00 - 12:00",
    cantidadEstimadaPaquetes: 3,
    tipoMercancia: "Cajas Selladas Mercancía Industrial",
    pesoEstimadoKg: 15,
    dimensionesEstimadas: "50x40x30 cm",
    prioridad: "ALTA",
    destinatarioNombre: "",
    destinatarioCiudad: "Medellín",
    destinatarioDireccion: "",
    guiaExternaInicial: "",
    observaciones: "",
  });

  // Formulario Asignar Transportador y Programar
  const [formAsignacion, setFormAsignacion] = useState({
    transportadorId: "trp-aliado-01",
    conductorId: "cnd-01",
    vehiculoId: "veh-01",
    fechaProgramada: new Date().toISOString().slice(0, 10),
    franjaHoraria: "08:00 - 12:00",
    prioridad: "ALTA",
  });

  // Formularios Transportador, Conductor y Vehículo
  const [formTransportador, setFormTransportador] = useState({
    razonSocial: "",
    nit: "",
    representanteLegal: "",
    telefonoOperaciones: "",
    emailOperaciones: "",
    direccion: "",
    ciudadBase: "Bogotá D.C.",
    zonasCobertura: "ZONA_NORTE,ZONA_OCCIDENTE,ZONA_CENTRO,SABANA",
    serviciosPrestados: "RECOGIDA_URBANA,TRASLADO_BODEGA",
    polizaResponsabilidad: "",
  });

  const [formConductor, setFormConductor] = useState({
    transportadorId: "trp-aliado-01",
    cedula: "",
    nombreCompleto: "",
    telefono: "",
    email: "",
    licenciaNumero: "",
    licenciaCategoria: "C2",
    arlEntidad: "ARL SURA",
    passwordPortalMovil: "Conecta2026*",
  });

  const [formVehiculo, setFormVehiculo] = useState({
    transportadorId: "trp-aliado-01",
    conductorHabitualId: "cnd-01",
    placa: "",
    tipoVehiculo: "FURGON_NHR",
    marcaModelo: "",
    capacidadKg: 2500,
    capacidadM3: 16,
    soatNumero: "",
    tecnomecanicaNumero: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "OK" | "ERROR"; text: string } | null>(
    null
  );

  async function handleCrearSolicitudAdmin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/recogidas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formAdminSol),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({
          type: "ERROR",
          text: data.message || "Error creando solicitud.",
        });
      } else {
        setMsg({
          type: "OK",
          text: `Solicitud ${data.consecutivo} registrada correctamente con ${
            (data.paquetesGenerados || []).length
          } paquetes.`,
        });
        setShowCrearModal(false);
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGuardarAsignacion(e: React.FormEvent) {
    e.preventDefault();
    if (!solicitudParaAsignar) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/recogidas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId: solicitudParaAsignar.id,
          operacion: "ASIGNAR_TRANSPORTADOR",
          ...formAsignacion,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({
          type: "ERROR",
          text: data.message || "Error asignando transportador.",
        });
      } else {
        setMsg({
          type: "OK",
          text: `Transportador y conductor asignados a la solicitud ${String(
            solicitudParaAsignar.consecutivo
          )}.`,
        });
        setSolicitudParaAsignar(null);
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelarSolicitud(solId: string, consecutivo: string) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/recogidas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId: solId,
          operacion: "CANCELAR",
          motivo: `Cancelada desde panel administrativo (${consecutivo})`,
        }),
      });
      if (res.ok) {
        setMsg({
          type: "OK",
          text: `Solicitud ${consecutivo} cancelada.`,
        });
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCrearTransportador(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/transportadores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREAR_TRANSPORTADOR",
          ...formTransportador,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({
          type: "ERROR",
          text: data.message || "Error registrando empresa transportadora.",
        });
      } else {
        setMsg({
          type: "OK",
          text: `Empresa transportadora ${data.codigoTransportador} guardada.`,
        });
        setFormTransportador({
          razonSocial: "",
          nit: "",
          representanteLegal: "",
          telefonoOperaciones: "",
          emailOperaciones: "",
          direccion: "",
          ciudadBase: "Bogotá D.C.",
          zonasCobertura: "ZONA_NORTE,ZONA_OCCIDENTE,ZONA_CENTRO,SABANA",
          serviciosPrestados: "RECOGIDA_URBANA,TRASLADO_BODEGA",
          polizaResponsabilidad: "",
        });
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCrearConductor(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/transportadores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREAR_CONDUCTOR",
          ...formConductor,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({
          type: "ERROR",
          text: data.message || "Error registrando conductor.",
        });
      } else {
        setMsg({
          type: "OK",
          text: "Conductor registrado con éxito.",
        });
        setFormConductor({
          ...formConductor,
          cedula: "",
          nombreCompleto: "",
          telefono: "",
          email: "",
          licenciaNumero: "",
        });
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCrearVehiculo(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/transportadores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREAR_VEHICULO",
          ...formVehiculo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({
          type: "ERROR",
          text: data.message || "Error registrando vehículo.",
        });
      } else {
        setMsg({
          type: "OK",
          text: `Vehículo placa ${formVehiculo.placa.toUpperCase()} guardado.`,
        });
        setFormVehiculo({
          ...formVehiculo,
          placa: "",
          marcaModelo: "",
          soatNumero: "",
          tecnomecanicaNumero: "",
        });
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const solicitudesFiltradas = solicitudes.filter((s) => {
    const est = String(s.estado_recogida || "");
    if (
      filtroRapido === "SIN_ASIGNAR" &&
      !["SOLICITADA", "EN_REVISION", "PROGRAMADA", "REPROGRAMADA"].includes(est)
    ) {
      return false;
    }
    if (
      filtroRapido === "EN_CURSO" &&
      !["ASIGNADA", "ACEPTADA", "EN_CAMINO", "EN_PUNTO_RECOGIDA"].includes(est)
    ) {
      return false;
    }
    if (
      filtroRapido === "COMPLETADAS" &&
      !["RECOGIDA_COMPLETADA", "RECOGIDA_PARCIAL"].includes(est)
    ) {
      return false;
    }

    if (!searchQ.trim()) return true;
    const q = searchQ.toLowerCase();
    return (
      String(s.consecutivo || "")
        .toLowerCase()
        .includes(q) ||
      String(s.cliente_nombre || "")
        .toLowerCase()
        .includes(q) ||
      String(s.direccion_texto || "")
        .toLowerCase()
        .includes(q) ||
      String(s.ciudad || "")
        .toLowerCase()
        .includes(q) ||
      String(s.transportador_nombre || "")
        .toLowerCase()
        .includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {msg && (
        <div
          className={`p-4 rounded-md border-l-4 bg-white flex items-center justify-between text-xs font-semibold shadow-sm ${
            msg.type === "OK"
              ? "border-[#DE1025] text-[#171717]"
              : "border-[#DE1025] text-[#DE1025]"
          }`}
        >
          <span>{msg.text}</span>
          <button
            type="button"
            onClick={() => setMsg(null)}
            className="underline ml-4 font-bold text-[#DE1025]"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VISTA 1: GESTIÓN Y PROGRAMACIÓN DE SOLICITUDES DE RECOGIDA            */}
      {/* ===================================================================== */}
      {subView === "RECOGIDAS" && (
        <div className="space-y-6">
          {/* Panel Claro para Programar y Asignar Transportador cuando el usuario hace clic en Asignar */}
          {solicitudParaAsignar && (
            <form
              onSubmit={handleGuardarAsignacion}
              className="p-5 bg-white rounded-lg border-2 border-[#DE1025] space-y-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E5E5] pb-3">
                <div>
                  <span className="text-xs font-bold uppercase text-[#DE1025]">
                    Programar Recogida y Asignar Transportador
                  </span>
                  <h3 className="text-base font-bold text-[#171717]">
                    Solicitud {String(solicitudParaAsignar.consecutivo)} —{" "}
                    {String(solicitudParaAsignar.cliente_nombre)}
                  </h3>
                  <p className="text-xs text-[#525252]">
                    Dirección: {String(solicitudParaAsignar.direccion_texto)} (
                    {String(solicitudParaAsignar.ciudad)})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSolicitudParaAsignar(null)}
                  className="px-3 py-1.5 bg-[#F5F5F5] hover:bg-[#E5E5E5] rounded text-xs font-semibold text-[#404040]"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-800 mb-1">
                    Empresa Transportadora *
                  </label>
                  <select
                    value={formAsignacion.transportadorId}
                    onChange={(e) =>
                      setFormAsignacion({
                        ...formAsignacion,
                        transportadorId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded text-xs"
                  >
                    {transportadores.map((t) => (
                      <option key={String(t.id)} value={String(t.id)}>
                        {String(t.razon_social)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-800 mb-1">
                    Conductor *
                  </label>
                  <select
                    value={formAsignacion.conductorId}
                    onChange={(e) =>
                      setFormAsignacion({
                        ...formAsignacion,
                        conductorId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded text-xs"
                  >
                    {conductores
                      .filter(
                        (c) =>
                          !formAsignacion.transportadorId ||
                          String(c.transportador_id) ===
                            formAsignacion.transportadorId
                      )
                      .map((c) => (
                        <option key={String(c.id)} value={String(c.id)}>
                          {String(c.nombre_completo)}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-800 mb-1">
                    Vehículo / Placa *
                  </label>
                  <select
                    value={formAsignacion.vehiculoId}
                    onChange={(e) =>
                      setFormAsignacion({
                        ...formAsignacion,
                        vehiculoId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded text-xs font-mono"
                  >
                    {vehiculos
                      .filter(
                        (v) =>
                          !formAsignacion.transportadorId ||
                          String(v.transportador_id) ===
                            formAsignacion.transportadorId
                      )
                      .map((v) => (
                        <option key={String(v.id)} value={String(v.id)}>
                          {String(v.placa)} — {String(v.tipo_vehiculo)}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-800 mb-1">
                    Fecha y Horario *
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="date"
                      value={formAsignacion.fechaProgramada}
                      onChange={(e) =>
                        setFormAsignacion({
                          ...formAsignacion,
                          fechaProgramada: e.target.value,
                        })
                      }
                      className="w-1/2 px-2 py-2 bg-white border border-neutral-300 rounded text-xs"
                    />
                    <select
                      value={formAsignacion.franjaHoraria}
                      onChange={(e) =>
                        setFormAsignacion({
                          ...formAsignacion,
                          franjaHoraria: e.target.value,
                        })
                      }
                      className="w-1/2 px-2 py-2 bg-white border border-neutral-300 rounded text-xs"
                    >
                      <option value="08:00 - 12:00">Mañana</option>
                      <option value="13:00 - 17:00">Tarde</option>
                      <option value="08:00 - 17:00">Todo el día</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 bg-[#DE1025] hover:bg-[#B80D1F] text-white rounded text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    Confirmar Asignación
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="bg-white rounded-2xl border border-[#E4E4E7] p-6 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F1F1F4] pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#DE1025]">
                  Operación de Primera Milla
                </span>
                <h2 className="text-base sm:text-lg font-bold text-[#18181B]">
                  Solicitudes de Recogida ({solicitudesFiltradas.length})
                </h2>
                <p className="text-xs text-[#71717A]">
                  Consulte las solicitudes de los clientes y asigne el transportador que irá a recoger la mercancía.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCrearModal(!showCrearModal)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#DE1025] hover:bg-[#B80D1F] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-[0_6px_16px_-4px_rgba(222,16,37,0.3)] cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>
                  {showCrearModal
                    ? "Cerrar Formulario"
                    : "Nueva Solicitud de Recogida"}
                </span>
              </button>
            </div>

            {/* Formulario Crear Solicitud desde Administración */}
            {showCrearModal && (
              <form
                onSubmit={handleCrearSolicitudAdmin}
                className="p-5 bg-neutral-50 rounded-lg border border-neutral-300 space-y-4"
              >
                <div className="text-sm font-bold text-neutral-900">
                  Registrar Nueva Solicitud de Recogida
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-800 mb-1">
                      Cliente *
                    </label>
                    <select
                      value={formAdminSol.clienteId}
                      onChange={(e) => {
                        const cli = clientes.find(
                          (c) => String(c.id) === e.target.value
                        );
                        setFormAdminSol({
                          ...formAdminSol,
                          clienteId: e.target.value,
                          direccionTexto: cli
                            ? String(cli.direccion_principal || "")
                            : formAdminSol.direccionTexto,
                          ciudad: cli
                            ? String(cli.ciudad_principal || "Bogotá D.C.")
                            : formAdminSol.ciudad,
                          contactoTelefono: cli
                            ? String(cli.telefono_principal || "")
                            : formAdminSol.contactoTelefono,
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-neutral-300 rounded text-xs"
                    >
                      {clientes.map((c) => (
                        <option key={String(c.id)} value={String(c.id)}>
                          {String(c.razon_social)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-neutral-800 mb-1">
                      Dirección de recogida *
                    </label>
                    <input
                      type="text"
                      required
                      value={formAdminSol.direccionTexto}
                      onChange={(e) =>
                        setFormAdminSol({
                          ...formAdminSol,
                          direccionTexto: e.target.value,
                        })
                      }
                      placeholder="Dirección completa donde se recoge"
                      className="w-full px-3 py-2 bg-white border border-neutral-300 rounded text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-800 mb-1">
                      Ciudad *
                    </label>
                    <input
                      type="text"
                      required
                      value={formAdminSol.ciudad}
                      onChange={(e) =>
                        setFormAdminSol({
                          ...formAdminSol,
                          ciudad: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-neutral-300 rounded text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-800 mb-1">
                      Nombre de contacto en sitio *
                    </label>
                    <input
                      type="text"
                      required
                      value={formAdminSol.contactoNombre}
                      onChange={(e) =>
                        setFormAdminSol({
                          ...formAdminSol,
                          contactoNombre: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-neutral-300 rounded text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-800 mb-1">
                      Teléfono de contacto *
                    </label>
                    <input
                      type="text"
                      required
                      value={formAdminSol.contactoTelefono}
                      onChange={(e) =>
                        setFormAdminSol({
                          ...formAdminSol,
                          contactoTelefono: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-neutral-300 rounded text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-800 mb-1">
                      Fecha y horario *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        required
                        value={formAdminSol.fechaProgramada}
                        onChange={(e) =>
                          setFormAdminSol({
                            ...formAdminSol,
                            fechaProgramada: e.target.value,
                          })
                        }
                        className="w-1/2 px-2 py-2 bg-white border border-neutral-300 rounded text-xs"
                      />
                      <select
                        value={formAdminSol.franjaHoraria}
                        onChange={(e) =>
                          setFormAdminSol({
                            ...formAdminSol,
                            franjaHoraria: e.target.value,
                          })
                        }
                        className="w-1/2 px-2 py-2 bg-white border border-neutral-300 rounded text-xs"
                      >
                        <option value="08:00 - 12:00">08:00 - 12:00</option>
                        <option value="13:00 - 17:00">13:00 - 17:00</option>
                        <option value="08:00 - 17:00">08:00 - 17:00</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-800 mb-1">
                      Cantidad de paquetes *
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={formAdminSol.cantidadEstimadaPaquetes}
                      onChange={(e) =>
                        setFormAdminSol({
                          ...formAdminSol,
                          cantidadEstimadaPaquetes: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-neutral-300 rounded text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-800 mb-1">
                      Mercancía y peso (kg) *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={formAdminSol.tipoMercancia}
                        onChange={(e) =>
                          setFormAdminSol({
                            ...formAdminSol,
                            tipoMercancia: e.target.value,
                          })
                        }
                        className="w-2/3 px-2 py-2 bg-white border border-neutral-300 rounded text-xs"
                      />
                      <input
                        type="number"
                        step="0.5"
                        required
                        value={formAdminSol.pesoEstimadoKg}
                        onChange={(e) =>
                          setFormAdminSol({
                            ...formAdminSol,
                            pesoEstimadoKg: Number(e.target.value),
                          })
                        }
                        className="w-1/3 px-2 py-2 bg-white border border-neutral-300 rounded text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCrearModal(false)}
                    className="px-4 py-2 bg-white border border-[#D4D4D4] rounded text-xs font-semibold text-[#404040]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-[#DE1025] hover:bg-[#B80D1F] text-white rounded text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    Guardar Solicitud
                  </button>
                </div>
              </form>
            )}

            {/* Filtros Rápidos en Lenguaje Claro + Buscador */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: "TODAS", label: "Todas las solicitudes" },
                  { id: "SIN_ASIGNAR", label: "Pendientes de asignar" },
                  { id: "EN_CURSO", label: "En recogida con conductor" },
                  { id: "COMPLETADAS", label: "Recogidas completadas" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() =>
                      setFiltroRapido(
                        f.id as
                          | "TODAS"
                          | "SIN_ASIGNAR"
                          | "EN_CURSO"
                          | "COMPLETADAS"
                      )
                    }
                    className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                      filtroRapido === f.id
                        ? "bg-[#DE1025] text-white"
                        : "bg-[#F5F5F5] text-[#404040] hover:bg-[#E5E5E5]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-[#A3A3A3] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Buscar por cliente, ciudad o número..."
                  className="w-full pl-9 pr-3 py-2 bg-[#FAFAFA] border border-[#D4D4D4] rounded text-xs focus:border-[#DE1025]"
                />
              </div>
            </div>

            {/* Tabla Simplificada de Solicitudes */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 font-semibold">
                    <th className="py-3 px-3">Nº Solicitud</th>
                    <th className="py-3 px-3">Cliente y Dirección</th>
                    <th className="py-3 px-3">Fecha y Paquetes</th>
                    <th className="py-3 px-3">Transportador Asignado</th>
                    <th className="py-3 px-3">Etapa del Proceso</th>
                    <th className="py-3 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {solicitudesFiltradas.map((sol) => (
                    <tr key={String(sol.id)} className="hover:bg-neutral-50">
                      <td className="py-3.5 px-3">
                        <div className="font-mono font-bold text-neutral-900">
                          {String(sol.consecutivo)}
                        </div>
                        <div className="mt-1">
                          <StateBadge
                            estado={String(sol.prioridad)}
                            dimension="PRIORIDAD"
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-neutral-900">
                          {String(sol.cliente_nombre)}
                        </div>
                        <div className="text-neutral-700">
                          {String(sol.direccion_texto)} ({String(sol.ciudad)})
                        </div>
                        <div className="text-neutral-500">
                          Contacto: {String(sol.contacto_nombre)} •{" "}
                          {String(sol.contacto_telefono)}
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-neutral-900">
                          {String(
                            sol.fecha_programada || sol.fecha_solicitada
                          ).slice(0, 10)}{" "}
                          ({String(sol.franja_horaria)})
                        </div>
                        <div className="text-neutral-600">
                          📦 {Number(sol.cantidad_estimada_paquetes)} paquetes (
                          {Number(sol.peso_estimado_kg)} kg)
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        {sol.transportador_nombre ? (
                          <div>
                            <div className="font-semibold text-neutral-900">
                              {String(sol.transportador_nombre)}
                            </div>
                            <div className="text-neutral-500">
                              {String(sol.conductor_nombre || "Conductor")}
                              {sol.vehiculo_placa
                                ? ` • Placa ${String(sol.vehiculo_placa)}`
                                : ""}
                            </div>
                          </div>
                        ) : (
                          <span className="text-conecta font-bold">
                            Pendiente de asignar
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        <LogisticsFlowSteps
                          estado_recogida={String(sol.estado_recogida)}
                          compact
                        />
                      </td>
                      <td className="py-3.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSolicitudParaAsignar(sol);
                            setFormAsignacion({
                              transportadorId: String(
                                sol.transportador_asignado_id || "trp-aliado-01"
                              ),
                              conductorId: String(
                                sol.conductor_asignado_id || "cnd-01"
                              ),
                              vehiculoId: String(
                                sol.vehiculo_asignado_id || "veh-01"
                              ),
                              fechaProgramada: String(
                                sol.fecha_programada || sol.fecha_solicitada
                              ).slice(0, 10),
                              franjaHoraria: String(
                                sol.franja_horaria || "08:00 - 12:00"
                              ),
                              prioridad: String(sol.prioridad || "ALTA"),
                            });
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#DE1025] hover:bg-[#B80D1F] text-white rounded text-xs font-bold transition-colors"
                        >
                          <CalendarClock className="w-3.5 h-3.5" />
                          <span>
                            {sol.transportador_nombre
                              ? "Cambiar Transportador"
                              : "Asignar Transportador"}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            descargarComprobanteSolicitudPDF(
                              sol as Parameters<
                                typeof descargarComprobanteSolicitudPDF
                              >[0]
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-[#F5F5F5] border border-[#D4D4D4] rounded text-xs font-semibold text-[#262626]"
                        >
                          <FileDown className="w-3.5 h-3.5 text-[#DE1025]" />
                          <span>PDF</span>
                        </button>

                        {sol.estado_recogida !== "RECOGIDA_COMPLETADA" &&
                          sol.estado_recogida !== "CANCELADA" && (
                            <button
                              type="button"
                              onClick={() =>
                                handleCancelarSolicitud(
                                  String(sol.id),
                                  String(sol.consecutivo)
                                )
                              }
                              className="inline-flex items-center p-1.5 bg-white border border-[#D4D4D4] hover:border-[#DE1025] text-[#737373] hover:text-[#DE1025] rounded"
                              title="Cancelar solicitud"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
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
      {/* VISTA 2: TRANSPORTADORES TERCEROS, CONDUCTORES Y VEHÍCULOS            */}
      {/* ===================================================================== */}
      {subView === "TRANSPORTADORES" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-neutral-200 p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Empresas Transportadoras Aliadas ({transportadores.length})
              </h2>
              <p className="text-xs text-neutral-500">
                Empresas externas contratadas por Conecta Express para realizar las recogidas de mercancía.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 font-semibold">
                    <th className="py-3 px-3">Empresa Transportadora</th>
                    <th className="py-3 px-3">Ciudad y Teléfono</th>
                    <th className="py-3 px-3">Conductores y Vehículos</th>
                    <th className="py-3 px-3">Póliza</th>
                    <th className="py-3 px-3">Recogidas Realizadas</th>
                    <th className="py-3 px-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {transportadores.map((t) => (
                    <tr key={String(t.id)} className="hover:bg-neutral-50">
                      <td className="py-3 px-3">
                        <div className="font-bold text-neutral-900">
                          {String(t.razon_social)}
                        </div>
                        <div className="text-neutral-500 font-mono">
                          NIT: {String(t.nit)}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-neutral-900">
                          {String(t.ciudad_base)}
                        </div>
                        <div className="text-neutral-500">
                          {String(t.telefono_operaciones)}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-semibold">
                        {Number(t.total_conductores || 0)} conductores •{" "}
                        {Number(t.total_vehiculos || 0)} vehículos
                      </td>
                      <td className="py-3 px-3">
                        <div className="inline-flex items-center gap-1 text-neutral-900 font-semibold">
                          <ShieldCheck className="w-3.5 h-3.5 text-conecta" />
                          <span>
                            {String(t.poliza_responsabilidad || "Vigente")}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-neutral-900">
                          {Number(t.recogidas_exitosas || 0)} completadas
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <StateBadge estado={String(t.estado)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 1. Registrar Empresa Transportadora */}
            <form
              onSubmit={handleCrearTransportador}
              className="bg-white rounded-lg border border-neutral-200 p-5 space-y-3"
            >
              <div className="flex items-center gap-2 border-b border-neutral-200 pb-2.5">
                <Building2 className="w-4 h-4 text-conecta" />
                <h3 className="text-sm font-bold text-neutral-900">
                  Agregar Empresa Transportadora
                </h3>
              </div>

              <input
                type="text"
                required
                placeholder="Nombre de la empresa *"
                value={formTransportador.razonSocial}
                onChange={(e) =>
                  setFormTransportador({
                    ...formTransportador,
                    razonSocial: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="NIT *"
                  value={formTransportador.nit}
                  onChange={(e) =>
                    setFormTransportador({
                      ...formTransportador,
                      nit: e.target.value,
                    })
                  }
                  className="px-3 py-2 border border-neutral-300 rounded text-xs"
                />
                <input
                  type="text"
                  required
                  placeholder="Teléfono *"
                  value={formTransportador.telefonoOperaciones}
                  onChange={(e) =>
                    setFormTransportador({
                      ...formTransportador,
                      telefonoOperaciones: e.target.value,
                    })
                  }
                  className="px-3 py-2 border border-neutral-300 rounded text-xs"
                />
              </div>
              <input
                type="email"
                required
                placeholder="Correo electrónico *"
                value={formTransportador.emailOperaciones}
                onChange={(e) =>
                  setFormTransportador({
                    ...formTransportador,
                    emailOperaciones: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded text-xs"
              />
              <input
                type="text"
                required
                placeholder="Dirección principal *"
                value={formTransportador.direccion}
                onChange={(e) =>
                  setFormTransportador({
                    ...formTransportador,
                    direccion: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded text-xs"
              />

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-[#DE1025] hover:bg-[#B80D1F] text-white rounded text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Guardar Transportadora
              </button>
            </form>

            {/* 2. Conductores */}
            <div className="bg-white rounded-lg border border-neutral-200 p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-neutral-200 pb-2.5">
                <UserCheck className="w-4 h-4 text-[#DE1025]" />
                <h3 className="text-sm font-bold text-[#171717]">
                  Conductores ({conductores.length})
                </h3>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {conductores.map((c) => (
                  <div
                    key={String(c.id)}
                    className="p-2.5 bg-neutral-50 rounded border border-neutral-200 text-xs"
                  >
                    <div className="font-bold text-neutral-900">
                      {String(c.nombre_completo)} (CC {String(c.cedula)})
                    </div>
                    <div className="text-neutral-600">
                      {String(c.transportador_nombre)} • Tel:{" "}
                      {String(c.telefono)}
                    </div>
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleCrearConductor}
                className="pt-2 border-t border-neutral-200 space-y-2"
              >
                <select
                  value={formConductor.transportadorId}
                  onChange={(e) =>
                    setFormConductor({
                      ...formConductor,
                      transportadorId: e.target.value,
                    })
                  }
                  className="w-full px-2.5 py-2 border border-neutral-300 rounded text-xs"
                >
                  {transportadores.map((t) => (
                    <option key={String(t.id)} value={String(t.id)}>
                      {String(t.razon_social)}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nombre del conductor *"
                    value={formConductor.nombreCompleto}
                    onChange={(e) =>
                      setFormConductor({
                        ...formConductor,
                        nombreCompleto: e.target.value,
                      })
                    }
                    className="px-2.5 py-2 border border-neutral-300 rounded text-xs"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Cédula *"
                    value={formConductor.cedula}
                    onChange={(e) =>
                      setFormConductor({
                        ...formConductor,
                        cedula: e.target.value,
                      })
                    }
                    className="px-2.5 py-2 border border-neutral-300 rounded text-xs"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Celular *"
                    value={formConductor.telefono}
                    onChange={(e) =>
                      setFormConductor({
                        ...formConductor,
                        telefono: e.target.value,
                      })
                    }
                    className="px-2.5 py-2 border border-neutral-300 rounded text-xs"
                  />
                  <input
                    type="email"
                    placeholder="Correo (App móvil)"
                    value={formConductor.email}
                    onChange={(e) =>
                      setFormConductor({
                        ...formConductor,
                        email: e.target.value,
                      })
                    }
                    className="px-2.5 py-2 border border-neutral-300 rounded text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-[#DE1025] hover:bg-[#B80D1F] text-white rounded text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Guardar Conductor
                </button>
              </form>
            </div>

            {/* 3. Vehículos */}
            <div className="bg-white rounded-lg border border-neutral-200 p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-neutral-200 pb-2.5">
                <Truck className="w-4 h-4 text-[#DE1025]" />
                <h3 className="text-sm font-bold text-[#171717]">
                  Vehículos ({vehiculos.length})
                </h3>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {vehiculos.map((v) => (
                  <div
                    key={String(v.id)}
                    className="p-2.5 bg-neutral-50 rounded border border-neutral-200 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-mono font-bold text-neutral-900">
                        Placa: {String(v.placa)}
                      </div>
                      <div className="text-neutral-600">
                        {String(v.marca_modelo)}
                      </div>
                    </div>
                    <StateBadge estado={String(v.estado)} />
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleCrearVehiculo}
                className="pt-2 border-t border-neutral-200 space-y-2"
              >
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Placa (Ej. KLM912) *"
                    value={formVehiculo.placa}
                    onChange={(e) =>
                      setFormVehiculo({
                        ...formVehiculo,
                        placa: e.target.value.toUpperCase(),
                      })
                    }
                    className="px-2.5 py-2 border border-neutral-300 rounded text-xs font-mono"
                  />
                  <select
                    value={formVehiculo.tipoVehiculo}
                    onChange={(e) =>
                      setFormVehiculo({
                        ...formVehiculo,
                        tipoVehiculo: e.target.value,
                      })
                    }
                    className="px-2.5 py-2 border border-neutral-300 rounded text-xs"
                  >
                    <option value="FURGON_NHR">Furgón NHR</option>
                    <option value="TURBO_NPR">Turbo NPR</option>
                    <option value="VAN_CARGA">Van de Carga</option>
                    <option value="CARRY">Carry</option>
                    <option value="MOTO">Moto</option>
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Marca y modelo *"
                    value={formVehiculo.marcaModelo}
                    onChange={(e) =>
                      setFormVehiculo({
                        ...formVehiculo,
                        marcaModelo: e.target.value,
                      })
                    }
                    className="col-span-2 px-2.5 py-2 border border-neutral-300 rounded text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-[#DE1025] hover:bg-[#B80D1F] text-white rounded text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Guardar Vehículo
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
