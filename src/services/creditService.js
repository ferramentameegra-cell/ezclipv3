/**
 * SERVIÇO DE CONTROLE DE CRÉDITOS
 * Gerencia créditos dos usuários (1 crédito = 1 vídeo)
 * Usa Supabase para persistência
 */

import { supabaseAdmin } from '../config/supabase.js';

// Verificar se Supabase está configurado
if (!supabaseAdmin) {
  console.warn('[CREDITS] ⚠️ Supabase não configurado. Configure SUPABASE_SERVICE_ROLE_KEY no Railway. Funcionalidades de créditos podem não funcionar.');
}

/**
 * Obter créditos do usuário
 */
export async function getUserCredits(userId) {
  try {
    if (!supabaseAdmin) {
      console.error('[CREDITS] Supabase não configurado');
      return 0;
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('creditos')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.error('[CREDITS] Erro ao buscar créditos:', error);
      return 0;
    }

    return data.creditos || 0;
  } catch (error) {
    console.error('[CREDITS] Erro ao buscar créditos:', error);
    return 0;
  }
}

/**
 * Verificar se usuário tem créditos disponíveis
 * Retorna true se creditos > 0 ou creditos = -1 (ilimitado)
 */
export async function hasCredits(userId) {
  const creditos = await getUserCredits(userId);
  
  // -1 = créditos ilimitados
  if (creditos === -1) {
    return true;
  }
  
  return creditos > 0;
}

/**
 * Decrementar 1 crédito do usuário
 * IMPORTANTE: Só deve ser chamado pelo backend após geração bem-sucedida
 */
export async function decrementCredits(userId) {
  try {
    if (!supabaseAdmin) {
      throw new Error('Supabase não configurado. Configure SUPABASE_SERVICE_ROLE_KEY no Railway.');
    }

    // Buscar créditos atuais
    const { data: userData, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('creditos')
      .eq('id', userId)
      .single();

    if (fetchError || !userData) {
      throw new Error('Usuário não encontrado');
    }

    const currentCredits = userData.creditos || 0;

    // Se for ilimitado (-1), não decrementar
    if (currentCredits === -1) {
      console.log(`[CREDITS] Usuário ${userId} tem créditos ilimitados. Não decrementando.`);
      return { creditos: -1, decremented: false };
    }

    // Se não tiver créditos, não decrementar (não deve chegar aqui se validação estiver correta)
    if (currentCredits <= 0) {
      throw new Error('Usuário não tem créditos disponíveis');
    }

    // Decrementar 1 crédito
    const newCredits = currentCredits - 1;

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ creditos: newCredits })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar créditos: ${error.message}`);
    }

    console.log(`[CREDITS] Crédito decrementado para usuário ${userId}: ${currentCredits} -> ${newCredits}`);

    return {
      creditos: newCredits,
      decremented: true
    };
  } catch (error) {
    console.error('[CREDITS] Erro ao decrementar créditos:', error);
    throw error;
  }
}

/**
 * Adicionar créditos ao usuário (para compras, etc)
 */
export async function addCredits(userId, amount) {
  try {
    if (!supabaseAdmin) {
      throw new Error('Supabase não configurado. Configure SUPABASE_SERVICE_ROLE_KEY no Railway.');
    }

    if (amount <= 0) {
      throw new Error('Quantidade de créditos deve ser maior que zero');
    }

    // Buscar créditos atuais
    const { data: userData, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('creditos')
      .eq('id', userId)
      .single();

    if (fetchError || !userData) {
      throw new Error('Usuário não encontrado');
    }

    const currentCredits = userData.creditos || 0;

    // Se for ilimitado (-1), não adicionar
    if (currentCredits === -1) {
      console.log(`[CREDITS] Usuário ${userId} tem créditos ilimitados. Não adicionando.`);
      return { creditos: -1, added: false };
    }

    const newCredits = currentCredits + amount;

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ creditos: newCredits })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao adicionar créditos: ${error.message}`);
    }

    console.log(`[CREDITS] ${amount} crédito(s) adicionado(s) para usuário ${userId}: ${currentCredits} -> ${newCredits}`);

    return {
      creditos: newCredits,
      added: true
    };
  } catch (error) {
    console.error('[CREDITS] Erro ao adicionar créditos:', error);
    throw error;
  }
}

/**
 * Verificar se usuário pode gerar vídeo
 */
export async function canGenerateVideo(userId) {
  const creditos = await getUserCredits(userId);
  
  // -1 = ilimitado
  if (creditos === -1) {
    return {
      allowed: true,
      creditos: -1,
      reason: null
    };
  }
  
  if (creditos <= 0) {
    return {
      allowed: false,
      creditos: creditos,
      reason: 'Créditos esgotados. Compre mais créditos para continuar gerando vídeos.'
    };
  }
  
  return {
    allowed: true,
    creditos: creditos,
    reason: null
  };
}
