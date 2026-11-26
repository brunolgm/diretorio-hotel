import { createRoot } from 'react-dom/client';
import { HotelPublicAreaContent } from '../../components/public/hotel-public-area-content';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { guestServicesFixture } from '../fixtures/guest-services';
import type { DomainContext } from '../../lib/domain-context';

const params = new URLSearchParams(location.search);
const data = guestServicesFixture(Number(params.get('hotel') || 4), 'pt', params.has('volume'));
const length = params.get('length');
const names = ['Room Service', 'Lavanderia', 'Menu de travesseiros', 'Academia', 'Spa dos Pés'];
if (params.has('volume')) for (const section of data.sections) {
  if (section.id.startsWith('extra-')) section.guest_presentation = { group: 'original', interaction: 'detail' };
}
if (length) for (const section of data.sections) {
  if (!names.includes(section.title)) continue;
  // Only the isolated renderer fixture changes; no hotel configuration or database writes.
  section.content = length === 'long'
    ? ('Orientações sintéticas extensas para conferir a rolagem e o acesso integral ao conteúdo.\n\n'.repeat(40) + 'FIM_DAS_ORIENTACOES')
    : 'Orientação sintética curta. Consulte a recepção.';
  section.guest_presentation = { interaction: 'detail', conditions: { pt: length === 'long' ? 'Condição de teste: ' + 'texto_sem_espacos_'.repeat(20) + '\nFIM_DAS_CONDICOES' : 'Condição sintética curta.' } };
}
const domain = { kind: 'localhost', hostname: '127.0.0.1', productRootDomain: 'libguest.digital', shouldUseSlugFallback: true } as DomainContext;
createRoot(document.getElementById('root')!).render(params.has('standard')
  ? <Dialog><DialogTrigger>Abrir modal padrão</DialogTrigger><DialogContent><DialogTitle>Modal padrão preservado</DialogTitle><DialogDescription>Referência da primitiva compartilhada sem o posicionamento de Serviços.</DialogDescription></DialogContent></Dialog>
  : <div style={params.has('transformed') ? { transform: 'translateZ(0)' } : undefined}><HotelPublicAreaContent pageData={data} area="servicos" language="pt" domainContext={domain} preferSubdomainRoot={false} /></div>);
