import { strict as assert } from "assert";

import type { RemotelySavePluginSettings } from "../../src/baseTypes";
import {
  PRIMARY_SYNC_TARGET_ID,
  projectSettingsForTarget,
} from "../../src/syncConfig";
import { checkIsSkipItemOrNotByName } from "../src/sync";

const createSettings = (): RemotelySavePluginSettings => {
  return {
    s3: {
      s3AccessKeyID: "acc",
    } as any,
    webdav: {
      address: "https://dav.example",
      remoteBaseDir: "legacy-base",
    } as any,
    dropbox: {} as any,
    onedrive: {} as any,
    onedrivefull: {} as any,
    webdis: {} as any,
    googledrive: {} as any,
    box: {} as any,
    pcloud: {} as any,
    yandexdisk: {} as any,
    koofr: {} as any,
    azureblobstorage: {} as any,
    password: "",
    serviceType: "webdav",
    currLogLevel: "info",
    ignorePaths: ["^legacy/"],
    onlyAllowPaths: [],
    remoteServices: [
      {
        id: "svc-webdav",
        serviceType: "webdav",
        config: {
          address: "https://dav.example",
        } as any,
      },
    ],
    syncTargets: [
      {
        id: PRIMARY_SYNC_TARGET_ID,
        remoteServiceId: "svc-webdav",
        remoteBaseDir: "vault-a",
        ignorePaths: ["^logs/"],
        onlyAllowPaths: [],
      },
      {
        id: "target-2",
        remoteServiceId: "svc-webdav",
        remoteBaseDir: "vault-b",
        ignorePaths: [],
        onlyAllowPaths: ["^logs/"],
      },
    ],
  } as RemotelySavePluginSettings;
};

const isSkipped = (settings: RemotelySavePluginSettings, key: string) => {
  return checkIsSkipItemOrNotByName(
    key,
    false,
    false,
    false,
    ".obsidian",
    settings.ignorePaths ?? [],
    settings.onlyAllowPaths ?? []
  ).finalIsIgnored;
};

describe("Sync: checkIsSkipItemOrNotByName", () => {
  it("should be ok everywhere for empty config", async () => {
    let isSkip = checkIsSkipItemOrNotByName(
      "xxx.md",
      false,
      false,
      false,
      ".obsidian",
      /*    ignorePaths */ [],
      /* onlyAllowPaths */ []
    ).finalIsIgnored;
    assert.ok(!isSkip);

    isSkip = checkIsSkipItemOrNotByName(
      "xxx.md",
      false,
      false,
      false,
      ".obsidian",
      /*    ignorePaths */ [""],
      /* onlyAllowPaths */ ["", "\n"]
    ).finalIsIgnored;
    assert.ok(!isSkip);
  });

  it("should be ok for deny list", async () => {
    let isSkip = checkIsSkipItemOrNotByName(
      "xxx.md",
      false,
      false,
      false,
      ".obsidian",
      /*    ignorePaths */ ["xxx"],
      /* onlyAllowPaths */ []
    ).finalIsIgnored;
    assert.ok(isSkip);

    isSkip = checkIsSkipItemOrNotByName(
      "yyy.md",
      false,
      false,
      false,
      ".obsidian",
      /*    ignorePaths */ ["xxx"],
      /* onlyAllowPaths */ []
    ).finalIsIgnored;
    assert.ok(!isSkip);

    isSkip = checkIsSkipItemOrNotByName(
      "xxx.md",
      false,
      false,
      false,
      ".obsidian",
      /*    ignorePaths */ ["xxx$"],
      /* onlyAllowPaths */ []
    ).finalIsIgnored;
    assert.ok(!isSkip);
  });

  it("should be ok for allow list", async () => {
    let isSkip = checkIsSkipItemOrNotByName(
      "xxx.md",
      false,
      false,
      false,
      ".obsidian",
      /*    ignorePaths */ [],
      /* onlyAllowPaths */ ["xxx"]
    ).finalIsIgnored;
    assert.ok(!isSkip);

    isSkip = checkIsSkipItemOrNotByName(
      "yyy.md",
      false,
      false,
      false,
      ".obsidian",
      /*    ignorePaths */ [""],
      /* onlyAllowPaths */ ["xxx"]
    ).finalIsIgnored;
    assert.ok(isSkip);

    isSkip = checkIsSkipItemOrNotByName(
      "xxx.md",
      false,
      false,
      false,
      ".obsidian",
      /*    ignorePaths */ [],
      /* onlyAllowPaths */ ["xxx$"]
    ).finalIsIgnored;
    assert.ok(isSkip);
  });

  it("should detect the name by two lists together", async () => {
    let isSkip = checkIsSkipItemOrNotByName(
      "xxx.md",
      false,
      false,
      false,
      ".obsidian",
      /*    ignorePaths */ ["xxx"],
      /* onlyAllowPaths */ ["yyy"]
    ).finalIsIgnored;
    assert.ok(isSkip);

    isSkip = checkIsSkipItemOrNotByName(
      "xxx/yyy.md",
      false,
      false,
      false,
      ".obsidian",
      /*    ignorePaths */ ["xxx"],
      /* onlyAllowPaths */ ["xxx/yyy.md"]
    ).finalIsIgnored;
    assert.ok(isSkip);
  });

  it("should project target-specific rules independently for a shared remote service", () => {
    const settings = createSettings();
    const primarySettings = projectSettingsForTarget(
      settings,
      PRIMARY_SYNC_TARGET_ID
    ).settings;
    const secondarySettings = projectSettingsForTarget(
      settings,
      "target-2"
    ).settings;

    assert.ok(isSkipped(primarySettings, "logs/app.md"));
    assert.ok(!isSkipped(secondarySettings, "logs/app.md"));
    assert.ok(!isSkipped(primarySettings, "notes/app.md"));
    assert.ok(isSkipped(secondarySettings, "notes/app.md"));
    assert.equal(primarySettings.webdav.remoteBaseDir, "vault-a");
    assert.equal(secondarySettings.webdav.remoteBaseDir, "vault-b");
  });

  it("should save target-specific rule edits without leaking to sibling targets", () => {
    const settings = createSettings();
    const secondary = projectSettingsForTarget(settings, "target-2");

    secondary.settings.ignorePaths = ["^drafts/"];
    secondary.settings.onlyAllowPaths = ["^drafts/private/"];
    secondary.settings.webdav.remoteBaseDir = "vault-b-updated";
    secondary.saveBack();

    assert.deepEqual(settings.syncTargets?.[0].ignorePaths, ["^logs/"]);
    assert.deepEqual(settings.syncTargets?.[0].onlyAllowPaths, []);
    assert.equal(settings.syncTargets?.[0].remoteBaseDir, "vault-a");
    assert.deepEqual(settings.syncTargets?.[1].ignorePaths, ["^drafts/"]);
    assert.deepEqual(settings.syncTargets?.[1].onlyAllowPaths, [
      "^drafts/private/",
    ]);
    assert.equal(settings.syncTargets?.[1].remoteBaseDir, "vault-b-updated");
    assert.deepEqual(settings.remoteServices?.[0].config, {
      address: "https://dav.example",
    });
  });

  it("should share remote service config changes across sibling targets while keeping rules independent", () => {
    const settings = createSettings();
    const secondary = projectSettingsForTarget(settings, "target-2");

    secondary.settings.webdav.address = "https://dav-shared.example";
    secondary.settings.ignorePaths = ["^drafts/"];
    secondary.settings.onlyAllowPaths = ["^drafts/private/"];
    secondary.saveBack();

    const primary = projectSettingsForTarget(
      settings,
      PRIMARY_SYNC_TARGET_ID
    ).settings;
    const secondaryAgain = projectSettingsForTarget(
      settings,
      "target-2"
    ).settings;

    assert.equal(primary.webdav.address, "https://dav-shared.example");
    assert.equal(secondaryAgain.webdav.address, "https://dav-shared.example");
    assert.equal(primary.webdav.remoteBaseDir, "vault-a");
    assert.equal(secondaryAgain.webdav.remoteBaseDir, "vault-b");
    assert.deepEqual(settings.syncTargets?.[0].ignorePaths, ["^logs/"]);
    assert.deepEqual(settings.syncTargets?.[0].onlyAllowPaths, []);
    assert.deepEqual(settings.syncTargets?.[1].ignorePaths, ["^drafts/"]);
    assert.deepEqual(settings.syncTargets?.[1].onlyAllowPaths, [
      "^drafts/private/",
    ]);
  });
});
