import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { hashPassword } from "./crypto-auth";
import { ROLES_CATALOG, ROLE_PERMISSIONS_MAP, PermissionKey } from "./rbac";

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

export interface DbExecutor {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
}

declare global {
  // eslint-disable-next-line no-var
  var __conectaPgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __conectaPglite: PGlite | undefined;
  // eslint-disable-next-line no-var
  var __conectaDbInitPromise: Promise<void> | undefined;
}

function getDataDirectory(): string {
  const configured = process.env.PGLITE_DATA_DIR || "./data/postgres-conecta";
  try {
    const resolved = path.resolve(process.cwd(), configured);
    const parent = path.dirname(resolved);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
    fs.accessSync(parent, fs.constants.W_OK);
    return resolved;
  } catch {
    const tmpFallback = path.join(
      process.env.TEMP || process.env.TMP || "/tmp",
      "postgres-conecta"
    );
    const tmpParent = path.dirname(tmpFallback);
    if (!fs.existsSync(tmpParent)) {
      fs.mkdirSync(tmpParent, { recursive: true });
    }
    return tmpFallback;
  }
}

async function getRawAdapter(): Promise<{
  mode: "PG_EXTERNAL" | "PGLITE_PERSISTENT";
  pgPool?: Pool;
  pglite?: PGlite;
}> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    if (!global.__conectaPgPool) {
      global.__conectaPgPool = new Pool({
        connectionString: databaseUrl,
        max: 15,
      });
    }
    return { mode: "PG_EXTERNAL", pgPool: global.__conectaPgPool };
  }

  if (!global.__conectaPglite) {
    const dataDir = getDataDirectory();
    global.__conectaPglite = await PGlite.create({
      dataDir,
    });
  }
  return { mode: "PGLITE_PERSISTENT", pglite: global.__conectaPglite };
}

async function runBootstrapIfNeeded(): Promise<void> {
  const adapter = await getRawAdapter();
  const execSql = async (sql: string, params: unknown[] = []) => {
    if (adapter.mode === "PG_EXTERNAL" && adapter.pgPool) {
      return adapter.pgPool.query(sql, params);
    }
    if (adapter.pglite) {
      if (params.length === 0 && sql.includes(";")) {
        await adapter.pglite.exec(sql);
        return { rows: [], rowCount: 0 };
      }
      const res = await adapter.pglite.query(sql, params);
      return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length };
    }
    throw new Error("PostgreSQL engine not initialized");
  };

  // 1. Ejecutar DDL de migración 001_schema_postgresql.sql
  const migrationPath = path.resolve(
    process.cwd(),
    "migrations",
    "001_schema_postgresql.sql"
  );
  if (fs.existsSync(migrationPath)) {
    const ddl = fs.readFileSync(migrationPath, "utf8");
    if (adapter.mode === "PG_EXTERNAL" && adapter.pgPool) {
      await adapter.pgPool.query(ddl);
    } else if (adapter.pglite) {
      await adapter.pglite.exec(ddl);
    }
  }

  // 2. Verificar si los roles base ya están aprovisionados
  const existingRoles = await execSql("SELECT COUNT(*)::int AS total FROM roles");
  const count = Number((existingRoles.rows[0] as { total?: number })?.total || 0);
  if (count > 0) {
    return;
  }

  // 3. Sembrar Roles y Permisos (Módulo 17)
  for (const r of ROLES_CATALOG) {
    await execSql(
      `INSERT INTO roles (id, codigo, nombre, descripcion, nivel_jerarquia)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (codigo) DO NOTHING`,
      [r.id, r.codigo, r.nombre, r.descripcion, r.nivel_jerarquia]
    );
  }

  const allPermissions = new Set<PermissionKey>();
  Object.values(ROLE_PERMISSIONS_MAP).forEach((perms) =>
    perms.forEach((p) => allPermissions.add(p))
  );

  for (const permKey of allPermissions) {
    const [modulo, accion] = permKey.split(":");
    const permId = `perm-${permKey.replace(":", "-")}`;
    await execSql(
      `INSERT INTO permisos (id, modulo, accion, clave, descripcion)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (clave) DO NOTHING`,
      [
        permId,
        modulo,
        accion,
        permKey,
        `Permiso para ${accion} en módulo ${modulo}`,
      ]
    );
  }

  for (const r of ROLES_CATALOG) {
    const perms = ROLE_PERMISSIONS_MAP[r.codigo] || [];
    for (const permKey of perms) {
      const permId = `perm-${permKey.replace(":", "-")}`;
      await execSql(
        `INSERT INTO roles_permisos (rol_id, permiso_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [r.id, permId]
      );
    }
  }

  // 4. Crear estructura física inicial de Bodega Principal Conecta Express (Módulo 9)
  await execSql(
    `INSERT INTO bodegas (id, sede, codigo, nombre, ciudad, direccion, capacidad_total_paquetes, activa)
     VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
     ON CONFLICT (codigo) DO NOTHING`,
    [
      "bod-bog-01",
      "Sede Principal Bogotá",
      "BOG-CENTRAL",
      "Centro de Distribución y Cross-Docking Conecta Express Bogotá",
      "Bogotá D.C.",
      "Parque Industrial San Cayetano, Bodega 14 - Zona Industrial Montevideo",
      8000,
    ]
  );

  const zonasIniciales = [
    {
      id: "zon-bog-rec",
      codigo: "Z-REC",
      nombre: "Muelle de Recepción y Verificación",
      tipo: "RECEPCION",
    },
    {
      id: "zon-bog-alm",
      codigo: "Z-ALM",
      nombre: "Zona de Almacenamiento Racks Estándar",
      tipo: "ALMACENAMIENTO",
    },
    {
      id: "zon-bog-cla",
      codigo: "Z-CLA",
      nombre: "Sorter Manual de Clasificación Nacional/Urbana",
      tipo: "CLASIFICACION",
    },
    {
      id: "zon-bog-con",
      codigo: "Z-CON",
      nombre: "Bahías de Consolidación por Destino y Transportadora",
      tipo: "CONSOLIDACION",
    },
    {
      id: "zon-bog-des",
      codigo: "Z-DES",
      nombre: "Muelle de Salida y Despacho a Transportadoras",
      tipo: "DESPACHO",
    },
    {
      id: "zon-bog-nov",
      codigo: "Z-NOV",
      nombre: "Jaula de Novedades, Averías y No Identificados",
      tipo: "NOVEDADES_CUARENTENA",
    },
  ];

  for (const z of zonasIniciales) {
    await execSql(
      `INSERT INTO zonas (id, bodega_id, codigo, nombre, tipo_zona, activa)
       VALUES ($1, 'bod-bog-01', $2, $3, $4, TRUE)
       ON CONFLICT (bodega_id, codigo) DO NOTHING`,
      [z.id, z.codigo, z.nombre, z.tipo]
    );
  }

  const ubicacionesIniciales = [
    {
      id: "ubi-rec-01",
      zona: "zon-bog-rec",
      codigo: "BOG-ZREC-P01-E01-N01",
      pasillo: "P01",
      estanteria: "E01",
      nivel: "N01",
      cap: 200,
    },
    {
      id: "ubi-alm-a1",
      zona: "zon-bog-alm",
      codigo: "BOG-ZALM-P01-E01-N01",
      pasillo: "P01",
      estanteria: "E01",
      nivel: "N01",
      cap: 80,
    },
    {
      id: "ubi-alm-a2",
      zona: "zon-bog-alm",
      codigo: "BOG-ZALM-P01-E01-N02",
      pasillo: "P01",
      estanteria: "E01",
      nivel: "N02",
      cap: 80,
    },
    {
      id: "ubi-alm-b1",
      zona: "zon-bog-alm",
      codigo: "BOG-ZALM-P02-E01-N01",
      pasillo: "P02",
      estanteria: "E01",
      nivel: "N01",
      cap: 80,
    },
    {
      id: "ubi-cla-01",
      zona: "zon-bog-cla",
      codigo: "BOG-ZCLA-P01-E01-N01",
      pasillo: "P01",
      estanteria: "E01",
      nivel: "N01",
      cap: 150,
    },
    {
      id: "ubi-con-med",
      zona: "zon-bog-con",
      codigo: "BOG-ZCON-MED-E01-N01",
      pasillo: "MED",
      estanteria: "E01",
      nivel: "N01",
      cap: 120,
    },
    {
      id: "ubi-con-cal",
      zona: "zon-bog-con",
      codigo: "BOG-ZCON-CAL-E01-N01",
      pasillo: "CAL",
      estanteria: "E01",
      nivel: "N01",
      cap: 120,
    },
    {
      id: "ubi-des-01",
      zona: "zon-bog-des",
      codigo: "BOG-ZDES-M01-E01-N01",
      pasillo: "M01",
      estanteria: "E01",
      nivel: "N01",
      cap: 250,
    },
    {
      id: "ubi-nov-01",
      zona: "zon-bog-nov",
      codigo: "BOG-ZNOV-CUA-E01-N01",
      pasillo: "CUA",
      estanteria: "E01",
      nivel: "N01",
      cap: 60,
    },
  ];

  for (const u of ubicacionesIniciales) {
    await execSql(
      `INSERT INTO ubicaciones (
        id, bodega_id, zona_id, codigo_ubicacion, codigo_barras_ubicacion,
        pasillo, estanteria, nivel, posicion, capacidad_max_paquetes, ocupacion_actual
      ) VALUES ($1, 'bod-bog-01', $2, $3, $3, $4, $5, $6, '01', $7, 0)
      ON CONFLICT (codigo_ubicacion) DO NOTHING`,
      [u.id, u.zona, u.codigo, u.pasillo, u.estanteria, u.nivel, u.cap]
    );
  }

  // 5. Configurar Adaptadores de Integración (Módulo 12 — Sin afirmar conexiones no verificadas)
  await execSql(
    `INSERT INTO integraciones (
      id, codigo_integracion, nombre_proveedor, tipo_conector, modo_operacion,
      endpoint_configurado, variable_entorno_credencial, conexion_verificada,
      estado_salud, observaciones_tecnicas
    ) VALUES
    (
      'int-coordinadora',
      'COORDINADORA',
      'Coordinadora Mercantil S.A. (Adaptador Oficial)',
      'API_REST_SOAP',
      'CONTINGENCIA_CSV',
      'https://api.coordinadora.com/ags/1.5/server.php',
      'COORDINADORA_API_KEY',
      FALSE,
      'CONTINGENCIA_IMPORTACION_ACTIVA',
      'Adaptador preparado para conexión directa API una vez se suministren credenciales en variables de entorno. Operando con validación local e importación Excel/CSV.'
    ),
    (
      'int-plataforma-ce',
      'PLATAFORMA_ACTUAL_CE',
      'Plataforma Preexistente de Guías Conecta Express',
      'PLATAFORMA_INTERNA_CE',
      'CONTINGENCIA_CSV',
      NULL,
      'PLATAFORMA_GUIAS_CE_API_TOKEN',
      FALSE,
      'CONTINGENCIA_IMPORTACION_ACTIVA',
      'Conector desacoplado de lectura/importación de guías y rótulos generados en la plataforma actual de Conecta Express.'
    )
    ON CONFLICT (codigo_integracion) DO NOTHING`
  );

  // 6. Aprovisionar cuentas operativas iniciales (Sin datos ficticios que se hagan pasar por operación histórica falsa;
  //    únicamente las cuentas maestras requeridas para acceder y operar los 3 portales inmediatamente).
  const defaultPasswordHash = hashPassword("Conecta2026*");

  // Cuenta 1: Cliente Corporativo inicial para el Portal de Clientes
  await execSql(
    `INSERT INTO clientes (
      id, codigo_cliente, razon_social, nit, digito_verificacion, nombre_comercial,
      email_corporativo, telefono_principal, ciudad_principal, direccion_principal,
      servicios_habilitados, sla_recogida_horas, estado
    ) VALUES (
      'cli-corporativo-01',
      'CLI-001',
      'DISTRIBUIDORA INDUSTRIAL ANDINA S.A.S.',
      '900482910',
      '4',
      'Industrial Andina',
      'logistica@industrialandina.co',
      '3104509821',
      'Bogotá D.C.',
      'Av. Calle 26 # 69D - 91 Torre 2 Of. 405',
      'PAQUETERIA,CARGA_MASIVA,CROSS_DOCKING',
      4,
      'ACTIVO'
    ) ON CONFLICT (codigo_cliente) DO NOTHING`
  );

  await execSql(
    `INSERT INTO contactos (id, cliente_id, nombre_completo, cargo, telefono, email, ciudad, es_principal)
     VALUES (
       'cnt-cli-01',
       'cli-corporativo-01',
       'Carolina Méndez Vargas',
       'Jefe de Despachos y Compras',
       '3104509821',
       'logistica@industrialandina.co',
       'Bogotá D.C.',
       TRUE
     ) ON CONFLICT (id) DO NOTHING`
  );

  await execSql(
    `INSERT INTO direcciones (
      id, cliente_id, alias, direccion_completa, complemento, barrio, ciudad,
      departamento, zona_logistica, codigo_dane, latitud, longitud,
      contacto_local_nombre, contacto_local_telefono, horario_atencion, es_frecuente
    ) VALUES
    (
      'dir-cli-01',
      'cli-corporativo-01',
      'CEDI Principal Puente Aranda',
      'Carrera 65B # 17A - 42 Zona Industrial',
      'Muelle de Carga #3',
      'Puente Aranda',
      'Bogotá D.C.',
      'Cundinamarca',
      'ZONA_INDUSTRIAL_OCCIDENTE',
      '11001000',
      4.6351200,
      -74.1164800,
      'Carolina Méndez Vargas',
      '3104509821',
      '07:30 - 17:00',
      TRUE
    ),
    (
      'dir-cli-02',
      'cli-corporativo-01',
      'Sucursal Norte Autopista',
      'Autopista Norte # 128B - 41 Costado Occidental',
      'Bodega Posterior',
      'Prado Veraniego',
      'Bogotá D.C.',
      'Cundinamarca',
      'ZONA_NORTE',
      '11001000',
      4.7124900,
      -74.0532100,
      'Jorge Iván Rojas',
      '3158923410',
      '08:00 - 16:30',
      TRUE
    ) ON CONFLICT (id) DO NOTHING`
  );

  // Cuenta 2: Empresa Transportadora Tercera inicial para el Portal Móvil de Transportadores
  await execSql(
    `INSERT INTO transportadores (
      id, codigo_transportador, razon_social, nit, representante_legal,
      telefono_operaciones, email_operaciones, direccion, ciudad_base,
      zonas_cobertura, servicios_prestados, calificacion_promedio, cumplimiento_sla_pct,
      documentacion_al_dia, poliza_responsabilidad, vencimiento_poliza, estado
    ) VALUES (
      'trp-aliado-01',
      'TRP-001',
      'TRANSPORTES Y RECOLECCIONES METROPOLITANAS S.A.S.',
      '901239841-2',
      'Hernán Darío Gómez',
      '3142987612',
      'operaciones@transmetropolitana.co',
      'Calle 13 # 82 - 19 Bodega 4',
      'Bogotá D.C.',
      'ZONA_NORTE,ZONA_OCCIDENTE,ZONA_INDUSTRIAL_OCCIDENTE,ZONA_CENTRO,SABANA_OCCIDENTE',
      'RECOGIDA_URBANA,DEDICADO_EMPRESARIAL,TRASLADO_BODEGA',
      4.95,
      98.50,
      TRUE,
      'POL-ALLIANZ-8849201',
      '2027-06-30',
      'ACTIVO'
    ) ON CONFLICT (codigo_transportador) DO NOTHING`
  );

  // Usuarios iniciales de cada rol
  const initialUsers = [
    {
      id: "usr-superadmin",
      email: "admin@conectaexpress.co",
      nombre: "Dirección General — Conecta Express",
      telefono: "3002104500",
      cargo: "Director de Operaciones y Tecnología",
      clienteId: null,
      transportadorId: null,
      rolId: "rol-superadmin",
    },
    {
      id: "usr-coordinador",
      email: "coordinador@conectaexpress.co",
      nombre: "Andrés Felipe Salazar",
      telefono: "3115408920",
      cargo: "Coordinador Logístico Nacional",
      clienteId: null,
      transportadorId: null,
      rolId: "rol-coordinador",
    },
    {
      id: "usr-bodega",
      email: "bodega@conectaexpress.co",
      nombre: "Miguel Ángel Rodríguez",
      telefono: "3128901122",
      cargo: "Líder de Recepción y WMS Bodega",
      clienteId: null,
      transportadorId: null,
      rolId: "rol-bodega",
    },
    {
      id: "usr-despacho",
      email: "despachos@conectaexpress.co",
      nombre: "Laura Valentina Ospina",
      telefono: "3187654321",
      cargo: "Responsable de Consolidación y Despachos",
      clienteId: null,
      transportadorId: null,
      rolId: "rol-despacho",
    },
    {
      id: "usr-cliente-01",
      email: "cliente@industrialandina.co",
      nombre: "Carolina Méndez (Industrial Andina)",
      telefono: "3104509821",
      cargo: "Jefe de Despachos",
      clienteId: "cli-corporativo-01",
      transportadorId: null,
      rolId: "rol-cliente",
    },
    {
      id: "usr-transportador-01",
      email: "conductor@transmetropolitana.co",
      nombre: "Carlos Eduardo Bermúdez (Conductor TRP-001)",
      telefono: "3142987612",
      cargo: "Conductor de Recolección Primera Milla",
      clienteId: null,
      transportadorId: "trp-aliado-01",
      rolId: "rol-transportador",
    },
  ];

  for (const u of initialUsers) {
    await execSql(
      `INSERT INTO usuarios (
        id, email, password_hash, nombre_completo, telefono, cargo, activo, cliente_id, transportador_id
      ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8)
      ON CONFLICT (email) DO NOTHING`,
      [
        u.id,
        u.email,
        defaultPasswordHash,
        u.nombre,
        u.telefono,
        u.cargo,
        u.clienteId,
        u.transportadorId,
      ]
    );
    await execSql(
      `INSERT INTO usuarios_roles (usuario_id, rol_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [u.id, u.rolId]
    );
  }

  // Registrar Conductor y Vehículo vinculados al usuario transportador
  await execSql(
    `INSERT INTO conductores (
      id, transportador_id, usuario_id, cedula, nombre_completo, telefono, email,
      licencia_numero, licencia_categoria, licencia_vencimiento, arl_entidad, arl_vencimiento, estado_operativo
    ) VALUES (
      'cnd-01',
      'trp-aliado-01',
      'usr-transportador-01',
      '80145920',
      'Carlos Eduardo Bermúdez',
      '3142987612',
      'conductor@transmetropolitana.co',
      'LC-80145920-C2',
      'C2',
      '2028-04-15',
      'ARL SURA',
      '2027-01-31',
      'DISPONIBLE'
    ) ON CONFLICT (cedula) DO NOTHING`
  );

  await execSql(
    `INSERT INTO vehiculos (
      id, transportador_id, conductor_habitual_id, placa, tipo_vehiculo, marca_modelo,
      capacidad_kg, capacidad_m3, soat_numero, soat_vencimiento, tecnomecanica_numero,
      tecnomecanica_vencimiento, gps_activo, estado
    ) VALUES (
      'veh-01',
      'trp-aliado-01',
      'cnd-01',
      'WTR842',
      'FURGON_NHR',
      'Chevrolet NHR Reward Furgón 2024',
      2800.00,
      18.50,
      'SOAT-99284102',
      '2027-05-20',
      'RTM-44182901',
      '2027-05-20',
      TRUE,
      'ACTIVO'
    ) ON CONFLICT (placa) DO NOTHING`
  );
}

export async function ensureDbReady(): Promise<void> {
  if (!global.__conectaDbInitPromise) {
    global.__conectaDbInitPromise = runBootstrapIfNeeded().catch((err) => {
      global.__conectaDbInitPromise = undefined;
      throw err;
    });
  }
  await global.__conectaDbInitPromise;
}

/**
 * Ejecuta una consulta parametrizada en PostgreSQL
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  await ensureDbReady();
  const adapter = await getRawAdapter();
  if (adapter.mode === "PG_EXTERNAL" && adapter.pgPool) {
    const res = await adapter.pgPool.query(sql, params);
    return {
      rows: res.rows as T[],
      rowCount: res.rowCount ?? res.rows.length,
    };
  }
  if (adapter.pglite) {
    const res = await adapter.pglite.query(sql, params);
    return {
      rows: res.rows as T[],
      rowCount: res.affectedRows ?? res.rows.length,
    };
  }
  throw new Error("No PostgreSQL adapter available");
}

/**
 * Ejecuta múltiples operaciones dentro de una transacción ACID PostgreSQL
 */
export async function withTransaction<R>(
  fn: (tx: DbExecutor) => Promise<R>
): Promise<R> {
  await ensureDbReady();
  const adapter = await getRawAdapter();

  if (adapter.mode === "PG_EXTERNAL" && adapter.pgPool) {
    const client = await adapter.pgPool.connect();
    try {
      await client.query("BEGIN");
      const executor: DbExecutor = {
        async query<T = Record<string, unknown>>(
          sql: string,
          params: unknown[] = []
        ): Promise<QueryResult<T>> {
          const res = await client.query(sql, params);
          return {
            rows: res.rows as T[],
            rowCount: res.rowCount ?? res.rows.length,
          };
        },
      };
      const result = await fn(executor);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  if (adapter.pglite) {
    return adapter.pglite.transaction(async (tx) => {
      const executor: DbExecutor = {
        async query<T = Record<string, unknown>>(
          sql: string,
          params: unknown[] = []
        ): Promise<QueryResult<T>> {
          const res = await tx.query(sql, params);
          return {
            rows: res.rows as T[],
            rowCount: res.affectedRows ?? res.rows.length,
          };
        },
      };
      return fn(executor);
    });
  }

  throw new Error("No PostgreSQL adapter available for transaction");
}
