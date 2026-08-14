# Sprint 45B — teste concorrente do último administrador

Este runbook prova, em duas sessões PostgreSQL simultâneas, que
`public.admin_update_hotel_user` serializa alterações administrativas por hotel,
relê o ator depois do advisory lock e nunca deixa o hotel sem administrador ativo.

Não execute em produção. O alvo deste procedimento é exclusivamente o container local
descartável `supabase_db_libguest-45b-lab`, reconstruído com a baseline remota e as
migrations 001–006. O agendamento de uma corrida sem coordenação é não determinístico:
o procedimento registra quem concluiu e quem falhou, sem definir uma sessão vencedora
universal.

## 1. Abrir os dois PowerShells

Abra dois PowerShells e, em ambos, conecte diretamente ao container local:

```powershell
docker exec -it supabase_db_libguest-45b-lab psql -U postgres -d postgres
```

Antes de continuar, confirme em cada terminal que o prompt pertence ao container local.
Não substitua o nome do container por host, URL ou project ref remoto.

## 2. Preparar as fixtures sintéticas

Execute este bloco uma vez, na Sessão A. Ele aborta diante de qualquer colisão e cria um
hotel com exatamente dois administradores ativos. Se `profiles.id` referenciar
`auth.users.id`, também cria os usuários Auth mínimos. O setup é confirmado em uma
transação própria porque as duas sessões precisam enxergar as mesmas fixtures.

```sql
begin;

do $$
begin
  if exists (
    select 1
    from public.hotels
    where id = '45500000-0000-4000-8000-000000000001'
       or slug = '45b-concurrency-hotel'
  ) or exists (
    select 1
    from public.profiles
    where id in (
      '45500000-0000-4000-8000-00000000000a',
      '45500000-0000-4000-8000-00000000000b'
    )
       or email in (
         '45b-concurrency-admin-a@example.invalid',
         '45b-concurrency-admin-b@example.invalid'
       )
  ) or exists (
    select 1
    from auth.users
    where id in (
      '45500000-0000-4000-8000-00000000000a',
      '45500000-0000-4000-8000-00000000000b'
    )
       or email in (
         '45b-concurrency-admin-a@example.invalid',
         '45b-concurrency-admin-b@example.invalid'
       )
  ) then
    raise exception '45B concurrency fixture collision; run the cleanup or inspect manually';
  end if;
end;
$$;

insert into public.hotels (id, name, slug)
values (
  '45500000-0000-4000-8000-000000000001',
  '45B Synthetic Concurrency Hotel',
  '45b-concurrency-hotel'
);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and confrelid = 'auth.users'::regclass
      and contype = 'f'
  ) then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    select
      (select id from auth.instances order by created_at limit 1),
      fixture.id,
      'authenticated',
      'authenticated',
      fixture.email,
      '',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    from (values
      (
        '45500000-0000-4000-8000-00000000000a'::uuid,
        '45b-concurrency-admin-a@example.invalid'
      ),
      (
        '45500000-0000-4000-8000-00000000000b'::uuid,
        '45b-concurrency-admin-b@example.invalid'
      )
    ) as fixture(id, email);
  end if;
end;
$$;

insert into public.profiles (id, email, full_name, role, hotel_id, is_active)
values
  (
    '45500000-0000-4000-8000-00000000000a',
    '45b-concurrency-admin-a@example.invalid',
    '45B Concurrency Admin A',
    'administrador',
    '45500000-0000-4000-8000-000000000001',
    true
  ),
  (
    '45500000-0000-4000-8000-00000000000b',
    '45b-concurrency-admin-b@example.invalid',
    '45B Concurrency Admin B',
    'administrador',
    '45500000-0000-4000-8000-000000000001',
    true
  )
on conflict (id) do update
set email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    hotel_id = excluded.hotel_id,
    is_active = excluded.is_active;

do $$
declare
  active_admins integer;
begin
  select count(*) into active_admins
  from public.profiles
  where hotel_id = '45500000-0000-4000-8000-000000000001'
    and is_active = true
    and lower(trim(coalesce(role, ''))) in ('administrador', 'admin', 'owner');

  if active_admins <> 2 then
    raise exception 'fixture must start with exactly two active administrators, found %', active_admins;
  end if;
end;
$$;

commit;
```

## 3. Sessão A: alterar B e manter o lock aberto

Na Sessão A, execute somente até a consulta da RPC. Não execute o `COMMIT` ainda.
Quando a RPC retornar, a mudança ainda não estará confirmada e o advisory lock de
transação continuará retido.

```sql
begin;
set local application_name = '45b-concurrency-session-a';
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '45500000-0000-4000-8000-00000000000a',
  true
);

select clock_timestamp() as session_a_started;
select *
from public.admin_update_hotel_user(
  '45500000-0000-4000-8000-00000000000b',
  '45B Concurrency Admin B',
  '45b-concurrency-admin-b@example.invalid',
  'editor',
  true
);
select clock_timestamp() as session_a_rpc_returned_lock_still_held;
```

Neste ponto, A concluiu a chamada, mas ainda não confirmou a transação.

## 4. Sessão B: alterar A em paralelo

Na Sessão B, execute o bloco abaixo. Ele deve ficar bloqueado dentro da RPC enquanto A
mantiver a transação aberta. O handler registra o resultado real da sessão. Se B tiver
perdido o papel antes da releitura pós-lock, o erro esperado é
`administrator_required`; `last_active_administrator_required` também é aceito como
defesa de invariância caso o estado observado produza esse caminho.

```sql
begin;
set local application_name = '45b-concurrency-session-b';
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '45500000-0000-4000-8000-00000000000b',
  true
);

do $$
begin
  raise notice 'SESSION B started at %', clock_timestamp();

  perform public.admin_update_hotel_user(
    '45500000-0000-4000-8000-00000000000a',
    '45B Concurrency Admin A',
    '45b-concurrency-admin-a@example.invalid',
    'editor',
    true
  );

  raise notice 'SESSION B completed at %', clock_timestamp();
exception
  when others then
    raise notice 'SESSION B failed at %, SQLSTATE %, error %',
      clock_timestamp(), sqlstate, sqlerrm;

    if sqlerrm not in (
      'administrator_required',
      'last_active_administrator_required'
    ) then
      raise;
    end if;
end;
$$;

commit;
```

Não confunda o terminal sem resposta com sucesso: enquanto A estiver aberta, B deve
estar esperando o advisory lock.

## 5. Observar a serialização

Enquanto B estiver bloqueada, volte à Sessão A e execute:

```sql
reset role;

select pid,
       application_name,
       state,
       wait_event_type,
       wait_event,
       pg_blocking_pids(pid) as blocking_pids
from pg_stat_activity
where application_name in (
  '45b-concurrency-session-a',
  '45b-concurrency-session-b'
)
order by application_name;
```

O registro da Sessão B deve mostrar espera de lock e o PID bloqueador. Guarde essa saída
com os horários e notices como evidência. Em seguida, ainda na Sessão A:

```sql
set local role authenticated;
commit;
```

Após o commit de A, B deve desbloquear, reler seu ator e registrar seu resultado. No
roteiro acima, A foi deliberadamente colocada no lock primeiro para tornar a espera
observável. Isso não significa que A sempre vence: ao inverter a ordem de aquisição,
B pode concluir primeiro e A passa a ser a candidata a falhar.

## 6. Verificar o resultado final

Depois que as duas sessões terminarem, execute como `postgres` em qualquer uma delas:

```sql
reset role;

select id,
       email,
       role,
       is_active
from public.profiles
where hotel_id = '45500000-0000-4000-8000-000000000001'
order by id;

select count(*) as active_administrators
from public.profiles
where hotel_id = '45500000-0000-4000-8000-000000000001'
  and is_active = true
  and lower(trim(coalesce(role, ''))) in ('administrador', 'admin', 'owner');

select created_at,
       actor_user_id,
       entity_id as changed_user_id,
       action,
       metadata
from public.admin_audit_log
where hotel_id = '45500000-0000-4000-8000-000000000001'
  and action = 'user.access_updated'
order by created_at;
```

Critérios de aprovação:

- a espera da segunda sessão foi observada em `pg_stat_activity`;
- uma sessão concluiu a mudança e a outra registrou o erro esperado;
- o audit identifica a operação confirmada sem armazenar token ou metadata complexa;
- `active_administrators` é exatamente `1`, nunca `0`;
- a sessão perdedora só decidiu após adquirir o lock e reler o ator.

Se ambas concluírem, nenhuma bloquear, o total for diferente de `1` ou surgir outro erro,
o teste falhou e a Sprint 45B não deve ser considerada concorrencialmente homologada.

## 7. Cleanup seguro obrigatório

Execute como `postgres` depois de guardar a evidência. Os filtros usam exclusivamente os
UUIDs sintéticos deste runbook. O bloco aborta se o hotel esperado não for encontrado.

```sql
begin;

do $$
begin
  if not exists (
    select 1
    from public.hotels
    where id = '45500000-0000-4000-8000-000000000001'
      and slug = '45b-concurrency-hotel'
  ) then
    raise exception 'synthetic concurrency hotel not found; refusing cleanup';
  end if;
end;
$$;

delete from public.admin_audit_log
where hotel_id = '45500000-0000-4000-8000-000000000001';

delete from public.profiles
where id in (
  '45500000-0000-4000-8000-00000000000a',
  '45500000-0000-4000-8000-00000000000b'
)
  and hotel_id = '45500000-0000-4000-8000-000000000001';

delete from public.hotels
where id = '45500000-0000-4000-8000-000000000001'
  and slug = '45b-concurrency-hotel';

delete from auth.users
where id in (
  '45500000-0000-4000-8000-00000000000a',
  '45500000-0000-4000-8000-00000000000b'
)
  and email in (
    '45b-concurrency-admin-a@example.invalid',
    '45b-concurrency-admin-b@example.invalid'
  );

commit;
```

Se qualquer sessão for interrompida, execute `rollback;` nela antes do cleanup. O setup e
o cleanup são as únicas etapas que confirmam dados, sempre sintéticos e sempre no banco
local descartável.
