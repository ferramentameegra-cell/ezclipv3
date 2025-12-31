/**
 * Worker Process - Executa processamento assíncrono
 * Pode ser executado em processos separados para escalabilidade horizontal
 * 
 * Uso:
 *   node worker.js
 * 
 * Ou configure múltiplos workers:
 *   node worker.js (processo 1)
 *   node worker.js (processo 2)
 *   node worker.js (processo 3)
 */

import dotenv from 'dotenv';
dotenv.config();

// Importar workers (inicia processamento automático)
import './src/workers/videoDownloadWorker.js';
import './src/workers/videoProcessWorker.js';

console.log('🚀 Workers iniciados - Pronto para processar jobs');
console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔄 Redis: ${process.env.REDIS_URL || 'localhost:6379'}`);

// Manter processo vivo
process.on('SIGTERM', () => {
  console.log('SIGTERM received, encerrando workers...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, encerrando workers...');
  process.exit(0);
});

