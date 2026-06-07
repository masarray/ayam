# Asset Licensing Guide

## Source code

The source code is licensed under Apache-2.0.

## Documentation screenshots

Documentation screenshots in `docs/assets/` are stored as optimized `.webp` files to keep the repository small. They are project screenshots and should be replaced when the visual design changes significantly.

Do not commit large raw screenshots such as full-size `.png` captures unless they are temporary review files. For public documentation, use compressed `.webp` files.

## Background music and celebratory sound

The current audio files are:

```txt
public/audio/mushroom-dance.ogg
public/audio/kids-yay.mp3
```

### `public/audio/mushroom-dance.ogg`

This background music is **Mushroom Dance** by **bart**, sourced from **OpenGameArt.org**.

License choices listed by OpenGameArt include CC BY 3.0, CC BY-SA 3.0, GPL 3.0, and GPL 2.0. This repository uses it under **CC BY 3.0**.

Required attribution:

```txt
Mushroom Dance by bart, licensed under CC BY 3.0.
Source: https://opengameart.org/content/mushroom-dance
OpenGameArt: https://opengameart.org
```

Keep this attribution visible in repository notices, release notes, or an in-app credits screen when the game is published.

### `public/audio/kids-yay.mp3`

This is a user-supplied celebratory sound effect. Keep it in the repository only when its source and distribution license are confirmed. If the license is unknown, replace it with a CC0 / CC BY / MIT / Apache-compatible sound effect and document the source here.

## Safe future asset policy

```txt
Do not add audio, image, or font assets unless the exact license is documented.
Sniglet is loaded from Google Fonts at runtime; no font files are bundled in this repository.
```

## Question bank

`public/data/questionBanks.json` is included as user-supplied learning content. Keep it in the repository only when the question content is cleared for the intended public or private distribution.
