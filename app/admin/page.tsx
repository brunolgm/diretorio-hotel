import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  ConciergeBell,
  Eye,
  Hotel,
  ShieldCheck,
} from 'lucide-react';
import {
  AdminInfoBadge,
  AdminPageHero,
  AdminQuickArrow,
  AdminSectionTitle,
  AdminStatCard,
  AdminSurface,
} from '@/components/admin/ui';
import { requireUser } from '@/lib/auth';
import { getAdminHotel } from '@/lib/queries';

function QuickLink({
  href,
  icon: Icon,
  title,
  text,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 transition group-hover:bg-slate-900 group-hover:text-white">
          <Icon className="h-5 w-5" />
        </div>
        <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:text-slate-700" />
      </div>

      <h3 className="mt-5 text-lg font-semibold tracking-tight text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </Link>
  );
}

export default async function AdminPage() {
  await requireUser();
  const hotel = await getAdminHotel();

  return (
    <main className="space-y-6">
      <AdminPageHero
        eyebrow="GuestDesk"
        title={hotel.name}
        description="Gerencie o GuestDesk do hotel com uma experiência mais organizada, elegante e preparada para apresentação, operação e atualização diária."
        rightSlot={
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Cidade</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {hotel.city || 'Não informada'}
              </p>
            </div>
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Status</p>
              <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-white">
                <CheckCircle2 className="h-4 w-4" />
                Operacional
              </p>
            </div>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          icon={<Hotel className="h-5 w-5" />}
          title="Check-in"
          value={hotel.checkin_time || '—'}
          description="Horário padrão configurado para entrada dos hóspedes."
        />
        <AdminStatCard
          icon={<Clock3 className="h-5 w-5" />}
          title="Check-out"
          value={hotel.checkout_time || '—'}
          description="Horário padrão configurado para saída dos hóspedes."
        />
        <AdminStatCard
          icon={<Eye className="h-5 w-5" />}
          title="Experiência pública"
          value="Online"
          description="A versão pública do GuestDesk está publicada e acessível."
        />
        <AdminStatCard
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Admin"
          value="Protegido"
          description="Área administrativa com autenticação e acesso restrito."
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        <QuickLink
          href="/admin/hotel"
          icon={Hotel}
          title="Informações do hotel"
          text="Atualize nome, cidade, horários, Wi-Fi, links institucionais e apresentação da marca."
        />
        <QuickLink
          href="/admin/servicos"
          icon={ConciergeBell}
          title="Serviços"
          text="Cadastre e organize os cards de serviços e informações exibidos no GuestDesk."
        />
        <QuickLink
          href="/admin/departamentos"
          icon={Building2}
          title="Departamentos"
          text="Gerencie os setores de contato exibidos para os hóspedes."
        />
        <QuickLink
          href="/admin/politicas"
          icon={ShieldCheck}
          title="Políticas"
          text="Mantenha regras, orientações e políticas sempre atualizadas."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <AdminSurface>
          <AdminSectionTitle eyebrow="Acesso rápido" title="Próximas ações recomendadas" />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Revisar conteúdo</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Verifique descrições, textos de botões, horários e links finais do hotel.
              </p>
            </div>

            <div className="rounded-[24px] bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Refinar apresentação</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Confira logo oficial, consistência visual e assinatura comercial do produto.
              </p>
            </div>

            <div className="rounded-[24px] bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Testar jornada do hóspede</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Navegue pela rota pública e valide a experiência do GuestDesk no celular.
              </p>
            </div>

            <div className="rounded-[24px] bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Preparar demonstração</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Organize o link público para portfolio, QR Code e apresentação comercial.
              </p>
            </div>
          </div>
        </AdminSurface>

        <AdminSurface>
          <AdminSectionTitle
            eyebrow="Resumo do ambiente"
            title="Situação atual"
            action={
              <AdminInfoBadge>
                <AdminQuickArrow />
                Gestão ativa
              </AdminInfoBadge>
            }
          />

          <div className="mt-6 space-y-4">
            <div className="rounded-[24px] border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-900">GuestDesk publicado</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                A experiência pública já está online e pronta para demonstração.
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-900">Operação centralizada</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Serviços, departamentos e políticas podem ser gerenciados em um único painel.
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-900">Marca e conteúdo</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                O hotel já pode ajustar identidade visual e finalizar os textos da apresentação.
              </p>
            </div>
          </div>
        </AdminSurface>
      </section>
    </main>
  );
}
