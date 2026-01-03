import express from 'express';
import cors from 'cors';

// ROTAS (todas dentro de src/routes)
import downloadRoutes from './routes/download.js';
import generateRoutes from './routes/generate.js';
import youtubeRoutes from './routes/youtube.js';
import trimRoutes from './routes/trim.js';
import nicheRoutes from './routes/niches.js';
import retentionRoutes from './routes/retention.js';

// ⚠️ IMPORTA OS WORKERS (mesmo processo)
import './workers/videoProcessWorker.js';
import './workers/videoDownloadWorker.js';

const app = express();
const PORT = process.env.PORT || 3000;

// MIDDLEWARES
app.use(cors());
app.use(express.json());

// ROTAS
app.use('/api', downloadRoutes);
app.use('/api', generateRoutes);
app.use('/api', youtubeRoutes);
app.use('/api', trimRoutes);
app.use('/api', nicheRoutes);
app.use('/api', retentionRoutes);

// HEALTH CHECK (importante pro Railway)
app.get('/', (_, res) => {
  res.send('EZClip API running');
});

app.listen(PORT, () => {
  console.log(`🚀 API rodando na porta ${PORT}`);
});
