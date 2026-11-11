import {ConciergeBell, Clock3, PackageCheck, Phone, ReceiptText} from 'lucide-react';
import {money, orderCopy, orderStates, publicOrderStatus, type Language, type PublicOrder} from '@/lib/fb/orders/journey';

const copy = {
  pt: {reference: 'Seu pedido', items: 'Resumo do pedido', sectors: 'Atendimento do hotel', history: 'Histórico do pedido', updated: 'Atualização do hotel', missingContact: 'O cancelamento por este canal está indisponível no momento. Procure a equipe do hotel para receber orientação.'},
  en: {reference: 'Your order', items: 'Order summary', sectors: 'Hotel service', history: 'Order history', updated: 'Hotel update', missingContact: 'Cancellation through this channel is currently unavailable. Please contact the hotel team for assistance.'},
  es: {reference: 'Tu pedido', items: 'Resumen del pedido', sectors: 'Servicio del hotel', history: 'Historial del pedido', updated: 'Actualización del hotel', missingContact: 'La cancelación por este canal no está disponible en este momento. Consulta al equipo del hotel para recibir ayuda.'},
};

export function SmartMenuOrderStatus({order, language, error, expired}: {order: PublicOrder | null; language: Language; error: string; expired: boolean}) {
  const t = orderCopy(language);
  const labels = copy[language];
  const stages = orderStates.filter(status => status !== 'cancelled' || order?.status === 'cancelled');
  function historyLabel(event: PublicOrder['history'][number]) {
    if (event.action === 'orders.cancellation_requested') return t.cancelPending;
    if (event.action === 'orders.cancellation_denied') return t.cancelDenied;
    const status = event.status || event.action.replace('orders.', '');
    return orderStates.includes(status as typeof orderStates[number]) ? publicOrderStatus(status, language) : labels.updated;
  }
  return <article className="fb-order-tracking smartmenu-tracking-card" data-fb-order-tracking>
    <header className="smartmenu-tracking-heading"><ConciergeBell aria-hidden/><h1>{t.tracking}</h1></header>
    {!order && !expired ? <p role="status">{t.loading}</p> : null}
    {order ? <>
      <section className="smartmenu-order-current" aria-live="polite">
        <p className="smartmenu-eyebrow">{labels.reference} · {order.reference}</p>
        <h2>{publicOrderStatus(order.status, language)}</h2>
        <p className="smartmenu-order-delivery"><PackageCheck aria-hidden/>{order.fulfilment === 'pickup' ? t.pickup : t.delivery}</p>
      </section>
      <ol className="smartmenu-progress" aria-label={t.tracking}>{stages.map(status => <li key={status} aria-current={order.status === status ? 'step' : undefined} data-confirmed={order.status === status || order.history.some(event => event.status === status)}><span aria-hidden/>{publicOrderStatus(status, language)}</li>)}</ol>
      <section className="smartmenu-tracking-summary"><h3><ReceiptText aria-hidden/>{labels.items}</h3><ul>{order.lines.map((line, index) => <li key={index}><div><span>{line.name}</span><small>×{line.quantity}</small>{line.options.length ? <p>{line.options.join(' · ')}</p> : null}</div>{line.kind !== 'component' ? <strong>{money(line.total_minor, order.currency, language)}</strong> : null}</li>)}</ul><p className="smartmenu-total">{t.total}<strong>{money(order.total_minor, order.currency, language)}</strong></p></section>
      <section><h3>{labels.sectors}</h3><ul className="smartmenu-sector-status">{order.groups.map((group, index) => <li key={index}><span>{group.label}</span><strong>{publicOrderStatus(group.status, language)}</strong></li>)}</ul></section>
      <details className="smartmenu-order-history"><summary><Clock3 aria-hidden/>{labels.history}</summary><ol>{order.history.map((event, index) => <li key={index}><time dateTime={event.at}>{new Date(event.at).toLocaleTimeString(language)}</time><span>{historyLabel(event)}</span></li>)}</ol></details>
      <section className="smartmenu-cancellation" data-cancellation-contact>{order.status === 'cancelled' ? <p>{t.cancelled}</p> : order.status !== 'delivered' ? <><h3><Phone aria-hidden/>{t.cancelContactIntro}</h3>{order.cancellation.contact ? <><p>{t.cancelContactCall} <a href={order.cancellation.contact.href}>{order.cancellation.contact.phone}</a> ({order.cancellation.contact.label}).</p><p>{t.cancelContactConfirmation}</p></> : <p role="status">{labels.missingContact}</p>}</> : null}</section>
    </> : null}
    {error ? <p role="alert">{error}</p> : null}
  </article>;
}
