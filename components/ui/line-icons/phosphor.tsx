'use client';

import { forwardRef } from 'react';
import { ChevronRight, Send } from 'lucide-react';
import type { LucideProps } from 'lucide-react';

export {
  Archive,
  ArrowLeft,
  ChevronDown as CaretDown,
  Check as CheckIcon,
  Settings as GearSix,
  Search as MagnifyingGlass,
  Mic as Microphone,
  Pencil as NotePencil,
  Plus,
  PanelLeft as SidebarSimple,
  Grid2X2 as SquaresFour,
  Trash2 as Trash,
  CircleUserRound as UserCircle,
} from 'lucide-react';

type LegacyProps = LucideProps & { weight?: string };

function acceptWeight(Icon: typeof ChevronRight, name: string) {
  const Compat = forwardRef<SVGSVGElement, LegacyProps>(({ weight, ...props }, ref) => {
    void weight;
    return <Icon {...props} ref={ref} />;
  });
  Compat.displayName = name;
  return Compat;
}

export const CaretRight = acceptWeight(ChevronRight, 'CaretRight');
export const CaretRightIcon = CaretRight;
export const PaperPlaneRight = acceptWeight(Send, 'PaperPlaneRight');
