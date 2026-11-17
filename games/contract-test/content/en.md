---
description: A test game that exercises every part of the Game Contract, from loading progress to saving, so the Player can be checked on phone and desktop.
updated: 2026-11-17
---

Contract Test is an internal test game that exercises every capability of the Game Contract (loading progress, pause and resume, fullscreen, mute, locale and saving) so the Player can be verified on phone and desktop.

## How to Play

1. Press **Play** and wait for the loading bar to finish.
2. Press **Increment** a few times. The counter is your save.
3. Reload the page and start again. The counter should keep its value.
4. Switch to another tab and come back. The timer pauses while the page is hidden.

## Controls

| Action | Touch | Keyboard and mouse |
| --- | --- | --- |
| Press a button | Tap it | Click it, or focus it with Tab and press Enter |
| Fullscreen | Tap **Fullscreen** | Click **Fullscreen** |
| Mute | Tap **Mute** | Click **Mute** |

## Tips

- Use **Reset** to clear the save and start from zero.
- The ad buttons always report that no ad was shown. The game must keep going anyway.

## FAQ

### Is Contract Test a real game?

No. It exists only to check that the Player and the Game Contract work before real games ship.

### Where is my progress saved?

In your browser. The game hands its save to the site through the Game Contract and never touches browser storage directly.

## Changelog

- 2026-11-17: First version.
