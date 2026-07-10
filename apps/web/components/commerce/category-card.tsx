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
      className="aspect-4/5 rounded-image bg-muted group relative block overflow-hidden"
    >
      {image ? (
        <Image
          src={image}
          alt=""
          fill
          sizes="(min-width: 1024px) 20vw, 40vw"
          className="duration-400 object-cover transition-transform group-hover:scale-105"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      <span className="text-body-lg absolute bottom-4 left-4 font-semibold text-white">{name}</span>
    </Link>
  );
}
