# Correções Aplicadas para Vercel

## ✅ Checklist de Correções

### 1. Extensões `.js` em todos os imports (ESM)

**Arquivos corrigidos:**

- ✅ `api/index.ts` - Imports de rotas agora usam `.js`
- ✅ `server/routes/demo.ts` - Import de `shared/api.js`
- ✅ `server/routes/login.ts` - Import de `shared/api.js` (removido alias `@shared`)
- ✅ `server/routes/pagamento-boleto.ts` - Imports de `shared/api.js` e `utils/pdf-parsers.js`
- ✅ `server/routes/pagamento-boleto-fake.ts` - Import de `shared/api.js`
- ✅ `server/utils/pdf-parsers.ts` - Import de `shared/api.js`

**Antes:**
```typescript
import { handleDemo } from "../server/routes/demo";
import { DemoResponse } from "../../shared/api";
```

**Depois:**
```typescript
import { handleDemo } from "../server/routes/demo.js";
import { DemoResponse } from "../../shared/api.js";
```

### 2. Configuração do Vercel

- ✅ `vercel.json` configurado com `includeFiles` para incluir `server/**` e `shared/**`
- ✅ `maxDuration: 60` configurado para funções serverless
- ✅ `rewrites` configurado corretamente para SPA

### 3. Estrutura de Arquivos

- ✅ Código dentro de `/api` (função serverless)
- ✅ Imports relativos corrigidos com extensões `.js`
- ✅ TypeScript compilado pelo Vercel automaticamente

## 📋 Estrutura Final

```
api/
  └── index.ts          ← Função serverless principal
server/
  └── routes/
      ├── demo.ts
      ├── login.ts
      ├── pagamento-boleto.ts
      └── pagamento-boleto-fake.ts
  └── utils/
      └── pdf-parsers.ts
shared/
  └── api.ts
```

## 🚀 Próximos Passos

1. Fazer commit das alterações
2. Fazer deploy: `npx vercel --prod`
3. Verificar se o erro foi resolvido

## ⚠️ Notas Importantes

- **ESM requer extensões**: Com `"type": "module"`, todos os imports relativos precisam de extensão `.js`
- **TypeScript compila para JS**: O Vercel compila `.ts` para `.js`, mas os imports devem referenciar `.js`
- **Case sensitive**: Linux (Vercel) é case-sensitive, então `server/index.js` ≠ `server/Index.js`

