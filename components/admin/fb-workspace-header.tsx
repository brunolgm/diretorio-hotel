import type { ReactNode } from 'react';
import { Eye, UtensilsCrossed } from 'lucide-react';
import { AdminInfoBadge } from './ui';
import { FbWorkspaceNav } from './fb-workspace-nav';
import type { FbWorkspaceLink, FbWorkspaceSection } from '@/lib/fb/admin-workspace';
import './fb-workspace.css';

export function FbWorkspaceHeader({ links, active, title = 'Gastronomia (F&B)', description = 'Gerencie restaurantes, Room Service e cardápios do hotel.', mode, action }: { links: FbWorkspaceLink[]; active: FbWorkspaceSection; title?: string; description?: string; mode?: { mode: 'catalog_only' | 'ordering' | null; unavailable: 'permission' | 'error' | null }; action?: ReactNode }) {
  return <><header className="fb-workspace-hero"><div className="fb-workspace-heading"><div className="fb-workspace-symbol"><UtensilsCrossed size={29} aria-hidden="true"/></div><div><h1>{title}</h1><p className="fb-workspace-subtitle">{description}</p></div></div><div className="fb-workspace-hero-actions">{mode ? <AdminInfoBadge><Eye size={16} aria-hidden="true"/>{mode.mode === 'catalog_only' ? 'Somente visualização' : mode.mode === 'ordering' ? 'Visualização + pedidos' : mode.unavailable === 'permission' ? 'Modo não disponível para este acesso' : 'Modo não consultado'}</AdminInfoBadge> : null}{action}</div></header><FbWorkspaceNav links={links} active={active}/></>;
}
