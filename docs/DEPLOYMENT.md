# Deployment

## Automatic GitHub Pages deployment

This project deploys through GitHub Actions, not through a `gh-pages` branch.

Workflow file:

```txt
.github/workflows/deploy-pages.yml
```

Trigger:

```txt
push to main
manual workflow_dispatch
```

Deployment flow:

```txt
checkout repo → setup Node → npm ci → verify files → npm run build → upload dist artifact → deploy Pages
```

## Vite base path

GitHub Pages repository sites are commonly served from:

```txt
https://username.github.io/repository-name/
```

The project handles this automatically in `vite.config.js`:

```js
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';
const githubPagesBase = process.env.GITHUB_ACTIONS && repoName ? `/${repoName}/` : '/';
```

For a user/organization root site such as `masarray.github.io`, the base remains `/`.

## Manual override

Set `VITE_BASE_PATH` when you need a custom path:

```bash
VITE_BASE_PATH=/custom-path/ npm run build
```

On Windows PowerShell:

```powershell
$env:VITE_BASE_PATH="/custom-path/"
npm run build
```
