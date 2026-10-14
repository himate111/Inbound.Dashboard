import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../..");
const backendRoot = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(projectRoot, ".env") });
dotenv.config({ path: path.join(backendRoot, ".env"), override: true });

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  maxUploadSizeMb: Number(process.env.MAX_UPLOAD_SIZE_MB || 50),
  db: {
    server: process.env.DB_SERVER || "LENOVO\\SQLEXPRESS",
    database: process.env.DB_NAME || "call_center_dashboard",
    driver: process.env.DB_DRIVER || "ODBC Driver 18 for SQL Server",
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10)
  }
};

export const paths = {
  projectRoot,
  backendRoot,
  uploadDir: path.resolve(backendRoot, env.uploadDir)
};
