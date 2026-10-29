/** Only explicitly international numbers from the published contact text. Never infer country or WhatsApp. */
export function publishedContactPhones(description:string|null,url?:string|null){
 const seen=new Set<string>();
 return (description?.match(/\+[1-9][0-9 ().-]{6,24}[0-9]/g)??[]).flatMap(label=>{
  const number=label.replace(/[^+0-9]/g,'');
  if(!/^\+[1-9]\d{7,14}$/.test(number)||seen.has(number)||url?.replace(/[ ().-]/g,'')==='tel:'+number)return [];
  seen.add(number);return [{label:label.trim(),href:'tel:'+number}];
 });
}
