alter table public.hotels
add column if not exists hero_image_url text null;

comment on column public.hotels.hero_image_url is
  'Optional public hero image URL used by supported visual presets.';
