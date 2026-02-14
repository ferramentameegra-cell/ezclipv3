/**
 * SERVIÇO DE ASSINATURAS
 * Gerencia planos, vídeos permitidos e integração com Stripe/Supabase
 * Usa tabela users no Supabase
 */

import { supabaseAdmin } from '../config/supabase.js';

// Mapeamento de planos para videos_allowed
const PLAN_VIDEOS_ALLOWED = {
  free: 1,
  creator: 10,
  pro: 40,
  unlimited: -1 // -1 = ilimitado
};

/**
 * Obter videos_allowed para um plano
 */
export function getPlanVideosAllowed(planName) {
  const normalized = (planName || 'free').toLowerCase();
  return PLAN_VIDEOS_ALLOWED[normalized] ?? 1;
}

/**
 * Atualizar assinatura do usuário no Supabase
 * Chamado pelo webhook quando pagamento é confirmado
 */
export async function updateUserSubscription({
  userId,
  planName,
  videosAllowed,
  subscriptionStatus,
  stripeCustomerId,
  stripeSubscriptionId
}) {
  if (!supabaseAdmin) {
    throw new Error('Supabase não configurado. Configure SUPABASE_SERVICE_ROLE_KEY.');
  }

  const updates = {
    plan_name: planName || 'free',
    videos_allowed: videosAllowed ?? 1,
    subscription_status: subscriptionStatus || 'active',
    updated_at: new Date().toISOString()
  };

  if (stripeCustomerId) updates.stripe_customer_id = stripeCustomerId;
  if (stripeSubscriptionId) updates.stripe_subscription_id = stripeSubscriptionId;

  // Manter videos_used se já existir (não resetar)
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('videos_used')
    .eq('id', userId)
    .single();

  if (existing && existing.videos_used === undefined) {
    updates.videos_used = 0;
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('[SUBSCRIPTION] Erro ao atualizar assinatura:', error);
    throw new Error(`Erro ao atualizar assinatura: ${error.message}`);
  }

  console.log(`[SUBSCRIPTION] ✅ Usuário ${userId} atualizado: plano=${planName}, videos_allowed=${videosAllowed}`);
  return data;
}

/**
 * Obter dados de assinatura do usuário
 */
export async function getUserSubscriptionData(userId) {
  if (!supabaseAdmin) {
    return {
      plan_name: 'free',
      videos_allowed: 1,
      videos_used: 0,
      subscription_status: 'active'
    };
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('plan_name, videos_allowed, videos_used, subscription_status, stripe_customer_id, stripe_subscription_id')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return {
      plan_name: 'free',
      videos_allowed: 1,
      videos_used: 0,
      subscription_status: 'active'
    };
  }

  return {
    plan_name: data.plan_name || 'free',
    videos_allowed: data.videos_allowed ?? 1,
    videos_used: data.videos_used ?? 0,
    subscription_status: data.subscription_status || 'active',
    stripe_customer_id: data.stripe_customer_id,
    stripe_subscription_id: data.stripe_subscription_id
  };
}

/**
 * Verificar se usuário pode enviar/uploadar novo vídeo
 * - videos_allowed = -1 → ilimitado, retorna true
 * - videos_used < videos_allowed → retorna true
 * - Caso contrário → retorna false
 */
export async function canUserUploadVideo(userId) {
  const data = await getUserSubscriptionData(userId);

  // Status cancelado ou past_due pode bloquear (opcional - você pode permitir até fim do período)
  if (data.subscription_status === 'canceled' || data.subscription_status === 'unpaid') {
    // Mesmo cancelado, pode ter período de grace - verificamos pelo limite
    // Se ainda tiver videos_allowed > 0 do plano anterior, permitir
  }

  const videosAllowed = data.videos_allowed ?? 1;
  const videosUsed = data.videos_used ?? 0;

  // Ilimitado
  if (videosAllowed === -1) {
    return true;
  }

  return videosUsed < videosAllowed;
}

/**
 * Incrementar videos_used quando um novo vídeo for enviado
 */
export async function incrementVideosUsed(userId) {
  if (!supabaseAdmin) {
    throw new Error('Supabase não configurado.');
  }

  const { data: current, error: fetchError } = await supabaseAdmin
    .from('users')
    .select('videos_used')
    .eq('id', userId)
    .single();

  if (fetchError || !current) {
    throw new Error('Usuário não encontrado');
  }

  const newCount = (current.videos_used ?? 0) + 1;

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({
      videos_used: newCount,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (updateError) {
    throw new Error(`Erro ao incrementar videos_used: ${updateError.message}`);
  }

  console.log(`[SUBSCRIPTION] videos_used incrementado para ${userId}: ${newCount}`);
  return newCount;
}

/**
 * Associar stripe_customer_id ao usuário
 */
export async function setStripeCustomerId(userId, stripeCustomerId) {
  if (!supabaseAdmin) return;

  await supabaseAdmin
    .from('users')
    .update({
      stripe_customer_id: stripeCustomerId,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);
}
