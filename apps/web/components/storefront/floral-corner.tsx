import Image from 'next/image';

const ASSETS = {
  1: { src: '/illustrations/corner-floral-1.png', width: 360, height: 270 },
  2: { src: '/illustrations/corner-floral-2.png', width: 295, height: 277 },
} as const;

interface FloralCornerProps {
  variant?: keyof typeof ASSETS;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size?: number;
  className?: string;
}

const POSITION_CLASSES: Record<FloralCornerProps['position'], string> = {
  'top-left': '-top-4 -left-4 scale-x-[-1]',
  'top-right': '-top-4 -right-4',
  'bottom-left': '-bottom-4 -left-4 rotate-180',
  'bottom-right': '-bottom-4 -right-4 -scale-y-100',
};

/**
 * Decorative watercolor floral corner flourishes from the owner's
 * reference mockup — purely visual, never obscures interactive content
 * (pointer-events-none, hidden below `lg` so it never crowds mobile).
 */
export function FloralCorner({
  variant = 1,
  position,
  size = 200,
  className = '',
}: FloralCornerProps) {
  const asset = ASSETS[variant];
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute z-0 hidden opacity-80 lg:block ${POSITION_CLASSES[position]} ${className}`}
      style={{ width: size }}
    >
      <Image
        src={asset.src}
        alt=""
        width={asset.width}
        height={asset.height}
        className="h-auto w-full"
      />
    </div>
  );
}
