# 💳 INTEGRAÇÃO STRIPE - CONFIGURAÇÃO COMPLETA

## ✅ O que foi implementado

### Backend
1. ✅ **Stripe instalado** (`stripe@^14.21.0`)
2. ✅ **Serviço Stripe** (`src/services/stripeService.js`)
   - Configuração com chaves LIVE
   - Criação de Checkout Sessions
   - Verificação de sessões
3. ✅ **Controller Stripe** (`src/controllers/stripeController.js`)
   - Webhook para processar pagamentos
   - Verificação de status de sessão
4. ✅ **Rotas Stripe** (`src/routes/stripe.js`)
   - `POST /api/stripe/webhook` - Webhook do Stripe
   - `GET /api/stripe/verify-session` - Verificar status
5. ✅ **Controller de Créditos atualizado**
   - `POST /api/credits/create-checkout` - Criar sessão de checkout
   - `POST /api/credits/purchase` - Processar compra após pagamento

### Frontend
1. ✅ **Função `purchasePlan` atualizada**
   - Cria checkout session
   - Redireciona para Stripe Checkout
   - Verifica pagamento após retorno
2. ✅ **Verificação automática de pagamento**
   - Verifica status ao retornar do Stripe
   - Processa compra automaticamente se pago

## 🔑 Chaves do Stripe (OBRIGATÓRIAS)

### ⚠️ IMPORTANTE: Configure as variáveis de ambiente

As chaves do Stripe **NÃO** devem estar no código. Configure via variáveis de ambiente:

### Variáveis de Ambiente (OBRIGATÓRIAS)
```env
# Substitua pelos valores reais das suas chaves do Stripe
STRIPE_SECRET_KEY=sk_live_... # Sua chave secreta do Stripe
STRIPE_PUBLISHABLE_KEY=pk_live_... # Sua chave pública do Stripe
STRIPE_WEBHOOK_SECRET=whsec_... # Obter no dashboard do Stripe após configurar webhook
FRONTEND_URL=https://seu-dominio.com # URL do frontend (ou RAILWAY_PUBLIC_DOMAIN)
```

### Configurar no Railway
1. Acesse o dashboard do Railway
2. Vá em "Variables"
3. Adicione as variáveis acima
4. Faça redeploy

### Configurar Localmente
Crie um arquivo `.env` na raiz do projeto:
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://localhost:8080
```

## 🔗 Configurar Webhook no Stripe

### 1. Acessar Dashboard do Stripe
1. Acesse: https://dashboard.stripe.com/webhooks
2. Clique em "Add endpoint"

### 2. Configurar Endpoint
- **URL**: `https://seu-dominio.com/api/stripe/webhook`
- **Eventos para escutar**:
  - `checkout.session.completed`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`

### 3. Copiar Webhook Secret
- Após criar o webhook, copie o "Signing secret"
- Configure como variável de ambiente: `STRIPE_WEBHOOK_SECRET`

## 📋 Fluxo de Pagamento

### 1. Usuário clica em "Comprar Plano"
```
Frontend → POST /api/credits/create-checkout
Backend → Cria Checkout Session no Stripe
Backend → Retorna URL do checkout
Frontend → Redireciona para Stripe Checkout
```

### 2. Usuário paga no Stripe
```
Stripe Checkout → Processa pagamento
Stripe → Envia webhook para /api/stripe/webhook
Backend → Processa webhook e ativa plano
```

### 3. Usuário retorna ao site
```
Frontend → Detecta ?payment=success na URL
Frontend → Verifica status da sessão
Frontend → Processa compra se pago
Frontend → Mostra confirmação
```

## 🧪 Testar Pagamento

### Modo Teste (Recomendado para desenvolvimento)
1. Use chaves de teste do Stripe
2. Configure no `.env`:
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

### Cartões de Teste
- **Sucesso**: `4242 4242 4242 4242`
- **Falha**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

### Modo Live (Produção)
- Use as chaves LIVE fornecidas
- Configure webhook no dashboard do Stripe
- Teste com valores pequenos primeiro

## 🔒 Segurança

1. ✅ **Secret Key** apenas no backend
2. ✅ **Public Key** pode ser exposta no frontend (já está no código)
3. ✅ **Webhook** verificado com assinatura
4. ✅ **Pagamentos** processados apenas após confirmação do Stripe

## 📝 Planos Configurados

- **Free**: R$ 0,00 - 1 vídeo
- **Creator**: R$ 79,00 - 10 vídeos
- **Pro**: R$ 197,00 - 40 vídeos
- **Unlimited**: R$ 397,00 - Ilimitado

## ⚠️ Importante

1. **Webhook Secret**: Configure no ambiente de produção
2. **Frontend URL**: Configure `FRONTEND_URL` ou `RAILWAY_PUBLIC_DOMAIN`
3. **HTTPS**: Stripe requer HTTPS em produção
4. **Testes**: Sempre teste com valores pequenos primeiro

## 🚀 Próximos Passos

1. ✅ Instalar Stripe: `npm install`
2. ⏳ Configurar webhook no dashboard do Stripe
3. ⏳ Configurar `STRIPE_WEBHOOK_SECRET` no ambiente
4. ⏳ Testar compra de plano
5. ⏳ Verificar webhook recebendo eventos

## 📞 Suporte

- Dashboard Stripe: https://dashboard.stripe.com
- Documentação: https://stripe.com/docs
- Logs: Verificar console do servidor para eventos do Stripe
