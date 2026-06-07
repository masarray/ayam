# Material Icons Audit

## Reason
The previous inline icon paths were custom-drawn and visually inconsistent. The UI now uses Google Material Icons / Material Symbols SVG path data directly in React.

## Scope
Updated icons:
- hamburger menu
- close button
- movement arrows
- menu action buttons: play, restart, save, continue, badge, install, settings

## Implementation
Icons are embedded as inline SVG path data to keep the game offline-safe and avoid runtime font/package loading. No external icon font is bundled.

## Licensing
Google Material Icons path data is listed in `THIRD_PARTY_NOTICES.md` as Apache-2.0 material.
