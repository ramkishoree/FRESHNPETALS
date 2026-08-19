import { BusinessRuleError, err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { stripUndefined } from '@/lib/strip-undefined';
import { recordAuditEvent, type AuditSeverity } from '@/server/audit/record-audit-event';
import { requireAdmin } from '@/server/auth/session';
import { AdminCrudRepository } from '@/server/repositories/admin-crud-repository';
import { runSecurityChain } from '@/server/security/chain';
import { createApiRoute } from './route-handler';

interface AdminCrudRouteConfig {
  table: string;
  /** Ch.16 §111 Audit Log "Service" filter dimension. */
  service: string;
  /** Ch.8 §117 Audit Record "Entity Type". */
  aggregateType: string;
  selectColumns?: string;
  searchColumns?: readonly string[];
  /** Additional exact-match `?field=value` query filters beyond the built-in limit/cursor/search. */
  filterKeys?: readonly string[];
  auditSeverity?: AuditSeverity;
  /**
   * Not every table in this factory's remit got the Ch.10 §16 universal
   * `created_by`/`updated_by` columns (announcements, static_pages, blogs
   * — see migration 0028's rationale). Defaults to true; set false for
   * tables where injecting those columns would fail with an unknown-
   * column error. The audit log (event_store) still records the actor
   * either way.
   */
  trackAttribution?: boolean;
  /**
   * Fills in columns the admin should not have to type.
   *
   * Runs after validation and before the insert, so a schema can mark a
   * required foreign key optional and have it resolved here instead of
   * being demanded from whoever is filling in the form. Delivery slots
   * are the case that prompted it: every slot belongs to the one
   * "Standard delivery" group, and the form was asking an admin to
   * hand-type its UUID.
   */
  beforeCreate?: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

interface RouteParams {
  id: string;
}

/**
 * Ch.16 §100-106: one factory behind every structurally-uniform admin
 * resource's collection route (GET list, POST create) — see
 * admin-crud-repository.ts for why these resources share one
 * implementation instead of a dozen bespoke ones.
 */
export function createAdminCrudCollectionRoute<TRow extends { id: string }>(
  config: AdminCrudRouteConfig & { createSchema: z.ZodType<Record<string, unknown>> },
) {
  const filterKeys = config.filterKeys ?? [];
  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().datetime().optional(),
    search: z.string().min(1).max(200).optional(),
    ...Object.fromEntries(filterKeys.map((key) => [key, z.string().optional()])),
  });

  const list = createApiRoute({
    querySchema,
    handler: async ({ query }) => {
      const admin = createSupabaseAdminClient();
      const repository = new AdminCrudRepository<TRow>(
        admin,
        config.table,
        config.selectColumns,
        config.searchColumns,
      );
      const { limit, cursor, search, ...rest } = query as Record<string, unknown> & {
        limit: number;
        cursor?: string;
        search?: string;
      };
      const filters: Record<string, string> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (typeof value === 'string') filters[key] = value;
      }

      try {
        const result = await repository.list({
          limit,
          ...(cursor ? { cursor } : {}),
          ...(search ? { search } : {}),
          filters,
        });
        return ok(result);
      } catch (cause) {
        return err(
          new InfrastructureError(`Failed to list ${config.table}.`, {
            cause: cause instanceof Error ? cause.message : String(cause),
          }),
        );
      }
    },
  });

  const create = createApiRoute({
    bodySchema: config.createSchema,
    handler: async ({ body, request }) => {
      const actor = await requireAdmin();
      const admin = createSupabaseAdminClient();
      const repository = new AdminCrudRepository<TRow>(admin, config.table, config.selectColumns);

      try {
        const withDefaults = config.beforeCreate ? await config.beforeCreate(body) : body;
        const created = await repository.create({
          ...stripUndefined(withDefaults),
          ...(config.trackAttribution !== false
            ? { created_by: actor.id, updated_by: actor.id }
            : {}),
        });
        await recordAuditEvent({
          eventType: `admin.${config.aggregateType}.created`,
          aggregateType: config.aggregateType,
          aggregateId: created.id,
          actor,
          service: config.service,
          next: body,
          ...(config.auditSeverity ? { severity: config.auditSeverity } : {}),
          request,
        });
        return ok(created);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        if (message.includes('duplicate key')) {
          return err(
            new BusinessRuleError('A record with this identifier already exists.', {
              httpStatus: 409,
            }),
          );
        }
        return err(
          new InfrastructureError(`Failed to create ${config.table} record.`, { cause: message }),
        );
      }
    },
  });

  return {
    GET: async (request: NextRequest) => {
      const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
      if (blocked) return blocked;
      return list(request);
    },
    POST: async (request: NextRequest) => {
      const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
      if (blocked) return blocked;
      return create(request);
    },
  };
}

/** The [id] counterpart — PATCH (partial update) and DELETE (soft delete). */
export function createAdminCrudItemRoute<TRow extends { id: string }>(
  config: AdminCrudRouteConfig & { updateSchema: z.ZodType<Record<string, unknown>> },
) {
  const update = createApiRoute<undefined, TRow, Record<string, unknown>, RouteParams>({
    bodySchema: config.updateSchema,
    handler: async ({ body, request, params }) => {
      const actor = await requireAdmin();
      const admin = createSupabaseAdminClient();
      const repository = new AdminCrudRepository<TRow>(admin, config.table, config.selectColumns);

      try {
        const updated = await repository.update(params.id, {
          ...stripUndefined(body),
          ...(config.trackAttribution !== false ? { updated_by: actor.id } : {}),
        });
        await recordAuditEvent({
          eventType: `admin.${config.aggregateType}.updated`,
          aggregateType: config.aggregateType,
          aggregateId: params.id,
          actor,
          service: config.service,
          next: body,
          ...(config.auditSeverity ? { severity: config.auditSeverity } : {}),
          request,
        });
        return ok(updated);
      } catch (cause) {
        return err(
          new InfrastructureError(`Failed to update ${config.table} record.`, {
            cause: cause instanceof Error ? cause.message : String(cause),
          }),
        );
      }
    },
  });

  const remove = createApiRoute<undefined, { id: string }, undefined, RouteParams>({
    handler: async ({ request, params }) => {
      const actor = await requireAdmin();
      const admin = createSupabaseAdminClient();
      const repository = new AdminCrudRepository<TRow>(admin, config.table, config.selectColumns);

      try {
        await repository.softDelete(
          params.id,
          config.trackAttribution !== false ? actor.id : undefined,
        );
        await recordAuditEvent({
          eventType: `admin.${config.aggregateType}.deleted`,
          aggregateType: config.aggregateType,
          aggregateId: params.id,
          actor,
          service: config.service,
          severity: 'warning',
          request,
        });
        return ok({ id: params.id });
      } catch (cause) {
        return err(
          new InfrastructureError(`Failed to delete ${config.table} record.`, {
            cause: cause instanceof Error ? cause.message : String(cause),
          }),
        );
      }
    },
  });

  return {
    PATCH: async (request: NextRequest, context: { params: Promise<RouteParams> }) => {
      const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
      if (blocked) return blocked;
      return update(request, await context.params);
    },
    DELETE: async (request: NextRequest, context: { params: Promise<RouteParams> }) => {
      const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
      if (blocked) return blocked;
      return remove(request, await context.params);
    },
  };
}
