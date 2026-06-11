# Train Horn, Bullet Impact, and Correct Reward Audit

## Train horn state machine
Train warning audio is now tied to the locomotive nose/front edge. Each train can trigger one long train horn per approach, then it stays armed-off until the train wraps back for a new pass. Center and tail positions do not trigger warning audio. Bullet trains also use the train horn, but they trigger earlier to give the player more time to react.

## Removed pass-sound spam
The previous train/bullet pass/wind warning path could fire again while the body or tail was still near the player. That path is no longer used for rail warning audio.

## Bullet impact
Fast and bullet train impacts now produce more feathers, blood, debris velocity, and stronger camera shake based on vehicle speed.

## Quiz reward
Correct quiz answers now trigger the kids-yay MP3 directly from the answer tap, with procedural reward tones as fallback. Correct answers also keep a Pembahasan button.
