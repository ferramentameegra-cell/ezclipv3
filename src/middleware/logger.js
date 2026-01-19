/**
 * MIDDLEWARE DE LOGGING
 * Sistema de logs estruturado para auditoria usando Winston
 */

import winston from 'winston';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jwtConfig } from '../config/security.js';

// Garantir que o diretório de logs existe
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsDir = path.join(__dirname, '../../logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configurar Winston
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ezclips-backend' },
  transports: [
    // Logs de erro em arquivo separado
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Todos os logs em arquivo geral
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Em desenvolvimento, também logar no console
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Middleware de logging de requisições
 */
export const loggerMiddleware = (req, res, next) => {
  // Log apenas requisições importantes (não health checks, etc)
  if (!req.path.startsWith('/health') && !req.path.startsWith('/favicon')) {
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id || null
    });
  }
  next();
};

/**
 * Registrar tentativa de login (sucesso ou falha)
 */
export function logLoginAttempt({ email, success, ipAddress, userAgent, userId = null }) {
  logger.info('Login Attempt', {
    event: 'login_attempt',
    email: email, // Em produção, considerar anonimizar
    success,
    ipAddress,
    userAgent,
    userId,
    timestamp: new Date().toISOString()
  });
}

/**
 * Registrar acesso a dados sensíveis
 */
export function logSensitiveAccess({ userId, resource, action, ipAddress, userAgent }) {
  logger.warn('Sensitive Access', {
    event: 'sensitive_access',
    userId,
    resource,
    action,
    ipAddress,
    userAgent,
    timestamp: new Date().toISOString()
  });
}

/**
 * Registrar deleção de conta
 */
export function logAccountDeletion({ userId, email, ipAddress, userAgent }) {
  logger.warn('Account Deletion', {
    event: 'account_deletion',
    userId,
    email, // Em produção, considerar anonimizar
    ipAddress,
    userAgent,
    timestamp: new Date().toISOString()
  });
}

/**
 * Registrar erro de segurança
 */
export function logSecurityError({ type, message, ipAddress, userAgent, userId = null }) {
  logger.error('Security Error', {
    event: 'security_error',
    type,
    message,
    ipAddress,
    userAgent,
    userId,
    timestamp: new Date().toISOString()
  });
}

// Exportar logger para uso direto
export { logger };

export default loggerMiddleware;
