import { ReactNode } from 'react';
import { Svg } from '@/components/icons';

/**
 * Icons for the `icon` token in `catalog/apps/*.json`. Deliberately generic
 * glyphs rather than vendor logos: manifests are contributed freely, and
 * shipping third-party marks would drag in trademark and licensing questions.
 * Unknown tokens fall back to a neutral box.
 */
const GLYPHS: Record<string, ReactNode> = {
  ai: (
    <>
      <rect x="5" y="7" width="14" height="12" rx="3" />
      <path d="M12 3v4M9 13h.01M15 13h.01M9.5 16.5h5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  chat: (
    <>
      <path d="M20 14.5a2.5 2.5 0 0 1-2.5 2.5H9l-4.5 3.5V6.5A2.5 2.5 0 0 1 7 4h10.5A2.5 2.5 0 0 1 20 6.5z" />
      <path d="M9 8.5h6M9 12h4" />
    </>
  ),
  check: (
    <>
      <path d="M9.5 6H20M9.5 12H20M9.5 18H17" />
      <path d="M3.5 6l1.3 1.3L7.5 4.6M3.5 12l1.3 1.3L7.5 10.6M3.5 18l1.3 1.3L7.5 16.6" />
    </>
  ),
  cloud: (
    <>
      <path d="M7.2 19a4.4 4.4 0 0 1-.6-8.76 6 6 0 0 1 11.42 1.43A3.7 3.7 0 0 1 17.4 19z" />
    </>
  ),
  code: (
    <>
      <path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5" />
      <path d="M13.5 4.5l-3 15" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="7" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="11" rx="1.5" />
      <rect x="3" y="13" width="7.5" height="8" rx="1.5" />
      <rect x="13.5" y="17" width="7.5" height="4" rx="1.5" />
    </>
  ),
  database: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M3 14.5h18M9 9.5V20" />
    </>
  ),
  demo: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 9l5 3-5 3z" />
    </>
  ),
  doc: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </>
  ),
  game: (
    <>
      <path d="M8 5.5h8a5.5 5.5 0 0 1 5.4 6.5l-.8 4.4A2.8 2.8 0 0 1 16.2 18L14.5 16h-5L7.8 18a2.8 2.8 0 0 1-4.4-1.6l-.8-4.4A5.5 5.5 0 0 1 8 5.5z" />
      <path d="M7.5 9.5v3M6 11h3M15.5 10.5h.01M17.5 12.5h.01" />
    </>
  ),
  git: (
    <>
      <circle cx="7" cy="6" r="2.5" />
      <circle cx="7" cy="18" r="2.5" />
      <circle cx="17" cy="12" r="2.5" />
      <path d="M7 8.5v7M9.5 6H13a1.5 1.5 0 0 1 1.5 1.5V10" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.4 2.6 3.7 5.6 3.7 9s-1.3 6.4-3.7 9c-2.4-2.6-3.7-5.6-3.7-9s1.3-6.4 3.7-9z" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  media: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M10 9.5l5 2.5-5 2.5z" />
    </>
  ),
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4M7 11l2.5 2.5L12 9l2.5 4L17 10.5" />
    </>
  ),
  music: (
    <>
      <path d="M9 17V5l11-2v12" />
      <circle cx="6.5" cy="17.5" r="2.5" />
      <circle cx="17.5" cy="15.5" r="2.5" />
    </>
  ),
  note: (
    <>
      <path d="M5 4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v16l-3.5-2.5L12 20l-3.5-2.5L5 20z" />
      <path d="M9 8h6M9 12h4" />
    </>
  ),
  pen: (
    <>
      <path d="M4 20l1.2-4.4L16.4 4.4a2.3 2.3 0 0 1 3.2 3.2L8.4 18.8z" />
      <path d="M14.6 6.2l3.2 3.2" />
    </>
  ),
  photo: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.8" />
      <path d="M4 18l4.8-4.3 3.4 2.9 3-2.4L20 18" />
    </>
  ),
  rss: (
    <>
      <path d="M4.5 10.5A9 9 0 0 1 13.5 19.5M4.5 4.5a15 15 0 0 1 15 15" />
      <circle cx="5.5" cy="18.5" r="1.6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M15.8 15.8l4.4 4.4" />
    </>
  ),
  storage: (
    <>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>
  ),
  sync: (
    <>
      <path d="M4 12a8 8 0 0 1 13.66-5.66L20 8.5" />
      <path d="M20 4v4.5h-4.5" />
      <path d="M20 12a8 8 0 0 1-13.66 5.66L4 15.5" />
      <path d="M4 20v-4.5h4.5" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2.5" />
      <path d="M3 10.5h18M16.5 15.2h1.6" />
    </>
  ),
  workflow: (
    <>
      <rect x="3" y="4" width="6" height="5" rx="1.5" />
      <rect x="15" y="15" width="6" height="5" rx="1.5" />
      <path d="M6 9v5a3 3 0 0 0 3 3h6" />
    </>
  ),
};

const FALLBACK = (
  <>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M9 9h6v6H9z" />
  </>
);

export function CatalogIcon({
  icon,
  className,
  size = 20,
}: {
  icon: string | null;
  className?: string;
  size?: number;
}) {
  return (
    <Svg className={className} size={size}>
      {(icon && GLYPHS[icon]) || FALLBACK}
    </Svg>
  );
}
