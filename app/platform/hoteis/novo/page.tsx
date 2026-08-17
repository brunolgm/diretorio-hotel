import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PlatformHotelOnboardingForm } from './onboarding-form';

export default function NewPlatformHotelPage() {
  return <div className="space-y-6"><section className="rounded-[30px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70 md:p-8"><Link href="/platform/hoteis" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" />Voltar ao diretório</Link><p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">LibGuest Platform</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Novo hotel</h1><p className="mt-2 text-sm leading-6 text-slate-600">Cadastre a propriedade e prepare o acesso inicial.</p></section><PlatformHotelOnboardingForm /></div>;
}
