-- Read-only metadata, not family data. Before applying the reviewed meal migration.
begin read only;
select to_regclass('public.gw_meals') as must_be_null,
 to_regprocedure('public.gw_meal_history(text,text)') as history_must_be_null,
 to_regprocedure('public.gw_save_meal(text,uuid,uuid,date,uuid)') as save_must_be_null,
 to_regprocedure('public.gw_delete_meal(text,uuid)') as delete_must_be_null;
select table_name,column_name,data_type from information_schema.columns
where table_schema='public' and table_name in ('gw_families','gw_restaurants','gw_members','gw_polls')
 and column_name in ('id','family_id','token','active','name','category','address','icon_mode','icon_value')
order by table_name,ordinal_position;
rollback;
