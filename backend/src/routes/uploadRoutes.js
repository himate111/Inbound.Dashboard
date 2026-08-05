import express from "express";
import multer from "multer";
import path from "path";
import { paths, env } from "../config/env.js";
import { uploadCsv } from "../controllers/uploadController.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: paths.uploadDir,
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: env.maxUploadSizeMb * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.mimetype === "text/csv" || ext === ".csv") {
      cb(null, true);
      return;
    }
    const error = new Error("Only CSV files are allowed.");
    error.statusCode = 400;
    cb(error);
  }
});

router.post("/", upload.single("file"), uploadCsv);

export default router;
