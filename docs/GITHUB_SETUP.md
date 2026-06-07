# GitHub Setup Guide

This guide turns the project folder into a clean public GitHub repository with CI and automatic GitHub Pages deployment.

## 1. Create the repository

Create a new GitHub repository:

```txt
Owner           : masarray
Repository name : ayam
Visibility      : Public
License         : Apache-2.0
Default branch  : main
```

Do not initialize the GitHub repository with another README if you are pushing this folder as the first commit.

## 2. Push from local folder

From `D:\Git\ayam`:

```bash
git init
git branch -M main
git add .
git commit -m "Initial public release: Ayam SD"
git remote add origin https://github.com/masarray/ayam.git
git push -u origin main
```

If the repository already exists locally and already has a remote:

```bash
git remote set-url origin https://github.com/masarray/ayam.git
git branch -M main
git add .
git commit -m "Prepare Ayam SD for public release"
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
https://masarray.github.io/ayam/
```

## 4. Recommended repository metadata

```txt
Description:
Free open-source Three.js Ayam SD browser game with voxel chicken gameplay, mobile controls, rewards, badges, audio, quiz learning, PWA support, and GitHub Pages deployment.

Website:
https://masarray.github.io/ayam/

Topics:
ayam-sd
threejs
react
vite
web-game
voxel-game
browser-game
github-pages
educational-game
kids-game
mobile-game
pwa
```

## 5. Verify locally before pushing

```bash
npm install
npm run verify
npm run build
npm run preview
```

## 6. Recommended first public release checklist

- Confirm `README.md` screenshot renders correctly.
- Confirm all audio files are legally safe for public distribution.
- Confirm GitHub Pages source is set to **GitHub Actions**.
- Confirm the CI badge and Deploy badge become green after the first push.
- Confirm the live game opens from `https://masarray.github.io/ayam/`.
