/** Display-only excerpt; the complete administrative instructions stay in the disclosure. */
export function wifiInstructionSummary(instructions:string|null|undefined,network:string) {
 const parts=instructions?.trim().split(/(?<=[.!?])\s+|\n+/u).filter(Boolean)??[];
 const text=parts.find(part=>!network.trim()||!part.toLocaleLowerCase().includes(network.trim().toLocaleLowerCase()));
 if(!text)return null;
 return text.length<=160?text:text.slice(0,157).replace(/\s+\S*$/,'')+'…';
}
