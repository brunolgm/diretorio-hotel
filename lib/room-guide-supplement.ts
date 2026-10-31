import {guideText,type RoomGuide} from './room-guides.ts';
/** Hide only empty text, exact preparation boilerplate, or exact structured instructions.
 * Mixed/additional operational descriptions always stay. No brand/name heuristic. */
export function hasGuideSupplement(content:string|null|undefined,guide:RoomGuide|null|undefined,language:'pt'|'en'|'es'){
 if(!guide)return true;
 const normalize=(s:string)=>s.normalize('NFKC').replace(/\s+/g,' ').trim();
 const value=normalize(content??'');if(!value)return false;
 const preparation=[
 'Guia do quarto em preparação editorial. Consulte as instruções revisadas pelo hotel e confirme a aplicabilidade ao equipamento da sua acomodação.',
 'Room guide under editorial preparation. Read the instructions reviewed by the hotel and confirm that they apply to the equipment in your accommodation.',
 'Guía de la habitación en preparación editorial. Consulte las instrucciones revisadas por el hotel y confirme que corresponden al equipo de su alojamiento.'
 ];
 const bodies=guide.steps.map(s=>guideText(s.body,language));
 const equivalents=[...preparation,...bodies,bodies.join(' '),guide.steps.map(s=>guideText(s.title,language)+' '+guideText(s.body,language)).join(' ')];
 return !equivalents.some(s=>normalize(s)===value);
}
