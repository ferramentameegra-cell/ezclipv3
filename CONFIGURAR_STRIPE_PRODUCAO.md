# 💳 CONFIGURAR STRIPE EM PRODUÇÃO - GUIA COMPLETO

## ✅ Status Atual

- ✅ Stripe SDK instalado (v14.25.0)
- ✅ Código integrado e pronto
- ✅ Variáveis de ambiente configuradas
- ⏳ Webhook precisa ser configurado no Stripe Dashboard

## 🔑 Variáveis de Ambiente (Railway)

Certifique-se de que estas variáveis estão configuradas no Railway:

```env
STRIPE_SECRET_KEY=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
STRIPE_PUBLISHABLE_KEY=pk_live_51Sqgz6FGRbcoS1jUs1zGSNPXyd0vL8TJcogmT4iABnCRCMzrcNlWeMqE4bT9zynCwQRdtqlGnJIUCU7IUlD8wEcy000k78qejp
FRONTEND_URL=https://seu-dominio.railway.app
# OU use:
RAILWAY_PUBLIC_DOMAIN=https://seu-dominio.railway.app
```

## 🔗 Configurar Webhook no Stripe Dashboard

### Passo 1: Obter URL do Webhook

Após o deploy no Railway, você terá uma URL como:
```
https://seu-projeto.railway.app/api/stripe/webhook
```

### Passo 2: Configurar no Stripe

1. **Acesse o Dashboard do Stripe:**
   - https://dashboard.stripe.com/webhooks
   - Faça login com sua conta

2. **Criar Novo Webhook:**
   - Clique em **"Add endpoint"**
   - Cole a URL: `https://seu-projeto.railway.app/api/stripe/webhook`

3. **Selecionar Eventos:**
   - Marque os seguintes eventos:
     - ✅ `checkout.session.completed` (OBRIGATÓRIO)
     - ✅ `payment_intent.succeeded` (recomendado)
     - ✅ `payment_intent.payment_failed` (recomendado)

4. **Copiar Webhook Secret:**
   - Após criar, copie o **"Signing secret"** (começa com `whsec_`)
   - Adicione no Railway como: `STRIPE_WEBHOOK_SECRET=whsec_...`

### Passo 3: Configurar no Railway

1. Acesse o Railway Dashboard
2. Vá em **"Variables"**
3. Adicione:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_... (o valor copiado do Stripe)
   ```
4. Faça redeploy

## 🧪 Testar Pagamento

### 1. Teste com Cartão de Teste (Recomendado primeiro)

Se estiver usando chaves de teste:
- **Cartão de sucesso**: `4242 4242 4242 4242`
- **CVV**: Qualquer 3 dígitos
- **Data**: Qualquer data futura
- **CEP**: Qualquer CEP válido

### 2. Teste com Pagamento Real

1. Acesse sua aplicação
2. Faça login
3. Clique em "Comprar Créditos"
4. Escolha um plano (Creator, Pro ou Unlimited)
5. Será redirecionado para Stripe Checkout
6. Complete o pagamento
7. Será redirecionado de volta com confirmação

## 📊 Verificar se Está Funcionando

### Logs do Servidor

Após uma compra, verifique os logs do Railway:

```
[STRIPE] Checkout session criada: cs_...
[STRIPE] Checkout session completed: cs_...
[STRIPE] ✅ Plano Creator ativado para usuário ...
```

### Dashboard do Stripe

1. Acesse: https://dashboard.stripe.com/payments
2. Você verá os pagamentos processados
3. Clique em um pagamento para ver detalhes

### Webhook Events

1. Acesse: https://dashboard.stripe.com/webhooks
2. Clique no seu webhook
3. Veja os eventos recebidos
4. Verifique se `checkout.session.completed` está sendo recebido

## 🔍 Troubleshooting

### Problema: Webhook não está recebendo eventos

**Solução:**
1. Verifique se a URL está correta no Stripe
2. Verifique se `STRIPE_WEBHOOK_SECRET` está configurado
3. Verifique os logs do Railway para erros
4. Teste o webhook manualmente no Stripe Dashboard

### Problema: Pagamento confirmado mas plano não ativado

**Solução:**
1. Verifique os logs do webhook no Railway
2. Verifique se o webhook está processando `checkout.session.completed`
3. Verifique se o usuário existe no sistema
4. Verifique se o plano existe

### Problema: Erro ao criar checkout session

**Solução:**
1. Verifique se `STRIPE_SECRET_KEY` está configurada
2. Verifique se a chave é válida (LIVE ou TEST)
3. Verifique os logs do servidor

## 📋 Checklist de Deploy

- [ ] Variáveis de ambiente configuradas no Railway
- [ ] Deploy realizado com sucesso
- [ ] URL do webhook obtida
- [ ] Webhook configurado no Stripe Dashboard
- [ ] `STRIPE_WEBHOOK_SECRET` adicionado no Railway
- [ ] Redeploy realizado após configurar webhook
- [ ] Teste de pagamento realizado
- [ ] Webhook recebendo eventos (verificar no Stripe Dashboard)
- [ ] Planos sendo ativados corretamente

## 🚀 Próximos Passos

1. ✅ Fazer deploy no Railway
2. ⏳ Configurar webhook no Stripe Dashboard
3. ⏳ Adicionar `STRIPE_WEBHOOK_SECRET` no Railway
4. ⏳ Testar compra de plano
5. ⏳ Verificar ativação automática

## 📞 Suporte

- **Stripe Dashboard**: https://dashboard.stripe.com
- **Stripe Docs**: https://stripe.com/docs/payments/checkout
- **Railway Logs**: Verificar no dashboard do Railway
