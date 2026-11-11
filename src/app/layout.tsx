import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CONECTA EXPRESS | Sistema Integral de Gestión Logística (WMS & TMS)",
  description:
    "Plataforma empresarial de operación logística de primera milla, escaneo, recepción en bodega, WMS, consolidación, despacho y trazabilidad para Conecta Express.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
