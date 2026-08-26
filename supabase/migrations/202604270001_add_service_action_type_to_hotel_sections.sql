alter table public.hotel_sections
  add column service_action_type text not null default 'standard';

alter table public.hotel_sections
  add constraint hotel_sections_service_action_type_check
    check (service_action_type in ('standard', 'external_url', 'room_restaurant_menu'));
