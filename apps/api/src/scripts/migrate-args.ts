/**
 * The migration CLI's arguments.
 *
 * Parsed in its own module, and pure, so every flag a deploy pipeline depends on is covered
 * by a test that needs neither a database nor a process (X-01). A deploy step that
 * misunderstands its own flags is a deploy step that migrates the wrong database.
 */
export type MigrateArgs = {
  /** Overrides `DATABASE_URL`. The flag exists so a deploy job can name the environment. */
  url: string | undefined;
  dryRun: boolean;
  allowGap: boolean;
};

export class MigrateArgsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrateArgsError';
  }
}

export const MIGRATE_USAGE = `Usage: npm run db:migrate -w @aria/api -- [options]

  --url <postgres-url>  Migrate this database instead of DATABASE_URL.
  --dry-run             Report what would be applied and change nothing.
  --allow-gap           Apply a migration numbered below one already applied.
  --help                Show this message.`;

/** Only PostgreSQL, matching the check the application configuration makes at boot. */
const POSTGRES_URL = /^postgres(ql)?:\/\/.+/;

export function parseMigrateArgs(argv: readonly string[]): MigrateArgs {
  const args: MigrateArgs = { url: undefined, dryRun: false, allowGap: false };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];

    if (flag === '--dry-run') args.dryRun = true;
    else if (flag === '--allow-gap') args.allowGap = true;
    else if (flag === '--url') {
      index += 1;
      args.url = requireUrl(argv[index]);
    } else if (flag?.startsWith('--url=') === true) {
      args.url = requireUrl(flag.slice('--url='.length));
    } else {
      // Unknown flags are refused rather than ignored: `--dryrun` silently migrating a
      // production database is the exact accident this whole file exists to prevent.
      throw new MigrateArgsError(`Unknown option "${String(flag)}".\n\n${MIGRATE_USAGE}`);
    }
  }

  return args;
}

function requireUrl(value: string | undefined): string {
  if (value === undefined || value === '' || value.startsWith('--')) {
    throw new MigrateArgsError(`--url needs a connection string.\n\n${MIGRATE_USAGE}`);
  }
  if (!POSTGRES_URL.test(value)) {
    throw new MigrateArgsError('--url must be a postgres:// or postgresql:// connection string');
  }
  return value;
}
