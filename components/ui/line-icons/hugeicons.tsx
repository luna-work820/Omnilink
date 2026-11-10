'use client';

import { forwardRef } from 'react';
import { Archive, Trash2 } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { Archive02Icon } from './hugeicons-data';
import type { HugeiconsIconData } from './hugeicons-data';

type HugeiconsIconProps = LucideProps & { icon: HugeiconsIconData };

export const HugeiconsIcon = forwardRef<SVGSVGElement, HugeiconsIconProps>(function HugeiconsIcon(
  { icon, ...props },
  ref,
) {
  const Icon = icon === Archive02Icon ? Archive : Trash2;
  return <Icon {...props} ref={ref} />;
});
