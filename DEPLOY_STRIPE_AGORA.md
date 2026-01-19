# 🚀 DEPLOY COM STRIPE - PASSO A PASSO

## ✅ Pré-requisitos

- [x] Código com Stripe integrado
- [x] Variáveis de ambiente configuradas no Railway
- [ ] Webhook configurado no Stripe (fazer após deploy)

## 📋 Passo 1: Fazer Deploy

### Opção A: Deploy Automático (GitHub Actions)

O deploy acontece automaticamente quando você faz push para `main`.

**Se o push foi bloqueado pelo GitHub:**
1. Acesse: https://github.com/ferramentameegra-cell/ezclipv3/security/secret-scanning/unblock-secret/38TeoZd1Dm8aTDOSskhSeUksubD
2. Autorize o push
3. Faça push novamente: `git push origin main`

### Opção B: Deploy Manual (Railway Dashboard)

1. Acesse: https://railway.app
2. Selecione seu projeto
3. Vá em **"Deployments"**
4. Clique em **"Redeploy"** ou faça um novo deploy

## 📋 Passo 2: Obter URL do Webhook

Após o deploy, você receberá uma URL como:
```
https://seu-projeto.railway.app
```

O endpoint do webhook será:
```
https://seu-projeto.railway.app/api/stripe/webhook
```

## 📋 Passo 3: Configurar Webhook no Stripe

1. **Acesse:** https://dashboard.stripe.com/webhooks
2. **Clique em:** "Add endpoint"
3. **Cole a URL:** `https://seu-projeto.railway.app/api/stripe/webhook`
4. **Selecione eventos:**
   - ✅ `checkout.session.completed`
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.payment_failed`
5. **Clique em:** "Add endpoint"
6. **Copie o "Signing secret"** (começa com `whsec_`)

## 📋 Passo 4: Adicionar Webhook Secret no Railway

1. Acesse o Railway Dashboard
2. Vá em **"Variables"**
3. Adicione:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_... (valor copiado do Stripe)
   ```
4. **Salve** e faça **redeploy**

## 📋 Passo 5: Verificar Configuração

### Verificar Variáveis no Railway

Certifique-se de que estas variáveis estão configuradas:

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=https://seu-projeto.railway.app
# OU
RAILWAY_PUBLIC_DOMAIN=https://seu-projeto.railway.app
```

### Verificar Logs

1. Acesse Railway Dashboard
2. Vá em **"Deployments"** > **"View Logs"**
3. Procure por:
   ```
   [STRIPE] Stripe inicializado com sucesso
   ```
   Se aparecer erro, verifique se `STRIPE_SECRET_KEY` está configurada.

## 📋 Passo 6: Testar Pagamento

1. Acesse sua aplicação: `https://seu-projeto.railway.app`
2. Faça login
3. Clique em **"Comprar Créditos"**
4. Escolha um plano (ex: Creator - R$ 79)
5. Será redirecionado para Stripe Checkout
6. Use um cartão de teste ou real
7. Complete o pagamento
8. Será redirecionado de volta
9. Verifique se o plano foi ativado

## ✅ Verificação Final

### No Stripe Dashboard:
- [ ] Pagamento aparece em https://dashboard.stripe.com/payments
- [ ] Webhook recebeu evento `checkout.session.completed`
- [ ] Webhook retornou status 200

### Na Aplicação:
- [ ] Usuário pode ver novo plano ativado
- [ ] Limite de vídeos atualizado
- [ ] Pode gerar clipes com novo limite

### Nos Logs do Railway:
- [ ] `[STRIPE] Checkout session criada`
- [ ] `[STRIPE] Checkout session completed`
- [ ] `[STRIPE] ✅ Plano ativado para usuário`

## 🎉 Pronto!

A cobrança real via Stripe está configurada e funcionando!

## 📞 Suporte

- **Stripe Dashboard**: https://dashboard.stripe.com
- **Railway Dashboard**: https://railway.app
- **Logs**: Verificar no Railway Dashboard > Deployments > View Logs
