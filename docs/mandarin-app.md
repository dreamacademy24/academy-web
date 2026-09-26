# Jia & Jiwoo - Little Mandarin

Public entry: https://www.dreamacademyph.com/mandarin/index.html

Static, separately scoped PWA. All changes are under `/mandarin/`; no staff or booking workflows are changed.

## Content and profiles

- 60 vocabulary items transcribed from the user's reference photos (book word lists photographed as `20260926_181729.jpg` and `20260926_181732.jpg`).
- 24 extra items: family, colors, numbers and everyday words.
- English picture front; simplified Chinese and tone-marked pinyin back.
- Mandarin MP3s generated with Microsoft Edge speech synthesis, Xiaoxiao, at -15% rate. This is synthetic speech, not a cloned child voice.
- Jia is the older sister: rounder cheeks, narrower smiling eyes, lavender star hoodie. Jiwoo is the younger sister: more open almond eyes, blue flower hoodie. Identity mapping follows the user's correction, not apparent size in the photos.
- Two separate generated 3D-style character illustrations, not rigged 3D models. Only final illustrations are published; reference family photos are not included.
- Per-profile practiced-card sets are saved locally as `little-mandarin-stars-v1-jia` and `little-mandarin-stars-v1-jiwoo`. No account or cross-device sync.

## Installation and offline

Manifest scope and service worker scope: `/mandarin/`. Android supports the browser install prompt; iOS uses Safari's Add to Home Screen flow. The app provides platform instructions when no install event is available.

The shell is cached on registration. Save all for offline downloads all 84 voices plus all three PDFs, verifies completeness and reports progress. Audio byte-range requests are supported from cache. Only caches prefixed `jia-jiwoo-mandarin-` are cleaned up by this worker. Browser storage eviction can remove offline data; readiness is rechecked on opening.

The existing root `/sw.js` belongs to the academy app and is unchanged. Its legacy activation handler can clear other caches if that root worker is updated later; reopening Mandarin online and saving again restores the offline set.

## Printing

84 cards, A4 portrait, 6 cards per side, 28 PDF pages / 14 paper sheets. Card size 90 by 80 mm. Long-edge duplex; each row's back-side positions are mirrored horizontally. Print at actual size 100%, test pages 1-2 first, cut paper, laminate, leave a 3-5 mm sealed border.

Starter workbook: 14 pages, twelve short English-guided activities covering 36 selected words, plus cover and adult notes. This does not reproduce every source-book activity.

## Rebuilding

1. `node scripts/build-chinese-cards.cjs`
2. Keep final `avatar-jia.png` and `avatar-jiwoo.png` under `public/mandarin/`.
3. `node scripts/enhance-chinese-pwa.cjs`
4. `node scripts/create-chinese-icons.cjs`
5. `node scripts/render-chinese-pdfs.cjs`
6. Use `scripts/chinese-audio.py` only when vocabulary changes. It reads `vocabulary.json` and skips existing audio files.
7. Bump the Mandarin service-worker cache version when cached assets change.

The authoring scripts use the local Codex bundled Chromium/Python paths. Final PDFs are copied to `C:/Users/desko/Claude/Artifacts/ChatGPT 저장` and the public app folder.

## Verification

`node scripts/verify-chinese-pwa.cjs` checks profile separation and persistence, MP3 playback, cards, search, flipping, quiz, 390/768/1180-width layouts, PDFs, manifest, offline reload, all 84 offline MP3s, audio byte ranges and offline PDF access. Pass a production origin as its first argument for live verification. Tests write only fresh browser-local practice data.

`scripts/verify-chinese-pdfs.py` checks 28/14/1-page totals, all 84 front/back ID pairs and renders representative pages for visual review. Real printer registration and physical tablet home-screen installation have not been tested on the user's hardware.
