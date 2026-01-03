import express from "express";
import { downloadWithProgress } from "../controllers/downloadProgressController.js";

const router = express.Router();

router.get("/download/progress", downloadWithProgress);

export default router;
