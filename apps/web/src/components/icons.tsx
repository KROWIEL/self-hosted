import { ReactNode } from 'react';

export type IconProps = { className?: string };

/** Shared 24-grid stroke icon wrapper. Colour comes from the parent. */
export function Svg({
  className = '',
  size = 20,
  children,
}: IconProps & { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}
