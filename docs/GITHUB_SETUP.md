# GitHub Setup Guide

This guide turns the project folder into a professional public GitHub repository with automatic GitHub Pages deployment.

## 1. Create the repository

Create a new GitHub repository:

```txt
Owner           : masarray
Repository name : voxel-crossing-game
Visibility      : Public
License         : Apache-2.0
```

Do not initialize with another README if you are pushing this ZIP as the first commit.

## 2. Push from local folder

```bash
git init
git branch -M main
git add .
git commit -m "Initial release: Voxel Crossing Game"
git remote add origin https://github.com/masarray/voxel-crossing-game.git
git push -u origin main
```

## 3. Enable GitHub Pages deployment

Open the repository on GitHub:

```txt
Settings → Pages → Build and deployment → Source → GitHub Actions
```

After that, every push to `main` runs:

```txt
.github/workflows/deploy-pages.yml
```

The live site will be published at:

```txt
https://masarray.github.io/voxel-crossing-game/
```

## 4. Recommended repository metadata

```txt
Description:
Lightweight Three.js voxel crossing browser game with cars, trains, rivers, music, mobile controls, and GitHub Pages deployment.

Website:
https://masarray.github.io/voxel-crossing-game/

Topics:
threejs
react
vite
web-game
voxel-game
browser-game
github-pages
educational-game
mobile-game
```

## 5. Verify locally before pushing

```bash
npm install
npm run verify
npm run build
npm run preview
```
