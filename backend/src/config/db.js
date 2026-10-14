import sql from "mssql/msnodesqlv8.js";
import { env } from "./env.js";

const config = {
  server: env.db.server,
  database: env.db.database,
  driver: env.db.driver,
  connectionString: [
    `Driver={${env.db.driver}}`,
    `Server=lpc:${env.db.server}`,
    `Database=${env.db.database}`,
    "Trusted_Connection=Yes",
    "Encrypt=Yes",
    "TrustServerCertificate=Yes"
  ].join(";"),

  options: {
    trustedConnection: true,
    encrypt: true,
    trustServerCertificate: true
  },

  requestTimeout: 60000,

  pool: {
    max: env.db.connectionLimit,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

export const pool = new sql.ConnectionPool(config);

export async function checkDatabaseConnection() {
  if (!pool.connected) {
    await pool.connect();
  }

  const result = await pool.request().query(`
    SELECT 1 AS ok;
  `);

  return result.recordset[0];
}

export { sql };