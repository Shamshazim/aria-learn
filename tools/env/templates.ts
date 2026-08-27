/**
 * Keeping the environment templates honest.
 *
 * `.env.example` is the contract: CODE-STANDARDS §8 says every variable the workspace reads
 * appears there. The per-environment templates in `infra/environments/` are what an operator
 * fills in, and a variable that exists in one and not the other is how a deploy comes to be
 * missing a key that boot then refuses to start without.
 *
 * This compares names only. Values are never read, never compared and never printed — the
 * whole point of the templates is that they hold none.
 */
export type TemplateDrift = {
  /** In `.env.example`, absent from the environment template: an operator cannot set it. */
  missing: readonly string[];
  /** In the environment template, absent from `.env.example`: nothing reads it. */
  unknown: readonly string[];
};

const ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)\s*=/;

/** The variable names a `.env`-shaped file declares, comments and blanks ignored. */
export function readEnvNames(text: string): string[] {
  const names: string[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;

    const match = ASSIGNMENT.exec(line.startsWith('export ') ? line.slice(7) : line);
    if (match?.[1] !== undefined) names.push(match[1]);
  }

  return names;
}

export function compareTemplates(
  reference: readonly string[],
  template: readonly string[],
  /**
   * Names an environment template is allowed to add — the ones only a deployment has, like a
   * platform-injected port. They are declared per template rather than assumed, so a typo
   * cannot quietly become an exemption.
   */
  deploymentOnly: readonly string[] = [],
): TemplateDrift {
  const inTemplate = new Set(template);
  const allowed = new Set([...reference, ...deploymentOnly]);

  return {
    missing: reference.filter((name) => !inTemplate.has(name)),
    unknown: template.filter((name) => !allowed.has(name)),
  };
}

export function hasDrift(drift: TemplateDrift): boolean {
  return drift.missing.length > 0 || drift.unknown.length > 0;
}

export function formatDrift(file: string, drift: TemplateDrift): string {
  const lines: string[] = [];

  if (drift.missing.length > 0) {
    lines.push(`${file} is missing: ${drift.missing.join(', ')}`);
  }
  if (drift.unknown.length > 0) {
    lines.push(`${file} declares variables nothing reads: ${drift.unknown.join(', ')}`);
  }

  return lines.join('\n');
}

/** Duplicates are their own bug: the second assignment silently wins. */
export function duplicateNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  return names.filter((name) => (seen.has(name) ? true : (seen.add(name), false)));
}
