import { m } from '@/messages'

/** Lesbare Bezeichnung für einen Eintrag im Audit-Log (statt Kürzeln wie «unmute» oder «circle:update»). */
export function auditLabel(action: string): string {
  return m.admin.auditActions[action] ?? (m.admin.actions as Record<string, string>)[action] ?? action
}
