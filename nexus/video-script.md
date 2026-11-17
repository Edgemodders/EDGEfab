# EDGEfab 0.1.0: the video's shot script

A shot list for the Nexus page's video (and the Marketplace or YouTube, if wanted). About 3 minutes once cut. The story: **one sentence in, a solid glowing vending machine standing in Night City out**, in one sitting, with no game restart. The prop goes from the Desk into the running game with REDcode's **Pack and Play** and is placed with EDGEbuilder.

(The 2026-11-16 version, with a generic prop and the Library and assistant shots, is in git history.)

## Before recording

| Check | Why |
|---|---|
| VS Code with REDcode and EDGEfab 0.1.0 (from the `.vsix` or the Marketplace), the REDnode HUD theme | The look the page promises |
| Tripo and OpenAI keys set (**Set Tripo Key**, **Set OpenAI Key**), the Tripo plan answered **paid** | So no key box comes up on camera. One run costs about 60 Tripo credits and a few cents of OpenAI per picture |
| A REDcode project open, with a short name such as `NeonProps` (it becomes the folder in the files you show) | Add to Project writes into it, and EDGEbuilder lists its archive under that name |
| The game running with REDnode and EDGEbuilder, a save loaded on a quiet street **by night**, REDnode's MCP server on | Pack and Play swaps the archive in through REDnode while the game runs. The glow shows best by night |
| **Allow REDnode's archive swap once before recording**: do one Pack and Play of any small project with the game running, and allow it when REDnode asks | So the permission prompt doesn't come up on camera |
| The game windowed or borderless, so Alt+Tab between VS Code and the game is quick | Shots 10 and 11 move between the two |
| **Make the vending machine once before recording**, with the same words, in a different project | Tripo takes 2 to 4 minutes and can miss. If the take on camera is weaker, cut to the one made earlier |

**Privacy, before anything is published:**

- VS Code's title bar, the Explorer and notifications show paths. A path with your Windows user name in it (`C:\Users\<name>\...`) should be cropped or blurred, or keep the project under a short path such as `D:\Mods\`.
- The key boxes are password boxes, but don't open them on camera.
- Tripo's balance shows in the cost message. Fine to show, or crop it.
- Claude Code's panel shows your account in places. Check the frame.

## The words

- **The object:** "a battered cyberpunk vending machine with glowing product shelves and a cracked screen"
- **The change (shot 5):** "make the cabinet red and the glow blue"
- **Its height:** 2.0 m
- **Its name (shot 8):** "Neon vending machine", which makes `neon_vending_machine.ent`, short to search for in EDGEbuilder

## The shots

| # | Time | Show | Do | Caption (optional) |
|---|---|---|---|---|
| 1 | 0:00 to 0:08 | **Cold open, in the game by night** | The finished vending machine glowing on the street. V walks up and jumps onto it. Record this last, after shot 13, when it is already standing there | "Made from one sentence." |
| 2 | 0:08 to 0:15 | VS Code, the EDGEfab icon in the activity bar, the Desk | Click the icon; the Desk opens | "EDGEfab: props for Cyberpunk 2077, in VS Code" |
| 3 | 0:15 to 0:30 | **Generate from Words...** | Type the object's words, choose **Draw it first** | "Describe it." |
| 4 | 0:30 to 0:40 | The **Pictures** tab opens on the four-view picture | Front, sides, back. Cut the 30 seconds' wait | "A picture first, from four sides" |
| 5 | 0:40 to 0:55 | **Edit Picture** | Type the change, Ctrl+Enter. The red and blue picture appears with the first one below it in the history, each with its words and time. Click back to the first to show it's kept, then click the red one again | "Not right? Change just that." |
| 6 | 0:55 to 1:10 | **Generate 3D Model** | With the red picture in view, click it. Pick **Detailed texture** and give the height, 2.0. The cost and your balance show before anything is paid: accept. The progress note; cut the 2 to 4 minutes | "EDGEfab says the cost first. Then Tripo makes it 3D, in named parts" |
| 7 | 1:10 to 1:30 | **Open in 3D** (click the prop on the Desk) | Turn it slowly. Hide a part and show it again. Step through the levels of detail | "Real size, named parts, three levels of detail" |
| 8 | 1:30 to 1:45 | **Make the Painted Lights Glow**, **Glow Strength**, **Rename...** | Pick how much counts as a light; the 3D view shows the shelves glow; keep strength 3. Rename it "Neon vending machine" | "Painted lights that really glow" |
| 9 | 1:45 to 1:55 | **Add to Project** | Right-click the prop on the Desk. REDcode's project tree shows its folder: the mesh, materials, the `.ent` | "One click into your mod" |
| 10 | 1:55 to 2:05 | **Pack and Play** (the flame button in REDcode's Project view title bar) | Click it. The busy note says Packing, then Swapping through REDnode, then that the archive is swapped. No game restart | "Into the running game. No restart." |
| 11 | 2:05 to 2:25 | **In the game: EDGEbuilder** | Alt+Tab to the game. **F10**, open **EDGEbuilder**, **Assets**, the **Mods** tab, **Entities**. Type `neon_vending`: it shows with its size (about 1.0 x 0.8 x 2.0 m) and the project's name. Face an open spot, **Drop where I look**. Press F10 to close the overlay | "Find it. Drop it." |
| 12 | 2:25 to 2:45 | **The proof** | Walk up to it: the shelves glow, the cabinet red. Walk into it (V stops), jump on top, shoot it (sparks). Let these play in real time | "Solid. Lit." |
| 13 | 2:45 to 2:55 | **Walk away and back** | Walk about 25 m away, turn, walk back: no change you can see as the detail drops | "Ready to place in your mod." |
| 14 | 2:55 to 3:05 | End card | Install from the VS Code Marketplace (search EDGEfab) or Nexus; needs REDcode; REDnode and EDGEbuilder to try and place it in the game | "EDGEfab 0.1.0 preview. Free, MIT. By EDGEmodders" |

**Shorter options** (keep or cut, before shot 10): **Make a Prop** on a `.glb` of your own from the Explorer ("Or bring a model of your own"), and **Add to Library** on the vending machine ("Keep it in the EDGE Library, for every mod").

## If something goes wrong on camera

| What | What to do |
|---|---|
| REDnode asks to allow the archive swap | Allow it, and cut the prompt. Next time it won't ask |
| Pack and Play says "Restart the game to see the change" | REDnode's MCP server is off, or the game isn't running with REDnode. Turn it on (REDnode's settings) and press Pack and Play again |
| `neon_vending` isn't in EDGEbuilder's Mods tab | Wait a few seconds for EDGEbuilder to read the new archive, or close and open the Assets tab |
| The machine lands inside something | Move it on EDGEbuilder's **Scene** tab, or step back and Drop again |

## Notes for the cut

- Cut every wait (the picture, Tripo, packing). Keep the cost message on screen for a beat: it says "nothing is paid until you agree".
- Shots 10 and 11 are the new part: keep the move from VS Code to the game in one cut, so it's clear the game never restarts.
- Shot 12 is the proof: let the jump and the shots play in real time.
- A shot can use the prop made before recording if the take on camera came out weaker; the words are the same.
- After recording, the swapped archive stays in the game's `archive\pc\mod` as the project's name. Take it out with the game closed if you don't want the prop in your game.
- Music and voice are your choice. Captions keep it watchable without sound.
- On Nexus, add the video on the page's **Videos** tab: the description stays as the repo has it. If you embed it in the description instead, say so before the release, so the description is pulled first (`npm run nexus:pull`), or the release stops.
