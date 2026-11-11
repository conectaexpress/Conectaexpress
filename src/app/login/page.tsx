"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Truck,
  ScanBarcode,
  ClipboardCheck,
  ArrowRight,
  Lock,
  Mail,
  Eye,
  EyeOff,
  CheckCircle2,
  SlidersHorizontal,
  PackageCheck,
} from "lucide-react";

/**
 * Cuentas operativas visibles en el login:
 * Únicamente Administrador General (admin) y Operador de Paquetes y Guías (escáner).
 * Se conservan intactos todos los usuarios, permisos y registros en la base de datos.
 */
const PERFILES_OPERATIVOS = [
  {
    etiqueta: "Administrador General",
    subtitulo: "Control Total",
    codigoCorto: "admin",
    email: "admin@conectaexpress.co",
    rol: "SUPERADMIN",
    icono: SlidersHorizontal,
  },
  {
    etiqueta: "Operador de Paquetes y Guías",
    subtitulo: "Escáner Operativo",
    codigoCorto: "escáner",
    email: "bodega@conectaexpress.co",
    rol: "OPERARIO_BODEGA",
    icono: ScanBarcode,
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@conectaexpress.co");
  const [password, setPassword] = useState("Conecta2026*");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(
          data.message || "Credenciales inválidas. Verifique su correo y contraseña."
        );
        setLoading(false);
        return;
      }
      router.push(data.redirectTo || "/admin");
      router.refresh();
    } catch {
      setErrorMsg(
        "Error de conexión al comunicarse con el servidor de autenticación."
      );
      setLoading(false);
    }
  }

  function seleccionarPerfil(correo: string) {
    setEmail(correo);
    setPassword("Conecta2026*");
    setErrorMsg(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7E8EA] via-[#F3F3F6] to-[#FCECEF] text-[#18181B] flex flex-col justify-between relative overflow-hidden selection:bg-[#DE1025] selection:text-white">
      {/* Barra superior institucional en rojo corporativo #DE1025 */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[#B80D1F] via-[#DE1025] to-[#B80D1F] shrink-0" />

      {/* Iluminación ambiental luminosa y suave en tonos rosados/rojos claros y grises perla */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-40 -left-36 w-[540px] h-[540px] rounded-full bg-[#FAD2D7]/65 blur-3xl" />
        <div className="absolute top-1/3 -right-36 w-[500px] h-[500px] rounded-full bg-[#F9DADD]/60 blur-3xl" />
        <div className="absolute -bottom-44 left-1/4 w-[520px] h-[520px] rounded-full bg-[#EDEBF0]/80 blur-3xl" />
      </div>

      {/* Contenedor Principal SaaS Centrado */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="w-full max-w-[1180px] bg-white rounded-2xl lg:rounded-3xl shadow-[0_20px_60px_-15px_rgba(184,13,31,0.14)] border border-[#E6E1E3] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          
          {/* COLUMNA IZQUIERDA (5/12): Identidad Corporativa en Rojo Conecta Express Luminoso y Elegante */}
          <aside className="lg:col-span-5 bg-gradient-to-br from-[#DE1025] via-[#C40E20] to-[#9E0B1A] text-white p-8 sm:p-10 lg:p-12 flex flex-col justify-between relative overflow-hidden">
            {/* Detalles suaves de luz blanca/rosada para dar profundidad sin oscurecer */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 w-72 h-72 rounded-full bg-white/10 blur-2xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-20 -bottom-20 w-64 h-64 rounded-full bg-[#FF8A96]/20 blur-2xl"
            />

            <div className="relative z-10">
              {/* Logotipo Oficial Conecta Express (.SVG) en tamaño amplio manteniendo proporción exacta (300:44) */}
              <div className="pb-8 border-b border-white/20">
                <img
                  src="/logo-conecta.svg"
                  alt="Conecta Express - Recogidas"
                  width={420}
                  height={62}
                  className="w-full max-w-[360px] sm:max-w-[410px] h-auto object-contain select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                />
              </div>

              {/* Identificación de la Plataforma */}
              <div className="mt-7">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/25 text-white text-[11px] font-semibold uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  Sistema Integral de Gestión Logística
                </div>

                <p className="mt-4 text-sm sm:text-[15px] text-white/95 leading-relaxed font-normal">
                  Plataforma tecnológica para la coordinación de recogidas, asignación de transportadores, verificación de paquetes con código de barras y trazabilidad operativa en tiempo real.
                </p>
              </div>

              {/* Flujo Operativo Integrado */}
              <div className="mt-8 space-y-3.5">
                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/12 border border-white/20 backdrop-blur-sm">
                  <div className="w-9 h-9 rounded-lg bg-white text-[#DE1025] flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <ClipboardCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      Solicitudes y Recogidas
                    </h3>
                    <p className="text-xs text-white/85 mt-1 leading-relaxed">
                      Programación ágil desde el portal de clientes y asignación de transportadores autorizados.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/12 border border-white/20 backdrop-blur-sm">
                  <div className="w-9 h-9 rounded-lg bg-white text-[#DE1025] flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <ScanBarcode className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      Escaneo y Registro de Paquetes
                    </h3>
                    <p className="text-xs text-white/85 mt-1 leading-relaxed">
                      Lectura de rótulos y guías, captura de dimensiones (largo, ancho, alto, peso) y evidencia.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/12 border border-white/20 backdrop-blur-sm">
                  <div className="w-9 h-9 rounded-lg bg-white text-[#DE1025] flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      Trazabilidad y Despacho
                    </h3>
                    <p className="text-xs text-white/85 mt-1 leading-relaxed">
                      Seguimiento de estados etapa por etapa e integración con guías de Coordinadora.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pie del panel corporativo */}
            <div className="relative z-10 mt-8 pt-5 border-t border-white/20 flex items-center justify-between gap-3 text-[11px] text-white/85">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-white shrink-0" />
                <span>Code 128 · QR · Rótulos Conecta Express</span>
              </div>
              <span className="font-semibold text-white">
                © {new Date().getFullYear()}
              </span>
            </div>
          </aside>

          {/* COLUMNA DERECHA (7/12): Área de Acceso en Blanco, Gris Claro y Rojo Suave */}
          <section className="lg:col-span-7 bg-gradient-to-b from-[#FFFFFF] to-[#F9F9FB] p-8 sm:p-10 lg:p-14 flex flex-col justify-center">
            <div className="w-full max-w-[460px] mx-auto">
              
              {/* Encabezado del Formulario */}
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#FFF1F2] border border-[#FCD4D8] text-[#B80D1F] text-[11px] font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#DE1025]" />
                  Acceso Corporativo
                </div>
                <h1 className="mt-3 text-2xl sm:text-[26px] font-bold text-[#18181B] tracking-tight">
                  Iniciar sesión en la plataforma
                </h1>
                <p className="mt-1.5 text-sm text-[#52525B]">
                  Ingrese sus credenciales operativas o seleccione una cuenta configurada para acceder.
                </p>
              </div>

              {/* Alerta de Error */}
              {errorMsg && (
                <div className="mt-5 p-3.5 rounded-xl bg-[#FFF1F2] border border-[#F9B4BB] flex items-start gap-2.5 text-xs sm:text-sm text-[#9E0B1A] font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#DE1025] mt-1.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Formulario de Inicio de Sesión */}
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-semibold text-[#3F3F46] mb-1.5"
                  >
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-[#F4F4F6] border border-[#E4E4E7] rounded-xl text-sm text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:bg-white focus:border-[#DE1025] focus:ring-3 focus:ring-[#DE1025]/12 transition-all"
                      placeholder="usuario@conectaexpress.co"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold text-[#3F3F46] mb-1.5"
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-[#F4F4F6] border border-[#E4E4E7] rounded-xl text-sm text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:bg-white focus:border-[#DE1025] focus:ring-3 focus:ring-[#DE1025]/12 transition-all"
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#18181B] p-1 rounded-md transition-colors"
                      tabIndex={-1}
                      title={
                        showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-5 bg-[#DE1025] hover:bg-[#B80D1F] active:bg-[#9E0B1A] text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 shadow-[0_8px_20px_-4px_rgba(222,16,37,0.32)] hover:shadow-[0_10px_24px_-4px_rgba(184,13,31,0.42)] disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {loading ? (
                      <span>Verificando credenciales...</span>
                    ) : (
                      <>
                        <span>Ingresar a la Plataforma</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Cuentas Operativas Configuradas (Únicamente Admin y Escáner) */}
              <div className="mt-8 pt-6 border-t border-[#ECECEE]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-[#52525B]">
                    Cuentas operativas disponibles
                  </span>
                  <span className="text-[11px] text-[#52525B] bg-[#F4F4F6] px-2.5 py-0.5 rounded-md border border-[#E4E4E7] font-mono">
                    Clave: Conecta2026*
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PERFILES_OPERATIVOS.map((p) => {
                    const selected =
                      email.toLowerCase() === p.email.toLowerCase();
                    const IconComponent = p.icono;
                    return (
                      <button
                        key={p.email}
                        type="button"
                        onClick={() => seleccionarPerfil(p.email)}
                        className={`group text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                          selected
                            ? "border-[#DE1025] bg-[#FFF2F3] shadow-[0_4px_14px_-4px_rgba(222,16,37,0.16)]"
                            : "border-[#E4E4E7] bg-[#F4F4F6] hover:bg-white hover:border-[#D4D4D8]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 w-full">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              selected
                                ? "bg-[#DE1025] text-white"
                                : "bg-white text-[#52525B] border border-[#E4E4E7] group-hover:border-[#F9B4BB] group-hover:text-[#DE1025]"
                            }`}
                          >
                            <IconComponent className="w-3.5 h-3.5" />
                          </div>

                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              selected
                                ? "bg-[#DE1025] text-white"
                                : "bg-white text-[#52525B] border border-[#E4E4E7]"
                            }`}
                          >
                            {selected && (
                              <CheckCircle2 className="w-2.5 h-2.5" />
                            )}
                            {p.codigoCorto}
                          </span>
                        </div>

                        <div className="mt-2.5">
                          <div className="text-xs font-bold text-[#18181B] leading-snug">
                            {p.etiqueta}
                          </div>
                          <div className="text-[11px] font-medium text-[#52525B] mt-0.5">
                            {p.subtitulo}
                          </div>
                          <div className="text-[10px] text-[#71717A] font-mono mt-1.5 truncate">
                            {p.email}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Pie de página luminoso y corporativo */}
      <footer className="relative z-10 py-3.5 px-6 text-center text-xs text-[#71717A]">
        Conecta Express · Plataforma Empresarial de Gestión de Recogidas y Trazabilidad de Paquetes
      </footer>
    </div>
  );
}
