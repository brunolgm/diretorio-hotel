// Synthetic browser fixture only. Never imported by application code.
import type {OperationResult} from '../../lib/fb/orders/operations';
async function action(form:FormData):Promise<OperationResult>{document.body.dataset.fixtureAction=JSON.stringify(Object.fromEntries(form));return {ok:true};}
export const transitionOrderGroup=action;
export const cancelOrderByStaff=action;
export const decideOrderCancellation=action;
