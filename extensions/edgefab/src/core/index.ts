// EDGEfab's core: everything that is not UI. No VS Code imports, so the MCP server bundles it as it is.

export { dataDir, readSettings, slug, deskDir, writeSettings, type SharedSettings, type TripoPlan } from "./config";
export { checkKey, envName, hasKey, keysDir, sharedKeys } from "./sharedKeys";
export {
  DefaultFaceLimit, generateModel, startTextToModel, startTexture, tripoBalance, tripoCredits, tripoTask, uploadPicture, waitForTask, TripoError, TripoModel, ViewNames, DetailLevels, type Detail, type ViewName,
  type Generated, type TextToModel, type TripoBalance, type TripoCall, type TripoTask,
} from "./tripo";
export {
  DefaultLods, MaxSubmeshVertices, prepareModel, PrepareError, type Facing,
  type LodLevel, type PrepareOptions, type PrepareResult, type PreparedSubmesh, type PreparedTexture, type PreparedGlow,
} from "./prepare";
export { drawPicture, makeModel, setSize, type AssetRecord, type FromPictureRequest, type MadeModel, type MakeRequest } from "./make";
export {
  addToProject, deskItem, entityJson, fitMesh, projectFolders, readItem, AddError, DefaultCollision, DefaultTemplate,
  type AddRequest, type AddResult, type Collision, type ProjectFolders,
} from "./addToProject";
export { callOf, startBridge } from "./bridge";
export {
  glowOff, glowWords, lightsMap, paintedLightsGlow, setGlowStrength, DefaultGlowStrength, DefaultLightsAmount, GlowError, GlowLevels, type GlowResult,
} from "./glow";
export { addBackFaces, groupParts, partsInternals, MaxParts, type PreparedPart } from "./parts";
export { drawViews, readPictures, viewsPrompt, PictureError, PictureModel, type PictureCall, type PictureRecord, type PictureTake } from "./picture";
