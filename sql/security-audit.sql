-- Read-only catalog inspection. No household records or secret values.
begin read only;
select c.relname,c.relrowsecurity,
 has_table_privilege('anon',c.oid,'SELECT') as anon_read,
 has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE') as anon_write,
 has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated_access
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname like 'gw_%' and c.relkind='r' order by 1;
select p.proname,pg_get_function_identity_arguments(p.oid) as signature,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'gw_%' order by 1;
select has_schema_privilege('anon','public','CREATE') as anon_schema_create;
select version,name from supabase_migrations.schema_migrations order by version;
rollback;
