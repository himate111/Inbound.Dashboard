    import express from "express";
    import { dashboard, filters } from "../controllers/dashboardController.js";

    const router = express.Router();

    router.get("/", dashboard);
    router.get("/filters", filters);

    export default router;
