# Nine commands: commit first, then push

Run from a terminal. Git must have your own user.name and user.email configured.
The GitHub repository must remain empty for this initial push.

```sh
cd /Users/tanishqgupta/Documents/Codex/2026-11-20/su/outputs/storage-stress-tester
git init
git branch -M main
git add .
git diff --cached --stat
git commit -m "feat: add storage stress testing package"
git remote add origin https://github.com/Shivgg1234/storage-stress-tester.git
git push -u origin main
git status --short
```

If push is rejected because the remote has new commits, stop and reconcile the
histories; do not force-push. These commands do not publish to npm.
