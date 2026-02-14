# Configuração Stripe + Supabase

## Variáveis de ambiente (Railway)

Configure no Railway:

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Os preços (Creator R$79, Pro R$197, Unlimited R$397) são criados automaticamente no checkout — **não precisa** de STRIPE_PRICE_*.

⚠️ **NUNCA** commite chaves no código. Use variáveis de ambiente.

## Produtos no Stripe

Os produtos e preços são criados automaticamente no checkout. Não é necessário criar nada manualmente no Stripe Dashboard.

## Webhook no Stripe

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://seu-dominio.railway.app/webhook/stripe`
3. Eventos:
   - `checkout.session.completed`
   - `invoice.paid`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copie o **Signing secret** para `STRIPE_WEBHOOK_SECRET`

## Migração Supabase

Execute no SQL Editor do Supabase:

```sql
-- Ver supabase-migration-stripe.sql
```

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/stripe/create-checkout-session | Cria sessão checkout (body: `{ planId: "creator" \| "pro" \| "unlimited" }`) |
| POST | /webhook/stripe | Webhook Stripe (raw body) |
| GET | /api/stripe/verify-session?sessionId=xxx | Verifica sessão de pagamento |
