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
const isUserOrOrgSite = repoName.endsWith('.github.io');
const githubPagesBase = process.env.GITHUB_ACTIONS && repoName && !isUserOrOrgSite ? `/${repoName}/` : '/';
const base = process.env.VITE_BASE_PATH || githubPagesBase;
```

For the `masarray/ayam` repository, the production base path becomes:

```txt
/ayam/
```

## Manual base-path override

Set `VITE_BASE_PATH` only when deploying to a custom path:

```bash
VITE_BASE_PATH=/custom-path/ npm run build
```

On Windows PowerShell:

```powershell
$env:VITE_BASE_PATH="/custom-path/"
npm run build
```

## GitHub Pages setting

Use this setting once after the repository is pushed:

```txt
Settings → Pages → Build and deployment → Source → GitHub Actions
```
