import type {ImgHTMLAttributes,AnchorHTMLAttributes} from 'react';
export default function Image({fill,unoptimized,priority,...props}:ImgHTMLAttributes<HTMLImageElement>&{fill?:boolean;unoptimized?:boolean;priority?:boolean}){
 void unoptimized;void priority;
 // Test-only replacement for next/image; never shipped as a public component.
 // eslint-disable-next-line @next/next/no-img-element
 return <img {...props} alt={props.alt??''} style={fill?{...props.style,position:'absolute',inset:0,width:'100%',height:'100%'}:props.style}/>;
}
export function Link(props:AnchorHTMLAttributes<HTMLAnchorElement>){return <a {...props}/>;}
export const usePathname=()=>'/preview';
export const useSearchParams=()=>new URLSearchParams(location.search);
export const useRouter=()=>({push:()=>{},replace:()=>{},prefetch:()=>{}});
