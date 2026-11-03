/** Internal Data API paging; no UI pagination or partial administrative snapshot. */
export async function readFbRows<T>(
 read:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown;count:number|null}>,
 max:number,key:(row:T)=>string,
):Promise<{data:T[];error:null}> {
 const rows:T[]=[],seen=new Set<string>();let total:number|undefined;
 for(;;){
  const page=await read(rows.length,Math.min(rows.length+499,max-1));
  if(page.error||!page.data||page.count===null||!Number.isSafeInteger(page.count)||page.count<0||page.count>max)
   throw new Error('Não foi possível carregar o retrato completo da Gastronomia.');
  if(total!==undefined&&total!==page.count)throw new Error('A Gastronomia mudou durante a leitura. Recarregue.');
  total=page.count;
  for(const row of page.data){const id=key(row);if(seen.has(id))throw new Error('A ordem mudou durante a leitura. Recarregue.');seen.add(id);rows.push(row);}
  if(rows.length===total)return {data:rows,error:null};
  if(!page.data.length||rows.length>total)throw new Error('Leitura incompleta da Gastronomia. Recarregue.');
 }
}
