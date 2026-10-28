'use client';
import { useState, type CSSProperties } from 'react';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export function PublicExperienceMenu({ title, label, links, style }: { title: string; label: string; links: { href: string; label: string }[]; style?: CSSProperties }) {
  const [open, setOpen] = useState(false);
  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger render={<button type="button" aria-label={label} className="v3-menu-trigger" />}><Menu aria-hidden className="h-6 w-6" /></SheetTrigger>
    <SheetContent side="right" style={style} className="overflow-y-auto bg-[var(--hotel-surface)] p-6 text-[color:var(--hotel-text)]">
      <SheetTitle className="pr-8 text-xl font-semibold">{title}</SheetTitle>
      <nav aria-label={label} className="flex flex-col gap-2">{links.map(link => <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="min-h-12 rounded-lg border-b border-[color:var(--hotel-border)] px-2 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hotel-accent)]">{link.label}</a>)}</nav>
    </SheetContent>
  </Sheet>;
}
