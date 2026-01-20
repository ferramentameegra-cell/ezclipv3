/**
 * AUTENTICAÇÃO SUPABASE - FRONTEND
 * Gerencia signup, login, sessão e verificação de email
 */

// Aguardar Supabase carregar
let supabase = null;

function getSupabaseClient() {
  if (!supabase) {
    // Tentar obter do SUPABASE_CONFIG primeiro
    if (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.getClient) {
      supabase = window.SUPABASE_CONFIG.getClient();
    } 
    // Fallback: criar diretamente
    else if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
      supabase = window.supabase.createClient(
        'https://wrsefdlvqprxjelxkvee.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyc2VmZGx2cXByeGplbHhrdmVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjExNjIsImV4cCI6MjA4NDQ5NzE2Mn0.gY7SYyAh0g6fjGbaFw9VT_h35Slq6NZysCf9gcd4CQI'
      );
      console.log('[SUPABASE-AUTH] Cliente criado diretamente');
    } else {
      console.warn('[SUPABASE-AUTH] Biblioteca Supabase ainda não carregada');
    }
  }
  return supabase;
}

/**
 * SIGN UP - Criar conta
 */
async function signUpSupabase(name, email, password) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente Supabase não inicializado');
    }

    // Validações
    if (!name || !email || !password) {
      throw new Error('Todos os campos são obrigatórios');
    }

    if (name.trim().length === 0) {
      throw new Error('Nome não pode estar vazio');
    }

    if (password.length < 6) {
      throw new Error('A senha deve ter no mínimo 6 caracteres');
    }

    // Criar conta no Supabase
    const { data, error } = await client.auth.signUp({
      email: email.trim().toLowerCase(),
      password: password,
      options: {
        data: {
          nome: name.trim()
        }
      }
    });

    if (error) {
      // Tratar erros específicos
      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        throw new Error('Email já cadastrado');
      }
      if (error.message.includes('Password')) {
        throw new Error('Senha muito fraca. Use pelo menos 6 caracteres.');
      }
      throw new Error(error.message || 'Erro ao criar conta');
    }

    if (!data || !data.user) {
      throw new Error('Erro ao criar conta - dados não retornados');
    }

    // NÃO fazer login automático - usuário deve confirmar email
    return {
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        email_confirmed_at: data.user.email_confirmed_at
      },
      requiresEmailConfirmation: !data.user.email_confirmed_at
    };
  } catch (error) {
    console.error('[SUPABASE-AUTH] Erro no signup:', error);
    throw error;
  }
}

/**
 * SIGN IN - Login
 */
async function signInSupabase(email, password) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente Supabase não inicializado');
    }

    // Validações
    if (!email || !password) {
      throw new Error('Email e senha são obrigatórios');
    }

    // Fazer login
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: password
    });

    if (error) {
      if (error.message.includes('Invalid login credentials') || error.message.includes('Invalid')) {
        throw new Error('Email ou senha incorretos');
      }
      throw new Error(error.message || 'Erro ao fazer login');
    }

    if (!data || !data.user) {
      throw new Error('Erro ao fazer login - dados não retornados');
    }

    // Verificar se email foi confirmado
    if (!data.user.email_confirmed_at) {
      // Fazer logout para não manter sessão não confirmada
      await client.auth.signOut();
      throw new Error('EMAIL_NOT_CONFIRMED');
    }

    // Buscar dados do usuário na tabela users
    const { data: userData, error: userError } = await client
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (userError || !userData) {
      console.error('[SUPABASE-AUTH] Erro ao buscar dados do usuário:', userError);
      // Continuar mesmo assim com dados básicos
    }

    return {
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        nome: userData?.nome || data.user.user_metadata?.nome,
        creditos: userData?.creditos || 1,
        email_confirmed_at: data.user.email_confirmed_at
      },
      session: data.session
    };
  } catch (error) {
    console.error('[SUPABASE-AUTH] Erro no login:', error);
    throw error;
  }
}

/**
 * SIGN OUT - Logout
 */
async function signOutSupabase() {
  try {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
    // Limpar localStorage
    localStorage.removeItem('ezv2_token');
    localStorage.removeItem('supabase_session');
    return { success: true };
  } catch (error) {
    console.error('[SUPABASE-AUTH] Erro no logout:', error);
    return { success: false, error: error.message };
  }
}

/**
 * GET SESSION - Verificar sessão atual
 */
async function getSessionSupabase() {
  try {
    const client = getSupabaseClient();
    if (!client) {
      return null;
    }

    const { data: { session }, error } = await client.auth.getSession();

    if (error || !session) {
      return null;
    }

    // Verificar se email foi confirmado
    if (!session.user.email_confirmed_at) {
      // Se não confirmado, fazer logout
      await signOutSupabase();
      return null;
    }

    // Buscar dados do usuário
    const { data: userData } = await client
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        nome: userData?.nome || session.user.user_metadata?.nome,
        creditos: userData?.creditos || 1,
        email_confirmed_at: session.user.email_confirmed_at
      },
      session: session
    };
  } catch (error) {
    console.error('[SUPABASE-AUTH] Erro ao obter sessão:', error);
    return null;
  }
}

/**
 * RESEND CONFIRMATION EMAIL - Reenviar email de confirmação
 */
async function resendConfirmationEmailSupabase(email) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente Supabase não inicializado');
    }

    const { error } = await client.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase()
    });

    if (error) {
      throw new Error(error.message || 'Erro ao reenviar email');
    }

    return { success: true };
  } catch (error) {
    console.error('[SUPABASE-AUTH] Erro ao reenviar email:', error);
    throw error;
  }
}

// Exportar funções globalmente
window.SupabaseAuth = {
  signUp: signUpSupabase,
  signIn: signInSupabase,
  signOut: signOutSupabase,
  getSession: getSessionSupabase,
  resendConfirmationEmail: resendConfirmationEmailSupabase
};
