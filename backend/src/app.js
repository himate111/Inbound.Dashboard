import express from "express";
import cors from "cors";
import morgan from "morgan";
import fs from "fs";
import { env, paths } from "./config/env.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";

fs.mkdirSync(paths.uploadDir, { recursive: true });

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.get("/api/health", (req, res) => {
  res.json({ success: true, status: "ok" });
});

app.use("/api/upload", uploadRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
