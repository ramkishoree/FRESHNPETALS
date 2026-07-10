import { describe, expect, it } from 'vitest';
import { checkKillSwitches, type KillSwitchState } from './kill-switch';

describe('checkKillSwitches', () => {
  it('allows everything when no switch is disabled', () => {
    const result = checkKillSwitches([], { agent: 'seo-specialist', provider: 'openai' });
    expect(result.blocked).toBe(false);
  });

  it('a global kill switch blocks everything regardless of other scopes', () => {
    const switches: KillSwitchState[] = [{ scope: 'global', scopeRef: null, disabled: true }];
    const result = checkKillSwitches(switches, { agent: 'seo-specialist' });
    expect(result).toEqual({ blocked: true, blockedBy: 'global' });
  });

  it('an agent-level switch blocks only that agent', () => {
    const switches: KillSwitchState[] = [
      { scope: 'agent', scopeRef: 'seo-specialist', disabled: true },
    ];
    expect(checkKillSwitches(switches, { agent: 'seo-specialist' }).blocked).toBe(true);
    expect(checkKillSwitches(switches, { agent: 'marketing-manager' }).blocked).toBe(false);
  });

  it('a provider-level switch blocks that provider even for an enabled agent', () => {
    const switches: KillSwitchState[] = [{ scope: 'provider', scopeRef: 'openai', disabled: true }];
    const result = checkKillSwitches(switches, { agent: 'seo-specialist', provider: 'openai' });
    expect(result).toEqual({ blocked: true, blockedBy: 'provider' });
  });

  it('a tool-level switch blocks that tool', () => {
    const switches: KillSwitchState[] = [
      { scope: 'tool', scopeRef: 'publish_product', disabled: true },
    ];
    expect(checkKillSwitches(switches, { tool: 'publish_product' }).blocked).toBe(true);
    expect(checkKillSwitches(switches, { tool: 'read_orders' }).blocked).toBe(false);
  });

  it('a workflow-level switch blocks that workflow', () => {
    const switches: KillSwitchState[] = [
      { scope: 'workflow', scopeRef: 'weekly-report', disabled: true },
    ];
    expect(checkKillSwitches(switches, { workflow: 'weekly-report' }).blocked).toBe(true);
  });

  it('an enabled (not disabled) switch row does not block anything', () => {
    const switches: KillSwitchState[] = [
      { scope: 'agent', scopeRef: 'seo-specialist', disabled: false },
    ];
    expect(checkKillSwitches(switches, { agent: 'seo-specialist' }).blocked).toBe(false);
  });
});
