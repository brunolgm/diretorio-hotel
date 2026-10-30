import type {GuideChannel,RoomGuide} from './room-guides';
export const GUIDE_CHANNEL_PAGE_SIZE=12;
export type GuideTab='how'|'channels'|'help';
export type GuideView={tab:GuideTab;step:number;search:string;quality:'all'|GuideChannel['quality'];page:number};
export const defaultGuideView:GuideView={tab:'how',step:0,search:'',quality:'all',page:1};
export function guideChannelResults(guide:RoomGuide,search:string,quality:GuideView['quality'],draftPreview:boolean){
 const normalize=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase();
 const query=normalize(search.trim());
 const eligible=guide.channels.filter(c=>(c.kind==='linear'||c.kind==='application'||(draftPreview&&c.kind==='review'))&&(quality==='all'||c.quality===quality)&&normalize([c.number,c.name,c.category??''].join(' ')).includes(query));
 return {channels:eligible.filter(c=>c.kind!=='application'),apps:eligible.filter(c=>c.kind==='application')};
}
export function guideChannelPage(channels:GuideChannel[],requestedPage:number){
 const totalPages=Math.max(1,Math.ceil(channels.length/GUIDE_CHANNEL_PAGE_SIZE));
 const page=Math.min(totalPages,Math.max(1,Number.isSafeInteger(requestedPage)?requestedPage:1));
 return {page,totalPages,items:channels.slice((page-1)*GUIDE_CHANNEL_PAGE_SIZE,page*GUIDE_CHANNEL_PAGE_SIZE)};
}
/** UI preferences only. Never authorizes content, selects a tenant or changes a guide. */
export function parseGuideView(raw:string,guide:RoomGuide,draftPreview:boolean):GuideView{
 let v:Partial<GuideView>={};try{const parsed=JSON.parse(raw);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))v=parsed;}catch{}
 const channelsAvailable=guide.channels.some(c=>c.kind==='linear'||c.kind==='application'||(draftPreview&&c.kind==='review'));
 return {tab:(v.tab==='help'||(v.tab==='channels'&&channelsAvailable))?v.tab:'how',step:Number.isSafeInteger(v.step)?Math.max(0,Math.min(guide.steps.length-1,v.step!)):0,search:typeof v.search==='string'?v.search.slice(0,160):'',quality:['HD','SD','unspecified'].includes(v.quality??'')?v.quality as GuideView['quality']:'all',page:Number.isSafeInteger(v.page)&&v.page!>0?v.page!:1};
}
