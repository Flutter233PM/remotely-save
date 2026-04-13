import cloneDeep from "lodash/cloneDeep";

import type {
  RemoteServiceConfig,
  RemotelySavePluginSettings,
  SUPPORTED_SERVICES_TYPE,
  SyncTargetConfig,
} from "./baseTypes";

export const PRIMARY_SYNC_TARGET_ID = "default-1";
export const PRIMARY_REMOTE_SERVICE_ID = "service-default-1";

const getLegacyServiceConfig = (
  settings: RemotelySavePluginSettings,
  serviceType: SUPPORTED_SERVICES_TYPE
) => {
  return cloneDeep((settings as any)[serviceType] ?? {});
};

const sanitizeRemoteServiceConfig = (
  serviceType: SUPPORTED_SERVICES_TYPE,
  config: any
) => {
  const sanitized = cloneDeep(config ?? {});
  switch (serviceType) {
    case "s3":
      delete sanitized.remotePrefix;
      break;
    case "dropbox":
    case "webdav":
    case "webdis":
    case "googledrive":
    case "box":
    case "pcloud":
    case "yandexdisk":
    case "koofr":
      delete sanitized.remoteBaseDir;
      break;
    case "onedrive":
    case "onedrivefull":
      delete sanitized.remoteBaseDir;
      delete sanitized.deltaLink;
      break;
    case "azureblobstorage":
      delete sanitized.remotePrefix;
      break;
    default:
      throw Error(`unknown service type ${serviceType}`);
  }
  return sanitized;
};

const writeTargetScopedFieldsFromConfig = (
  target: SyncTargetConfig,
  serviceType: SUPPORTED_SERVICES_TYPE,
  config: any,
  overwrite: boolean
) => {
  const assignIfNeeded = (key: keyof SyncTargetConfig, value: string | undefined) => {
    if (value === undefined) {
      return;
    }
    if (overwrite || target[key] === undefined || target[key] === "") {
      target[key] = value;
    }
  };

  switch (serviceType) {
    case "s3":
      assignIfNeeded("remotePrefix", config?.remotePrefix ?? "");
      break;
    case "dropbox":
    case "webdav":
    case "webdis":
    case "googledrive":
    case "box":
    case "pcloud":
    case "yandexdisk":
    case "koofr":
      assignIfNeeded("remoteBaseDir", config?.remoteBaseDir ?? "");
      break;
    case "onedrive":
    case "onedrivefull":
      assignIfNeeded("remoteBaseDir", config?.remoteBaseDir ?? "");
      assignIfNeeded("deltaLink", config?.deltaLink ?? "");
      break;
    case "azureblobstorage":
      assignIfNeeded("remotePrefix", config?.remotePrefix ?? "");
      break;
    default:
      throw Error(`unknown service type ${serviceType}`);
  }
};

const applyTargetScopedFieldsToConfig = (
  target: SyncTargetConfig,
  serviceType: SUPPORTED_SERVICES_TYPE,
  config: any
) => {
  switch (serviceType) {
    case "s3":
      config.remotePrefix = target.remotePrefix ?? "";
      break;
    case "dropbox":
    case "webdav":
    case "webdis":
    case "googledrive":
    case "box":
    case "pcloud":
    case "yandexdisk":
    case "koofr":
      config.remoteBaseDir = target.remoteBaseDir ?? "";
      break;
    case "onedrive":
    case "onedrivefull":
      config.remoteBaseDir = target.remoteBaseDir ?? "";
      config.deltaLink = target.deltaLink ?? "";
      break;
    case "azureblobstorage":
      config.remotePrefix = target.remotePrefix ?? "";
      break;
    default:
      throw Error(`unknown service type ${serviceType}`);
  }
};

const buildPrimaryRemoteServiceFromLegacySettings = (
  settings: RemotelySavePluginSettings
): RemoteServiceConfig => {
  return {
    id: PRIMARY_REMOTE_SERVICE_ID,
    serviceType: settings.serviceType,
    config: sanitizeRemoteServiceConfig(
      settings.serviceType,
      getLegacyServiceConfig(settings, settings.serviceType)
    ) as any,
  } as RemoteServiceConfig;
};

const buildPrimarySyncTargetFromLegacySettings = (
  settings: RemotelySavePluginSettings,
  remoteServiceId: string
): SyncTargetConfig => {
  const target: SyncTargetConfig = {
    id: PRIMARY_SYNC_TARGET_ID,
    remoteServiceId,
    enabled: true,
    ignorePaths: cloneDeep(settings.ignorePaths ?? []),
    onlyAllowPaths: cloneDeep(settings.onlyAllowPaths ?? []),
  };
  writeTargetScopedFieldsFromConfig(
    target,
    settings.serviceType,
    getLegacyServiceConfig(settings, settings.serviceType),
    true
  );
  return target;
};

export const getPrimarySyncTarget = (
  settings: RemotelySavePluginSettings
) => {
  return settings.syncTargets?.[0];
};

export const getRemoteServiceById = (
  settings: RemotelySavePluginSettings,
  remoteServiceId: string
) => {
  return settings.remoteServices?.find((remoteService) => {
    return remoteService.id === remoteServiceId;
  });
};

export const ensureRemoteServicesAndSyncTargetsInplace = (
  settings: RemotelySavePluginSettings
) => {
  if (!Array.isArray(settings.remoteServices)) {
    settings.remoteServices = [];
  }
  if (!Array.isArray(settings.syncTargets)) {
    settings.syncTargets = [];
  }

  settings.remoteServices.forEach((remoteService, index) => {
    if (remoteService.id === undefined || remoteService.id === "") {
      remoteService.id = index === 0 ? PRIMARY_REMOTE_SERVICE_ID : `service-${index + 1}`;
    }
  });
  settings.syncTargets.forEach((target, index) => {
    if (target.id === undefined || target.id === "") {
      target.id = index === 0 ? PRIMARY_SYNC_TARGET_ID : `target-${index + 1}`;
    }
    if (target.enabled === undefined) {
      target.enabled = true;
    }
    if (target.ignorePaths === undefined) {
      target.ignorePaths = [];
    }
    if (target.onlyAllowPaths === undefined) {
      target.onlyAllowPaths = [];
    }
  });

  if (settings.remoteServices.length === 0) {
    settings.remoteServices.push(buildPrimaryRemoteServiceFromLegacySettings(settings));
  }

  if (settings.syncTargets.length === 0) {
    settings.syncTargets.push(
      buildPrimarySyncTargetFromLegacySettings(
        settings,
        settings.remoteServices[0].id
      )
    );
  }

  for (const target of settings.syncTargets) {
    if (
      target.remoteServiceId === undefined ||
      getRemoteServiceById(settings, target.remoteServiceId) === undefined
    ) {
      target.remoteServiceId = settings.remoteServices[0].id;
    }
    if (target.enabled === undefined) {
      target.enabled = true;
    }
    if (target.ignorePaths === undefined) {
      target.ignorePaths = [];
    }
    if (target.onlyAllowPaths === undefined) {
      target.onlyAllowPaths = [];
    }
  }

  for (const remoteService of settings.remoteServices) {
    const firstTarget = settings.syncTargets.find((target) => {
      return target.remoteServiceId === remoteService.id;
    });
    if (firstTarget !== undefined) {
      writeTargetScopedFieldsFromConfig(
        firstTarget,
        remoteService.serviceType,
        remoteService.config,
        false
      );
    }
    remoteService.config = sanitizeRemoteServiceConfig(
      remoteService.serviceType,
      remoteService.config
    ) as any;
  }
};

export const applyLegacySettingsToPrimaryTargetInplace = (
  settings: RemotelySavePluginSettings
) => {
  ensureRemoteServicesAndSyncTargetsInplace(settings);

  const primaryTarget = settings.syncTargets![0];
  const primaryRemoteService = getRemoteServiceById(
    settings,
    primaryTarget.remoteServiceId
  );
  if (primaryRemoteService === undefined) {
    throw Error("cannot find primary remote service");
  }

  primaryRemoteService.serviceType = settings.serviceType;
  primaryRemoteService.config = sanitizeRemoteServiceConfig(
    settings.serviceType,
    getLegacyServiceConfig(settings, settings.serviceType)
  ) as any;
  primaryTarget.ignorePaths = cloneDeep(settings.ignorePaths ?? []);
  primaryTarget.onlyAllowPaths = cloneDeep(settings.onlyAllowPaths ?? []);
  writeTargetScopedFieldsFromConfig(
    primaryTarget,
    settings.serviceType,
    getLegacyServiceConfig(settings, settings.serviceType),
    true
  );
};

export const applyPrimaryTargetToLegacySettingsInplace = (
  settings: RemotelySavePluginSettings
) => {
  ensureRemoteServicesAndSyncTargetsInplace(settings);

  const primaryTarget = settings.syncTargets![0];
  const primaryRemoteService = getRemoteServiceById(
    settings,
    primaryTarget.remoteServiceId
  );
  if (primaryRemoteService === undefined) {
    throw Error("cannot find primary remote service");
  }

  settings.serviceType = primaryRemoteService.serviceType;
  (settings as any)[primaryRemoteService.serviceType] = cloneDeep(
    primaryRemoteService.config
  );
  applyTargetScopedFieldsToConfig(
    primaryTarget,
    primaryRemoteService.serviceType,
    (settings as any)[primaryRemoteService.serviceType]
  );
  settings.ignorePaths = cloneDeep(primaryTarget.ignorePaths ?? []);
  settings.onlyAllowPaths = cloneDeep(primaryTarget.onlyAllowPaths ?? []);
};

export const getEnabledSyncTargets = (
  settings: RemotelySavePluginSettings
) => {
  ensureRemoteServicesAndSyncTargetsInplace(settings);
  return settings.syncTargets!
    .filter((target) => target.enabled !== false)
    .map((target) => {
      const remoteService = getRemoteServiceById(settings, target.remoteServiceId);
      if (remoteService === undefined) {
        throw Error(`cannot find remote service ${target.remoteServiceId}`);
      }
      return {
        target,
        remoteService,
      };
    });
};

export const getProfileIDByTarget = (
  target: SyncTargetConfig,
  serviceType: SUPPORTED_SERVICES_TYPE
) => {
  if (target.id === PRIMARY_SYNC_TARGET_ID) {
    return `${serviceType}-default-1`;
  }
  return `${serviceType}-${target.id}`;
};

export const projectSettingsForTarget = (
  settings: RemotelySavePluginSettings,
  targetId: string
) => {
  ensureRemoteServicesAndSyncTargetsInplace(settings);

  const target = settings.syncTargets!.find((item) => item.id === targetId);
  if (target === undefined) {
    throw Error(`cannot find sync target ${targetId}`);
  }
  const remoteService = getRemoteServiceById(settings, target.remoteServiceId);
  if (remoteService === undefined) {
    throw Error(`cannot find remote service ${target.remoteServiceId}`);
  }

  const projectedSettings = cloneDeep(settings);
  const projectedConfig = cloneDeep(remoteService.config as any);
  applyTargetScopedFieldsToConfig(target, remoteService.serviceType, projectedConfig);
  (projectedSettings as any)[remoteService.serviceType] = projectedConfig;
  projectedSettings.serviceType = remoteService.serviceType;
  projectedSettings.ignorePaths = cloneDeep(target.ignorePaths ?? []);
  projectedSettings.onlyAllowPaths = cloneDeep(target.onlyAllowPaths ?? []);

  return {
    target,
    remoteService,
    settings: projectedSettings,
    saveBack: () => {
      remoteService.config = sanitizeRemoteServiceConfig(
        remoteService.serviceType,
        projectedConfig
      ) as any;
      writeTargetScopedFieldsFromConfig(
        target,
        remoteService.serviceType,
        projectedConfig,
        true
      );
      target.ignorePaths = cloneDeep(projectedSettings.ignorePaths ?? []);
      target.onlyAllowPaths = cloneDeep(projectedSettings.onlyAllowPaths ?? []);
      settings.pro = cloneDeep(projectedSettings.pro);
      if (getPrimarySyncTarget(settings)?.id === target.id) {
        applyPrimaryTargetToLegacySettingsInplace(settings);
      }
    },
  };
};
