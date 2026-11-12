import {BellRing,ChefHat,CircleCheck,Truck,PackageCheck,UtensilsCrossed} from 'lucide-react';
export function FbOperationIcon({status,size=22}:{status:string;size?:number}){
 const icons={registered:BellRing,accepted:UtensilsCrossed,preparing:ChefHat,ready:CircleCheck,out_for_delivery:Truck,delivered:PackageCheck};
 const Icon=icons[status as keyof typeof icons]||UtensilsCrossed;
 return <Icon size={size} aria-hidden="true"/>;
}
