export {
  MODULE_CATALOG as ADMIN_MODULE_CATALOG,
  MODULE_KEYS as ADMIN_MODULE_KEYS,
  getModule as getAdminModule,
  isModuleKey as isAdminModuleKey,
} from './modules/catalog.ts';
export type {
  ModuleAvailability as AdminModuleAvailability,
  ModuleDefinition as AdminModuleDefinition,
  ModuleGroup as AdminModuleGroup,
  ModuleKey as AdminModuleKey,
} from './modules/catalog.ts';
