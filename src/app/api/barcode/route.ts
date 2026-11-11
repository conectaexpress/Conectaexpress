import { NextRequest, NextResponse } from "next/server";
import bwipjs from "bwip-js";

export async function GET(req: NextRequest) {
  try {
    const text = req.nextUrl.searchParams.get("text")?.trim() || "CE-000000";
    const type = req.nextUrl.searchParams.get("type") === "qr" ? "qrcode" : "code128";

    const pngBuffer = await bwipjs.toBuffer({
      bcid: type,
      text,
      scale: type === "qrcode" ? 4 : 3,
      height: type === "qrcode" ? 28 : 14,
      includetext: type !== "qrcode",
      textxalign: "center",
      backgroundcolor: "FFFFFF",
    });

    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Error generando código de barras:", error);
    return NextResponse.json(
      { error: "ERROR_GENERACION_BARCODE" },
      { status: 500 }
    );
  }
}
