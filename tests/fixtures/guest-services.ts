import snapshot from '../browser/fixtures/bugan-v4-public-copy.json' with { type: 'json' };
import { fbFixture, FB_IDENTITIES } from './fb.ts';
import type { PublicHotelPageData } from '../../lib/public-hotel-data';

/** Safe published historical copy + synthetic tenant/graph identities. No production write. */
export function guestServicesFixture(index = 4, language: 'pt' | 'en' | 'es' = 'pt', volume = false): PublicHotelPageData {
  const data = fbFixture(index, language);
  data.layout.push({ blockKey: 'quick_info', isEnabled: true, position: 4 });
  data.layout = data.layout.map(b => b.blockKey === 'contact' ? { ...b, isEnabled: true } : b);
  data.layout = data.layout.map(b => b.blockKey === 'quick_info' ? { ...b, isEnabled: true } : b);
  data.hotel.wifi_name = 'Synthetic guest network';
  data.hotel.checkin_time = '14:00'; data.hotel.checkout_time = '12:00';
  data.hotel.logo_url = index === 4 ? '/assets/logo.png' : null;
  data.hotel.hero_image_url = index === 4 ? '/assets/hero.webp' : null;
  data.sections = snapshot.services.map((s, i) => ({ ...s, ...(language === 'pt' ? {} : snapshot.serviceTranslations.find(t => t.section_id === s.id && t.language === language)), id: `service-${index}-${i}`, hotel_id: data.hotel.id })) as PublicHotelPageData['sections'];
  const restaurant = data.fb!.outlets.find(o => o.type === 'restaurant')!, room = data.fb!.outlets.find(o => o.type === 'room_service')!;
  data.fb!.service_links = [{ hotel_id: data.hotel.id, outlet_id: restaurant.id, service_id: data.sections[2].id }, { hotel_id: data.hotel.id, outlet_id: room.id, service_id: data.sections[3].id }];
  data.sections[3].url = `https://${data.hotel.subdomain}.libguest.digital/room-service`;
  data.sections.push({ ...data.sections[3], id: 'native-access', title: 'Room Service — Pedidos', url: data.sections[3].url, service_action_type: 'external_url' });
  const laundry = data.sections[4];
  laundry.guest_presentation = { summary: { pt: 'Coleta e entrega de roupas', en: 'Laundry collection and delivery', es: 'Recogida y entrega de ropa' }, hours: { pt: 'Coleta até 14h', en: 'Collection until 14:00', es: 'Recogida hasta las 14:00' }, interaction: 'detail' };
  if (volume) for (let i = 0; i < 40; i++) data.sections.push({ ...laundry, id: `extra-${index}-${i}`, title: `${FB_IDENTITIES[index].name} · ${i + 1}`, content: 'Additional synthetic local information for this tenant.', category: i % 2 ? 'Transportes do bairro' : 'Experiências locais', guest_presentation: { group: 'original' } });
  return data;
}
