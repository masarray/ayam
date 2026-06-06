# Asset Licensing Guide

## Source code

The source code is licensed under Apache-2.0.

## Background music

The current background music file is:

```txt
public/audio/mushroom-dance.ogg
public/audio/kids-yay.mp3
```

It is user-supplied media and is not automatically covered by the Apache-2.0 source-code license.

Before publishing the repository or deploying a public app, choose one of these options:

1. Keep the file only if you own it or have distribution permission.
2. Replace it with CC0, MIT, Apache-2.0, or a clearly licensed royalty-free loop.
3. Remove it and use only the procedural Web Audio sound effects.

## Safe future sources

Prefer audio sources where the license is explicit and compatible with public app distribution. Keep the credit and license link in `THIRD_PARTY_NOTICES.md`.

Recommended asset policy:

```txt
Do not add audio, image, or font assets unless the exact license is documented. Sniglet is loaded from Google Fonts at runtime; do not bundle downloaded font files into this repository unless the license note is preserved.
```


## Question bank

`public/data/questionBanks.json` is included as user-supplied learning content. Keep it in the repository only when the question content is cleared for the intended public or private distribution.
