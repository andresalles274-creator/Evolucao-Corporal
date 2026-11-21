# Otimizações de índices aplicadas — 21/11/2026

Projeto: Evolução Corporal (Supabase gfwdfskjoiyfrbqntkou).

## SQL executado no banco ativo
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_diet_plan_meals_plan_id ON public.diet_plan_meals (plan_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_training_day_exercises_exercise_id ON public.training_day_exercises (exercise_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_training_set_logs_exercise_id ON public.training_set_logs (exercise_id);
```

## Validação
Consulta em pg_index confirmou indisvalid=true e indisready=true para os três índices. Advisor de desempenho: alertas unindexed_foreign_keys 17 -> 14.

## Segurança operacional
Nenhuma política RLS, usuário, credencial, sessão, tabela ou código de frontend foi alterado. Índices foram criados com CONCURRENTLY para reduzir bloqueios de escrita. O impacto de desempenho real ainda requer medição com consultas representativas.

## Pendências
14 índices de chaves estrangeiras, 38 alertas auth_rls_initplan, 9 multiple_permissive_policies e demais avisos. Não modificar políticas de acesso sem testes de isolamento entre alunos e verificação do painel do coach.

## Reversão, se tecnicamente necessária
```sql
DROP INDEX CONCURRENTLY IF EXISTS public.idx_diet_plan_meals_plan_id;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_training_day_exercises_exercise_id;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_training_set_logs_exercise_id;
```
