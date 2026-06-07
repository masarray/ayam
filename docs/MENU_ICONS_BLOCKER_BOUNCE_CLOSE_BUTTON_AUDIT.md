# Menu Icons, Blocker Bounce, and Close Button Audit

## Menu icons
The menu continues to use Google Material Icons, but each icon now sits inside a soft colorful chip so the menu feels more playful and game-like.

## Blocker bounce
When the player tries to move into a blocker such as a tree or the board boundary, the chicken now performs a short partial hop toward that direction and rebounds back. This preserves the feeling that the touch input was accepted, while clearly communicating that the space ahead is blocked. A short procedural "doeng" style SFX is also played.

## Close button
The close button now closes on pointer-down, with centered icon alignment and a larger circular hit area.

## Freeze regression protection
No new heavy work was added to the Start click path. The previously fixed no-start-freeze strategy remains intact.
