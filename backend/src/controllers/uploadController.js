import fs from "fs/promises";
import { importCsv } from "../services/importService.js";

export async function uploadCsv(req, res, next) {
  if (!req.file) {
    res.status(400).json({
      success: false,
      message: "CSV file is required."
    });
    return;
  }

  try {
    const result = await importCsv(req.file.path);
    res.json(result);
  } catch (error) {
    next(error);
  } finally {
    await fs.rm(req.file.path, { force: true }).catch(() => undefined);
  }
}
