import { NextRequest, NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { getServerSession } from "@/lib/session";
import { hasPermission } from "@/lib/rbac";
import { generateId, hashPassword } from "@/lib/crypto-auth";
import { registrarAuditoria } from "@/lib/operational-service";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "NO_AUTENTICADO" }, { status: 401 });
    }

    const q = req.nextUrl.searchParams.get("q")?.trim() || "";

    // Aislamiento si es Transportador Externo
    if (session.rolCodigo === "TRANSPORTADOR_EXTERNO") {
      const [trpRes, cndRes, vehRes, asigRes] = await Promise.all([
        query(`SELECT * FROM transportadores WHERE id = $1`, [
          session.transportadorId,
        ]),
        query(`SELECT * FROM conductores WHERE transportador_id = $1`, [
          session.transportadorId,
        ]),
        query(`SELECT * FROM vehiculos WHERE transportador_id = $1`, [
          session.transportadorId,
        ]),
        query(
          `SELECT a.*, s.consecutivo AS solicitud_consecutivo, s.direccion_texto, s.ciudad,
                  s.contacto_nombre, s.contacto_telefono, s.cantidad_estimada_paquetes,
                  s.tipo_mercancia, s.peso_estimado_kg, s.estado_recogida, s.observaciones,
                  c.razon_social AS cliente_nombre
           FROM asignaciones a
           JOIN solicitudes_recogida s ON s.id = a.solicitud_id
           JOIN clientes c ON c.id = s.cliente_id
           WHERE a.transportador_id = $1 AND a.activa = TRUE
           ORDER BY a.created_at DESC`,
          [session.transportadorId]
        ),
      ]);

      return NextResponse.json({
        transportadores: trpRes.rows,
        conductores: cndRes.rows,
        vehiculos: vehRes.rows,
        asignaciones: asigRes.rows,
      });
    }

    if (!hasPermission(session, "transportadores:ver")) {
      return NextResponse.json({ error: "ACCESO_DENEGADO" }, { status: 403 });
    }

    const params: unknown[] = [];
    let whereSql = "WHERE 1=1";
    if (q) {
      params.push(`%${q}%`);
      whereSql += ` AND (t.razon_social ILIKE $1 OR t.nit ILIKE $1 OR t.codigo_transportador ILIKE $1 OR t.ciudad_base ILIKE $1)`;
    }

    const [trpRes, cndRes, vehRes, asigRes] = await Promise.all([
      query(
        `SELECT t.*,
          (SELECT COUNT(*)::int FROM conductores cd WHERE cd.transportador_id = t.id) AS total_conductores,
          (SELECT COUNT(*)::int FROM vehiculos vh WHERE vh.transportador_id = t.id) AS total_vehiculos,
          (SELECT COUNT(*)::int FROM solicitudes_recogida s WHERE s.transportador_asignado_id = t.id) AS total_servicios,
          (SELECT COUNT(*)::int FROM solicitudes_recogida s WHERE s.transportador_asignado_id = t.id AND s.estado_recogida = 'RECOGIDA_COMPLETADA') AS recogidas_exitosas,
          (SELECT COUNT(*)::int FROM solicitudes_recogida s WHERE s.transportador_asignado_id = t.id AND s.estado_recogida = 'RECOGIDA_FALLIDA') AS recogidas_fallidas
         FROM transportadores t
         ${whereSql}
         ORDER BY t.created_at DESC`,
        params
      ),
      query(
        `SELECT cd.*, t.razon_social AS transportador_nombre, u.email AS usuario_email
         FROM conductores cd
         JOIN transportadores t ON t.id = cd.transportador_id
         LEFT JOIN usuarios u ON u.id = cd.usuario_id
         ORDER BY cd.created_at DESC`
      ),
      query(
        `SELECT v.*, t.razon_social AS transportador_nombre, cd.nombre_completo AS conductor_nombre
         FROM vehiculos v
         JOIN transportadores t ON t.id = v.transportador_id
         LEFT JOIN conductores cd ON cd.id = v.conductor_habitual_id
         ORDER BY v.created_at DESC`
      ),
      query(
        `SELECT a.*, t.razon_social AS transportador_nombre,
                cd.nombre_completo AS conductor_nombre,
                v.placa AS vehiculo_placa,
                s.consecutivo AS solicitud_consecutivo,
                s.ciudad, s.direccion_texto, s.estado_recogida
         FROM asignaciones a
         JOIN transportadores t ON t.id = a.transportador_id
         LEFT JOIN conductores cd ON cd.id = a.conductor_id
         LEFT JOIN vehiculos v ON v.id = a.vehiculo_id
         JOIN solicitudes_recogida s ON s.id = a.solicitud_id
         ORDER BY a.created_at DESC
         LIMIT 100`
      ),
    ]);

    return NextResponse.json({
      transportadores: trpRes.rows,
      conductores: cndRes.rows,
      vehiculos: vehRes.rows,
      asignaciones: asigRes.rows,
    });
  } catch (error) {
    console.error("Error en GET /api/transportadores:", error);
    return NextResponse.json(
      { error: "ERROR_CONSULTA_TRANSPORTADORES" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !hasPermission(session, "transportadores:gestionar")) {
      return NextResponse.json({ error: "ACCESO_DENEGADO" }, { status: 403 });
    }

    const body = await req.json();
    const action = String(body.action || "CREAR_TRANSPORTADOR");

    // 1. Registrar Conductor y cuenta opcional de Portal Móvil (Módulo 4 y 5)
    if (action === "CREAR_CONDUCTOR") {
      const transportadorId = String(body.transportadorId || "");
      const cedula = String(body.cedula || "").trim();
      const nombreCompleto = String(body.nombreCompleto || "").trim();
      const telefono = String(body.telefono || "").trim();
      const email = String(body.email || "")
        .trim()
        .toLowerCase();
      const licenciaNumero = String(body.licenciaNumero || cedula).trim();
      const licenciaCategoria = String(body.licenciaCategoria || "C1");
      const licenciaVencimiento = String(
        body.licenciaVencimiento || "2028-12-31"
      );
      const arlEntidad = String(body.arlEntidad || "ARL SURA").trim();
      const arlVencimiento = String(body.arlVencimiento || "2027-12-31");

      if (!transportadorId || !cedula || !nombreCompleto || !telefono) {
        return NextResponse.json(
          {
            error: "DATOS_INCOMPLETOS",
            message:
              "Empresa transportadora, cédula, nombre y teléfono del conductor son obligatorios.",
          },
          { status: 400 }
        );
      }

      const created = await withTransaction(async (tx) => {
        let usuarioId: string | null = null;
        if (email && body.passwordPortalMovil) {
          usuarioId = generateId();
          await tx.query(
            `INSERT INTO usuarios (
              id, email, password_hash, nombre_completo, telefono, cargo, activo, transportador_id
            ) VALUES ($1, $2, $3, $4, $5, 'Conductor Recolección Móvil', TRUE, $6)`,
            [
              usuarioId,
              email,
              hashPassword(String(body.passwordPortalMovil)),
              nombreCompleto,
              telefono,
              transportadorId,
            ]
          );
          await tx.query(
            `INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES ($1, 'rol-transportador')`,
            [usuarioId]
          );
        }

        const conductorId = generateId();
        await tx.query(
          `INSERT INTO conductores (
            id, transportador_id, usuario_id, cedula, nombre_completo, telefono, email,
            licencia_numero, licencia_categoria, licencia_vencimiento,
            arl_entidad, arl_vencimiento, estado_operativo
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'DISPONIBLE')`,
          [
            conductorId,
            transportadorId,
            usuarioId,
            cedula,
            nombreCompleto,
            telefono,
            email || null,
            licenciaNumero,
            licenciaCategoria,
            licenciaVencimiento,
            arlEntidad,
            arlVencimiento,
          ]
        );

        return { conductorId, usuarioId };
      });

      return NextResponse.json({ ok: true, ...created });
    }

    // 2. Registrar Vehículo y Placa (Módulo 4)
    if (action === "CREAR_VEHICULO") {
      const transportadorId = String(body.transportadorId || "");
      const placa = String(body.placa || "")
        .trim()
        .toUpperCase();
      const tipoVehiculo = String(body.tipoVehiculo || "FURGON_NHR");
      const marcaModelo = String(
        body.marcaModelo || "Chevrolet NHR Furgón"
      ).trim();
      const capacidadKg = Number(body.capacidadKg || 2500);
      const capacidadM3 = Number(body.capacidadM3 || 16);

      if (!transportadorId || !placa) {
        return NextResponse.json(
          {
            error: "DATOS_INCOMPLETOS",
            message: "Transportador y placa del vehículo son obligatorios.",
          },
          { status: 400 }
        );
      }

      const vehiculoId = generateId();
      await query(
        `INSERT INTO vehiculos (
          id, transportador_id, conductor_habitual_id, placa, tipo_vehiculo,
          marca_modelo, capacidad_kg, capacidad_m3,
          soat_numero, soat_vencimiento, tecnomecanica_numero, tecnomecanica_vencimiento,
          gps_activo, estado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE, 'ACTIVO')`,
        [
          vehiculoId,
          transportadorId,
          body.conductorHabitualId || null,
          placa,
          tipoVehiculo,
          marcaModelo,
          capacidadKg,
          capacidadM3,
          String(body.soatNumero || `SOAT-${placa}`),
          String(body.soatVencimiento || "2027-06-30"),
          String(body.tecnomecanicaNumero || `RTM-${placa}`),
          String(body.tecnomecanicaVencimiento || "2027-06-30"),
        ]
      );

      return NextResponse.json({ ok: true, vehiculoId });
    }

    // 3. Registrar Nueva Empresa de Transporte Tercera (Módulo 4)
    const razonSocial = String(body.razonSocial || "").trim();
    const nit = String(body.nit || "").trim();
    const telefonoOperaciones = String(body.telefonoOperaciones || "").trim();
    const emailOperaciones = String(body.emailOperaciones || "")
      .trim()
      .toLowerCase();
    const direccion = String(body.direccion || "").trim();
    const ciudadBase = String(body.ciudadBase || "Bogotá D.C.").trim();

    if (
      !razonSocial ||
      !nit ||
      !telefonoOperaciones ||
      !emailOperaciones ||
      !direccion
    ) {
      return NextResponse.json(
        {
          error: "DATOS_INCOMPLETOS",
          message:
            "Razón social, NIT, teléfono, correo y dirección son obligatorios.",
        },
        { status: 400 }
      );
    }

    const created = await withTransaction(async (tx) => {
      const countRes = await tx.query<{ total: number }>(
        "SELECT COUNT(*)::int AS total FROM transportadores"
      );
      const nextNum = Number(countRes.rows[0]?.total || 0) + 1;
      const codigoTransportador = `TRP-${String(nextNum).padStart(3, "0")}`;
      const transportadorId = generateId();

      await tx.query(
        `INSERT INTO transportadores (
          id, codigo_transportador, razon_social, nit, representante_legal,
          telefono_operaciones, email_operaciones, direccion, ciudad_base,
          zonas_cobertura, servicios_prestados, poliza_responsabilidad, vencimiento_poliza, estado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'ACTIVO')`,
        [
          transportadorId,
          codigoTransportador,
          razonSocial,
          nit,
          body.representanteLegal ? String(body.representanteLegal) : null,
          telefonoOperaciones,
          emailOperaciones,
          direccion,
          ciudadBase,
          String(
            body.zonasCobertura ||
              "ZONA_NORTE,ZONA_OCCIDENTE,ZONA_CENTRO,SABANA"
          ),
          String(
            body.serviciosPrestados || "RECOGIDA_URBANA,TRASLADO_BODEGA"
          ),
          body.polizaResponsabilidad
            ? String(body.polizaResponsabilidad)
            : "POL-RC-ACTIVA",
          String(body.vencimientoPoliza || "2027-12-31"),
        ]
      );

      await registrarAuditoria(tx, {
        modulo: "TRANSPORTADORES_TERCEROS",
        accion: "CREAR_TRANSPORTADOR",
        entidadTipo: "TRANSPORTADOR",
        entidadId: transportadorId,
        session,
        datosNuevos: { codigoTransportador, razonSocial, nit },
      });

      return { transportadorId, codigoTransportador };
    });

    return NextResponse.json({ ok: true, ...created });
  } catch (error) {
    console.error("Error en POST /api/transportadores:", error);
    return NextResponse.json(
      {
        error: "ERROR_CREACION_TRANSPORTADOR",
        message:
          error instanceof Error
            ? error.message
            : "Error registrando transportador.",
      },
      { status: 500 }
    );
  }
}
