# Contributing

Run `npm ci`, `npm run check`, `npm test`, and `npm run demo`.
For real-browser verification run `npx playwright install chromium` then
`npm run test:browser`. Use synthetic fixtures. Add regression tests for behavior
changes and update declarations alongside JavaScript APIs.

The runtime is plain ESM JavaScript: there is no transpilation step. `src/*.d.ts`
provides TypeScript consumers with declarations. The package exports only the core
and optional browser adapter. CLI config errors use exit 2, test failures exit 1.

Before a release, run `npm pack`, install the tarball into a clean project, and test
both exports. Keep production dependencies empty. Do not commit generated tarballs,
node_modules, credentials, or application data.
