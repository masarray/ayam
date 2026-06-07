# Audio MP3 and Road Marking Audit

## Why the music asset changed

The previous runtime music file used `public/audio/mushroom-dance.ogg`. Some desktop/mobile decoders can take noticeably longer to probe or start MP3/Vorbis-in-Ogg media, and the game should not risk tying that work to the Start tap.

The distributed background music is now:

```txt
public/audio/mushroom-dance.mp3
Codec: MP3 stereo
Target bitrate: 48 kbps
Duration: about 82 seconds
Size: about 483 KB
```

The original OpenGameArt attribution remains unchanged: **Mushroom Dance** by **bart**, used under **CC BY 3.0**. The MP3 is a compressed runtime conversion for faster browser delivery.

## Start freeze protection

The Start button no longer starts or warms background music. Start is kept visual-only: hide overlay, start the prepared engine, reset gameplay state, then profile/storage work is deferred. Music is allowed only after movement begins and is still scheduled away from the first gameplay frame.

## Road marking correction

Continuous side and yellow markings are no longer made from the thick row slab. They now use a dedicated flat long-line geometry, so the white road border and yellow center lines appear thin while dashed lane markings remain readable.
