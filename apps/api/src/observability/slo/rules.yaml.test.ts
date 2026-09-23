import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { renderRuleFile } from '@/observability/slo/rules.yaml';
import { SLOS } from '@/observability/slo/slos';

/**
 * The committed rule file must be what the generator produces (X-04).
 *
 * This is the check that keeps a generated artefact honest. Without it, somebody edits a
 * paging threshold in the YAML because that is the file the alert lives in, the source of
 * truth silently disagrees, and the next regeneration reverts their fix. `slo:rules --check`
 * runs the same comparison in CI; this runs it in `npm test`, where it is noticed sooner.
 */
const RULES_PATH = fileURLToPath(
  new URL('../../../../../infra/alerts/slo-rules.yaml', import.meta.url),
);
const RUNBOOKS = fileURLToPath(new URL('../../../../../infra/alerts/runbooks/', import.meta.url));

describe('infra/alerts/slo-rules.yaml', () => {
  it('is exactly what the generator renders', () => {
    expect(readFileSync(RULES_PATH, 'utf8')).toBe(renderRuleFile());
  });

  it('says it is generated, so nobody edits it by hand', () => {
    expect(readFileSync(RULES_PATH, 'utf8')).toContain('Do not edit by hand');
  });

  /** An alert nobody can act on is worse than no alert: it wakes somebody for nothing. */
  it.each(SLOS.filter((slo) => slo.status === 'instrumented').map((slo) => slo.id))(
    'has a runbook for %s',
    (id) => {
      const runbook = readFileSync(join(RUNBOOKS, `${id}.md`), 'utf8');

      expect(runbook).toContain('## What to do');
      expect(runbook.length).toBeGreaterThan(400);
    },
  );

  /**
   * The gaps are named in the generated file itself, because that is the file somebody opens
   * during an incident to find out what is watched — and therefore where they should be told
   * what is not.
   */
  it('names the bars that nothing is watching', () => {
    const rendered = renderRuleFile();

    expect(rendered).toContain('bars are watched here');
    expect(rendered).toContain('interrupt_silence:');
    expect(rendered).toContain('audible_welcome:');
  });

  it('groups the rules by severity', () => {
    const rendered = renderRuleFile();

    expect(rendered).toContain('- name: aria-slo-page');
    expect(rendered).toContain('- name: aria-slo-ticket');
  });

  it('renders nothing but a header when no SLO is instrumented', () => {
    const rendered = renderRuleFile(SLOS.filter((slo) => slo.status === 'not_instrumented'));

    expect(rendered).not.toContain('- alert:');
    expect(rendered).toContain('groups:');
  });

  /** A single quote inside a summary would end the YAML string early if it were not doubled. */
  it('escapes a quote in an annotation', () => {
    const first = SLOS[0];
    if (first === undefined) throw new Error('the registry is empty');
    const rendered = renderRuleFile([
      {
        ...first,
        id: 'quote_test',
        title: "Aria's voice",
        bar: "Aria's own words reach the child inside the bar, always",
      },
    ]);

    expect(rendered).toContain("'Aria''s voice is missing its bar (14.4x budget burn)'");
  });
});
