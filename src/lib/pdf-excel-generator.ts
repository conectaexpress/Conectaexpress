import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const CONECTA_RED: [number, number, number] = [222, 16, 37]; // #DE1025
const DARK_GRAY: [number, number, number] = [23, 23, 23]; // #171717 gris neutro puro
const NEUTRAL_GRAY: [number, number, number] = [115, 115, 115]; // #737373 gris neutro puro

function drawCorporateHeader(
  doc: jsPDF,
  tituloDocumento: string,
  consecutivo: string,
  subtitulo?: string
) {
  // Franja superior corporativa #DE1025
  doc.setFillColor(...CONECTA_RED);
  doc.rect(0, 0, 210, 26, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("CONECTA EXPRESS", 14, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("SISTEMA INTEGRAL DE GESTIÓN LOGÍSTICA | WMS & TMS", 14, 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(tituloDocumento.toUpperCase(), 196, 11, { align: "right" });

  doc.setFontSize(9.5);
  doc.text(consecutivo, 196, 18, { align: "right" });

  if (subtitulo) {
    doc.setTextColor(...DARK_GRAY);
    doc.setFontSize(9);
    doc.text(subtitulo, 14, 33);
  }
}

/**
 * 1. Genera Comprobante PDF de Solicitud / Orden de Recogida (Módulo 1 y 3)
 */
export function descargarComprobanteSolicitudPDF(solicitud: {
  consecutivo: string;
  cliente_nombre: string;
  cliente_nit?: string;
  direccion_texto: string;
  ciudad: string;
  zona_logistica?: string;
  contacto_nombre: string;
  contacto_telefono: string;
  fecha_solicitada: string;
  fecha_programada?: string;
  franja_horaria: string;
  cantidad_estimada_paquetes: number;
  cantidad_recogida_real?: number;
  tipo_mercancia: string;
  peso_estimado_kg: number;
  estado_recogida: string;
  transportador_nombre?: string;
  conductor_nombre?: string;
  vehiculo_placa?: string;
  observaciones?: string;
  nombre_quien_entrega?: string;
  documento_quien_entrega?: string;
}) {
  const doc = new jsPDF();
  drawCorporateHeader(
    doc,
    "Comprobante de Recogida",
    solicitud.consecutivo,
    `Fecha de emisión: ${new Date().toLocaleString("es-CO")} | Estado: ${solicitud.estado_recogida}`
  );

  autoTable(doc, {
    startY: 38,
    head: [["INFORMACIÓN DEL CLIENTE Y PUNTO DE RECOLECCIÓN", "DETALLE"]],
    body: [
      ["Consecutivo de Solicitud", solicitud.consecutivo],
      [
        "Cliente / Razón Social",
        `${solicitud.cliente_nombre}${solicitud.cliente_nit ? ` (NIT: ${solicitud.cliente_nit})` : ""}`,
      ],
      ["Dirección de Recogida", solicitud.direccion_texto],
      [
        "Ciudad y Zona Logística",
        `${solicitud.ciudad} — ${solicitud.zona_logistica || "Zona Urbana"}`,
      ],
      [
        "Contacto en Sitio",
        `${solicitud.contacto_nombre} | Tel: ${solicitud.contacto_telefono}`,
      ],
      [
        "Fecha Solicitada / Programada",
        `${String(solicitud.fecha_solicitada).slice(0, 10)} / ${String(
          solicitud.fecha_programada || solicitud.fecha_solicitada
        ).slice(0, 10)} (${solicitud.franja_horaria})`,
      ],
      [
        "Mercancía Declarada",
        `${solicitud.tipo_mercancia} (${solicitud.peso_estimado_kg} kg estimados)`,
      ],
      [
        "Unidades Estimadas vs. Recolectadas",
        `${solicitud.cantidad_estimada_paquetes} estimadas / ${
          solicitud.cantidad_recogida_real ?? 0
        } verificadas en sitio`,
      ],
      [
        "Transportador Asignado",
        solicitud.transportador_nombre || "Pendiente de asignación",
      ],
      [
        "Conductor y Vehículo",
        solicitud.conductor_nombre
          ? `${solicitud.conductor_nombre} — Placa: ${solicitud.vehiculo_placa || "N/A"}`
          : "Por asignar",
      ],
      [
        "Entregado en sitio por",
        solicitud.nombre_quien_entrega
          ? `${solicitud.nombre_quien_entrega} (Doc: ${solicitud.documento_quien_entrega || "S/D"})`
          : "Pendiente de recolección física",
      ],
      ["Observaciones Operativas", solicitud.observaciones || "Sin observaciones"],
    ],
    headStyles: { fillColor: CONECTA_RED, textColor: [255, 255, 255] },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 68 } },
  });

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY || 160;

  doc.setDrawColor(180, 180, 180);
  doc.line(20, finalY + 28, 90, finalY + 28);
  doc.line(120, finalY + 28, 190, finalY + 28);

  doc.setFontSize(8);
  doc.setTextColor(...NEUTRAL_GRAY);
  doc.text("Firma Remitente / Cliente", 55, finalY + 34, { align: "center" });
  doc.text("Firma Transportador Autorizado Conecta Express", 155, finalY + 34, {
    align: "center",
  });

  doc.save(`Comprobante_${solicitud.consecutivo}.pdf`);
}

/**
 * 2. Imprime / Descarga Rótulo Interno Térmico de Conecta Express (4x6" o 4x2")
 */
export async function imprimirRotuloInternoPDF(paquete: {
  identificador_interno: string;
  cliente_nombre: string;
  remitente_ciudad: string;
  destinatario_nombre: string;
  destinatario_telefono: string;
  destinatario_direccion: string;
  destinatario_ciudad: string;
  contenido_declarado: string;
  peso_kg: number;
  unidad_numero?: number;
  total_unidades_lote?: number;
  guia_externa_principal?: string | null;
  transportadora_principal?: string | null;
  solicitud_consecutivo?: string | null;
  formato?: "4X6" | "4X2";
}) {
  const is4x2 = paquete.formato === "4X2";
  // 4x6 pulgadas = 101.6 x 152.4 mm; 4x2 pulgadas = 101.6 x 50.8 mm
  const doc = new jsPDF({
    orientation: is4x2 ? "landscape" : "portrait",
    unit: "mm",
    format: is4x2 ? [101.6, 50.8] : [101.6, 152.4],
  });

  // Encabezado corporativo #DE1025
  doc.setFillColor(...CONECTA_RED);
  doc.rect(0, 0, 101.6, is4x2 ? 10 : 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(is4x2 ? 9 : 11);
  doc.text("CONECTA EXPRESS", 4, is4x2 ? 6.5 : 8);
  doc.setFontSize(7);
  doc.text(
    `PIEZA ${paquete.unidad_numero || 1}/${paquete.total_unidades_lote || 1}`,
    97.6,
    is4x2 ? 6.5 : 8,
    { align: "right" }
  );

  doc.setTextColor(...DARK_GRAY);
  doc.setFontSize(is4x2 ? 11 : 14);
  doc.text(paquete.identificador_interno, 50.8, is4x2 ? 16 : 22, {
    align: "center",
  });

  // Cargar imagen Code128 desde nuestro endpoint /api/barcode
  try {
    const res = await fetch(
      `/api/barcode?type=code128&text=${encodeURIComponent(
        paquete.identificador_interno
      )}`
    );
    if (res.ok) {
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      });
      doc.addImage(
        dataUrl,
        "PNG",
        10,
        is4x2 ? 18 : 25,
        81.6,
        is4x2 ? 14 : 22
      );
    }
  } catch {
    // Fallback texto código de barras
  }

  if (is4x2) {
    doc.setFontSize(7);
    doc.text(
      `DEST: ${paquete.destinatario_ciudad} - ${paquete.destinatario_nombre.slice(0, 28)}`,
      4,
      38
    );
    doc.text(
      `CLIENTE: ${paquete.cliente_nombre.slice(0, 30)} | ${paquete.peso_kg} kg`,
      4,
      43
    );
    doc.text(
      `GUÍA EXT: ${paquete.guia_externa_principal || "SIN GUÍA EXTERNA (INTERNO CE)"}`,
      4,
      48
    );
  } else {
    doc.setDrawColor(210, 210, 210);
    doc.line(4, 51, 97.6, 51);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("DESTINO:", 4, 57);
    doc.setFontSize(12);
    doc.text(paquete.destinatario_ciudad.toUpperCase(), 22, 57);

    doc.setFontSize(8);
    doc.text(`Destinatario: ${paquete.destinatario_nombre}`, 4, 64);
    doc.setFont("helvetica", "normal");
    doc.text(`Dirección: ${paquete.destinatario_direccion}`, 4, 69, {
      maxWidth: 92,
    });
    doc.text(`Teléfono: ${paquete.destinatario_telefono}`, 4, 78);

    doc.line(4, 82, 97.6, 82);

    doc.setFont("helvetica", "bold");
    doc.text(`Remitente / Cliente:`, 4, 88);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${paquete.cliente_nombre} (${paquete.remitente_ciudad})`,
      4,
      93,
      { maxWidth: 92 }
    );
    doc.text(
      `Solicitud: ${paquete.solicitud_consecutivo || "Directo Bodega"} | Peso: ${paquete.peso_kg} kg`,
      4,
      100
    );
    doc.text(`Contenido: ${paquete.contenido_declarado}`, 4, 105, {
      maxWidth: 92,
    });

    doc.line(4, 111, 97.6, 111);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("REFERENCIA / GUÍA TRANSPORTADORA EXTERNA:", 4, 118);
    doc.setFontSize(10);
    doc.text(
      paquete.guia_externa_principal
        ? `${paquete.transportadora_principal || "COORDINADORA"} # ${paquete.guia_externa_principal}`
        : "PENDIENTE / OPERACIÓN INTERNA CONECTA EXPRESS",
      4,
      125
    );

    // Cargar QR en esquina inferior
    try {
      const qrRes = await fetch(
        `/api/barcode?type=qr&text=${encodeURIComponent(
          paquete.identificador_interno
        )}`
      );
      if (qrRes.ok) {
        const blob = await qrRes.blob();
        const qrUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result));
          reader.readAsDataURL(blob);
        });
        doc.addImage(qrUrl, "PNG", 74, 126, 22, 22);
      }
    } catch {
      // Fallback
    }

    doc.setFontSize(6.5);
    doc.setTextColor(...NEUTRAL_GRAY);
    doc.text("RÓTULO OFICIAL TRAZABILIDAD INTERNA", 4, 142);
    doc.text(`Impreso: ${new Date().toLocaleString("es-CO")}`, 4, 146);
  }

  doc.save(`Rotulo_${paquete.identificador_interno}.pdf`);
}

/**
 * 3. Exportador Universal a Excel (.xlsx) y PDF Corporativo (Módulo 16)
 */
export function exportarTablaExcel(
  nombreArchivo: string,
  nombreHoja: string,
  filas: Record<string, unknown>[]
) {
  const worksheet = XLSX.utils.json_to_sheet(filas);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, nombreHoja.slice(0, 31));
  XLSX.writeFile(workbook, `${nombreArchivo}.xlsx`);
}

export function exportarReportePDF(params: {
  tituloReporte: string;
  codigoReporte: string;
  columnas: string[];
  filas: (string | number)[][];
  resumenTexto?: string;
}) {
  const doc = new jsPDF({ orientation: "landscape" });
  drawCorporateHeader(
    doc,
    params.tituloReporte,
    params.codigoReporte,
    params.resumenTexto ||
      `Generado el ${new Date().toLocaleString("es-CO")} | Total registros: ${params.filas.length}`
  );

  autoTable(doc, {
    startY: 38,
    head: [params.columnas],
    body: params.filas,
    headStyles: { fillColor: CONECTA_RED, textColor: [255, 255, 255] },
    styles: { fontSize: 8, cellPadding: 2.5 },
  });

  doc.save(`${params.codigoReporte}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
