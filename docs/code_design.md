# Code Design

## Code Organization

1. Every function except `main.ts` should be pure. Pass any stateful information in parameters.

2. `misc.ts` should not depend on any other written code.

3. Each storage code should not depend on `sync.ts`.

## File and Folder Representation

While writing sync codes, folders are always represented by a string ending with `/`.

## Multi-Remote Sync Boundary

The new final model should be centered on `remoteServices[]` and `syncTargets[]`.
Each target should reference one service by `remoteServiceId`.
Legacy top-level fields such as `serviceType`, `ignorePaths`, and `onlyAllowPaths` should be treated as compatibility input only, not the final source of truth.

### UI Boundary

- Main settings UI lives in `src/settings.ts` via `RemotelySaveSettingTab.display()`.
- PRO service settings UI is split into `pro/src/settingsOnedriveFull.ts`, `pro/src/settingsGoogleDrive.ts`, `pro/src/settingsBox.ts`, `pro/src/settingsPCloud.ts`, `pro/src/settingsYandexDisk.ts`, `pro/src/settingsKoofr.ts`, and `pro/src/settingsAzureBlobStorage.ts`.
- The smallest safe UI-only surface is to edit settings rendering and interaction there, while keeping legacy fields as a temporary compatibility projection.

### Command Boundary

- Ribbon and command palette registration live in `src/main.ts`.
- Current commands call `syncRun(...)` directly and still assume a single active remote in status text and command flow.
- UI work should avoid changing command behavior unless the core target-selection contract is already finalized.

### Sync Engine Boundary

The following files are core sync files and should be avoided by UI-only work:

- `src/baseTypes.ts`
- `src/configPersist.ts`
- `src/main.ts`
- `src/fsGetter.ts`
- `src/fsLocal.ts`
- `pro/src/sync.ts`
- `src/fsS3.ts`
- `src/fsDropbox.ts`
- `src/fsOnedrive.ts`
- `src/fsWebdav.ts`
- `src/fsWebdis.ts`
- `pro/src/fs*.ts`

Path filtering is enforced in `pro/src/sync.ts`, mainly by `checkIsSkipItemOrNotByName(...)`.
This means target-level include/exclude rules should eventually be projected into the sync engine input, not reimplemented in settings UI.

### Persistence And Migration Risk

- Settings persistence is `loadData/saveData(data.json)` plus the obfuscation wrapper in `src/configPersist.ts`.
- Previous sync history and sync plans are keyed by `vaultRandomID + profileID` in `src/localdb.ts`.
- `src/main.ts` currently derives profile id from `serviceType` using `${serviceType}-default-1`.
- When moving to multiple targets, profile id must become stable per target. Otherwise previous sync history may be lost, or a target may be treated as a first full sync unexpectedly.
- A compatibility migration should map old single-remote config to one default target and preserve the old profile bucket where possible.

### Test Boundary

- Best location for rule semantics tests: `pro/tests/sync.test.ts`.
- Best location for settings serialization and compatibility tests: `tests/configPersist.test.ts`.
- Hidden-path utility coverage already exists in `tests/misc.test.ts`.
- UI changes should prefer adding or extending tests without changing sync-engine semantics unless core work explicitly requires it.
