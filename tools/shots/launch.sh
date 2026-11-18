# Starts a separate VS Code window for screenshots: its own profile, the scratch Desk and Library made by
# setup.cjs, no keys, EDGEfab from this checkout, REDcode and the HUD theme from the installed extensions (set
# their folder names below), and a debugging port for cdp.cjs to drive it. Write <scratch>/vscode/User/settings.json
# first (the theme, no trust prompt, no updates, redcode.gamePath and redcode.bridgePath).
# Usage: bash tools/shots/launch.sh "<the scratch folder, with backslashes>"
R="$1"
HERE="$(cd "$(dirname "$0")/../.." && pwd -W)"
unset OPENAI_API_KEY TRIPO_API_KEY ELECTRON_RUN_AS_NODE
for v in $(env | grep -o "^VSCODE_[A-Z0-9_]*"); do unset "$v"; done
export EDGEFAB_DATA="$R\edgefab"
export EDGE_LIBRARY_CONFIG="$R\library.json"
EXT="$USERPROFILE\.vscode\extensions"
"$LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe" --user-data-dir="$R\vscode" --extensions-dir="$R\ext" \
  --extensionDevelopmentPath="$HERE/extensions/edgefab" \
  --extensionDevelopmentPath="$EXT\edgemodders.redcode-cyberpunk-0.10.13-win32-x64" \
  --extensionDevelopmentPath="$EXT\edgemodders.rednode-hud-theme-0.3.1" \
  --remote-debugging-port=9334 --disable-workspace-trust --skip-welcome --skip-release-notes --disable-updates --new-window \
  "$R\NeonProps"
