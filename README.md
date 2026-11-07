# DanceStudio

Choose LucianOS commands by moving in front of the camera, or with the cursor. Wave a hand in a tile to pick **Grammar Logic**, wave in **meditation**, then wave in **Run it**, and the LucianOS desktop runs "grammar logic on meditation". It's part of the [LucianOS suite](https://github.com/luciangreen/lucianos).

## Install

DanceStudio runs inside the LucianOS platform:

```sh
cd lucianos/apps
git clone https://github.com/luciangreen/dancestudio
```

Open it from the desktop (💃 icon, the Apps menu, or say "open DanceStudio"). You can also go to http://localhost:4170/apps/dancestudio/ in its own tab; commands then open on the LucianOS desktop in another tab.

## Using it

- **Tiles round the edge:**
  - Grammar Logic
  - Brainstorm
  - Today's workflows
  - Today's music
  - Checklist item
  - Run a script (from `LucianOS/shellrun`)
  - Open an app

  The middle shows the command you're building.
- **Choosing a tile** works three ways:
  - **Camera** (📷): move a hand inside a tile and keep moving for about a second, until the ring fills. The picture is mirrored, so move right to choose on the right. The middle of the picture is ignored, because that's where you stand. When everything moves at once, as when you sway or the lights change, nothing is chosen.
  - **Hover** (🖱): hold the cursor on a tile until the ring fills.
  - **Tap or click** a tile straight away.
- **Steps:**
  1. A command.
  2. What it needs: a topic, a script, an app or a checklist item. **More** shows further choices, and **Type a topic** lets you type a new one.
  3. **Run it**, or **Back**.

  Nothing runs without **Run it**.
- **Topics:** your own list (⚙ settings) comes first, then topics from your recent Grammar Logic files in `LucianOS/gl`. Topics you type are remembered.
- **⚙ Settings:**
  - your topics
  - how long to hold
  - how much movement is needed
  - mirroring
  - whether it says what to choose next (in your character's voice)

**Privacy:** the camera picture never leaves your device and isn't recorded. DanceStudio shrinks each frame to 48 × 36 grey dots and only measures how much each part changed.

## How commands run

Each choice builds a sentence the LucianOS character understands, such as `grammar logic on meditation`, `brainstorm time travel`, `run hello` or `open iEdit`. The desktop runs it exactly as if you'd said it, and the character tells you what happened. Checklist items run as they do from the checklist.

## Tests

```sh
npm test
```

The tests cover finding movement in each tile (with mirroring), ignoring whole-body movement, the hold timer (short flickers forgiven, a pause after each choice), topics from file names, laying out menus, and the sentences each choice makes. The sentences are checked against the character's own parser when the platform is next to this repo.

The app was also tested in headless Chrome:
- choosing by fed-in movement, by holding the cursor, and by typing a topic
- that swaying everywhere chooses nothing
- Chrome's fake camera
- running "brainstorm robot dance" inside the desktop, which made the page and opened it in iEdit
