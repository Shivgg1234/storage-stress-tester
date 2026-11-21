# Release instructions

## Commit and push first

Follow COMMIT-COMMANDS.md. The public repository is:
https://github.com/Shivgg1234/storage-stress-tester

## Verify before publishing

Use Node 22+ and run:

```sh
npm ci
npm run check
npm test
npm run demo
npx playwright install chromium
npm run test:browser
npm pack --dry-run
```

Check that both GitHub Actions jobs pass. Chromium could not launch in the agent's
macOS sandbox, so the actual browser integration test must pass in CI or your normal
terminal before release. See VERIFICATION.md.

## Publish version 0.1.0

Create an npm account and enable 2FA. GitHub and npm usernames need not match.
Check name availability with `npm view storage-stress-tester name version`.
An E404 means no package was found at that moment, not a reservation of the name.
If someone else owns it, choose a scoped npm name and update imports/docs/lockfile
before publishing. Do not attempt to overwrite another owner's package.

```sh
npm login
npm whoami
npm pack
npm publish ./storage-stress-tester-0.1.0.tgz --access public
npm view storage-stress-tester version repository.url
```

Complete the browser login and 2FA prompts. After success, verify installation from
npm in a separate empty project. Then tag the matching Git commit:

```sh
git tag v0.1.0
git push origin v0.1.0
```

Submit your public GitHub and npm package links for the assignment. Do not claim
publication until npm confirms the release. For later releases, update the changelog
and bump the version before publishing; published versions cannot be reused.

Official docs:
https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/
https://docs.npmjs.com/trusted-publishers/
