import Image from 'next/image';
import Link from 'next/link';

export interface CategoryAvatar {
  name: string;
  slug: string;
  imageUrl: string | null;
}

/**
 * The shop's own photograph, standing for "everything".
 *
 * A local asset rather than a row in `categories`: "All" is not a
 * category, it is the absence of one, and giving it a real row would put
 * it in every category dropdown in the admin and in the product form.
 */
const ALL_SLUG = 'all';
const ALL_IMAGE = '/category-all.webp';

/**
 * The round category shortcuts, and the only category navigation on the
 * storefront.
 *
 * These replaced a second row of text pills that went to exactly the
 * same `/shop/[category]` pages. Two controls for one job meant the
 * answer to "how do I see the bouquets?" depended on which one you
 * happened to look at, and both wanted the same sticky slot under the
 * header.
 *
 * Sticky for the whole page, not just past the hero: this is now the
 * only way to change category, so it has to stay reachable while
 * scrolling a long catalogue. Its containing block is the page
 * container, so `sticky top-16` holds it under the header the whole way
 * down.
 *
 * Carries no negative margin, so it shares the container's content box
 * exactly with the hero band directly below — the two are meant to read
 * as one block, and a banner that overhung its own navigation did not.
 *
 * Every entry is visible at once at every width — no sideways scrolling,
 * at the owner's request. The buttons divide the available width between
 * them rather than taking a fixed size; see `.cat-strip` for what that
 * costs on a small screen.
 *
 * Nothing here is client-side, so it costs no JavaScript — the active
 * entry is decided on the server from the route.
 */
export function CategoryAvatarStrip({
  categories,
  activeSlug,
}: {
  categories: CategoryAvatar[];
  /** Omitted on the catalogue landing page, where "All" is current. */
  activeSlug?: string;
}) {
  const entries: (CategoryAvatar & { href: string })[] = [
    { name: 'All', slug: ALL_SLUG, imageUrl: ALL_IMAGE, href: '/' },
    ...categories.map((category) => ({ ...category, href: `/shop/${category.slug}` })),
  ];
  const current = activeSlug ?? ALL_SLUG;

  return (
    <nav
      aria-label="Shop by category"
      className="sticky top-16 z-30 border-b border-[var(--sf-border)] bg-[var(--sf-surface)]/95 px-2 py-3 backdrop-blur sm:px-4"
    >
      <ul className="cat-strip">
        {entries.map((entry) => {
          const isCurrent = entry.slug === current;
          return (
            <li key={entry.slug} className="shrink-0">
              <Link
                href={entry.href}
                aria-current={isCurrent ? 'page' : undefined}
                className="group flex w-full flex-col items-center gap-1.5"
              >
                <span
                  className={`cat-avatar block overflow-hidden rounded-full bg-[var(--paper-2)] transition-colors ${
                    isCurrent
                      ? 'ring-2 ring-[var(--gold)]'
                      : 'border border-[var(--sf-border)] group-hover:border-[var(--gold)]'
                  }`}
                >
                  {entry.imageUrl ? (
                    <Image
                      src={entry.imageUrl}
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
                      {entry.name.charAt(0)}
                    </span>
                  )}
                </span>
                <span
                  className={`cat-label line-clamp-3 text-center ${
                    isCurrent ? 'font-semibold text-[var(--gold-deep)]' : ''
                  }`}
                >
                  {entry.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
