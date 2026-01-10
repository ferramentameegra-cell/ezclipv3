import express from "express";
import { downloadWithProgress, getVideoState } from "../controllers/downloadProgressController.js";

const router = express.Router();

// Rotas já são prefixadas com /api/download no index.js
// Então aqui só precisamos /progress e /state/:videoId
router.get("/progress", downloadWithProgress);
router.get("/state/:videoId", getVideoState);

export default router;
