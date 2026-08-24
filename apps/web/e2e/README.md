# Visual baseline

Run `npm run e2e:baseline -w @aria/web` to verify the checked-in baseline.
For an intended visual change, run it once with `-- --update-snapshots`.
Inspect every changed PNG at tablet and laptop sizes before committing it.
State the visual reason in the commit or PR; never update snapshots to hide a failure.
Run the command again without the update flag and require a clean pass.
