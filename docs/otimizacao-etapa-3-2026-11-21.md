# Otimização etapa 3 — 21/11/2026

Projeto Supabase: gfwdfskjoiyfrbqntkou. Alterações aplicadas no banco ativo.

## Índices criados com CONCURRENTLY
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_push_subscriptions_user_id_fk ON public.chat_push_subscriptions(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coach_student_messages_sender_id_fk ON public.coach_student_messages(sender_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_featured_exercise_videos_updated_by_fk ON public.featured_exercise_videos(updated_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hormone_logs_user_id_fk ON public.hormone_logs(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meals_user_id_fk ON public.meals(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_measurements_user_id_fk ON public.measurements(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_progress_photos_user_id_fk ON public.progress_photos(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_skinfolds_user_id_fk ON public.skinfolds(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_training_sessions_training_day_id_fk ON public.training_sessions(training_day_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workouts_user_id_fk ON public.workouts(user_id);
```

## Validação
pg_index: 10/10 índices indisvalid=true e indisready=true.
Advisor de performance: unindexed_foreign_keys não aparece mais (anteriormente 10). Ao longo das etapas, total 17 novos índices.
Avisos ainda existentes: 38 auth_rls_initplan; 9 multiple_permissive_policies; 1 no_primary_key em internal_backup.student_snapshots; 16 unused_index (índices recém-criados podem aparecer como ainda não utilizados, não são evidência de desnecessidade).

## Segurança e pendências
Não foram alteradas políticas RLS, autenticação, sessões, senhas ou código frontend. Revisão de leitura mostrou políticas em profiles, training_plans, progress_photos, training_checkins e outras que usam auth.uid() sem SELECT; reescrita exige testes de equivalência e isolamento aluno/coach. Sobreposição de políticas de progress_photos pode afetar regras de acesso: investigar antes de alterar. Não mexer no fluxo específico da Rafaela até nova orientação.

## Reversão
Para remover algum índice criado, executar DROP INDEX CONCURRENTLY IF EXISTS public.<nome>; individualmente, após diagnóstico.
