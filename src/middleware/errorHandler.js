/**
 * MIDDLEWARE DE TRATAMENTO DE ERROS
 * Centraliza o tratamento de erros da aplicação
 * Nunca expõe stack trace ou informações sensíveis
 */

// Logger será importado dinamicamente
let logger = null;

// Função para obter logger de forma segura
async function getLogger() {
  if (logger) {
    return logger;
  }
  
  try {
    const loggerModule = await import('./logger.js');
    logger = loggerModule.logger || loggerModule.default;
    return logger;
  } catch (error) {
    // Logger não disponível, usar console
    logger = {
      error: (message, data) => {
        console.error('[ERROR]', message, data);
      }
    };
    return logger;
  }
}

/**
 * Middleware de tratamento de erros
 * Deve ser o último middleware registrado
 * NUNCA expõe stack trace ou informações sensíveis
 */
export const errorHandler = (err, req, res, next) => {
  // Log do erro completo (apenas no servidor) - assíncrono para não bloquear
  getLogger().then(loggerInstance => {
    try {
      if (loggerInstance && typeof loggerInstance.error === 'function') {
        loggerInstance.error('Application Error', {
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
      } else {
        console.error('[ERROR]', {
          message: err.message,
          path: req.path,
          method: req.method,
          ip: req.ip
        });
      }
    } catch (logError) {
      // Se logger falhar, usar console (nunca bloquear resposta)
      console.error('[ERROR] Erro ao logar:', logError.message);
    }
  }).catch(() => {
    // Se getLogger falhar, usar console
    console.error('[ERROR]', {
      message: err.message,
      path: req.path,
      method: req.method,
      ip: req.ip
    });
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
