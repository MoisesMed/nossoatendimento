# AGENTS.md - Diretrizes do Projeto NossoAtendimento

> Leia este arquivo antes de editar qualquer codigo.

## Contexto rapido

NossoAtendimento e um SaaS multi-tenant para restaurantes com foco inicial no atendimento em mesas.

- Arquitetura: Next.js 15 + TypeScript + Supabase/Postgres
- Seguranca: isolamento total por tenant via RLS
- Autorizacao: membership + papeis OWNER, ADMIN, STAFF
- Front inicial: login simples e selecao de restaurante quando necessario
- Restaurantes modelo iniciais: MANJA e MOISES
- Uso principal em mobile e maquininhas de cartao

## Diretriz de produto e performance

1. Mobile first e obrigatorio em toda tela e fluxo.
2. O app deve evoluir como PWA instalavel com experiencia proxima de nativo.
3. Performance e requisito critico por uso em maquininhas de cartao.
4. Toda entrega deve evitar aumento de bundle e re-renders desnecessarios.
5. Priorizacao tecnica: carregamento rapido, interacoes fluidas e baixo consumo de memoria.

## Regras criticas de seguranca

1. Toda tabela de dominio deve ter tenant_id e indice por tenant_id.
2. Toda query de dominio deve filtrar por tenant_id.
3. Nenhum tenant_id vem do body do cliente; tenant sempre vem do contexto autenticado.
4. RLS deve estar ativo em toda tabela de dominio.
5. Politicas de leitura/escrita devem exigir membership valida para o tenant.
6. STAFF nao pode executar operacoes administrativas de tenant.

## Politica de seguranca restrita (defesa em profundidade)

1. Isolamento de tenant deve ser validado em duas camadas: aplicacao e banco.
2. A aplicacao sempre injeta e valida tenant_id no contexto antes de qualquer operacao.
3. O banco sempre aplica RLS/policies por tenant e role, mesmo que a aplicacao ja filtre.
4. Nenhuma camada substitui a outra; ambas sao obrigatorias para evitar fuga de informacoes.
5. Esta politica e permanente e independe de fornecedor (Supabase ou outro banco/plataforma no futuro).
6. Em migracao de stack, reproduzir o mesmo contrato: tenant_id obrigatorio + controle de acesso por role + enforcement no banco.

## Stack

- Next.js 15 (App Router)
- TypeScript estrito
- Tailwind CSS
- react-hook-form + zod
- @tanstack/react-query
- zustand
- react-select
- react-toastify
- lucide-react
- Supabase (Auth + Postgres + RLS)

## Estrutura recomendada

```
src/
  app/
  components/
  lib/
  modules/
  stores/
  constants/
```

## Convencoes

- Sem any salvo justificativa curta.
- Validacao de input externo com zod.
- Server Components por padrao; client component apenas quando necessario.
- Sem comentarios explicando o obvio.
- Sem hardcode de segredo.

## Supabase e RLS

- Projeto usa Supabase Cloud somente (sem Docker e sem banco local).
- Migrations sao aplicadas no projeto remoto via supabase link + supabase db push.
- Habilitar RLS em todas as tabelas de dominio.
- Funcoes auxiliares no schema app para checar membership e role.
- Policies devem usar auth.uid() e nunca depender de parametro vindo do cliente.

## Fluxo inicial do garcom

1. Listar reservas ativas do tenant atual.
2. Marcar check-in.
3. Finalizar atendimento.

Cada passo deve respeitar:

- tenant_id da reserva igual ao tenant da membership do usuario.
- papel minimo STAFF.

## Checklist obrigatorio apos alteracoes

1. npm run typecheck
2. npm run lint
3. npm run supabase:push (quando houver migration nova)
4. testar manualmente fluxo principal no front
5. validar isolamento entre MANJA e MOISES
