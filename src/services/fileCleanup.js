import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Limpa arquivos temporários antigos
 * Executa periodicamente para evitar acúmulo de arquivos
 */
export async function cleanupOldFiles(maxAgeHours = 24) {
  const uploadsDir = path.join(__dirname, '../../uploads');
  const seriesDir = path.join(__dirname, '../../uploads/series');
  const maxAge = maxAgeHours * 60 * 60 * 1000; // Converter para milissegundos
  const now = Date.now();
  let cleanedCount = 0;
  let totalSizeFreed = 0;

  try {
    // Limpar vídeos originais antigos
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      
      for (const file of files) {
        if (file === 'series') continue; // Pular diretório de séries
        
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile() && (now - stats.mtimeMs) > maxAge) {
          try {
            const fileSize = stats.size;
            fs.unlinkSync(filePath);
            cleanedCount++;
            totalSizeFreed += fileSize;
            console.log(`[CLEANUP] Removido: ${file} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
          } catch (error) {
            console.error(`[CLEANUP] Erro ao remover ${file}:`, error.message);
          }
        }
      }
    }

    // Limpar séries antigas
    if (fs.existsSync(seriesDir)) {
      const seriesDirs = fs.readdirSync(seriesDir);
      
      for (const seriesId of seriesDirs) {
        const seriesPath = path.join(seriesDir, seriesId);
        const stats = fs.statSync(seriesPath);
        
        if (stats.isDirectory() && (now - stats.mtimeMs) > maxAge) {
          try {
            // Calcular tamanho total da série
            let seriesSize = 0;
            const files = fs.readdirSync(seriesPath);
            for (const file of files) {
              const filePath = path.join(seriesPath, file);
              const fileStats = fs.statSync(filePath);
              seriesSize += fileStats.size;
            }
            
            // Remover diretório completo
            fs.rmSync(seriesPath, { recursive: true, force: true });
            cleanedCount++;
            totalSizeFreed += seriesSize;
            console.log(`[CLEANUP] Removida série: ${seriesId} (${(seriesSize / 1024 / 1024).toFixed(2)} MB)`);
          } catch (error) {
            console.error(`[CLEANUP] Erro ao remover série ${seriesId}:`, error.message);
          }
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`[CLEANUP] Limpeza concluída: ${cleanedCount} itens removidos, ${(totalSizeFreed / 1024 / 1024).toFixed(2)} MB liberados`);
    }

    return { cleanedCount, totalSizeFreed };
  } catch (error) {
    console.error('[CLEANUP] Erro na limpeza:', error);
    return { cleanedCount: 0, totalSizeFreed: 0 };
  }
}

/**
 * Limpa arquivo específico
 */
export function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      fs.unlinkSync(filePath);
      console.log(`[CLEANUP] Arquivo removido: ${filePath} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`[CLEANUP] Erro ao remover arquivo ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Limpa série específica
 */
export function cleanupSeries(seriesId) {
  try {
    const seriesPath = path.join(__dirname, '../../uploads/series', seriesId);
    
    if (fs.existsSync(seriesPath)) {
      let seriesSize = 0;
      const files = fs.readdirSync(seriesPath);
      
      for (const file of files) {
        const filePath = path.join(seriesPath, file);
        const fileStats = fs.statSync(filePath);
        seriesSize += fileStats.size;
      }
      
      fs.rmSync(seriesPath, { recursive: true, force: true });
      console.log(`[CLEANUP] Série removida: ${seriesId} (${(seriesSize / 1024 / 1024).toFixed(2)} MB)`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`[CLEANUP] Erro ao remover série ${seriesId}:`, error.message);
    return false;
  }
}

