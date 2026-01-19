# 🔐 Inicialização Administrativa

## 📋 Visão Geral

Sistema de inicialização administrativa que limpa dados e cria um usuário administrador com acesso ilimitado.

## 🚀 Como Funciona

### Execução Automática

A inicialização administrativa executa **automaticamente** quando:

1. **Ambiente de Desenvolvimento**: `NODE_ENV !== 'production'`
2. **Inicialização Controlada**: `INIT_ADMIN=true` (mesmo em produção)

### O que é Executado

1. **Limpeza de Dados**:
   - Remove todos os usuários existentes
   - Remove todos os logs de uso

2. **Criação do Admin**:
   - Email: `josyasborba@hotmail.com`
   - Senha: `12345678` (hash seguro com bcrypt)
   - Nome: `Josyas Borba`
   - Role: `admin`

### Proteções

- ✅ Executa **apenas uma vez** por sessão (flag interna)
- ✅ Não executa em produção a menos que `INIT_ADMIN=true`
- ✅ Logs detalhados de todas as operações

## 👤 Usuário Administrador

### Características

- **Créditos**: Ilimitados (`credits_balance: null`)
- **Free Trial**: Não aplicável (`free_trial_credits: null`)
- **Verificações**: Ignora todas as verificações de créditos
- **Débito**: Nunca tem créditos debitados
- **Acesso**: Total à plataforma

### Regras de Sistema

1. **Verificação de Créditos**:
   - Admin sempre passa nas verificações
   - `hasEnoughCredits()` retorna `true` para admin
   - `getTotalCredits()` retorna `null` (ilimitado) para admin

2. **Consumo de Créditos**:
   - `consumeCreditsForClips()` não debita créditos para admin
   - Retorna `totalDebited: 0` para admin

3. **Geração de Clipes**:
   - Admin pode gerar clipes ilimitados
   - Não há bloqueios ou limitações

## 🔧 Uso

### Desenvolvimento Local

```bash
# Executa automaticamente (NODE_ENV !== 'production')
npm start
```

### Produção (Inicialização Controlada)

```bash
# Definir variável de ambiente
export INIT_ADMIN=true
npm start
```

Ou no Railway:
```
INIT_ADMIN=true
```

### Verificar se Admin Foi Criado

Após inicialização, você verá nos logs:
```
[ADMIN_INIT] ✅ Inicialização administrativa concluída com sucesso!
[ADMIN_INIT] 👤 Admin criado: josyasborba@hotmail.com (ID: ...)
[ADMIN_INIT] 🔑 Senha: 12345678
```

## 🛡️ Middleware de Admin

### `requireAdmin`

Middleware para proteger rotas administrativas:

```javascript
import { requireAdmin } from './middleware/adminMiddleware.js';

router.get('/admin/stats', requireAuth, requireAdmin, getAdminStats);
```

### `checkIsAdmin`

Helper para verificar se usuário é admin:

```javascript
import { checkIsAdmin } from './middleware/adminMiddleware.js';

if (checkIsAdmin(userId)) {
  // Lógica para admin
}
```

## 📝 Arquivos Modificados

- `src/models/users.js` - Adicionado campo `role` e funções de admin
- `src/models/usageLogs.js` - Função para limpar logs
- `src/services/creditService.js` - Ignora admin nas verificações
- `src/utils/adminInit.js` - Script de inicialização
- `src/middleware/adminMiddleware.js` - Middleware de autorização
- `src/index.js` - Integração da inicialização
- `src/controllers/authController.js` - Retorna `role` nas respostas

## ⚠️ Importante

1. **Senha Padrão**: Em produção, altere a senha do admin após primeiro login
2. **Segurança**: A inicialização só executa com `INIT_ADMIN=true` em produção
3. **Uma Vez**: A flag interna garante execução única por sessão
4. **Logs**: Todas as operações são logadas para auditoria

## 🔍 Verificação

Para verificar se o admin foi criado:

```bash
# Login com credenciais do admin
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"josyasborba@hotmail.com","password":"12345678"}'
```

A resposta deve incluir:
```json
{
  "user": {
    "role": "admin",
    "credits_balance": null,
    "free_trial_credits": null
  }
}
```
