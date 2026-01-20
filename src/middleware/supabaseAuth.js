/**
 * MIDDLEWARE DE AUTENTICAÇÃO SUPABASE
 * Valida tokens JWT do Supabase e extrai informações do usuário
 */

import { supabaseAdmin } from '../config/supabase.js';

/**
 * Middleware para verificar autenticação via Supabase
 * Extrai token do header Authorization ou cookie
 */
export const requireSupabaseAuth = async (req, res, next) => {
  try {
    // Verificar se o cliente Supabase está disponível
    if (!supabaseAdmin) {
      return res.status(503).json({
        error: 'Serviço de autenticação não configurado. Configure SUPABASE_SERVICE_ROLE_KEY.',
        code: 'AUTH_NOT_CONFIGURED'
      });
    }

    // Obter token do header Authorization ou cookie
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies['sb-access-token']) {
      token = req.cookies['sb-access-token'];
    }

    if (!token) {
      return res.status(401).json({
        error: 'Token de autenticação não fornecido',
        code: 'NO_TOKEN'
      });
    }

    // Verificar token com Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: 'Token inválido ou expirado',
        code: 'INVALID_TOKEN'
      });
    }

    // Verificar se email foi confirmado
    if (!user.email_confirmed_at) {
      return res.status(403).json({
        error: 'Email não confirmado. Verifique sua caixa de entrada.',
        code: 'EMAIL_NOT_CONFIRMED'
      });
    }

    // Buscar dados do usuário na tabela users
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      console.error('[AUTH] Erro ao buscar dados do usuário:', userError);
      return res.status(500).json({
        error: 'Erro ao buscar dados do usuário',
        code: 'USER_DATA_ERROR'
      });
    }

    // Adicionar informações do usuário ao request
    req.user = {
      id: user.id,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      ...userData
    };
    req.userId = user.id;

    next();
  } catch (error) {
    console.error('[AUTH] Erro no middleware de autenticação:', error);
    return res.status(500).json({
      error: 'Erro ao verificar autenticação',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Middleware opcional - não bloqueia se não autenticado
 */
export const optionalSupabaseAuth = async (req, res, next) => {
  try {
    // Se o cliente não estiver disponível, continuar sem autenticação
    if (!supabaseAdmin) {
      return next();
    }

    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies['sb-access-token']) {
      token = req.cookies['sb-access-token'];
    }

    if (token) {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      
      if (!error && user && user.email_confirmed_at) {
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (userData) {
          req.user = {
            id: user.id,
            email: user.email,
            email_confirmed_at: user.email_confirmed_at,
            ...userData
          };
          req.userId = user.id;
        }
      }
    }

    next();
  } catch (error) {
    // Em caso de erro, continuar sem autenticação
    next();
  }
};
