# EDGEfab 0.1.0: the video's shot script

A shot list for the Nexus page's video (and the Marketplace or YouTube, if wanted). About 2 to 3 minutes once cut. The story: **words in, a solid glowing prop in Night City out**, in one sitting, then a quick look at your own model, the Library and an assistant.

## Before recording

| Check | Why |
|---|---|
| VS Code with REDcode and EDGEfab 0.1.0 (from the `.vsix` or the Marketplace), the REDnode HUD theme | The look the page promises |
| Tripo and OpenAI keys set (**Set Tripo Key**, **Set OpenAI Key**), the Tripo plan answered **paid** | So no key box comes up on camera. Each Generate costs about 60 Tripo credits and a few cents of OpenAI |
| A REDcode project open, with a short name (it becomes the folder in the files you show) | Add to Project writes into it |
| The game with REDnode and EDGEbuilder, a quiet street by night, a save there | The glow shows best by night |
| **Make the hero prop once before recording**, the same words | Tripo takes 2 to 4 minutes and can miss. If the take on camera is weaker, cut to the one made earlier |
| A second model of your own as a `.glb` in a folder you can show (any textured GLB) | For the "your own model" shot |

**Privacy, before anything is published:**

- VS Code's title bar, the Explorer and notifications show paths. A path with your Windows user name in it (`C:\Users\<name>\...`) should be cropped or blurred, or keep the project under a short path such as `D:\Mods\`.
- The key boxes are password boxes, but don't open them on camera.
- Tripo's balance shows in the cost message. Fine to show, or crop it.
- Claude Code's panel shows your account in places. Check the frame.

## The shots

| # | Time | Show | Do | Caption (optional) |
|---|---|---|---|---|
| 1 | 0:00 to 0:08 | **Cold open, in the game by night** | The finished hero prop glowing on a street. V walks up and jumps onto it | "Made from one sentence." |
| 2 | 0:08 to 0:15 | VS Code, the EDGEfab icon in the activity bar, the Desk | Click the icon; the Desk opens | "EDGEfab: props for Cyberpunk 2077, in VS Code" |
| 3 | 0:15 to 0:35 | **Generate from Words...** | Type the words (below). Give the height when asked (for example 2.2 m). The cost and your balance show before anything is paid: accept | "Describe it. EDGEfab says the cost first." |
| 4 | 0:35 to 0:45 | The four-view picture on the Desk | Open it: front, sides, back. Cut the 30 seconds' wait | "A picture first, from four sides" |
| 5 | 0:45 to 0:55 | (Optional) **Change the Words** | Add a detail ("...with a red awning"), a second picture. The first one stays | "Not right? Change the words." |
| 6 | 0:55 to 1:05 | **Make 3D** | Click it; the progress note; cut the 2 to 4 minutes | "Then Tripo makes it 3D, in named parts" |
| 7 | 1:05 to 1:25 | **Open in 3D** (click the prop on the Desk) | Turn it slowly. Hide a part and show it again. Step through the levels of detail | "Real size, named parts, three levels of detail" |
| 8 | 1:25 to 1:40 | **Make the Painted Lights Glow**, then **Glow Strength** | Pick how much counts as a light; the 3D view shows the glow; pick a strength | "Painted lights that really glow" |
| 9 | 1:40 to 1:50 | **Add to Project** | Right-click the prop. REDcode's project tree shows its folder: the mesh, materials, the `.ent` | "One click into your mod" |
| 10 | 1:50 to 2:00 | REDcode packs, EDGEdeck or REDnode puts it in the game | Keep it short: one click, a cut | |
| 11 | 2:00 to 2:20 | **In the game: EDGEbuilder places it** | Find it in EDGEbuilder's Browse, place it, by night. Walk into it (solid), jump on top, shoot it (sparks). Walk 25 m away and back: no change you can see | "Solid. Lit. Ready to place." |
| 12 | 2:20 to 2:30 | Your own model | Right-click a `.glb` in the Explorer, **Make a Prop**; it lands on the Desk ready | "Or bring a model of your own" |
| 13 | 2:30 to 2:40 | The **Library** view | **Add to Library** on the hero prop; it shows in your folder; **Add to Project** from there into another project | "Keep it in the EDGE Library, for every mod" |
| 14 | 2:40 to 2:55 | (Optional) An assistant | In Claude Code: "make a neon street lamp, 3 metres tall, and add it to my project". Show the tool calls go by, cut the wait, the lamp on the Desk | "Or just ask." |
| 15 | 2:55 to 3:05 | End card | Install from the VS Code Marketplace (search EDGEfab) or Nexus; needs REDcode; EDGEbuilder to place | "EDGEfab 0.1.0 preview. Free, MIT. By EDGEmodders" |

**Words for the hero prop** (pick one, or your own; a lit object shows the glow best):

- "a cyberpunk street food cart with a glowing neon menu board and a striped awning"
- "a battered cyberpunk vending machine with glowing product shelves and a cracked screen"
- "a neon-lit noodle stand sign on a metal post, kanji and arrows glowing"

## Notes for the cut

- Cut every wait (the picture, Tripo, packing, the game loading). Keep the cost message on screen for a beat: it says "nothing is paid until you agree".
- Shot 11 is the proof: let the jump and the shots play in real time.
- A shot can use the prop made before recording if the take on camera came out weaker; the words are the same.
- Music and voice are your choice. Captions keep it watchable without sound.
- On Nexus, add the video on the page's **Videos** tab: the description stays as the repo has it. If you embed it in the description instead, say so before the release, so the description is pulled first (`npm run nexus:pull`), or the release stops.
