/**
 * Ch.14 §80: "Disable Entire AI / Individual Agent / Provider / Tool /
 * Workflow. Commerce continues operating without AI." A global switch
 * overrides everything; otherwise each scope is checked independently —
 * a request can be blocked by an agent-level switch even if its provider
 * and tool are both enabled.
 */

export type KillSwitchScope = 'global' | 'agent' | 'provider' | 'tool' | 'workflow';

export interface KillSwitchState {
  scope: KillSwitchScope;
  scopeRef: string | null;
  disabled: boolean;
}

export interface KillSwitchCheck {
  agent?: string;
  provider?: string;
  tool?: string;
  workflow?: string;
}

export interface KillSwitchResult {
  blocked: boolean;
  blockedBy?: KillSwitchScope;
}

export function checkKillSwitches(
  switches: KillSwitchState[],
  check: KillSwitchCheck,
): KillSwitchResult {
  const isDisabled = (scope: KillSwitchScope, scopeRef?: string) =>
    scopeRef != null &&
    switches.some((s) => s.scope === scope && s.scopeRef === scopeRef && s.disabled);

  if (switches.some((s) => s.scope === 'global' && s.disabled)) {
    return { blocked: true, blockedBy: 'global' };
  }
  if (isDisabled('agent', check.agent)) return { blocked: true, blockedBy: 'agent' };
  if (isDisabled('provider', check.provider)) return { blocked: true, blockedBy: 'provider' };
  if (isDisabled('tool', check.tool)) return { blocked: true, blockedBy: 'tool' };
  if (isDisabled('workflow', check.workflow)) return { blocked: true, blockedBy: 'workflow' };

  return { blocked: false };
}
