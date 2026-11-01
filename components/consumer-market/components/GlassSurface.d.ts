import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from 'react';

type GlassChannel = 'R' | 'G' | 'B' | 'A';
type GlassBackdrop =
  | HTMLImageElement
  | HTMLVideoElement
  | HTMLCanvasElement
  | { current: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | null }
  | null;

type GlassSurfaceProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: ReactNode;
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  borderRadius?: number;
  borderWidth?: number;
  brightness?: number;
  opacity?: number;
  blur?: number;
  displace?: number;
  backgroundOpacity?: number;
  saturation?: number;
  distortionScale?: number;
  redOffset?: number;
  greenOffset?: number;
  blueOffset?: number;
  xChannel?: GlassChannel;
  yChannel?: GlassChannel;
  mixBlendMode?: CSSProperties['mixBlendMode'];
  refraction?: boolean;
  renderer?: 'auto' | 'svg' | 'webgl';
  backdrop?: GlassBackdrop;
  shape?: string;
};

export default function GlassSurface(props: GlassSurfaceProps): ReactElement;
