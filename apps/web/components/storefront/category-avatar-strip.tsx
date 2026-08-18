import Image from 'next/image';
import Link from 'next/link';

export interface CategoryAvatar {
  name: string;
  slug: string;
  imageUrl: string | null;
}

/**
 * The round category shortcuts above the hero.
 *
 * Deliberately plain links to the existing `/shop/[category]` pages —
 * the same destination the pill bar below the hero already uses — so
 * there is one definition of "browse this category" and this bar cannot
 * drift from it. Nothing here is client-side, so it costs no JavaScript.
 *
 * Sticky is the same mechanism as `FloatingCategoryBar`: `sticky top-16`
 * under the site header. Its containing block is the wrapper the
 * homepage puts around this strip and the hero, so it pins while the
 * hero scrolls under it and then releases exactly as the pill bar
 * arrives to take the same slot — rather than the two bars fighting over
 * one coordinate, which is what they would do if both pinned forever.
 */
export function CategoryAvatarStrip({ categories }: { categories: CategoryAvatar[] }) {
  if (categories.length === 0) return null;

  return (
    <nav
      aria-label="Shop by category"
      className="sticky top-16 z-20 -mx-4 border-b border-[var(--sf-border)] bg-[var(--sf-surface)]/95 px-4 py-3 backdrop-blur sm:mx-0 sm:border-b-0"
    >
      <ul className="flex gap-4 overflow-x-auto sm:flex-wrap sm:justify-center sm:overflow-visible">
        {categories.map((category) => (
          <li key={category.slug} className="shrink-0">
            <Link
              href={`/shop/${category.slug}`}
              className="group flex w-16 flex-col items-center gap-1.5 sm:w-20"
            >
              <span className="block size-16 overflow-hidden rounded-full border border-[var(--sf-border)] bg-[var(--paper-2)] transition-colors group-hover:border-[var(--gold)] sm:size-20">
                {category.imageUrl ? (
                  <Image
                    src={category.imageUrl}
                    alt=""
                    width={160}
                    height={160}
                    // A square crop of the existing cover photo — the
                    // same picture the category card already uses, so
                    // the owner has nothing new to upload.
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-h4 grid size-full place-items-center text-[var(--sage)]">
                    {category.name.charAt(0)}
                  </span>
                )}
              </span>
              <span className="line-clamp-2 text-center text-[11px] leading-tight sm:text-xs">
                {category.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
