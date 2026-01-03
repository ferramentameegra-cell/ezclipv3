import express from 'express';
import cors from 'cors';

// ROTAS (todas dentro de src/routes)
import downloadRoutes from './src/routes/download.js';
import generateRoutes from './src/routes/generate.js';
import youtubeRoutes from './src/routes/youtube.js';
import trimRoutes from './src/routes/trim.js';
import nicheRoutes from './src/routes/niches.js';
import retentionRoutes from './src/routes/retention.js';

// WORKERS (precisam ser importados UMA VEZ)
import './src/workers/videoProcessWorker.js';
import './src/workers/videoDownloadWorker.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Rotas API
app.use('/api', downloadRoutes);
app.use('/api', generateRoutes);
app.use('/api', youtubeRoutes);
app.use('/api', trimRoutes);
app.use('/api', nicheRoutes);
app.use('/api', retentionRoutes);

// Frontend estático
app.use(express.static('public'));

// Health check (Railway gosta disso)
app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`🚀 EZClip rodando na porta ${PORT}`);
});
