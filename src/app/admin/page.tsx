"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ScanBarcode,
  ClipboardList,
  Truck,
  Package,
  Plug,
  Clock,
  AlertTriangle,
  Building2,
  FileSpreadsheet,
  Users,
  Bell,
  LogOut,
  Search,
  RefreshCw,
  Smartphone,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { DashboardModule } from "@/components/admin/DashboardModule";
import { RecogidasTmsModule } from "@/components/admin/RecogidasTmsModule";
import { ScannerAndLabelsModule } from "@/components/admin/ScannerAndLabelsModule";
import { GovernanceAndBiModule } from "@/components/admin/GovernanceAndBiModule";

/**
 * Ícono vectorial oficial de Inicio (public/icono inicio.svg) con fill="currentColor"
 * para adaptarse automáticamente al color activo (blanco sobre #DE1025) e inactivo (#52525B) del menú.
 */
function IconoInicioConecta({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 375.65 197.31"
      fill="currentColor"
      className={className}
    >
      <path d="M324.73,145.13c-4.77,0-9.58,0.26-9.58,0.26c-4.48,0.24-8.1,0.61-9.32,0.75c-8.37,0.98-11.71,4.12-20.62,7.19c-7.21,2.48-12.73,3.1-23.44,4.25c-6.12,0.66-12.44,1-18.9,1c-23.16,0-44.52-2.96-61.68-10.42l-79.36-1.46c1.75,1.94,3.69,4.45,5.64,6.31c25.25,24.01,67.16,40.7,115.59,43.78c5.34,0.33,10.77,0.51,16.26,0.51c43.04,0,82.18-11.07,110.64-28.57c8.35-5.11,15.79-10.79,22.13-16.95C357.92,147.53,341.81,145.13,324.73,145.13z" />
      <path d="M130.82,142.39c10.44,0.61,21.26,1.04,32.37,1.28c7.28,0.22,14.17,0.28,20.62,0.22c22.68,0,44.41-0.79,64.54-2.25c8.62-0.62,16.95-1.37,24.93-2.22c2.66-0.29,5.28-0.58,7.86-0.89c2.58-0.31,5.12-0.63,7.62-0.96s4.95-0.68,7.36-1.03c2.41-0.36,4.77-0.72,7.09-1.1c3.48-0.57,6.85-1.16,10.11-1.77c2.17-0.41,4.3-0.83,6.37-1.26c1.04-0.21,2.06-0.43,3.07-0.65c3.03-0.66,5.94-1.34,8.73-2.04c1.86-0.47,3.66-0.94,5.4-1.43c2.62-0.73,5.1-1.47,7.46-2.24c0.78-0.25,1.55-0.51,2.31-0.77c6.78-2.33,12.32-4.81,16.43-7.43c1.37-0.87,2.58-1.75,3.63-2.65c0.7-0.6,1.32-1.2,1.87-1.81c1.93-2.13,2.93-4.32,2.93-6.56c0-14.37-41.44-26.83-102.01-32.97c-1.36-0.26-2.24-0.37-2.28-0.23c-0.31,1.09,51.47,10.35,51.47,19.96c0,1-0.33,1.99-0.97,2.97c-0.32,0.49-0.72,0.97-1.19,1.45c-0.24,0.24-0.49,0.48-0.77,0.72c-1.38,1.19-3.22,2.36-5.51,3.49c-1.83,0.91-3.94,1.8-6.31,2.67c-28.49,10.41-95.2,17.72-172.94,17.72c-33.44,0-64.84-1.35-92.04-3.72c-1.29-0.11-2.58-0.23-3.86-0.35c-12.76-1.17-24.54-2.58-35.1-4.17v0c1.65,1.58,3.81,3.12,6.45,4.62c0.44,0.25,0.89,0.5,1.36,0.75c0.93,0.49,1.91,0.98,2.95,1.47c1.55,0.73,3.22,1.44,4.99,2.15c1.18,0.47,2.41,0.93,3.69,1.39c5.76,2.06,12.47,3.99,20.03,5.79c1.68,0.4,3.4,0.79,5.16,1.17c0.88,0.19,1.77,0.38,2.67,0.57c3.6,0.75,7.36,1.48,11.27,2.17c1.95,0.35,3.94,0.68,5.97,1.01c2.03,0.33,4.09,0.65,6.19,0.96c2.1,0.31,4.23,0.62,6.39,0.91c2.16,0.3,4.36,0.58,6.59,0.86c2.23,0.28,4.49,0.55,6.78,0.81c2.29,0.26,4.61,0.51,6.96,0.75c8.23,0.84,16.81,1.57,25.69,2.17C125.68,142.08,128.24,142.24,130.82,142.39z M275.55,75.14c-0.55-0.12-1.1-0.24-1.63-0.36c8.26,1.5,15.56,3.13,21.74,4.87C290.77,78.53,284.19,77.06,275.55,75.14z" />
      <path d="M84.9,116.97h0.01h60.84h0.01c-0.3-0.49-0.58-0.99-0.86-1.48c-0.38-0.68-0.74-1.36-1.09-2.04c-0.43-0.86-0.82-1.72-1.18-2.6c-1.81-4.38-2.79-8.94-2.79-13.63c0-3.56,0.55-7.04,1.6-10.43c0.15-0.48,0.31-0.97,0.48-1.44c0.34-0.96,0.72-1.91,1.14-2.85c0.21-0.47,0.43-0.94,0.66-1.41c1.15-2.33,2.54-4.6,4.16-6.8c0.65-0.88,1.33-1.75,2.05-2.61c0.72-0.86,1.47-1.71,2.26-2.54c1.58-1.67,3.29-3.29,5.13-4.86c1.84-1.57,3.81-3.08,5.9-4.54c18.79-13.1,47.23-21.44,79.07-21.44c7.47,0,14.75,0.45,21.77,1.34c1.23,0.06,2.4,0.15,3.55,0.26c4.06,0.38,7.61,1.03,10.62,1.77c0.77,0.19,1.51,0.39,2.22,0.59c1.41,0.4,2.68,0.81,3.81,1.2c0.43,0.15,0.85,0.3,1.25,0.45c1.21,0.45,2.32,0.9,3.36,1.33c0.52,0.22,1.03,0.43,1.54,0.64c2.52,1.06,4.87,2.03,7.91,2.8c1.22,0.31,2.54,0.58,4.03,0.81c0.47,0.07,0.91,0.14,1.36,0.19c0.03,0,0.06,0.01,0.08,0.01c0.3,0.04,0.6,0.07,0.92,0.11c1.1,0.13,2.21,0.24,3.29,0.33c3.61,0.34,9.09,0.72,16.03,0.7c0.04,0,0.08,0,0.12,0c0.02,0,0.04,0,0.05,0c0.34,0,0.67,0,1.01,0c6.92-0.07,19.42-0.27,35.08-3.73c4.47-0.99,8.09-2,10.46-2.7C342.78,17.67,294.15,0,238.84,0c-5.42,0-10.77,0.17-16.04,0.5C143.52,5.48,81.66,46.87,81.66,97.22c0,6.77,1.13,13.37,3.25,19.74L84.9,116.97z" />
    </svg>
  );
}

export type AdminModuleKey =
  | "DASHBOARD"
  | "ESCANER"
  | "RECOGIDAS"
  | "TRANSPORTADORES"
  | "PAQUETES"
  | "INTEGRACIONES"
  | "TRAZABILIDAD"
  | "NOVEDADES"
  | "CLIENTES"
  | "REPORTES"
  | "USUARIOS"
  | "NOTIFICACIONES";

export default function AdminPanelPage() {
  const router = useRouter();
  const [activeModule, setActiveModule] = useState<AdminModuleKey>("DASHBOARD");
  const [loading, setLoading] = useState(true);
  const [globalSearch, setGlobalSearch] = useState("");

  const [user, setUser] = useState<{
    userId: string;
    nombre: string;
    email: string;
    rolCodigo: string;
    rolNombre: string;
    permisos: string[];
  } | null>(null);

  // Datos sincronizados desde PostgreSQL
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [graficos, setGraficos] = useState<{
    porFecha: Record<string, unknown>[];
    porCliente: Record<string, unknown>[];
    porCiudad: Record<string, unknown>[];
    porTransportador: Record<string, unknown>[];
    porServicio: Record<string, unknown>[];
  }>({
    porFecha: [],
    porCliente: [],
    porCiudad: [],
    porTransportador: [],
    porServicio: [],
  });
  const [ultimosEventos, setUltimosEventos] = useState<
    Record<string, unknown>[]
  >([]);

  const [solicitudes, setSolicitudes] = useState<Record<string, unknown>[]>([]);
  const [clientes, setClientes] = useState<Record<string, unknown>[]>([]);
  const [direcciones, setDirecciones] = useState<Record<string, unknown>[]>([]);
  const [contactos, setContactos] = useState<Record<string, unknown>[]>([]);

  const [transportadores, setTransportadores] = useState<
    Record<string, unknown>[]
  >([]);
  const [conductores, setConductores] = useState<Record<string, unknown>[]>([]);
  const [vehiculos, setVehiculos] = useState<Record<string, unknown>[]>([]);
  const [asignaciones, setAsignaciones] = useState<Record<string, unknown>[]>(
    []
  );

  const [paquetes, setPaquetes] = useState<Record<string, unknown>[]>([]);
  const [guiasExternas, setGuiasExternas] = useState<Record<string, unknown>[]>(
    []
  );

  const [despachos, setDespachos] = useState<Record<string, unknown>[]>([]);
  const [movimientos, setMovimientos] = useState<Record<string, unknown>[]>([]);

  const [integraciones, setIntegraciones] = useState<Record<string, unknown>[]>(
    []
  );
  const [registrosSincronizacion, setRegistrosSincronizacion] = useState<
    Record<string, unknown>[]
  >([]);
  const [estadoVariablesEntorno, setEstadoVariablesEntorno] = useState<
    Record<string, unknown>
  >({});

  const [eventos, setEventos] = useState<Record<string, unknown>[]>([]);
  const [novedades, setNovedades] = useState<Record<string, unknown>[]>([]);
  const [notificaciones, setNotificaciones] = useState<
    Record<string, unknown>[]
  >([]);
  const [responsablesInternos, setResponsablesInternos] = useState<
    Record<string, unknown>[]
  >([]);

  const [usuarios, setUsuarios] = useState<Record<string, unknown>[]>([]);
  const [roles, setRoles] = useState<Record<string, unknown>[]>([]);
  const [matrizPermisos, setMatrizPermisos] = useState<
    Record<string, string[]>
  >({});
  const [auditoria, setAuditoria] = useState<Record<string, unknown>[]>([]);

  const cargarPlataforma = useCallback(async () => {
    setLoading(true);
    try {
      const sesRes = await fetch("/api/auth/session");
      const sesData = await sesRes.json();
      if (!sesData.authenticated || !sesData.user) {
        router.push("/login");
        return;
      }
      if (sesData.user.rolCodigo === "CLIENTE") {
        router.push("/portal-cliente");
        return;
      }
      if (sesData.user.rolCodigo === "TRANSPORTADOR_EXTERNO") {
        router.push("/transportador");
        return;
      }
      setUser(sesData.user);
      if (sesData.user.rolCodigo === "OPERARIO_BODEGA") {
        setActiveModule((prev) => (prev === "DASHBOARD" ? "ESCANER" : prev));
      }

      const [
        dashRes,
        recRes,
        cliRes,
        trpRes,
        pkgRes,
        bodRes,
        dspRes,
        intRes,
        trzRes,
        usrRes,
      ] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/recogidas"),
        fetch("/api/clientes"),
        fetch("/api/transportadores"),
        fetch("/api/paquetes"),
        fetch("/api/bodega"),
        fetch("/api/despachos"),
        fetch("/api/integraciones"),
        fetch("/api/trazabilidad"),
        fetch("/api/usuarios"),
      ]);

      if (dashRes.ok) {
        const d = await dashRes.json();
        setKpis(d.kpis || {});
        setGraficos(
          d.graficos || {
            porFecha: [],
            porCliente: [],
            porCiudad: [],
            porTransportador: [],
            porServicio: [],
          }
        );
        setUltimosEventos(d.ultimosEventos || []);
      }

      if (recRes.ok) {
        const r = await recRes.json();
        setSolicitudes(r.solicitudes || []);
      }

      if (cliRes.ok) {
        const c = await cliRes.json();
        setClientes(c.clientes || []);
        setDirecciones(c.direcciones || []);
        setContactos(c.contactos || []);
      }

      if (trpRes.ok) {
        const t = await trpRes.json();
        setTransportadores(t.transportadores || []);
        setConductores(t.conductores || []);
        setVehiculos(t.vehiculos || []);
        setAsignaciones(t.asignaciones || []);
      }

      if (pkgRes.ok) {
        const p = await pkgRes.json();
        setPaquetes(p.paquetes || []);
        setGuiasExternas(p.guiasExternas || []);
      }

      if (bodRes.ok) {
        const b = await bodRes.json();
        setMovimientos(b.movimientos || []);
      }

      if (dspRes.ok) {
        const dp = await dspRes.json();
        setDespachos(dp.despachos || []);
      }

      if (intRes.ok) {
        const i = await intRes.json();
        setIntegraciones(i.integraciones || []);
        setRegistrosSincronizacion(i.registrosSincronizacion || []);
        setEstadoVariablesEntorno(i.estadoVariablesEntorno || {});
      }

      if (trzRes.ok) {
        const tr = await trzRes.json();
        setEventos(tr.eventos || []);
        setNovedades(tr.novedades || []);
        setNotificaciones(tr.notificaciones || []);
        setResponsablesInternos(tr.responsablesInternos || []);
      }

      if (usrRes.ok) {
        const u = await usrRes.json();
        setUsuarios(u.usuarios || []);
        setRoles(u.roles || []);
        setMatrizPermisos(u.matrizPermisos || {});
        setAuditoria(u.auditoria || []);
      }
    } catch (error) {
      console.error("Error cargando Panel Administrativo:", error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    cargarPlataforma();
  }, [cargarPlataforma]);

  function handleGlobalSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = globalSearch.trim().toUpperCase();
    if (!q) return;
    if (q.startsWith("REC-")) {
      setActiveModule("RECOGIDAS");
    } else if (q.startsWith("NOV-")) {
      setActiveModule("NOVEDADES");
    } else if (q.startsWith("CE-") || /^\d+$/.test(q)) {
      setActiveModule("PAQUETES");
    } else {
      setActiveModule("TRAZABILIDAD");
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const notificacionesNoLeidas = notificaciones.filter((n) => !n.leida).length;
  const solicitudesPendientesCount = solicitudes.filter(
    (s) =>
      s.estado_recogida === "SOLICITADA" || s.estado_recogida === "PROGRAMADA"
  ).length;

  // Menú Principal Simplificado sin Numeración Decorativa ni Módulos de Bodega/Inventario
  const mainFlowSections: Array<{
    key: string;
    label: string;
    subtitle: string;
    defaultModule: AdminModuleKey;
    includedModules: AdminModuleKey[];
    icon: React.ComponentType<{ className?: string }>;
    badgeCount?: number;
    subTabs?: Array<{
      id: AdminModuleKey;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
    }>;
  }> = [
    {
      key: "INICIO",
      label: "Inicio",
      subtitle: "Tareas y resumen del día",
      defaultModule: "DASHBOARD",
      includedModules: ["DASHBOARD"],
      icon: IconoInicioConecta,
    },
    {
      key: "SOLICITUDES_RECOGIDAS",
      label: "Solicitudes y Recogidas",
      subtitle: "Programar y asignar conductor",
      defaultModule: "RECOGIDAS",
      includedModules: ["RECOGIDAS", "TRANSPORTADORES"],
      icon: ClipboardList,
      badgeCount: solicitudesPendientesCount,
      subTabs: [
        {
          id: "RECOGIDAS",
          label: "Solicitudes de Recogida",
          icon: ClipboardList,
        },
        {
          id: "TRANSPORTADORES",
          label: "Transportadores y Conductores",
          icon: Truck,
        },
      ],
    },
    {
      key: "PAQUETES_GUIAS",
      label: "Paquetes y Guías",
      subtitle: "Medidas, rótulos CE y Coordinadora",
      defaultModule: "PAQUETES",
      includedModules: ["PAQUETES", "INTEGRACIONES"],
      icon: Package,
      badgeCount: paquetes.length,
      subTabs: [
        {
          id: "PAQUETES",
          label: "Paquetes, Medidas y Rótulos",
          icon: Package,
        },
        {
          id: "INTEGRACIONES",
          label: "Importar Guías de Coordinadora / Excel",
          icon: Plug,
        },
      ],
    },
    {
      key: "ESCANER_PAQUETES",
      label: "Escáner de Paquetes",
      subtitle: "Escaneo, medidas y eventos",
      defaultModule: "ESCANER",
      includedModules: ["ESCANER"],
      icon: ScanBarcode,
    },
    {
      key: "TRAZABILIDAD_NOVEDADES",
      label: "Trazabilidad y Novedades",
      subtitle: "Seguimiento, clientes y reportes",
      defaultModule: "TRAZABILIDAD",
      includedModules: [
        "TRAZABILIDAD",
        "NOVEDADES",
        "REPORTES",
        "CLIENTES",
        "USUARIOS",
        "NOTIFICACIONES",
      ],
      icon: Clock,
      badgeCount: kpis.novedadesAbiertas || 0,
      subTabs: [
        {
          id: "TRAZABILIDAD",
          label: "Seguimiento de Paquetes",
          icon: Clock,
        },
        {
          id: "NOVEDADES",
          label: "Novedades Reportadas",
          icon: AlertTriangle,
        },
        {
          id: "REPORTES",
          label: "Descargar Reportes",
          icon: FileSpreadsheet,
        },
        {
          id: "CLIENTES",
          label: "Clientes",
          icon: Building2,
        },
        {
          id: "USUARIOS",
          label: "Usuarios",
          icon: Users,
        },
        {
          id: "NOTIFICACIONES",
          label: "Avisos",
          icon: Bell,
        },
      ],
    },
  ];

  const currentSection =
    mainFlowSections.find((s) => s.includedModules.includes(activeModule)) ||
    mainFlowSections[0];

  return (
    <div className="min-h-screen bg-[#F4F4F6] flex flex-col lg:flex-row">
      {/* Menú Lateral Corporativo con Logotipo Oficial (.SVG) */}
      <aside className="w-full lg:w-72 bg-white text-[#18181B] flex flex-col justify-between shrink-0 border-b lg:border-b-0 lg:border-r border-[#E4E4E7] shadow-[2px_0_16px_rgba(0,0,0,0.02)]">
        <div>
          {/* Cabecera Institucional con Logotipo Oficial .SVG Limpio */}
          <div className="bg-gradient-to-r from-[#DE1025] via-[#C90E22] to-[#A80C1C] px-5 py-5 border-b border-[#B80D1F] flex items-center">
            <img
              src="/logo-conecta.svg"
              alt="Conecta Express - Recogidas"
              width={240}
              height={35}
              className="h-8 w-auto object-contain select-none"
            />
          </div>

          {/* Botón Rápido Destacado: Escáner de Paquetes */}
          <div className="px-4 pt-4 pb-2">
            <button
              type="button"
              onClick={() => setActiveModule("ESCANER")}
              className={`w-full py-2.5 px-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs ${
                activeModule === "ESCANER"
                  ? "bg-[#9E0B1A] text-white ring-3 ring-[#DE1025]/25"
                  : "bg-[#DE1025] hover:bg-[#B80D1F] text-white shadow-[0_6px_16px_-4px_rgba(222,16,37,0.3)]"
              }`}
            >
              <ScanBarcode className="w-4 h-4" />
              <span>Abrir Escáner de Paquetes</span>
            </button>
          </div>

          {/* Navegación Principal */}
          <nav className="p-3.5 space-y-1.5">
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[#71717A]">
              Módulos Operativos
            </div>
            {mainFlowSections.map((section) => {
              const Icon = section.icon;
              const isSectionActive =
                section.includedModules.includes(activeModule);
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveModule(section.defaultModule)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    isSectionActive
                      ? "bg-[#FFF1F2] text-[#DE1025] border border-[#FCD4D8] shadow-2xs font-bold"
                      : "text-[#3F3F46] hover:bg-[#F8F8FA] border border-transparent font-medium"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isSectionActive
                          ? "bg-[#DE1025] text-white shadow-2xs"
                          : "bg-[#F4F4F6] text-[#52525B]"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div
                        className={`text-xs truncate ${
                          isSectionActive ? "text-[#18181B]" : "text-[#27272A]"
                        }`}
                      >
                        {section.label}
                      </div>
                      <div className="text-[10px] text-[#71717A] font-normal truncate">
                        {section.subtitle}
                      </div>
                    </div>
                  </div>
                  {typeof section.badgeCount === "number" &&
                    section.badgeCount > 0 && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          isSectionActive
                            ? "bg-[#DE1025] text-white"
                            : "bg-[#F4F4F6] text-[#3F3F46] border border-[#E4E4E7]"
                        }`}
                      >
                        {section.badgeCount}
                      </span>
                    )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Pie del Menú: Accesos Rápidos de Entorno y Cerrar Sesión */}
        <div className="p-4 border-t border-[#E4E4E7] space-y-2.5 bg-[#FAFAFB]">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#71717A]">
            Cambiar de Vista
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => router.push("/portal-cliente")}
              className="py-2 px-2.5 bg-white hover:bg-[#FFF1F2] hover:border-[#FCD4D8] border border-[#E4E4E7] text-[#3F3F46] rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#DE1025]" />
              <span>Vista Cliente</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/transportador")}
              className="py-2 px-2.5 bg-white hover:bg-[#FFF1F2] hover:border-[#FCD4D8] border border-[#E4E4E7] text-[#3F3F46] rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-[#DE1025]" />
              <span>Vista Conductor</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-2.5 px-3 bg-white hover:bg-[#FFF1F2] hover:border-[#FCD4D8] border border-[#E4E4E7] text-[#18181B] rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-[#DE1025]" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Contenedor Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Encabezado Superior Corporativo */}
        <header className="bg-white border-b border-[#E4E4E7] px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-10 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-4 flex-1 min-w-[260px]">
            <div className="hidden xl:flex flex-col pr-4 border-r border-[#E4E4E7]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#DE1025]">
                Sección Activa
              </span>
              <span className="text-sm font-bold text-[#18181B]">
                {currentSection.label}
              </span>
            </div>

            <form
              onSubmit={handleGlobalSearchSubmit}
              className="relative flex-1 max-w-xl"
            >
              <Search className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Buscar paquete (CE-...), guía Coordinadora o solicitud (REC-...)..."
                className="w-full pl-10 pr-4 py-2 bg-[#F4F4F6] border border-[#E4E4E7] rounded-xl text-xs text-[#18181B] placeholder:text-[#71717A] focus:outline-none focus:bg-white focus:border-[#DE1025]"
              />
            </form>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={cargarPlataforma}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#F8F8FA] hover:bg-[#FFF1F2] hover:border-[#FCD4D8] border border-[#E4E4E7] rounded-xl text-xs font-semibold text-[#27272A] transition-colors cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#DE1025] ${
                  loading ? "animate-spin" : ""
                }`}
              />
              <span>Actualizar</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModule("NOTIFICACIONES")}
              className="relative p-2 bg-[#F8F8FA] hover:bg-[#FFF1F2] hover:border-[#FCD4D8] border border-[#E4E4E7] rounded-xl text-[#27272A] transition-colors cursor-pointer"
              title="Ver Avisos y Notificaciones"
            >
              <Bell className="w-4 h-4" />
              {notificacionesNoLeidas > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#DE1025] text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                  {notificacionesNoLeidas}
                </span>
              )}
            </button>

            <div className="pl-3 border-l border-[#E4E4E7] flex items-center gap-2.5 hidden sm:flex">
              <div className="w-8 h-8 rounded-lg bg-[#FFF1F2] border border-[#FCD4D8] flex items-center justify-center text-[#DE1025] shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-[#18181B] leading-tight">
                  {user?.nombre || "Operador Conecta Express"}
                </div>
                <div className="text-[11px] text-[#71717A]">
                  {user?.rolNombre || "Administrador"}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Sub-Pestañas Contextuales con Diseño Moderno */}
        {currentSection.subTabs && currentSection.subTabs.length > 1 && (
          <div className="bg-white border-b border-[#E4E4E7] px-6 py-2.5 flex flex-wrap items-center gap-2">
            {currentSection.subTabs.map((tab) => {
              const TabIcon = tab.icon;
              const isTabActive = activeModule === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveModule(tab.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isTabActive
                      ? "bg-[#DE1025] text-white shadow-xs"
                      : "bg-[#F4F4F6] text-[#3F3F46] hover:bg-[#FFF1F2] hover:text-[#DE1025]"
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Área Principal de Trabajo */}
        <main className="p-6 flex-1 overflow-y-auto max-w-7xl w-full mx-auto">
          {activeModule === "DASHBOARD" && (
            <DashboardModule
              kpis={kpis}
              graficos={graficos}
              ultimosEventos={ultimosEventos}
              solicitudes={solicitudes}
              paquetes={paquetes}
              onNavigate={(mod) => setActiveModule(mod as AdminModuleKey)}
            />
          )}

          {(activeModule === "RECOGIDAS" ||
            activeModule === "TRANSPORTADORES") && (
            <RecogidasTmsModule
              subView={activeModule}
              solicitudes={solicitudes}
              clientes={clientes}
              transportadores={transportadores}
              conductores={conductores}
              vehiculos={vehiculos}
              asignaciones={asignaciones}
              onRefresh={cargarPlataforma}
            />
          )}

          {(activeModule === "ESCANER" || activeModule === "PAQUETES") && (
            <ScannerAndLabelsModule
              subView={activeModule}
              paquetes={paquetes}
              guiasExternas={guiasExternas}
              clientes={clientes}
              solicitudes={solicitudes}
              onRefresh={cargarPlataforma}
            />
          )}

          {(activeModule === "INTEGRACIONES" ||
            activeModule === "TRAZABILIDAD" ||
            activeModule === "NOVEDADES" ||
            activeModule === "CLIENTES" ||
            activeModule === "REPORTES" ||
            activeModule === "USUARIOS" ||
            activeModule === "NOTIFICACIONES") && (
            <GovernanceAndBiModule
              subView={activeModule}
              integraciones={integraciones}
              registrosSincronizacion={registrosSincronizacion}
              estadoVariablesEntorno={estadoVariablesEntorno}
              eventos={eventos}
              novedades={novedades}
              notificaciones={notificaciones}
              responsablesInternos={responsablesInternos}
              clientes={clientes}
              direcciones={direcciones}
              contactos={contactos}
              usuarios={usuarios}
              roles={roles}
              matrizPermisos={matrizPermisos}
              auditoria={auditoria}
              solicitudes={solicitudes}
              paquetes={paquetes}
              despachos={despachos}
              movimientos={movimientos}
              transportadores={transportadores}
              onRefresh={cargarPlataforma}
            />
          )}
        </main>
      </div>
    </div>
  );
}
