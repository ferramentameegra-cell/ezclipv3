import express from "express";
import { downloadWithProgress, getVideoState } from "../controllers/downloadProgressController.js";

const router = express.Router();

router.get("/download/progress", downloadWithProgress);
router.get("/download/state/:videoId", getVideoState);

export default router;
