import { describe, expect, it } from 'vitest';

import { MigrateArgsError, parseMigrateArgs } from './migrate-args';

describe('parseMigrateArgs', () => {
  it('defaults to a real run against the configured database', () => {
    expect(parseMigrateArgs([])).toEqual({ url: undefined, dryRun: false, allowGap: false });
  });

  it('reads the flags a deploy job uses', () => {
    expect(parseMigrateArgs(['--dry-run', '--allow-gap'])).toEqual({
      url: undefined,
      dryRun: true,
      allowGap: true,
    });
  });

  it.each([
    ['separate', ['--url', 'postgresql://aria@db/aria']],
    ['joined', ['--url=postgresql://aria@db/aria']],
  ])('accepts a %s --url', (_form, argv) => {
    expect(parseMigrateArgs(argv).url).toBe('postgresql://aria@db/aria');
  });

  it('refuses a --url that is not postgres', () => {
    expect(() => parseMigrateArgs(['--url', 'mysql://aria@db/aria'])).toThrow(MigrateArgsError);
  });

  it('refuses --url with nothing after it, rather than swallowing the next flag', () => {
    expect(() => parseMigrateArgs(['--url', '--dry-run'])).toThrow(/needs a connection string/);
  });

  // The whole point of the parser: a typo must not become a real migration run.
  it('refuses an unknown option instead of ignoring it', () => {
    expect(() => parseMigrateArgs(['--dryrun'])).toThrow(/Unknown option "--dryrun"/);
  });
});
