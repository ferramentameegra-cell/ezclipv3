/**
 * MIDDLEWARE DE TRATAMENTO DE ERROS
 * Centraliza o tratamento de erros da aplicação
 * Nunca expõe stack trace ou informações sensíveis
 */

import { logger } from './logger.js';

/**
 * Middleware de tratamento de erros
 * Deve ser o último middleware registrado
 */
export const errorHandler = (err, req, res, next) => {
  // Log do erro completo (apenas no servidor)
  logger.error('Application Error', {
    error: {
      message: err.message,
      stack: err.stack,
      code: err.code,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id || null
    }
  });

  // Determinar status code
  const statusCode = err.statusCode || err.status || 500;

  // Resposta genérica para o cliente (nunca expor detalhes)
  const response = {
    error: 'Ocorreu um erro ao processar sua requisição',
    code: err.code || 'INTERNAL_ERROR'
  };

  // Em desenvolvimento, adicionar mais informações (opcional)
  if (process.env.NODE_ENV === 'development') {
    response.message = err.message;
  }

  res.status(statusCode).json(response);
};

/**
 * Middleware para capturar erros 404
 */
export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    code: 'NOT_FOUND',
    path: req.path
  });
};

/**
 * Wrapper para async handlers (evita try/catch repetitivo)
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default errorHandler;
