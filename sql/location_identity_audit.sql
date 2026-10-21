-- READ ONLY owner/operator report. Run privately before the H4 upgrade.
-- Do not commit output containing family locations or IDs. No cleanup is performed.
with normalized as (
 select id,family_id,name,address,osm_id,active,
 translate(btrim(regexp_replace(coalesce(name,''),'[[:space:]]+',' ','g')),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') as nk,
 translate(btrim(regexp_replace(coalesce(address,''),'[[:space:]]+',' ','g')),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') as ak,
 translate(btrim(regexp_replace(coalesce(osm_id,''),'[[:space:]]+',' ','g')),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') as sk
 from public.gw_restaurants
), duplicate_sources as (
 select family_id,sk from normalized where sk<>'' group by family_id,sk having count(*)>1
), duplicate_manual as (
 select family_id,nk,ak from normalized where sk='' and ak<>'' group by family_id,nk,ak having count(*)>1
)
select n.id,n.family_id,n.name,n.address,n.osm_id,n.active,
 case when s.sk is not null then 'Duplicate OSM identity'
      when m.nk is not null then 'Duplicate manual name/address'
      when n.sk<>'' and n.sk !~ '^(node|way|relation)/[1-9][0-9]*$' then 'Legacy source identity needs review'
      else 'Missing address: identity cannot be inferred' end as review_reason
from normalized n
left join duplicate_sources s on s.family_id=n.family_id and s.sk=n.sk
left join duplicate_manual m on m.family_id=n.family_id and m.nk=n.nk and m.ak=n.ak and n.sk=''
where s.sk is not null or m.nk is not null or n.ak='' or (n.sk<>'' and n.sk !~ '^(node|way|relation)/[1-9][0-9]*$')
order by review_reason,n.family_id,n.name,n.address,n.id;
