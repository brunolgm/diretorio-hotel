import {
  BedDouble,
  BellRing,
  Building2,
  Coffee,
  ConciergeBell,
  Dumbbell,
  Droplets,
  Globe,
  Heart,
  Hotel,
  Info,
  Package,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Shirt,
  Sparkles,
  UtensilsCrossed,
  Wifi,
} from 'lucide-react';
import { resolveServiceIconName } from '@/lib/service-options';

interface ServiceIconProps {
  iconName?: string | null;
  className?: string;
}

export function ServiceIcon({ iconName, className }: ServiceIconProps) {
  switch (resolveServiceIconName(iconName)) {
    case 'ConciergeBell':
      return <ConciergeBell className={className} />;
    case 'Coffee':
      return <Coffee className={className} />;
    case 'UtensilsCrossed':
      return <UtensilsCrossed className={className} />;
    case 'BellRing':
      return <BellRing className={className} />;
    case 'ShoppingBag':
      return <ShoppingBag className={className} />;
    case 'Sparkles':
      return <Sparkles className={className} />;
    case 'Heart':
      return <Heart className={className} />;
    case 'BedDouble':
      return <BedDouble className={className} />;
    case 'Package':
      return <Package className={className} />;
    case 'Shirt':
      return <Shirt className={className} />;
    case 'Dumbbell':
      return <Dumbbell className={className} />;
    case 'Droplets':
      return <Droplets className={className} />;
    case 'Wifi':
      return <Wifi className={className} />;
    case 'Building2':
      return <Building2 className={className} />;
    case 'Phone':
      return <Phone className={className} />;
    case 'ShieldCheck':
      return <ShieldCheck className={className} />;
    case 'Hotel':
      return <Hotel className={className} />;
    case 'Info':
      return <Info className={className} />;
    case 'Globe':
    default:
      return <Globe className={className} />;
  }
}
