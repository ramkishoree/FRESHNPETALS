-- Marketing, CMS & Content Domain — Ch.10 Part 7 (§144-167).

-- seo_metadata — §156, created first: every content table below references
-- it. "Never duplicate SEO columns. Everything references this table."
create table public.seo_metadata (
  id uuid primary key default uuid_generate_v7(),
  entity_type text not null,
  entity_id uuid not null,
  title text,
  description text,
  canonical text,
  robots text not null default 'index,follow',
  open_graph jsonb not null default '{}',
  twitter_card jsonb not null default '{}',
  structured_data jsonb not null default '{}',
  focus_keyword text,
  score integer check (score between 0 and 100),
  last_audited timestamptz,
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id)
);

create trigger trg_touch_row before update on public.seo_metadata
  for each row execute function private.touch_row();

-- blogs — §146. Administrator never edits HTML; content lives in blog_blocks.
create table public.blogs (
  id uuid primary key default uuid_generate_v7(),
  title text not null,
  slug text not null unique,
  excerpt text,
  featured_image text,
  author uuid references public.users (id),
  status blog_status not null default 'draft',
  reading_time_minutes integer,
  published_at timestamptz,
  scheduled_at timestamptz,
  seo_id uuid references public.seo_metadata (id),
  ai_generated boolean not null default false,
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_blogs_slug on public.blogs (slug);
create index idx_blogs_published_at on public.blogs (published_at);
create index idx_blogs_status on public.blogs (status);
create index idx_blogs_author on public.blogs (author);
create trigger trg_touch_row before update on public.blogs
  for each row execute function private.touch_row();

-- blog_blocks — §147. Ordered content blocks; editor upgrades never require
-- a schema change.
create table public.blog_blocks (
  id uuid primary key default uuid_generate_v7(),
  blog_id uuid not null references public.blogs (id) on delete cascade,
  block_type text not null,
  position integer not null,
  content jsonb not null default '{}'
);

create index idx_blog_blocks_blog_id on public.blog_blocks (blog_id, position);

-- blog_categories — §148.
create table public.blog_categories (
  id uuid primary key default uuid_generate_v7(),
  name text not null,
  slug text not null unique,
  description text,
  color text,
  icon text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_touch_row_no_version before update on public.blog_categories
  for each row execute function private.touch_row_no_version();

-- blog_category_links — many-to-many, §148.
create table public.blog_category_links (
  blog_id uuid not null references public.blogs (id) on delete cascade,
  category_id uuid not null references public.blog_categories (id) on delete cascade,
  primary key (blog_id, category_id)
);

-- static_pages — §149.
create table public.static_pages (
  id uuid primary key default uuid_generate_v7(),
  title text not null,
  slug text not null unique,
  layout text,
  status content_status not null default 'draft',
  seo_id uuid references public.seo_metadata (id),
  content jsonb not null default '{}',
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_static_pages_slug on public.static_pages (slug);
create trigger trg_touch_row before update on public.static_pages
  for each row execute function private.touch_row();

-- landing_pages — §150. Hero/sections/products/testimonials/CTA all nest
-- inside `content`, mirroring the blogs block-based pattern rather than
-- giving each facet its own column.
create table public.landing_pages (
  id uuid primary key default uuid_generate_v7(),
  title text not null,
  slug text not null unique,
  content jsonb not null default '{}',
  seo_id uuid references public.seo_metadata (id),
  status content_status not null default 'draft',
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_landing_pages_slug on public.landing_pages (slug);
create trigger trg_touch_row before update on public.landing_pages
  for each row execute function private.touch_row();

-- homepage_sections — §151.
create table public.homepage_sections (
  id uuid primary key default uuid_generate_v7(),
  section_type text not null,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  configuration jsonb not null default '{}',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_homepage_sections_sort_order on public.homepage_sections (sort_order);
create trigger trg_touch_row before update on public.homepage_sections
  for each row execute function private.touch_row();

-- hero_banners — §152.
create table public.hero_banners (
  id uuid primary key default uuid_generate_v7(),
  title text,
  subtitle text,
  button_text text,
  button_url text,
  desktop_image text not null,
  mobile_image text not null,
  priority integer not null default 0,
  start_date timestamptz,
  end_date timestamptz,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_hero_banners_enabled on public.hero_banners (enabled, priority);
create trigger trg_touch_row_no_version before update on public.hero_banners
  for each row execute function private.touch_row_no_version();

-- announcements — §153.
create table public.announcements (
  id uuid primary key default uuid_generate_v7(),
  title text,
  message text not null,
  background_color text,
  text_color text,
  button_text text,
  button_url text,
  start_date timestamptz,
  end_date timestamptz,
  priority integer not null default 0,
  dismissible boolean not null default true,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_announcements_enabled on public.announcements (enabled, priority);
create trigger trg_touch_row_no_version before update on public.announcements
  for each row execute function private.touch_row_no_version();

-- faqs — §154.
create table public.faqs (
  id uuid primary key default uuid_generate_v7(),
  question text not null,
  answer text not null,
  entity_type text,
  entity_id uuid,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_faqs_entity on public.faqs (entity_type, entity_id);
create trigger trg_touch_row_no_version before update on public.faqs
  for each row execute function private.touch_row_no_version();

-- media_library — §155.
create table public.media_library (
  id uuid primary key default uuid_generate_v7(),
  filename text not null,
  mime_type text not null,
  width integer,
  height integer,
  filesize bigint,
  storage_path text not null,
  cdn_url text,
  dominant_color text,
  blur_hash text,
  alt_text text,
  tags text[] not null default '{}',
  uploaded_by uuid references public.users (id),
  created_at timestamptz not null default now()
);

create index idx_media_library_tags_gin on public.media_library using gin (tags);

-- redirects — §157. Auto-generated when a slug changes (Phase 5 trigger/service).
create table public.redirects (
  id uuid primary key default uuid_generate_v7(),
  source text not null unique,
  destination text not null,
  type redirect_type not null default '301',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- navigation — §158. Unlimited nesting via self-referencing parent_id.
create table public.navigation (
  id uuid primary key default uuid_generate_v7(),
  menu_name text not null,
  parent_id uuid references public.navigation (id),
  label text not null,
  url text,
  icon text,
  sort_order integer not null default 0,
  visibility boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_navigation_menu_name on public.navigation (menu_name, sort_order);
create index idx_navigation_parent_id on public.navigation (parent_id);
create trigger trg_touch_row_no_version before update on public.navigation
  for each row execute function private.touch_row_no_version();

-- footer — §159. JSON-driven configurable sections.
create table public.footer (
  id uuid primary key default uuid_generate_v7(),
  section text not null,
  content jsonb not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_touch_row_no_version before update on public.footer
  for each row execute function private.touch_row_no_version();

-- sitemap_entries — §160. Refreshed automatically when products/blogs/pages change.
create table public.sitemap_entries (
  id uuid primary key default uuid_generate_v7(),
  url text not null unique,
  priority numeric(2, 1) not null default 0.5,
  change_frequency text not null default 'weekly',
  last_modified timestamptz not null default now(),
  included boolean not null default true,
  generated_at timestamptz not null default now()
);
