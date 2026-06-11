# Menu Center, Blur, and Control Alignment Audit

## Implemented

- The menu is now centered as a modal instead of being anchored to the lower corner.
- A blurred/dimmed backdrop is applied when the menu opens so the foreground panel is readable.
- Menu buttons use a fixed icon column and left-aligned text with a 10 px left visual indent.
- Menu text weights are kept under 500 to avoid the bulky rounded-font look.
- The hamburger menu circle now matches the move-pad circle sizing and bottom alignment across portrait and compact landscape layouts.
- The menu panel can scroll internally on short screens, preventing bottom buttons/settings from being clipped.

## Additional issues found

- The previous mobile media rule forced the menu panel near the top, fighting the desired modal layout. It is now overridden by the centered menu ownership rule.
- The old hamburger active transform used `translateX(-50%)` even though the button is not center-positioned, causing a sideways jump during tap. This is corrected.
- The sound-effect setting had a duplicated `onChange` attribute in JSX. This is removed.
- Several old CSS sections still override each other late in the file. The current fix is intentionally placed at the bottom as the final ownership layer. Future cleanup should consolidate legacy menu/HUD rules to reduce regression risk.
