import express from 'express';
import cors from 'cors';

import downloadRoutes from './routes/download.js';
import generateRoutes from './routes/generate.js';
import youtubeRoutes from './routes/youtube.js';
import trimRoutes from './routes/trim.js';
import nicheRoutes from './routes/niches.js';
import retentionRoutes from './routes/retention.js';

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARES =====
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== ROTAS =====
app.use('/api', downloadRoutes);
app.use('/api', generateRoutes);
app.use('/api', youtubeRoutes);
app.use('/api', trimRoutes);
app.use('/api', nicheRoutes);
app.use('/api', retentionRoutes);

// ===== START =====
app.listen(PORT, () => {
  console.log(`🚀 EZCLIP API rodando na porta ${PORT}`);
});
