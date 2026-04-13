import { strict as assert } from "assert";
import cloneDeep from "lodash/cloneDeep";

import type { RemotelySavePluginSettings } from "../src/baseTypes";
import { messyConfigToNormal, normalConfigToMessy } from "../src/configPersist";
import { projectSettingsCompatibilityForPersistence } from "../src/main";

import {
  applyPrimaryTargetToLegacySettingsInplace,
  ensureRemoteServicesAndSyncTargetsInplace,
  getProfileIDByTarget,
  PRIMARY_REMOTE_SERVICE_ID,
  PRIMARY_SYNC_TARGET_ID,
  projectSettingsForTarget,
} from "../src/syncConfig";

const DEFAULT_SETTINGS: RemotelySavePluginSettings = {
  s3: {
    s3AccessKeyID: "acc",
  } as any,
  webdav: {
    address: "addr",
  } as any,
  dropbox: {
    username: "测试中文",
  } as any,
  onedrive: {
    username: "test 🍎 emoji",
  } as any,
  onedrivefull: {
    username: "test 🍎 emoji",
  } as any,
  webdis: {
    address: "addr",
  } as any,
  googledrive: {
    refreshToken: "xxx",
  } as any,
  box: {
    refreshToken: "xxx",
  } as any,
  pcloud: {
    accessToken: "xxx",
  } as any,
  yandexdisk: {
    refreshToken: "xxx",
  } as any,
  koofr: {
    refreshToken: "xxx",
  } as any,
  azureblobstorage: {
    containerSasUrl: "http://127.0.0.1",
  } as any,
  password: "password",
  serviceType: "s3",
  currLogLevel: "info",
  ignorePaths: ["somefoldertoignore"],
  onlyAllowPaths: [],
  enableStatusBarInfo: true,
};

const createSettings = () => {
  return cloneDeep(DEFAULT_SETTINGS);
};

describe("Config Persist tests", () => {
  it("should encrypt go back and forth conrrectly", async () => {
    const settings = createSettings();
    const encoded = normalConfigToMessy(settings);
    const decoded = messyConfigToNormal(encoded);
    assert.deepEqual(decoded, settings);
  });

  it("should keep structured multi-remote config through encode and decode", async () => {
    const settings = createSettings();
    settings.remoteServices = [
      {
        id: "service-1",
        serviceType: "webdav",
        config: {
          address: "https://dav.example",
        } as any,
      },
      {
        id: "service-2",
        serviceType: "s3",
        config: {
          s3AccessKeyID: "another-acc",
        } as any,
      },
    ];
    settings.syncTargets = [
      {
        id: PRIMARY_SYNC_TARGET_ID,
        remoteServiceId: "service-1",
        remoteBaseDir: "vault-a",
        ignorePaths: ["^logs/"],
        onlyAllowPaths: [],
      },
      {
        id: "target-2",
        remoteServiceId: "service-2",
        remotePrefix: "backup",
        ignorePaths: [],
        onlyAllowPaths: ["^notes/"],
      },
    ];

    const encoded = normalConfigToMessy(settings);
    const decoded = messyConfigToNormal(encoded);
    assert.deepEqual(decoded, settings);
  });

  it("should migrate legacy settings into the default structured target", () => {
    const settings = createSettings();
    settings.serviceType = "webdav";
    settings.webdav = {
      address: "https://dav.example",
      remoteBaseDir: "legacy-base",
    } as any;
    settings.ignorePaths = ["^logs/"];
    settings.onlyAllowPaths = ["^notes/"];

    ensureRemoteServicesAndSyncTargetsInplace(settings);

    assert.equal(settings.remoteServices?.length, 1);
    assert.equal(settings.syncTargets?.length, 1);
    assert.equal(settings.remoteServices?.[0].id, PRIMARY_REMOTE_SERVICE_ID);
    assert.equal(settings.syncTargets?.[0].id, PRIMARY_SYNC_TARGET_ID);
    assert.equal(
      settings.syncTargets?.[0].remoteServiceId,
      PRIMARY_REMOTE_SERVICE_ID
    );
    assert.equal(settings.remoteServices?.[0].serviceType, "webdav");
    assert.deepEqual(settings.remoteServices?.[0].config, {
      address: "https://dav.example",
    });
    assert.equal(settings.syncTargets?.[0].remoteBaseDir, "legacy-base");
    assert.deepEqual(settings.syncTargets?.[0].ignorePaths, ["^logs/"]);
    assert.deepEqual(settings.syncTargets?.[0].onlyAllowPaths, ["^notes/"]);
    assert.equal(
      getProfileIDByTarget(settings.syncTargets![0], settings.serviceType),
      "webdav-default-1"
    );
  });

  it("should keep non-primary target changes isolated from legacy compatibility fields", () => {
    const settings = createSettings();
    settings.serviceType = "s3";
    settings.s3 = {
      s3AccessKeyID: "legacy-acc",
      remotePrefix: "primary-prefix",
    } as any;
    settings.ignorePaths = ["^legacy/"];
    settings.onlyAllowPaths = ["^primary/"];
    settings.remoteServices = [
      {
        id: "svc-s3",
        serviceType: "s3",
        config: {
          s3AccessKeyID: "shared-acc",
        } as any,
      },
    ];
    settings.syncTargets = [
      {
        id: PRIMARY_SYNC_TARGET_ID,
        remoteServiceId: "svc-s3",
        remotePrefix: "primary-prefix",
        ignorePaths: ["^legacy/"],
        onlyAllowPaths: ["^primary/"],
      },
      {
        id: "target-2",
        remoteServiceId: "svc-s3",
        remotePrefix: "secondary-prefix",
        ignorePaths: ["^skip-second/"],
        onlyAllowPaths: ["^allow-second/"],
      },
    ];

    applyPrimaryTargetToLegacySettingsInplace(settings);

    const projected = projectSettingsForTarget(settings, "target-2");
    projected.settings.ignorePaths = ["^updated-second/"];
    projected.settings.onlyAllowPaths = ["^updated-allow/"];
    projected.settings.s3.remotePrefix = "updated-second-prefix";
    projected.saveBack();

    assert.deepEqual(settings.syncTargets?.[0].ignorePaths, ["^legacy/"]);
    assert.deepEqual(settings.syncTargets?.[0].onlyAllowPaths, ["^primary/"]);
    assert.equal(settings.syncTargets?.[0].remotePrefix, "primary-prefix");
    assert.deepEqual(settings.syncTargets?.[1].ignorePaths, [
      "^updated-second/",
    ]);
    assert.deepEqual(settings.syncTargets?.[1].onlyAllowPaths, [
      "^updated-allow/",
    ]);
    assert.equal(
      settings.syncTargets?.[1].remotePrefix,
      "updated-second-prefix"
    );
    assert.equal(settings.serviceType, "s3");
    assert.equal(settings.s3.remotePrefix, "primary-prefix");
    assert.deepEqual(settings.ignorePaths, ["^legacy/"]);
    assert.deepEqual(settings.onlyAllowPaths, ["^primary/"]);
    assert.deepEqual(settings.remoteServices?.[0].config, {
      s3AccessKeyID: "shared-acc",
    });
  });

  it("should allow a new target to bind to an existing or new remote service", () => {
    const settings = createSettings();
    settings.remoteServices = [
      {
        id: "svc-webdav",
        serviceType: "webdav",
        config: {
          address: "https://dav.example",
        } as any,
      },
      {
        id: "svc-s3",
        serviceType: "s3",
        config: {
          s3AccessKeyID: "shared-acc",
        } as any,
      },
    ];
    settings.syncTargets = [
      {
        id: PRIMARY_SYNC_TARGET_ID,
        remoteServiceId: "svc-webdav",
        remoteBaseDir: "vault-a",
        ignorePaths: [],
        onlyAllowPaths: [],
      },
      {
        id: "target-2",
        remoteServiceId: "svc-webdav",
        remoteBaseDir: "vault-b",
        ignorePaths: ["^logs/"],
        onlyAllowPaths: [],
      },
      {
        id: "target-3",
        remoteServiceId: "svc-s3",
        remotePrefix: "backup-c",
        ignorePaths: [],
        onlyAllowPaths: ["^notes/"],
      },
    ];

    const reusedService = projectSettingsForTarget(
      settings,
      "target-2"
    ).settings;
    const newService = projectSettingsForTarget(settings, "target-3").settings;

    assert.equal(reusedService.serviceType, "webdav");
    assert.equal(reusedService.webdav.address, "https://dav.example");
    assert.equal(reusedService.webdav.remoteBaseDir, "vault-b");
    assert.equal(newService.serviceType, "s3");
    assert.equal(newService.s3.s3AccessKeyID, "shared-acc");
    assert.equal(newService.s3.remotePrefix, "backup-c");
  });

  it("should keep legacy compatibility fields aligned when the primary target switches service type", () => {
    const settings = createSettings();
    settings.remoteServices = [
      {
        id: "svc-webdav",
        serviceType: "webdav",
        config: {
          address: "https://dav.example",
        } as any,
      },
      {
        id: "svc-s3",
        serviceType: "s3",
        config: {
          s3AccessKeyID: "switch-acc",
        } as any,
      },
    ];
    settings.syncTargets = [
      {
        id: PRIMARY_SYNC_TARGET_ID,
        remoteServiceId: "svc-webdav",
        remoteBaseDir: "vault-a",
        ignorePaths: ["^logs/"],
        onlyAllowPaths: [],
      },
      {
        id: "target-2",
        remoteServiceId: "svc-s3",
        remotePrefix: "secondary-prefix",
        ignorePaths: [],
        onlyAllowPaths: ["^notes/"],
      },
    ];

    settings.syncTargets[0].remoteServiceId = "svc-s3";
    settings.syncTargets[0].remotePrefix = "primary-switched";
    delete settings.syncTargets[0].remoteBaseDir;
    settings.syncTargets[0].ignorePaths = ["^switched/"];
    settings.syncTargets[0].onlyAllowPaths = ["^notes/"];

    applyPrimaryTargetToLegacySettingsInplace(settings);

    assert.equal(settings.serviceType, "s3");
    assert.equal(settings.s3.s3AccessKeyID, "switch-acc");
    assert.equal(settings.s3.remotePrefix, "primary-switched");
    assert.deepEqual(settings.ignorePaths, ["^switched/"]);
    assert.deepEqual(settings.onlyAllowPaths, ["^notes/"]);
  });

  it("should re-project legacy fields from the remaining primary target after deletion", () => {
    const settings = createSettings();
    settings.remoteServices = [
      {
        id: "svc-webdav",
        serviceType: "webdav",
        config: {
          address: "https://primary.example",
        } as any,
      },
      {
        id: "svc-s3",
        serviceType: "s3",
        config: {
          s3AccessKeyID: "after-delete-acc",
        } as any,
      },
    ];
    settings.syncTargets = [
      {
        id: PRIMARY_SYNC_TARGET_ID,
        remoteServiceId: "svc-webdav",
        remoteBaseDir: "vault-a",
        ignorePaths: ["^primary/"],
        onlyAllowPaths: [],
      },
      {
        id: "target-2",
        remoteServiceId: "svc-s3",
        remotePrefix: "after-delete",
        ignorePaths: ["^secondary/"],
        onlyAllowPaths: ["^allowed/"],
      },
    ];

    settings.syncTargets = [settings.syncTargets[1]];
    const remaining = projectSettingsForTarget(settings, "target-2");
    remaining.settings.ignorePaths = ["^updated-after-delete/"];
    remaining.settings.onlyAllowPaths = ["^keep-after-delete/"];
    remaining.settings.s3.remotePrefix = "remaining-prefix";
    remaining.saveBack();

    assert.equal(settings.syncTargets?.length, 1);
    assert.equal(settings.syncTargets?.[0].id, "target-2");
    assert.equal(settings.serviceType, "s3");
    assert.equal(settings.s3.s3AccessKeyID, "after-delete-acc");
    assert.equal(settings.s3.remotePrefix, "remaining-prefix");
    assert.deepEqual(settings.ignorePaths, ["^updated-after-delete/"]);
    assert.deepEqual(settings.onlyAllowPaths, ["^keep-after-delete/"]);
  });

  it("should persist structured primary edits after legacy migration", () => {
    const settings = createSettings();
    settings.serviceType = "webdav";
    settings.webdav = {
      address: "https://legacy.example",
      remoteBaseDir: "legacy-base",
    } as any;
    settings.ignorePaths = ["^legacy/"];
    settings.onlyAllowPaths = ["^legacy-allow/"];

    const projectionState = {
      explicitStructuredConfigLoaded: false,
      legacyProjectedStructuredSnapshot: "",
    };

    projectSettingsCompatibilityForPersistence(settings, projectionState);

    settings.remoteServices![0].serviceType = "s3";
    settings.remoteServices![0].config = {
      s3AccessKeyID: "structured-acc",
    } as any;
    settings.syncTargets![0].remoteServiceId = settings.remoteServices![0].id;
    delete settings.syncTargets![0].remoteBaseDir;
    settings.syncTargets![0].remotePrefix = "structured-prefix";
    settings.syncTargets![0].ignorePaths = ["^structured/"];
    settings.syncTargets![0].onlyAllowPaths = ["^structured-allow/"];

    projectSettingsCompatibilityForPersistence(settings, projectionState);

    assert.equal(projectionState.explicitStructuredConfigLoaded, true);
    assert.equal(settings.serviceType, "s3");
    assert.equal(settings.s3.s3AccessKeyID, "structured-acc");
    assert.equal(settings.s3.remotePrefix, "structured-prefix");
    assert.equal(settings.syncTargets?.[0].remotePrefix, "structured-prefix");
    assert.deepEqual(settings.ignorePaths, ["^structured/"]);
    assert.deepEqual(settings.onlyAllowPaths, ["^structured-allow/"]);
  });
});
