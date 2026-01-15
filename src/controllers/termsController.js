/**
 * Controller para gerenciar aceite dos Termos de Uso
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Diretório para armazenar logs de aceite
const TERMS_LOG_DIR = path.join(__dirname, '../../logs/terms');
const TERMS_LOG_FILE = path.join(TERMS_LOG_DIR, 'acceptances.json');

// Garantir que o diretório existe
if (!fs.existsSync(TERMS_LOG_DIR)) {
  fs.mkdirSync(TERMS_LOG_DIR, { recursive: true });
}

/**
 * Registrar aceite dos Termos de Uso
 * POST /api/terms/accept
 */
export const acceptTerms = async (req, res) => {
  try {
    const { timestamp, sessionId, ipAddress, userAgent } = req.body;

    // Validações básicas
    if (!timestamp || !sessionId) {
      return res.status(400).json({ 
        error: 'Timestamp e sessionId são obrigatórios' 
      });
    }

    // Obter IP do cliente (pode vir do header ou do body)
    const clientIP = ipAddress || req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Criar registro de aceite
    const acceptanceRecord = {
      timestamp: timestamp || new Date().toISOString(),
      sessionId: sessionId,
      ipAddress: clientIP,
      userAgent: userAgent || req.headers['user-agent'] || 'Unknown',
      date: new Date().toISOString()
    };

    // Salvar em arquivo JSON (append)
    let acceptances = [];
    if (fs.existsSync(TERMS_LOG_FILE)) {
      try {
        const fileContent = fs.readFileSync(TERMS_LOG_FILE, 'utf8');
        acceptances = JSON.parse(fileContent);
      } catch (error) {
        console.error('[TERMS] Erro ao ler arquivo de aceites:', error);
        acceptances = [];
      }
    }

    acceptances.push(acceptanceRecord);

    // Manter apenas os últimos 10000 registros (evitar arquivo muito grande)
    if (acceptances.length > 10000) {
      acceptances = acceptances.slice(-10000);
    }

    fs.writeFileSync(TERMS_LOG_FILE, JSON.stringify(acceptances, null, 2), 'utf8');

    console.log(`[TERMS] ✅ Aceite registrado: Session ${sessionId} - IP: ${clientIP}`);

    res.status(200).json({ 
      success: true, 
      message: 'Aceite dos termos registrado com sucesso',
      timestamp: acceptanceRecord.timestamp
    });

  } catch (error) {
    console.error('[TERMS] Erro ao registrar aceite:', error);
    res.status(500).json({ 
      error: 'Erro ao registrar aceite dos termos',
      details: error.message 
    });
  }
};
