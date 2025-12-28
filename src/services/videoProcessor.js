import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
// jobs será passado como parâmetro

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const generateVideoSeries = async (job, jobsMap) => {
  try {
    const { videoId, numberOfCuts, seriesId } = job;
    
    // Simular processamento (em produção, usar ffmpeg real)
    const totalParts = numberOfCuts;
    const seriesPath = path.join(__dirname, '../../uploads/series', seriesId);
    
    if (!fs.existsSync(seriesPath)) {
      fs.mkdirSync(seriesPath, { recursive: true });
    }

    // Atualizar progresso
    for (let i = 1; i <= totalParts; i++) {
      job.progress = Math.round((i / totalParts) * 100);
      if (jobsMap) {
        jobsMap.set(job.id, job);
      }
      
      // Simular processamento de cada parte
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    job.status = 'completed';
    job.progress = 100;
    job.completedAt = new Date();
    if (jobsMap) {
      jobsMap.set(job.id, job);
    }

    return {
      seriesId,
      totalParts,
      status: 'completed'
    };
  } catch (error) {
    job.status = 'error';
    job.error = error.message;
    if (jobsMap) {
      jobsMap.set(job.id, job);
    }
    throw error;
  }
};

