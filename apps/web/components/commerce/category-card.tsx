import Image from 'next/image';
import Link from 'next/link';

export interface CategoryCardProps {
  name: string;
  slug: string;
  image?: string | null;
}

/** Ch.12 §82. */
export function CategoryCard({ name, slug, image }: CategoryCardProps) {
  return (
    <Link
      href={`/shop/${slug}`}
      className="group relative block aspect-[4/5] overflow-hidden rounded-[var(--r-lg)] border border-[var(--sf-border)] shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-lift)]"
    >
      <div className="relative size-full bg-[var(--sf-surface-2)]">
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            sizes="(min-width: 1024px) 20vw, 40vw"
            className="object-cover transition-transform duration-700 ease-[var(--ease)] group-hover:scale-105"
          />
        ) : null}
        <div
          aria-hidden="true"
          className="from-[var(--green)]/85 via-[var(--green)]/20 absolute inset-0 bg-gradient-to-t to-transparent"
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-4">
        <span className="font-display text-lg text-[var(--ivory)]">{name}</span>
        <span className="mt-0.5 block h-px w-6 origin-left scale-x-0 bg-[var(--gold)] transition-transform duration-300 group-hover:scale-x-100" />
      </div>
    </Link>
  );
}
