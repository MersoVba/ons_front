# Configuração do Vercel - Validação

## ✅ Configuração Atual (Corrigida)

### Arquivo: `vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": ".",
  "functions": {
    "api/index.ts": {
      "includeFiles": [
        "dist/**",
        "server/**",
        "shared/**"
      ],
      "maxDuration": 60
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api"
    },
    {
      "source": "/(.*\\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot))",
      "destination": "/dist/spa/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/api"
    }
  ]
}
```

## ✅ Correções Aplicadas

1. **Removido `version: 2`** - Propriedade legacy, não é mais necessária
2. **Adicionado `$schema`** - Para autocomplete e validação
3. **Substituído `routes` por `rewrites`** - `routes` é legacy, `rewrites` é a forma moderna
4. **Adicionado `maxDuration: 60`** - Limite de tempo para a função serverless
5. **Removido `express.static`** - O Vercel serve arquivos estáticos automaticamente

## 📋 Estrutura de Rotas

1. **`/api/(.*)`** → Função serverless em `api/index.ts`
2. **Arquivos estáticos** (`.js`, `.css`, imagens, etc.) → `dist/spa/`
3. **Todas as outras rotas** → Função serverless (serve `index.html` para SPA)

## 🔍 Validação

### ✅ Segue as práticas recomendadas:
- Usa `rewrites` ao invés de `routes` (legacy)
- Não usa `version` (legacy)
- Usa `$schema` para validação
- Configura `functions` corretamente
- `includeFiles` inclui arquivos necessários
- `maxDuration` configurado para funções

### ⚠️ Pontos de Atenção:

1. **Output Directory**: Está como `.` (raiz), mas os arquivos estão em `dist/spa/`
   - Isso está correto porque usamos `rewrites` para mapear os arquivos
   
2. **Função Serverless**: Serve `index.html` para rotas não-API
   - Isso é necessário para React Router funcionar como SPA

3. **Arquivos Estáticos**: O Vercel serve automaticamente, mas precisamos do rewrite para mapear corretamente

## 🚀 Próximos Passos

1. Fazer commit das alterações
2. Fazer deploy: `npx vercel --prod`
3. Verificar se os arquivos estáticos estão sendo servidos corretamente
4. Testar rotas da API
5. Testar rotas do SPA (React Router)

