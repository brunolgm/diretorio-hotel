import {FbPrintingGuestReadiness} from './fb-printing-deployment';
import {AlertTriangle, ArrowRight, ClipboardCheck, ListChecks, Monitor, Printer, Route} from 'lucide-react';
import type {Commissioning} from '@/lib/fb/printing/commissioning';
import type {PrintConsole} from '@/lib/fb/printing/admin';

const pendingActions:Record<string,string>={physical_test:'Teste físico pendente',physical_verification:'Teste físico pendente',bridge:'Conectar computador',computer:'Conectar computador',queue:'Verificar fila da impressora',routing:'Configurar roteamento',test:'Enviar teste de impressão',catalog:'Publicar cardápio',entitlements:'Verificar módulos necessários',mode:'Configurar modo operacional',native_outlet:'Configurar atendimento',sectors:'Configurar setores'};

export function FbPrintingSummary({snapshot, readiness, stale, navigate}: {snapshot: PrintConsole; readiness: Commissioning | null; stale: boolean; navigate: (section: string) => void}) {
 const {config, access, health} = snapshot;
 const online = config.devices?.filter(d => d.active && !d.revoked_at && d.last_seen_at && Date.parse(snapshot.server_time) - Date.parse(d.last_seen_at) < 90000).length;
 const verified = readiness?.checks.filter(check => check.status === 'PASS').length ?? 0;
 const verificationAvailable = access.configure && !stale && readiness && readiness.checks.length > 0;
 const blockers = readiness?.checks.filter(check => check.status === 'BLOCKER') ?? [];
 const singleBlocker = readiness?.blockers === 1 && blockers.length === 1 ? blockers[0] : null;
 const pendingAction = singleBlocker && pendingActions[singleBlocker.code] ? pendingActions[singleBlocker.code] + (singleBlocker.sector ? ` · ${singleBlocker.sector}` : '') : null;
 const pending = readiness?.checks.filter(check => check.status !== 'PASS') ?? [];
 const pendingHint = pendingAction ?? (pending.length === 1 && pendingActions[pending[0].code] ? pendingActions[pending[0].code] + (pending[0].sector ? ` · ${pending[0].sector}` : '') : pending.length ? 'Confira as pendências na implantação.' : 'Verificações concluídas.');
 const cards = [
  {label: 'Verificação para ativação', value: !access.configure ? 'Acesso restrito' : stale ? 'Atualizando' : !readiness ? 'Não confirmada' : readiness.blockers ? pendingAction ?? `${readiness.blockers} ${readiness.blockers === 1 ? 'pendência' : 'pendências'}` : readiness.warnings ? 'Papel / avisos pendentes' : readiness.ready ? 'Preflight verificado' : 'Incompleta', target: 'deployment', Icon: ClipboardCheck},
  {label: 'Computador de impressão', value: online === undefined ? 'Escopo restrito' : `${online} online`, target: 'deployment', Icon: Monitor},
  {label: 'Impressoras', value: config.printers ? `${config.printers.length} ${config.printers.length === 1 ? 'configurada' : 'configuradas'}` : 'Escopo restrito', target: 'printers', Icon: Printer},
  {label: 'Roteamento', value: config.routes ? `${config.routes.filter(r => r.active).length} ${config.routes.filter(r => r.active).length === 1 ? 'rota ativa' : 'rotas ativas'}` : 'Escopo restrito', target: 'routing', Icon: Route},
  {label: 'Fila', value: `${health.backlog} aguardando`, target: 'queue', Icon: ListChecks},
 ];
 return <section aria-label="Visão geral" className="fb-print-overview">
  <div className="fb-print-metrics">{cards.map(({label, value, target, Icon}) => <article key={label}>
   <Icon size={17} aria-hidden="true"/><p>{label}</p><strong data-tone={stale ? undefined : target === 'deployment' && label === 'Verificação para ativação' ? readiness?.blockers ? 'warning' : readiness?.ready ? 'success' : undefined : label === 'Computador de impressão' ? online ? 'success' : online === 0 ? 'warning' : undefined : label === 'Fila' ? health.ambiguous ? 'warning' : undefined : undefined}>{value}</strong>
   {target === 'queue' || access.configure ? <button type="button" aria-label={`Consultar ${label.toLowerCase()}`} onClick={() => navigate(target)}><ArrowRight size={16} aria-hidden="true"/></button> : null}
  </article>)}</div>
  <article className="fb-print-guide fb-print-overview-guide">
   <div><span className="fb-print-eyebrow">OPERAÇÃO DO HOTEL</span><h2>Impressão organizada para a operação do hotel</h2>
    <p>{readiness?.mode === 'catalog_only' ? 'Cardápio em modo de consulta. Conclua a implantação antes de liberar pedidos e impressão.' : 'Acompanhe a fila e confira a configuração de cada setor.'}</p>
    <div className="fb-print-actions">{access.configure ? <button className="fb-print-primary" onClick={() => navigate('deployment')}>Configurar impressão<ArrowRight size={16} aria-hidden="true"/></button> : null}<button className="fb-print-secondary" onClick={() => navigate('queue')}>Acompanhar fila</button></div>
   </div><div className="fb-print-readiness"><span className="fb-print-eyebrow">Verificações críticas</span>{verificationAvailable ? <><strong>{verified} de {readiness.checks.length} concluídas</strong><p>{pendingHint}</p></> : <p>{access.configure ? 'Aguardando verificação atualizada.' : 'Verificação restrita ao responsável.'}</p>}</div>
  </article>
  {health.ambiguous || health.last_error || readiness?.blockers || readiness?.warnings ? <section className="fb-print-attention" aria-label="Atenções da operação">
   <AlertTriangle size={20} aria-hidden="true"/><div><h2>{health.ambiguous ? `${health.ambiguous} ${health.ambiguous === 1 ? 'resultado precisa' : 'resultados precisam'} de revisão` : readiness?.blockers ? 'Conclua a verificação para ativação' : 'Confira os avisos da operação'}</h2>
    <p>{health.ambiguous ? 'Revise o envio antes de autorizar uma nova via.' : readiness?.blockers ? 'Confira as pendências antes de liberar a operação.' : 'Consulte a fila antes de repetir uma ação.'}</p>
   </div><button className="fb-print-secondary" onClick={() => navigate(health.ambiguous || health.last_error ? 'queue' : 'deployment')}>{health.ambiguous || health.last_error ? 'Revisar fila' : 'Ver pendências'}<ArrowRight size={16} aria-hidden="true"/></button>
  </section> : null}
  {access.configure?<FbPrintingGuestReadiness data={readiness}/>:null}
  <p className="fb-print-footnote">Computador online e envio ao sistema de impressão não comprovam saída de papel. Atendimento e impressão são independentes.</p>
 </section>;
}

export function FbPrintingSteps({snapshot, readiness, navigate}: {snapshot: PrintConsole; readiness: Commissioning | null; navigate: (section: string) => void}) {
 const connected = snapshot.config.devices?.some(d => d.active && !d.revoked_at && d.last_seen_at && Date.parse(snapshot.server_time) - Date.parse(d.last_seen_at) < 90000);
 const steps = [
  {title: 'Preparar computador', text: 'Windows com o pacote oficial do LibGuest Printing Bridge.', status: 'Orientação', target: null},
  {title: 'Conectar Bridge', text: 'Use o código temporário no computador do hotel.', status: connected ? 'Conectado' : 'Pendente', target: null},
  {title: 'Detectar impressoras', text: 'Escolha as filas encontradas no computador.', status: snapshot.config.printers?.some(p => p.active) ? 'Configurada' : 'Pendente', target: 'printers'},
  {title: 'Configurar roteamento', text: 'Defina o destino de cada setor.', status: snapshot.config.routes?.some(r => r.active) ? 'Configurado' : 'Pendente', target: 'routing'},
  {title: 'Fazer teste', text: 'Envie um teste autorizado e confirme o papel.', status: readiness?.human_verifications.length ? 'Evidência registrada' : 'Pendente', target: 'printers'},
  {title: 'Liberar operação', text: 'Revise a verificação abaixo antes de ativar.', status: readiness?.ready ? 'Verificação pronta' : 'Verificação pendente', target: null},
 ];
 return <section className="fb-print-steps" aria-label="Etapas de implantação"><div className="fb-print-section-heading"><div><span className="fb-print-eyebrow">IMPLANTAÇÃO</span><h2>Da configuração à operação</h2></div><p>Avance pelas etapas sem perder a verificação de segurança.</p></div>
  <ol>{steps.map((step, index) => <li key={step.title}><span className="fb-print-step-number">{index + 1}</span><div><h3>{step.title}</h3><p>{step.text}</p><span className="fb-print-step-state" data-pending={step.status.includes('Pendente') || step.status.includes('pendente')} data-complete={step.status !== 'Orientação' && !step.status.toLowerCase().includes('pendente')}><span aria-hidden="true">{step.status === 'Orientação' ? null : step.status.toLowerCase().includes('pendente') ? '!' : '✓'}</span>{step.status}</span>{step.target ? <button onClick={() => navigate(step.target!)}>Abrir<ArrowRight size={14} aria-hidden="true"/></button> : null}</div></li>)}</ol>
 </section>;
}
