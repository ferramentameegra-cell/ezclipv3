/**
 * CONTROLLER DE AUTENTICAÇÃO - SUPABASE
 * Gerencia registro, login e verificação usando Supabase Auth
 */

import { supabaseAdmin } from '../config/supabase.js';

// Verificar se Supabase está configurado
if (!supabaseAdmin) {
  console.warn('[AUTH] ⚠️ Supabase não configurado. Configure SUPABASE_SERVICE_ROLE_KEY no Railway. Funcionalidades de autenticação podem não funcionar.');
}

/**
 * POST /api/auth/register
 * Registrar novo usuário via Supabase Auth
 */
export const register = async (req, res) => {
  try {
    if (!supabaseAdmin) {
      // Se Supabase não estiver configurado, retornar erro
      console.error('[AUTH] ❌ Supabase não configurado - SUPABASE_SERVICE_ROLE_KEY não definida');
      return res.status(503).json({
        success: false,
        error: 'Serviço de autenticação não configurado. Configure SUPABASE_SERVICE_ROLE_KEY no Railway.',
        code: 'AUTH_NOT_CONFIGURED'
      });
    }

    const { name, email, password } = req.body;

    // Validações
    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Todos os campos são obrigatórios',
        code: 'MISSING_FIELDS'
      });
    }

    if (name.trim().length === 0) {
      return res.status(400).json({
        error: 'Nome não pode estar vazio',
        code: 'EMPTY_NAME'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'A senha deve ter no mínimo 6 caracteres',
        code: 'WEAK_PASSWORD'
      });
    }

    // Email validation básica
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Email inválido',
        code: 'INVALID_EMAIL'
      });
    }

    // Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
      email: email.trim().toLowerCase(),
      password: password,
      options: {
        data: {
          nome: name.trim()
        },
        emailRedirectTo: `${req.protocol}://${req.get('host')}/auth/confirm`
      }
    });

    if (authError) {
      console.error('[AUTH] Erro ao criar usuário no Supabase:', authError);
      
      // Tratar erros específicos do Supabase
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        return res.status(400).json({
          error: 'Email já cadastrado',
          code: 'EMAIL_EXISTS'
        });
      }

      if (authError.message.includes('Password')) {
        return res.status(400).json({
          error: 'Senha muito fraca. Use pelo menos 6 caracteres.',
          code: 'WEAK_PASSWORD'
        });
      }

      return res.status(400).json({
        error: authError.message || 'Erro ao criar conta',
        code: 'REGISTER_ERROR'
      });
    }

    if (!authData || !authData.user) {
      return res.status(500).json({
        error: 'Erro ao criar conta - dados não retornados',
        code: 'REGISTER_ERROR'
      });
    }

    // O trigger do Supabase criará automaticamente o registro na tabela users
    // Aguardar um pouco para garantir que o trigger foi executado
    await new Promise(resolve => setTimeout(resolve, 500));

    // Buscar dados do usuário criado na tabela users
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    console.log(`[AUTH] Novo usuário registrado: ${email} (ID: ${authData.user.id})`);

    // NÃO logar automaticamente - usuário deve confirmar email primeiro
    res.status(201).json({
      message: 'Conta criada com sucesso. Verifique seu email para confirmar a conta.',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        email_confirmed_at: authData.user.email_confirmed_at,
        creditos: userData?.creditos || 1
      },
      requiresEmailConfirmation: true
    });
  } catch (error) {
    console.error('[AUTH] Erro ao registrar:', error);
    res.status(500).json({
      error: 'Erro ao criar conta',
      code: 'REGISTER_ERROR'
    });
  }
};

/**
 * POST /api/auth/login
 * Login via Supabase Auth
 */
export const login = async (req, res) => {
  try {
    if (!supabaseAdmin) {
      // Se Supabase não estiver configurado, retornar erro
      console.error('[AUTH] ❌ Supabase não configurado - SUPABASE_SERVICE_ROLE_KEY não definida');
      return res.status(503).json({
        success: false,
        error: 'Serviço de autenticação não configurado. Configure SUPABASE_SERVICE_ROLE_KEY no Railway.',
        code: 'AUTH_NOT_CONFIGURED'
      });
    }

    const { email, password } = req.body;

    // Validações
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email e senha são obrigatórios',
        code: 'MISSING_FIELDS'
      });
    }

    // Fazer login no Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: password
    });

    if (authError) {
      console.error('[AUTH] Erro no login:', authError);
      
      if (authError.message.includes('Invalid login credentials') || authError.message.includes('Invalid')) {
        return res.status(401).json({
          error: 'Email ou senha incorretos',
          code: 'INVALID_CREDENTIALS'
        });
      }

      return res.status(401).json({
        error: authError.message || 'Erro ao fazer login',
        code: 'LOGIN_ERROR'
      });
    }

    if (!authData || !authData.user) {
      return res.status(401).json({
        error: 'Erro ao fazer login - dados não retornados',
        code: 'LOGIN_ERROR'
      });
    }

    // Verificar se email foi confirmado
    if (!authData.user.email_confirmed_at) {
      // Fazer logout para não manter sessão não confirmada
      await supabaseAdmin.auth.signOut();
      
      return res.status(403).json({
        error: 'Email não confirmado. Verifique sua caixa de entrada e confirme seu email antes de fazer login.',
        code: 'EMAIL_NOT_CONFIRMED'
      });
    }

    // Buscar dados do usuário na tabela users
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (userError || !userData) {
      console.error('[AUTH] Erro ao buscar dados do usuário:', userError);
      return res.status(500).json({
        error: 'Erro ao buscar dados do usuário',
        code: 'USER_DATA_ERROR'
      });
    }

    // Configurar cookie com token de acesso (opcional - frontend pode usar session)
    // Cookie com expiração muito longa (1 ano) para manter usuário conectado
    if (authData.session) {
      // Usar expiração de 1 ano (31536000000 ms) ao invés do expires_in do Supabase
      // Isso mantém o usuário conectado por muito tempo
      const oneYearInMs = 365 * 24 * 60 * 60 * 1000; // 1 ano em milissegundos
      res.cookie('sb-access-token', authData.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: oneYearInMs // 1 ano - mantém usuário conectado
      });
    }

    console.log(`[AUTH] Login bem-sucedido: ${email} (ID: ${authData.user.id})`);

    // Retornar resposta compatível com frontend (suporta tanto token direto quanto session)
    const responseData = {
      message: 'Login realizado com sucesso',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        nome: userData.nome || authData.user.user_metadata?.nome,
        creditos: userData.creditos || 1,
        email_confirmed_at: authData.user.email_confirmed_at
      },
      session: {
        access_token: authData.session?.access_token,
        refresh_token: authData.session?.refresh_token,
        expires_at: authData.session?.expires_at
      }
    };

    // Adicionar token direto para compatibilidade com código antigo
    if (authData.session?.access_token) {
      responseData.token = authData.session.access_token;
    }

    res.json(responseData);
  } catch (error) {
    console.error('[AUTH] Erro ao fazer login:', error);
    res.status(500).json({
      error: 'Erro ao fazer login',
      code: 'LOGIN_ERROR'
    });
  }
};

/**
 * POST /api/auth/logout
 * Logout via Supabase
 */
export const logout = async (req, res) => {
  try {
    // Obter token do header ou cookie
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : req.cookies?.['sb-access-token'];

    if (token) {
      // Fazer logout no Supabase
      await supabaseAdmin.auth.signOut(token);
    }

    // Limpar cookie
    res.clearCookie('sb-access-token');

    res.json({
      message: 'Logout realizado com sucesso'
    });
  } catch (error) {
    console.error('[AUTH] Erro ao fazer logout:', error);
    res.json({
      message: 'Logout realizado'
    });
  }
};

/**
 * GET /api/auth/me
 * Obter dados do usuário autenticado
 */
export const getMe = async (req, res) => {
  try {
    // req.user já foi preenchido pelo middleware requireSupabaseAuth
    if (!req.user) {
      return res.status(401).json({
        error: 'Não autenticado',
        code: 'NOT_AUTHENTICATED'
      });
    }

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        nome: req.user.nome,
        creditos: req.user.creditos || 1,
        email_confirmed_at: req.user.email_confirmed_at
      }
    });
  } catch (error) {
    console.error('[AUTH] Erro ao buscar dados do usuário:', error);
    res.status(500).json({
      error: 'Erro ao buscar dados do usuário',
      code: 'USER_DATA_ERROR'
    });
  }
};

/**
 * POST /api/auth/forgot-password
 * Enviar email de redefinição de senha
 */
export const forgotPassword = async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({
        error: 'Serviço de autenticação não configurado',
        code: 'AUTH_NOT_CONFIGURED'
      });
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email é obrigatório',
        code: 'MISSING_EMAIL'
      });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const redirectTo = `${baseUrl}/auth/reset-password`;

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo
    });

    if (error) {
      const isRateLimit = error.message?.toLowerCase().includes('rate limit') || error.message?.toLowerCase().includes('too many');
      return res.status(400).json({
        error: isRateLimit
          ? 'Muitas tentativas. Aguarde 1 hora ou faça login e use "Trocar senha" no menu do usuário.'
          : error.message || 'Erro ao enviar email',
        code: isRateLimit ? 'RATE_LIMIT_EXCEEDED' : 'FORGOT_PASSWORD_ERROR'
      });
    }

    res.json({
      message: 'Se o email existir, você receberá um link para redefinir sua senha'
    });
  } catch (error) {
    console.error('[AUTH] Erro ao enviar email de redefinição:', error);
    res.status(500).json({
      error: 'Erro ao enviar email',
      code: 'FORGOT_PASSWORD_ERROR'
    });
  }
};

/**
 * POST /api/auth/change-password
 * Trocar senha (usuário logado) - sem enviar email, sem rate limit
 */
export const changePassword = async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({
        error: 'Serviço de autenticação não configurado',
        code: 'AUTH_NOT_CONFIGURED'
      });
    }

    const userId = req.userId || req.user?.id;
    const userEmail = req.user?.email;

    if (!userId || !userEmail) {
      return res.status(401).json({
        error: 'Faça login para trocar a senha',
        code: 'NOT_AUTHENTICATED'
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Senha atual e nova senha são obrigatórias',
        code: 'MISSING_FIELDS'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'A nova senha deve ter no mínimo 6 caracteres',
        code: 'WEAK_PASSWORD'
      });
    }

    const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: userEmail.trim().toLowerCase(),
      password: currentPassword
    });

    if (signInError) {
      return res.status(401).json({
        error: 'Senha atual incorreta',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (updateError) {
      return res.status(400).json({
        error: updateError.message || 'Erro ao alterar senha',
        code: 'CHANGE_PASSWORD_ERROR'
      });
    }

    res.json({
      message: 'Parabéns, senha alterada com sucesso!'
    });
  } catch (error) {
    console.error('[AUTH] Erro ao trocar senha:', error);
    res.status(500).json({
      error: 'Erro ao alterar senha',
      code: 'CHANGE_PASSWORD_ERROR'
    });
  }
};

/**
 * POST /api/auth/verify-email
 * Reenviar email de confirmação
 */
export const resendConfirmationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email é obrigatório',
        code: 'MISSING_EMAIL'
      });
    }

    const { error } = await supabaseAdmin.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase()
    });

    if (error) {
      return res.status(400).json({
        error: error.message || 'Erro ao reenviar email',
        code: 'RESEND_ERROR'
      });
    }

    res.json({
      message: 'Email de confirmação reenviado com sucesso'
    });
  } catch (error) {
    console.error('[AUTH] Erro ao reenviar email:', error);
    res.status(500).json({
      error: 'Erro ao reenviar email de confirmação',
      code: 'RESEND_ERROR'
    });
  }
};
