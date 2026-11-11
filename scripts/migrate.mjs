import fs from "fs";
import path from "path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

async function migrate() {
  const ddlPath = path.resolve(
    process.cwd(),
    "migrations",
    "001_schema_postgresql.sql"
  );
  const ddl = fs.readFileSync(ddlPath, "utf8");
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl) {
    console.log("Ejecutando migración 001 en PostgreSQL externo (DATABASE_URL)...");
    const pool = new pg.Pool({ connectionString: databaseUrl });
    await pool.query(ddl);
    await pool.end();
    console.log("Migración completada exitosamente en PostgreSQL externo.");
  } else {
    const dataDir = path.resolve(
      process.cwd(),
      process.env.PGLITE_DATA_DIR || "./data/postgres-conecta"
    );
    fs.mkdirSync(path.dirname(dataDir), { recursive: true });
    console.log(`Ejecutando migración 001 en PostgreSQL persistente local (${dataDir})...`);
    const db = await PGlite.create({ dataDir });
    await db.exec(ddl);
    await db.close();
    console.log("Migración completada exitosamente.");
  }
}

migrate().catch((err) => {
  console.error("Error ejecutando migración:", err);
  process.exit(1);
});
