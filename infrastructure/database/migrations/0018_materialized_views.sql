-- Materialized views — Ch.10 §37 (Commerce), §58 (Order/Payment).
--
-- Implemented here: every view whose aggregation logic is fully determined
-- by tables this migration set already defines. NOT implemented here (see
-- docs/database-schema.md): Top Blogs, Most Viewed Pages, Best Landing
-- Pages, SEO Scoreboard, Media Usage, Content Health, Homepage Performance,
-- Order Funnel (Ch.10 §166/§58) — these all key off analytics_events
-- page/event-name shapes that the backend (Phase 5) hasn't defined yet.
-- Building them now would mean guessing an event taxonomy and likely
-- redoing the view once real event names exist; better to defer than to
-- ship a materialized view against a schema we made up.
--
-- Refresh strategy: nightly via pg_cron or an application-scheduled job
-- (Ch.10 §37: "Refreshed Nightly or Incrementally") — refresh scheduling
-- itself is a Phase 5/13 operations concern, not created here.
--
-- SECURITY: materialized views cannot have RLS policies (Postgres rejects
-- `ENABLE ROW LEVEL SECURITY` on relkind 'm') — confirmed by testing this
-- directly against a real Postgres instance while building this file. The
-- 0010 blanket grant (`select on all tables in schema public`) also reaches
-- materialized views, which would otherwise leave every view below —
-- customer emails and lifetime value included — readable by anon/
-- authenticated with no row filtering at all. Every matview's SELECT grant
-- to anon/authenticated is revoked at the end of this file; only
-- service_role (i.e. the backend, which enforces is_admin() itself) and
-- Postgres roles with BYPASSRLS can read them.

create materialized view public.mv_top_selling_products as
select
  p.id as product_id,
  p.name as product_name,
  p.slug as product_slug,
  sum(oi.quantity) as units_sold,
  sum(oi.line_total) as revenue
from public.order_items oi
join public.products p on p.id = oi.product_id
join public.orders o on o.id = oi.order_id
where o.status not in ('cancelled', 'failed')
group by p.id, p.name, p.slug;

create unique index idx_mv_top_selling_products_product_id on public.mv_top_selling_products (product_id);

create materialized view public.mv_best_categories as
select
  c.id as category_id,
  c.name as category_name,
  sum(oi.quantity) as units_sold,
  sum(oi.line_total) as revenue
from public.order_items oi
join public.products p on p.id = oi.product_id
join public.categories c on c.id = p.category_id
join public.orders o on o.id = oi.order_id
where o.status not in ('cancelled', 'failed')
group by c.id, c.name;

create unique index idx_mv_best_categories_category_id on public.mv_best_categories (category_id);

create materialized view public.mv_inventory_dashboard as
select
  i.id as inventory_id,
  p.id as product_id,
  p.name as product_name,
  o.id as outlet_id,
  o.name as outlet_name,
  i.physical_quantity,
  i.reserved_quantity,
  i.available_quantity,
  i.low_stock_threshold,
  i.critical_threshold,
  case
    when i.available_quantity <= i.critical_threshold then 'critical'
    when i.available_quantity <= i.low_stock_threshold then 'low'
    else 'healthy'
  end as stock_status
from public.inventory i
join public.products p on p.id = i.product_id
join public.outlets o on o.id = i.outlet_id;

create unique index idx_mv_inventory_dashboard_inventory_id on public.mv_inventory_dashboard (inventory_id);

create materialized view public.mv_low_stock_dashboard as
select *
from public.mv_inventory_dashboard
where stock_status in ('low', 'critical');

create unique index idx_mv_low_stock_dashboard_inventory_id on public.mv_low_stock_dashboard (inventory_id);

create materialized view public.mv_customer_lifetime_value as
select
  c.id as customer_id,
  c.first_name,
  c.last_name,
  c.email,
  c.lifetime_value,
  c.total_orders,
  c.average_order_value,
  rank() over (order by c.lifetime_value desc) as ltv_rank
from public.customers c
where c.deleted_at is null;

create unique index idx_mv_customer_ltv_customer_id on public.mv_customer_lifetime_value (customer_id);

create materialized view public.mv_daily_revenue as
select
  date_trunc('day', created_at) as day,
  count(*) as order_count,
  sum(grand_total) as revenue
from public.orders
where status not in ('cancelled', 'failed')
group by 1;

create unique index idx_mv_daily_revenue_day on public.mv_daily_revenue (day);

create materialized view public.mv_monthly_revenue as
select
  date_trunc('month', created_at) as month,
  count(*) as order_count,
  sum(grand_total) as revenue
from public.orders
where status not in ('cancelled', 'failed')
group by 1;

create unique index idx_mv_monthly_revenue_month on public.mv_monthly_revenue (month);

create materialized view public.mv_payment_success_rate as
select
  date_trunc('day', created_at) as day,
  count(*) filter (where status = 'captured') as captured_count,
  count(*) as total_count,
  round(
    100.0 * count(*) filter (where status = 'captured') / nullif(count(*), 0),
    2
  ) as success_rate_pct
from public.payments
group by 1;

create unique index idx_mv_payment_success_rate_day on public.mv_payment_success_rate (day);

create materialized view public.mv_top_payment_methods as
select
  method,
  count(*) as payment_count,
  sum(amount) as total_amount
from public.payments
where status = 'captured' and method is not null
group by method;

create unique index idx_mv_top_payment_methods_method on public.mv_top_payment_methods (method);

create materialized view public.mv_refund_rate as
select
  date_trunc('month', o.created_at) as month,
  count(distinct o.id) as order_count,
  count(distinct r.order_id) as refunded_order_count,
  round(
    100.0 * count(distinct r.order_id) / nullif(count(distinct o.id), 0),
    2
  ) as refund_rate_pct
from public.orders o
left join public.refunds r on r.order_id = o.id and r.status = 'processed'
group by 1;

create unique index idx_mv_refund_rate_month on public.mv_refund_rate (month);

create materialized view public.mv_delivery_performance as
select
  d.outlet_id,
  o.name as outlet_name,
  count(*) as delivery_count,
  count(*) filter (where d.status = 'delivered') as delivered_count,
  avg(extract(epoch from (d.actual_delivery - d.estimated_delivery)) / 60)
    filter (where d.actual_delivery is not null and d.estimated_delivery is not null)
    as avg_delay_minutes
from public.deliveries d
join public.outlets o on o.id = d.outlet_id
group by d.outlet_id, o.name;

create unique index idx_mv_delivery_performance_outlet_id on public.mv_delivery_performance (outlet_id);

-- Lock every matview above down to service_role only (see file header).
revoke select on
  public.mv_top_selling_products,
  public.mv_best_categories,
  public.mv_inventory_dashboard,
  public.mv_low_stock_dashboard,
  public.mv_customer_lifetime_value,
  public.mv_daily_revenue,
  public.mv_monthly_revenue,
  public.mv_payment_success_rate,
  public.mv_top_payment_methods,
  public.mv_refund_rate,
  public.mv_delivery_performance
from public, anon, authenticated;
