# ThymerTodaysNotesFooter

Footer panel for journal pages that shows records whose date fields match the current journal day.

## Features

- Renders grouped records from configured collections for the active journal date.
- Expandable inline record previews with nested collapse/expand.
- Click any preview line to open that line in the source record.
- Settings command/panel for date field names and excluded collections.
- Header icon + updated preview/panel styling closer to native Thymer record visuals.
- Collapsed/expanded footer state persisted.

## Storage mode

Includes Path B support (`Plugin Settings` collection + localStorage mirror):

- Command Palette: `Today's Notes: Storage location…`
- Can store settings local-only or synced across devices/workspaces.

## Stability updates in this sync

- Added deferred handling on `panel.navigated` to improve journal page repopulation.
- Added persistent `recordExpandedState` pattern for preview stability across DOM rebuilds.
- Added scheduled settings flush to synced storage mode.

## Files

- `Today's Notes.js` - plugin code
- `Today's Notes.json` - collection/plugin metadata

## Known limitations

- Full recursive transclusion rendering is still intentionally limited (preview shows ref rows but does not recursively expand all referenced trees).
