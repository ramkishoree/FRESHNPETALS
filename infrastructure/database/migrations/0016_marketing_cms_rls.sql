-- RLS — Marketing, CMS & Content Domain. Public read of published content;
-- admin manages everything. media_library is admin-only: its column list
-- mixes public-facing assets with internal documents (invoices, exports —
-- §155), so the table itself is treated as an admin asset-management index
-- rather than something the storefront queries directly. Storefront pages
-- reference plain CDN URL strings (already public) in their own columns
-- (featured_image, desktop_image, etc.), not this table.

create policy blogs_select_published on public.blogs
  for select to anon, authenticated
  using (status = 'published' and deleted_at is null);
create policy blogs_admin_all on public.blogs
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.blogs enable row level security;
alter table public.blogs force row level security;

create policy blog_blocks_select_published on public.blog_blocks
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.blogs b
      where b.id = blog_blocks.blog_id and b.status = 'published' and b.deleted_at is null
    )
  );
create policy blog_blocks_admin_all on public.blog_blocks
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.blog_blocks enable row level security;
alter table public.blog_blocks force row level security;

create policy blog_categories_select_public on public.blog_categories
  for select to anon, authenticated using (true);
create policy blog_categories_admin_all on public.blog_categories
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.blog_categories enable row level security;
alter table public.blog_categories force row level security;

create policy blog_category_links_select_public on public.blog_category_links
  for select to anon, authenticated using (true);
create policy blog_category_links_admin_all on public.blog_category_links
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.blog_category_links enable row level security;
alter table public.blog_category_links force row level security;

create policy static_pages_select_published on public.static_pages
  for select to anon, authenticated using (status = 'published');
create policy static_pages_admin_all on public.static_pages
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.static_pages enable row level security;
alter table public.static_pages force row level security;

create policy landing_pages_select_published on public.landing_pages
  for select to anon, authenticated using (status = 'published');
create policy landing_pages_admin_all on public.landing_pages
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.landing_pages enable row level security;
alter table public.landing_pages force row level security;

create policy homepage_sections_select_enabled on public.homepage_sections
  for select to anon, authenticated using (enabled = true);
create policy homepage_sections_admin_all on public.homepage_sections
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.homepage_sections enable row level security;
alter table public.homepage_sections force row level security;

create policy hero_banners_select_enabled on public.hero_banners
  for select to anon, authenticated using (enabled = true);
create policy hero_banners_admin_all on public.hero_banners
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.hero_banners enable row level security;
alter table public.hero_banners force row level security;

create policy announcements_select_enabled on public.announcements
  for select to anon, authenticated using (enabled = true);
create policy announcements_admin_all on public.announcements
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.announcements enable row level security;
alter table public.announcements force row level security;

create policy faqs_select_published on public.faqs
  for select to anon, authenticated using (published = true);
create policy faqs_admin_all on public.faqs
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.faqs enable row level security;
alter table public.faqs force row level security;

-- media_library — admin-only (see file header).
create policy media_library_admin_all on public.media_library
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.media_library enable row level security;
alter table public.media_library force row level security;

create policy seo_metadata_select_public on public.seo_metadata
  for select to anon, authenticated using (true);
create policy seo_metadata_admin_all on public.seo_metadata
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.seo_metadata enable row level security;
alter table public.seo_metadata force row level security;

create policy redirects_select_public on public.redirects
  for select to anon, authenticated using (active = true);
create policy redirects_admin_all on public.redirects
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.redirects enable row level security;
alter table public.redirects force row level security;

create policy navigation_select_visible on public.navigation
  for select to anon, authenticated using (visibility = true);
create policy navigation_admin_all on public.navigation
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.navigation enable row level security;
alter table public.navigation force row level security;

create policy footer_select_public on public.footer
  for select to anon, authenticated using (true);
create policy footer_admin_all on public.footer
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.footer enable row level security;
alter table public.footer force row level security;

create policy sitemap_entries_select_included on public.sitemap_entries
  for select to anon, authenticated using (included = true);
create policy sitemap_entries_admin_all on public.sitemap_entries
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.sitemap_entries enable row level security;
alter table public.sitemap_entries force row level security;
