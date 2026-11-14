// EDGEfab's core: everything that is not UI. No VS Code imports, so the MCP server bundles it as it is.

export { dataDir, readSettings, renameFolder, slug, deskDir, writeSettings, type SharedSettings, type TripoPlan } from "./config";
export { checkKey, envKey, KeyServices, type KeyService } from "./keys";
export {
  DefaultFaceLimit, generateModel, startTextToModel, startTexture, tripoBalance, tripoCredits, tripoTask, uploadPicture, waitForTask, TripoError, TripoModel, ViewNames, DetailLevels, type Detail, type ViewName,
  type Generated, type TextToModel, type TripoBalance, type TripoCall, type TripoTask,
} from "./tripo";
export {
  DefaultLods, MaxParts, MaxSubmeshVertices, prepareModel, readPrepared, PrepareError, type Facing, type PreparedPart,
  type LodLevel, type PrepareOptions, type PrepareResult, type PreparedSubmesh, type PreparedTexture, type PreparedGlow,
} from "./prepare";
export { drawPicture, makeModel, renameItem, setSize, type AssetRecord, type FromPictureRequest, type MadeModel, type MakeRequest } from "./make";
export {
  addToProject, deskItem, entityJson, fitMesh, projectFolders, readItem, AddError, DefaultCollision, DefaultTemplate,
  type AddRequest, type AddResult, type Collision, type ProjectFolders,
} from "./addToProject";
export { callOf, gameFolder, startBridge } from "./bridge";
export {
  addFromLibrary, addToLibrary, assetById, editOnDesk, isInside, libraryAssets, libraryConfigFile, libraryFolder, libraryFolders, libraryProp, libraryRoot,
  modderFolder, propFiles, propGameFolder, readAsset, readNote, recordedLibraryRoot, refreshList, safeFolder, setLibraryRoot, setModderFolder, suggestedLibraryRoot,
  LibraryError, ModelFiles,
  type FromLibraryResult, type LibraryAddRequest, type LibraryAddResult, type LibraryAsset, type LibraryFolder, type Note, type NoteItem, type RefreshLine,
} from "./library";
export {
  glowOff, glowWords, lightsMap, percent, paintedLightsGlow, setGlowStrength, DefaultGlowStrength, DefaultLightsAmount, GlowError, GlowLevels, type GlowResult,
} from "./glow";
export { drawViews, readPictures, viewsPrompt, PictureError, PictureModel, type PictureCall, type PictureRecord, type PictureTake } from "./picture";
