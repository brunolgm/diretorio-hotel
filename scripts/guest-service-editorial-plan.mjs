// Read-only, deterministic proposal. Never connects to a database or applies changes.
import { readFileSync } from 'node:fs';
import { getGuestServiceCatalog } from '../lib/guest-service-catalog.ts';
import { guestServicesFixture } from '../tests/fixtures/guest-services.ts';
const snapshot = JSON.parse(readFileSync('tests/browser/fixtures/bugan-v4-public-copy.json', 'utf8'));
const data = guestServicesFixture();
const domain = { kind: 'localhost', hostname: 'localhost', productRootDomain: 'libguest.digital', shouldUseSlugFallback: true };
const catalog = getGuestServiceCatalog(data, 'pt', domain, false);
console.log(JSON.stringify({
  version: 1,
  scope: 'Proposta a partir do snapshot público histórico autorizado, não inventário produtivo atual. Nenhuma escrita.',
  hotelId: snapshot.services[0].hotel_id,
  records: snapshot.services.map((source, index) => {
    const proposed = catalog.find(s => s.id === data.sections[index].id);
    return { id: source.id, title: source.title, expected: { category: source.category, service_action_type: source.service_action_type, url: source.url, updated_at: source.updated_at }, proposed: proposed && { area: proposed.area, group: proposed.category, interaction: proposed.interaction }, preserveOriginal: true };
  }),
  ambiguities: [
    'O snapshot tem 13 serviços; o acesso nativo adicional é derivado do grafo F&B e não constitui um segundo cadastro. Confirmar os 14 acessos atuais antes de persistir classificação.',
    'A fixture adiciona um segundo acesso sintético para comprovar deduplicação; seu ID não é ID produtivo.',
    'Room Service: acesso nativo somente quando o resolvedor canônico permite. Goomer e o registro original são preservados.',
    'Novos conteúdos ou divergências de updated_at exigem nova revisão; nenhum executor de escrita é fornecido.',
  ],
}, null, 2));
