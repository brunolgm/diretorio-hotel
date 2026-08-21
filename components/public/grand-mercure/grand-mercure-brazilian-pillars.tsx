import { Heart, Music2, Sprout, Waves } from 'lucide-react';
import type { SupportedPublicLanguage } from '@/lib/public-language';

function getPillars(language: SupportedPublicLanguage) {
  if (language === 'en') {
    return [
      { title: 'Local Gastronomy', description: 'Brazilian flavors and regional ingredients that delight.', icon: Sprout },
      { title: 'Unforgettable Views', description: 'The sea of Copacabana as the setting for your stay.', icon: Waves },
      { title: 'Carioca Culture', description: 'Art, music and stories that are part of our destination.', icon: Music2 },
      { title: 'Brazilian Hospitality', description: 'A warm and authentic way of welcoming you.', icon: Heart },
    ];
  }

  if (language === 'es') {
    return [
      { title: 'Gastronomía Local', description: 'Sabores brasileños e ingredientes regionales que cautivan.', icon: Sprout },
      { title: 'Vistas Inolvidables', description: 'El mar de Copacabana como escenario de su estadía.', icon: Waves },
      { title: 'Cultura Carioca', description: 'Arte, música e historias que forman parte de nuestro destino.', icon: Music2 },
      { title: 'Hospitalidad Brasileña', description: 'Una forma acogedora y auténtica de recibir.', icon: Heart },
    ];
  }

  return [
    { title: 'Gastronomia Local', description: 'Sabores brasileiros e ingredientes regionais que encantam.', icon: Sprout },
    { title: 'Vistas Inesquecíveis', description: 'O mar de Copacabana como cenário da sua estadia.', icon: Waves },
    { title: 'Cultura Carioca', description: 'Arte, música e histórias que fazem parte do nosso destino.', icon: Music2 },
    { title: 'Hospitalidade Brasileira', description: 'Um jeito acolhedor e autêntico de receber.', icon: Heart },
  ];
}

export function GrandMercureBrazilianPillars({ language }: { language: SupportedPublicLanguage }) {
  const sectionLabel = language === 'en'
    ? 'Brazilian experience'
    : language === 'es'
      ? 'Experiencia brasileña'
      : 'Experiência brasileira';

  return (
    <section
      className="grand-mercure-brazilian-pillars relative mx-3 mt-4 overflow-hidden rounded-[20px] border border-[#dfd2c0] bg-[#fffdf9] shadow-[0_16px_36px_-28px_rgba(56,45,29,.42)] md:mx-8 md:mt-7 md:rounded-[24px] lg:mx-14"
      aria-label={sectionLabel}
    >
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-4">
        {getPillars(language).map((pillar) => {
          const Icon = pillar.icon;

          return (
            <article key={pillar.title} className="flex min-h-[164px] flex-col items-center px-3 pt-6 pb-8 text-center md:min-h-[180px] md:px-5 md:pt-8 md:pb-11">
              <Icon className="h-7 w-7 text-[#b27e27] md:h-8 md:w-8" strokeWidth={1.45} aria-hidden="true" />
              <h2 className="mt-3 text-[11px] font-semibold leading-4 text-[#2d2a27] md:text-sm">{pillar.title}</h2>
              <p className="mt-2 text-[9px] leading-[1.55] text-[#6f675e] min-[390px]:text-[10px] md:text-xs md:leading-5">{pillar.description}</p>
            </article>
          );
        })}
      </div>
      <div className="grand-mercure-promenade" aria-hidden="true" />
    </section>
  );
}
