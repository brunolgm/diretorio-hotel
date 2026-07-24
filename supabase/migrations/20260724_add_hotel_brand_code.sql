alter table public.hotels
  add column brand_code text null;

alter table public.hotels
  add constraint hotels_brand_code_check
    check (
      brand_code is null
      or brand_code in ('mercure', 'novotel', 'grand-mercure')
    );

comment on column public.hotels.brand_code is
  'Permanent hotel brand identity managed by the LibGuest platform; independent from theme_preset.';
