// EDGEfab's core: everything that is not UI. No VS Code imports, so the MCP server bundles it as it is.

export { dataDir, readSettings, slug, workDir, writeSettings, type SharedSettings, type TripoPlan } from "./config";
export { checkKey, envName, hasKey, keysDir, sharedKeys } from "./sharedKeys";
export {
  DefaultFaceLimit, generateModel, startTextToModel, tripoBalance, tripoTask, waitForTask, TripoError, TripoModel,
  type Generated, type TextToModel, type TripoBalance, type TripoCall, type TripoTask,
} from "./tripo";
export {
  DefaultLods, MaxSubmeshVertices, prepareModel, PrepareError,
  type LodLevel, type PrepareOptions, type PrepareResult, type PreparedSubmesh, type PreparedTexture,
} from "./prepare";
export { makeModel, type MadeModel, type MakeRequest } from "./make";
