'use client';

import Image from 'next/image';
import * as React from 'react';

export interface GalleryItem {
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
}

/** Ch.12 §22 PDP gallery — featured image plus any additional product_media (images/videos), with a thumbnail strip to switch the main viewer. */
export function ProductGallery({ items, name }: { items: GalleryItem[]; name: string }) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const active = items[activeIndex];

  if (!active) return null;

  return (
    <div>
      <div className="relative overflow-hidden rounded-[var(--r-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] shadow-[var(--shadow-md)]">
        <div className="relative aspect-square w-full">
          {active.type === 'video' ? (
            <video
              key={active.url}
              src={active.url}
              poster={active.thumbnailUrl}
              controls
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <Image
              src={active.url}
              alt={name}
              fill
              priority={activeIndex === 0}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          )}
        </div>
      </div>

      {items.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {items.map((item, index) => (
            <button
              key={`${item.type}-${item.url}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`relative size-16 shrink-0 overflow-hidden rounded-[var(--r-md)] border ${
                index === activeIndex ? 'border-[var(--gold-deep)]' : 'border-[var(--sf-border)]'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- small thumbnail strip, already-optimized Supabase-hosted asset */}
              <img
                src={item.type === 'video' ? (item.thumbnailUrl ?? item.url) : item.url}
                alt=""
                className="h-full w-full object-cover"
              />
              {item.type === 'video' && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
