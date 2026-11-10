// glTF-Transform logs its steps with console.log ("prune: Removed types..."), which would land in the MCP
// server's stdout, its protocol channel. Warnings and errors only, which go to stderr.
import { Logger } from "@gltf-transform/core";

export const quiet = new Logger(Logger.Verbosity.WARN);
