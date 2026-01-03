import express from "express";
import cors from "cors";
import downloadRoutes from "./routes/download.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", downloadRoutes);

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});
