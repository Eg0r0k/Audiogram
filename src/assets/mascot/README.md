# Mascot parts

These files make up the placeholder covers of albums and playlists without artwork (`src/modules/covers/lib/placeholder`). Every part and the mascot of any id can be seen at `/dev/mascot` (dev builds only).

```
base/head.svg      head with headphones, shared by all
base/body.svg      body, shared by all
eyes/*.svg         eyes
mouth/*.svg        mouth
extra/*.svg        extra detail: note, sparkles, bow, none
phones/*.svg       headphones: white, colored, cat-ears
```

## Drawing a part

- The canvas is 170×170, the same as `public/img/liked-fallback.svg`. The easiest way is to copy `base/head.svg` and `base/body.svg` into Figma, draw on top, then delete the base and export.
- `currentColor` becomes the dark tone of the gradient (`ink`). Use it for the face, the coloured cups and the bow.
- `#fff` stays white. Any other colour stays as it is: that is how the tongue is pink.
- An empty `<svg …></svg>` is a valid variant. `extra/none.svg` and `phones/white.svg` are empty: they set how often the detail is absent.
- A part that goes behind the head is named `name.back.svg`. The cat ears under the headband are drawn this way.
- Check it on `/dev/mascot` at 55 px. If it does not read at that size, it does not belong in the sidebar.

## Adding, shelving or removing a part

| Action | How | What happens to existing covers |
| --- | --- | --- |
| Add a variant | put `eyes/new.svg` | about 1/(n+1) of ids get the new variant, the rest stay as they are |
| Shelve as a draft | rename to `_new.svg` | the variant leaves the pick; ids that had it get another one |
| Bring back a draft | drop the `_` | ids that had it before get it back |
| Remove | delete the file | same as shelving |
| Rename | **don't** | the file name is the variant's key: renaming is a removal plus an addition |

A new slot (say, "hat") is a code change: a folder, `MASCOT_SLOTS` in `parts.ts` and the layer order in `mascotSvg`.

Any change to the set of live parts fails `mascot.test.ts`: the list of live variants always, the fixed ids when one of them moves. That is expected: update both in the same commit.
