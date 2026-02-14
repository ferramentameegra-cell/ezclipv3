-- ============================================
-- MIGRAÇÃO: Colunas para Stripe + Assinaturas
-- ============================================
-- Execute no Supabase SQL Editor para adicionar
-- as colunas necessárias na tabela users
-- ============================================

-- Adicionar colunas de assinatura (se não existirem)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS plan_name TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS videos_allowed INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS videos_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Índices para buscas por Stripe
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON public.users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription_id ON public.users(stripe_subscription_id);
