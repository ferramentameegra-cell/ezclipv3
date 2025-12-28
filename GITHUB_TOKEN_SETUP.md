# 🔑 Configurar Token do GitHub com Permissão Workflow

O token fornecido precisa ter a permissão `workflow` habilitada para poder modificar arquivos `.github/workflows/`.

## Solução 1: Atualizar Token Existente

1. Acesse: https://github.com/settings/tokens
2. Encontre o token existente ou crie um novo
3. Clique em "Edit" ou crie um novo token
4. Marque a permissão: **`workflow`** ✅
5. Salve o token

## Solução 2: Criar Novo Token

1. Acesse: https://github.com/settings/tokens/new
2. Dê um nome: "Railway Auto Deploy"
3. Selecione as permissões:
   - ✅ `repo` (acesso completo ao repositório)
   - ✅ `workflow` (permissão para modificar workflows)
4. Clique em "Generate token"
5. Copie o novo token
6. Atualize o remote:

```bash
git remote set-url origin https://NOVO_TOKEN@github.com/ferramentameegra-cell/ezclipv3.git
```

## Solução 3: Fazer Push Manualmente

Se não quiser modificar o token, você pode fazer push manualmente via interface do GitHub ou usando outro método de autenticação.

## Após Configurar

Depois de ter um token com permissão `workflow`, execute:

```bash
git push origin main
```

Os workflows serão criados e o deploy automático funcionará.

