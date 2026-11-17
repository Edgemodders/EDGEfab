---
title: Made lip sync
---

# Made lip sync: from a talking video (or a voice) to the game's lip sync clips

**Status: research, with a proposal** ([the Lip Sync tab](#the-lip-sync-tab-a-proposal), 2026-11-17; where it goes in the build plan is the EDGEfab build session's call). Asked for by the owner on 2026-11-17: can a generated video of a person speaking a line be turned into the game's own lip sync clip, by one service built for it or by several steps put together? It decides where the long pole is for new voiced lines. Follows [NPC faces](faces.html). The game side was read from game 2.5 through the `redcode` server on 2026-11-17; the services from their own pages and reviews the same day (sources at the end). Nothing here was tried in the game. **Inferred** and **unverified** mark what was not checked.

## The short answer

| Question | Answer |
|---|---|
| Can it be done? | **Yes, by steps.** No service turns a video into Cyberpunk lip sync. Every step exists as a service or a free tool, except one: turning a service's face curves into the game's face tracks. That one EDGEfab would write |
| Is a video the best input? | **Not for the mouth.** A talking-head video made from a line's audio has a mouth the video model made from that audio. Reading it back adds a lossy step. Going from the audio straight to face curves gives the same mouth for less. Video earns its place for brows, eyes and head (a performance), and for a modder filming themselves |
| What is the long pole? | **The translation into the game's tracks**: about 100 tracks (mouth shapes, the overrides that mute other animation, envelopes, JALI's jaw and lips controls), at 30 fps. The services speak ARKit's 52 blendshapes or MetaHuman's controls. Writing the `.anims`, naming the clips and registering them are already solved |
| Is there ground truth to build the translation from? | **Yes.** The game has a baked clip for every voiced line, beside its `.wem`. A front end run on the game's own lines gives pairs to fit the translation on, on the modder's own PC (game data stays local) |
| Has anyone done part of this? | **Yes.** The community's [Lipsync Animator](https://github.com/andreaolivato/cyberpunk2077-lipsync-animator) (MIT, October 2026, tested on 2.5) makes lip sync clips from a line's audio and text, writes them through WolvenKit's own anims import, and documents the tracks. English only; mouth and blinks only |

## What the game wants

Read from the head rig `h0_005_mb_c__middle_skeleton.rig` (414 track names) and the English clip `aaron_waines.anims`, exported to glTF through REDbridge 0.12.1 (WolvenKit 10.0.0) on 2026-11-17. **The float tracks survive the export**: WolvenKit writes them in the animation's extras as `trackKeys` (`trackIndex`, `time`, `value`) and `constTrackKeys`, under the schema `wkit.cp2077.gltf.anims` version 5. Lipsync Animator found the same 414 names, in the same order, on three heads in 2.31 and 2.5.

| Track group | Count | In one line (2.4 s, 73 frames) |
|---|---|---|
| Poses (`jaw_mid_open`, `lips_l_funnel`, `lips_together_up`, `tongue_mid_tip_up`, ...: FACS-like, left and right) | about 140 | Only eye direction, head, neck and `face_gravity_*` move (17) |
| `<pose>LipsyncPoseOutput` | 141 | **The mouth**: 46 move, 0 to about 1 |
| `<pose>AnimOverrideWeight` | 86 | 40 move, mostly the negative of their `LipsyncPoseOutput` (26 of 36 pairs exactly): they mute other face animation on the poses lip sync drives |
| `<pose>Wrnkl` | 33 | None |
| Controls | 13 | 7 move: `lipSyncEnvelope`, `jaliJaw`, `jaliLips`, `muzzleLips`, `muzzleBrows`, `upperFace`, `lowerFace` |

Other facts the clip must keep: 30 frames a second; `AdditiveFromRefPose`; the clip named `f_<HEX>` or `m_<HEX>` from the line's string id; one set per speaking actor and scene; the set's `rig` the head's skeleton. `jaliJaw` and `jaliLips` are JALI's two controls (JALI is the research company that made the game's lip sync from audio, with no facial capture). Lipsync Animator found `jaliJaw` follows neither loudness nor any sound group, so what it does is **unverified**. It also measured that the mouth leads the voice by 60 to 70 ms.

Registering is solved too. WolvenKit's Scene Editor has **Generate vanilla lipsync anim sets**, and the RED modding wiki describes what it writes: a mod's own clip sets under `localization\<language>\lipsync\<scene>\<actor>.anims`, a mod's own `<project>.lipmap` per language, and an ArchiveXL file listing them under `localization: lipmaps:`. So mods add lip sync maps without changing the game's `.lipmap` (this answers an open question on [NPC faces](faces.html)). The generator copies existing clips only; new audio needs a made clip.

## The routes

| Route | Steps | Gives | Cost and terms |
|---|---|---|---|
| **A. Audio, by sounds** | Audio + text, forced alignment, a per-sound mouth table learned from the game's lines (Lipsync Animator) | Mouth and blinks. Scores against CDPR's clips 0.01 to 0.85 per part; lip closing 0.85 with the aligner | Free, MIT, local. English only (others need a pronunciation dictionary) |
| **B. Audio, by a speech-to-face model** | Audio, NVIDIA **Audio2Face-3D** (open source since 2025), ARKit's 52 blendshapes plus 16 tongue shapes | Mouth, jaw, tongue, some emotion | Free, local; SDK MIT; models under NVIDIA's own licence (read before shipping); needs an NVIDIA GPU (CUDA 12.8+, TensorRT 10.13+, 4 GB+), Windows or Linux. Audio2Emotion may be used only inside Audio2Face |
| B'. The same, Unreal | Audio, **MetaHuman Animator** audio-driven solve (UE 5.6), MetaHuman's face controls | Mouth, head movement | Free with Unreal Engine; needs UE (FA's Unreal path, [UE5 assets](ue-assets.html)) |
| B''. The same, licensed | Audio, **JALI** or **Speech Graphics SGX** | The game's own method (JALI) or its peer | Quote only; JALI offers evaluations and C++ libraries. No hosted API found |
| **C. Video (the owner's route)** | 1. The line's voice. 2. A talking head **driven by that audio**. 3. Face capture from the video. 4. Translate. 5. Write. 6. Register | Mouth, plus brows, eyes and head from the video's performance | Per second of video (below), plus a free capture step |
| D. A real performance | The modder films themselves saying the line (webcam), then C3 to C6 | The modder's own acting | Free |

### The video route's steps

| Step | Candidates | Notes |
|---|---|---|
| 1. Voice | The modder's recording, or a generated voice (EDGEwave's job) | The `.wem` the game plays. Everything else follows it |
| 2. Talking head from that audio | **HeyGen** (REST API, script or uploaded audio, paid plans), **Hedra** (image plus audio), **VEED Fabric 1.0** (about $0.15 a second), **sync.so**, or local **SadTalker** and **Wav2Lip** | Must take the line's own audio. **Veo 3** makes speech with its video (about $0.05 a second at its lowest tier, per a 2026 estimate), but in its own voice, so the line would have to use Veo's audio. Rankings are mostly the vendors' own; test on a front-facing, evenly lit head |
| 3. Face capture | **MediaPipe Face Landmarker** (`pip install mediapipe`, VIDEO mode, 52 blendshape scores per frame, ARKit-style names, local and free); **MetaHuman Animator** from mono video (UE 5.6, offline, high quality); **DeepMotion** face tracking (39 ARKit blendshapes, web portal; no public API found); QuickMagic (52, no API docs found) | MediaPipe's set has no tongue (**unverified**: not on its page); lip closure from video is the weak point of all single-camera capture |
| 4. Translate to the game's tracks | **None exists.** EDGEfab's own | The long pole; below |
| 5. Write the `.anims` | A glTF with `trackKeys` in WolvenKit's extras, imported by WolvenKit's `ImportAnims` | Proven by Lipsync Animator (through WolvenKit's libraries). For EDGEfab, through REDbridge: [REDbridge #14](https://github.com/Edgemodders/REDbridge/issues/14), which must keep float tracks |
| 6. Register | Line clip names in the scene, a mod `.lipmap` per language, the ArchiveXL `lipmaps` entry | What WolvenKit's generator writes; EDGEquest's side |

## Using Lipsync Animator from EDGE

Read from its source (0.1.0, 2026-10-27) on 2026-11-17; not run here.

| Question | Answer |
|---|---|
| Does it need the WolvenKit app's window? | **No.** It loads WolvenKit's libraries into its own Python process (pythonnet) and calls WolvenKit's `ModTools` directly (`ImportAnims`, export, archive reads). The libraries come from the WolvenKit app's folder (self-contained) or the WolvenKit CLI's (needs .NET 10). Tested with WolvenKit 9.1 |
| Can it use the WolvenKit that REDbridge carries? | **Not as written.** REDbridge's folder has WolvenKit's libraries (`WolvenKit.Modkit` 10.0.0-beta.1, on .NET 10, which this PC has), but its loader starts .NET from `WolvenKit.CLI.dll` or `WolvenKit.dll`, and REDbridge's folder has neither. Neither the app nor the CLI is installed on this PC. Whether it works with WolvenKit 10 at all is **unverified** (it finds `ModTools`' constructor by reflection) |
| Which steps need WolvenKit? | Exporting an `.anims` to glTF, importing back, reading `.wem`, and `scene` (the project's scene, voice maps, lipmap). **`make` does not** when the audio is `.wav`, `.ogg` or `.flac`: it takes an exported `.anims.glb` and writes the new lines' tracks into it, with numpy and soundfile only (Montreal Forced Aligner, a separate conda install, if present) |
| So how would EDGE use it? | **Split it at the glTF.** REDbridge exports the actor's set (`project.export`, which writes this `.anims.glb`, checked 2026-11-17), Lipsync Animator's `make` adds the lines as a separate process, REDbridge imports the result (REDbridge #14). EDGEquest does the scene's part (line names, the mod `.lipmap`, the ArchiveXL entry). WolvenKit stays inside REDbridge; Lipsync Animator is MIT, called as a separate process |
| What it gives | English, from audio and the exact words: mouth, jaw, tongue and cheeks, and blinks; the rest of the face, head and neck stay as the game has them. A new line can borrow another line's bone layout (`--template`) |
| What the modder installs | Python 3.12 to 3.15 with numpy and soundfile; for good lip closing, Montreal Forced Aligner (Kaldi, through conda or mamba) |

This would make route A usable as soon as REDbridge #14 imports. **Proposed instead (2026-11-17, at the owner's question): EDGE builds its own, in its own stack**, and runs Lipsync Animator only as the baseline to score against. Why: its install (Python, and conda for the aligner) is too much for non-coders and can't ship in a Marketplace extension; the translation below is needed for routes B, C and D anyway, and the same core serves route A; and the conventions forbid copying other mods' code or data (its dictionary is numbers from the game). Its documented method and measurements are fair to learn from. The [Lip Sync tab](#the-lip-sync-tab-a-proposal) below is built on this.

## The long pole: the translation

ARKit's 52 shapes and the game's poses are both FACS-like, but they don't line up one to one. The game has more lip parts (`lips_together_up` and `_dn`, `lips_suck_*`, `lips_puff_*`, sticky corners), 16 tongue poses, throat poses, and the controls. A hand-made table would get the jaw and the big mouth shapes; it would miss the controls and the overrides.

**Proposed: learn it from the game.** For a few hundred of the game's lines (their `.wem` and their clip), run the chosen front end on the audio (route B) or on a video made from it (route C), then fit, per game track, a small model from the front end's curves (with a few frames of lead, the 60 to 70 ms Lipsync Animator measured). Overrides are set from their outputs (mostly the negative), envelopes from the speech's start and end. Score it as Lipsync Animator does: leave one character out, remake its lines, compare with CDPR's. The game's files stay on the modder's PC; EDGEfab ships the method, or only the fitted numbers (whether numbers fitted on game data may ship is a question for the owner).

One translation serves every front end that speaks ARKit's 52: Audio2Face (B), MediaPipe on any video (C, D). MetaHuman's controls would need their own fit.

## Recommendation

1. **Build the translation once, on ARKit's 52 shapes**, fitted on the game's own lines. It is the only missing piece and every route needs it.
2. **Feed it from audio first** (Audio2Face-3D, local and free), since a voiced line always has audio and the mouth is best from audio.
3. **Add video as a second front end** for performance: MediaPipe on a talking-head video (HeyGen, Hedra, VEED Fabric) or the modder's webcam, taking brows, eyes and head from the video and the mouth from audio, or both from the video when only a video exists.
4. **Keep Lipsync Animator as the baseline**: run it once on a test machine and score EDGE's clips against it. Its notes on the tracks match what was read here.
5. **Take the timing from EDGEwave**: a line voiced through ElevenLabs can come back with per-character timings, so the first version needs no aligner of its own ([below](#the-lip-sync-tab-a-proposal)).

## Experiments, smallest first

| # | Experiment | Answers |
|---|---|---|
| L1 | Export a game clip to glTF and import it back with WolvenKit's `ImportAnims`; compare the bytes or play both in the game | The write step through REDbridge (#14), with float tracks |
| L2 | MediaPipe on a HeyGen or Hedra video made from one game line's audio; plot its curves beside the game's clip | Whether video capture follows the game's mouth at all |
| L3 | Audio2Face-3D on the same line's audio; the same plot | Audio front end against video front end |
| L4 | Fit the translation on about 300 lines, score left-out characters | The long pole's quality, against Lipsync Animator's scores |
| L5 | A new line in a test scene with the made clip, a mod `.lipmap` and its ArchiveXL entry, watched in the game (REDnode) | The whole route |

## The Lip Sync tab: a proposal

Proposed by the owner on 2026-11-17: a command in EDGEfab opens a **Lip Sync** tab where the modder picks a character, sees and hears its lip synced lines, and adds new ones from typed text. The owner calls it a foundational capability for the platform, needed by EDGEdir (a face's lip sync lane) and EDGEquest (new voiced lines). **Where it goes in the build plan is for the EDGEfab build session to decide** (plan.md); this page proposes its shape and a course.

### Who owns what

| Part | Owner | Why |
|---|---|---|
| The tab, the made clip, the translation into the game's tracks | **EDGEfab** | A lip sync clip is one clip ([plan.md](plan.html), the split with EDGEdir, 2026-11-16) |
| The voice: cloned voice, speaking a line, re-voicing, the `.wem` | **EDGEwave** | It already does this through **ElevenLabs** (voice cloning and speech, with the modder's key), and has a Voice Lines contract with EDGEquest keyed by the line's decimal ruid. Its `.wem` route goes through the modder's own Wwise (spiked offline 2026-10-23, not finished) |
| The line in a scene: its id, the screenplay line's clip names, voice map, subtitles, the mod `.lipmap` and its ArchiveXL entry | **EDGEquest** | It owns scenes |
| Lip sync on a timeline: the face's lip sync lane, moods and gestures beside it | **EDGEdir** | It puts clips together; it asks EDGEfab for a line's clip |
| Game files: read clip tracks, write the `.anims` | **REDbridge** | Every game file read and write |
| Hearing and watching the line on a character in the game | **REDnode** | The running game |

The tab calls the other tools through their extension APIs and never does their part (docs/tools-together.md, rule 2). Every action is also an MCP tool (`fab_lipsync_*`), as every EDGEfab feature is.

### What the modder sees

**Pick a character, not a head.** Lip sync is stored per line, per speaking character (its voice tag), per scene and per language, and all heads share the same 414 tracks in the same order, so one clip plays on any head. The tab opens on a character (from a scene, an NPC's record, or the command's search), or on a scene's speaker; the head is only the preview, taken from the character's appearance.

| Part of the tab | What it shows | Comes from |
|---|---|---|
| Character | Name, voice tag, head | The scene's actor, or an NPC record and its appearance |
| Lines | Every lip synced line of the character, by scene: text, length, language | The `.lipmap` entries that list the voice tag; each clip name `f_<hex>` gives the line's id, the voice maps its `.wem`, the subtitles its text |
| A line | ▶ the audio; the clip as curves under the waveform: mouth (`LipsyncPoseOutput`), jaw, tongue, envelopes and JALI's controls | The `.anims` tracks (REDbridge), the `.wem` decoded (EDGEwave or REDcode) |
| **Add a Line** | Type the words (and a delivery note); voice it; see and hear the made clip; keep it | Below |
| Tune (later) | Nudge the timing, the strength per mouth part, edit keys on a curve | EDGEfab |
| **Watch in the Game** | The character spawned beside V says the line | REDnode |

A 3D face in the tab needs the head's `.facialsetup` decoded (its poses are binary data no tool reads yet). Until then the tab shows curves and the game shows the face. Decoding it is research of its own (R-face below).

### From a typed line to a clip

| Step | Done by | Automatic? |
|---|---|---|
| 1. The words, in English | The modder | Their input |
| 2. A new line id (a CRUID) | EDGEfab, or EDGEquest when the line is in a scene | Yes |
| 3. The voice: the character's cloned voice speaks the words | EDGEwave, Speak Line | Yes. The modder listens and asks for another take until it sounds right |
| 4. When each letter is spoken | ElevenLabs returns per-character start and end times with the speech when called with timestamps (`/v1/text-to-speech/{voice_id}/with-timestamps`). For Re-Voice (speech to speech) or a recorded line, ElevenLabs' forced alignment takes the audio and the words and returns the same | Yes, from EDGEwave, once it asks for the timings and passes them on (a request to EDGEwave). **Unverified:** that timings come with every model EDGEwave uses (v3 and its tags) and with cloned voices; that `normalized_alignment` covers text ElevenLabs rewrites (numbers) |
| 5. Letters to speech sounds | A pronunciation dictionary (CMUdict, BSD) with rules for unknown words, spread over each word's time | Yes |
| 6. Speech sounds to the game's tracks | EDGEfab's sound model, fitted on the game's own lines (the mouth 60 to 70 ms ahead of the voice, the overrides, the envelopes, JALI's controls) | Yes. **How good it looks is the research** (L4) |
| 7. Brows, eyes, head | The character's own from the game by default; from the voice's pitch and loudness later | Yes |
| 8. The `.anims` | REDbridge imports the made `.anims.glb` with its float tracks (REDbridge #14) | Yes, once #14 imports |
| 9. The `.wem` | EDGEwave's Wwise route | Yes, but **the modder must have Wwise installed**; that is heavy for a non-coder |
| 10. Into a scene: the line, its clip names, voice map, subtitles, the mod `.lipmap` and ArchiveXL entry | EDGEquest | Yes |
| 11. Check | REDnode plays the line on the character | The modder judges |

So the modder types, listens and approves. Everything else can run by itself. A shortcut to keep in view: Azure's speech returns 55 face blend shapes at 60 fps with its audio, but only in Azure's own voices; it could drive the mouth while ElevenLabs drives the sound, with the two time-matched. An option, not the plan.

### A course: phase FL, Lip sync

Proposed steps; the build session decides where they go. Each ends in a test, as every phase does.

| Step | What it builds | Needs first | Its test |
|---|---|---|---|
| **FL0 Checks** (no UI) | L1, the import round trip; ElevenLabs timings on the owner's key (v3, a cloned voice, a line with numbers); Lipsync Animator's baseline scores on a test machine | REDbridge #14's import | A game clip exported and imported back plays the same; timings match the audio |
| **FL1 See** | **EDGEfab: Open Lip Sync** (command, and on a character, a scene's speaker or an `.anims`); the tab: character, lines, ▶ audio, curves under the waveform. MCP `fab_lipsync_lines`, `fab_lipsync_line`. An API for EDGEdir and EDGEquest: a line's clip and its tracks | REDbridge: an `.anims` clip's tracks as data, many at once (`anims.info`/`infoMany`, already asked in #14); `.wem` to WAV (EDGEwave or REDcode) | Angie in `mq306_04b_angie_meeting`: her lines with text, audio and moving curves |
| **FL2 Make** | **Add a Line**: words to voice (EDGEwave), timings, sounds, the sound model v1, the `.anims` into the project. The fitting step: the model fitted on the modder's own game lines, scored by leaving characters out. MCP `fab_lipsync_make` | FL1; EDGEwave's timings; REDbridge #14 | Offline: the scores against CDPR's lines, beside Lipsync Animator's. Heard and seen as curves |
| **FL3 Into the game** | The made line in a scene with EDGEquest (line, voice map, subtitles, `.lipmap`, ArchiveXL) and its `.wem` from EDGEwave; **Watch in the Game** | FL2; EDGEquest's API for a new line; EDGEwave's `.wem` route; REDnode playing a line on a spawned character | **A new line, typed in EDGEfab, spoken in the game with moving lips** (the phase test) |
| FL4 Tune | Timing nudge, strength per part, curve keys; Re-Voice a game line (if a mod `.lipmap` can override a game entry, unverified) | FL3 | The owner tunes a line and sees it in the game |
| FL5 More inputs | Audio2Face-3D and video (MediaPipe on a talking-head video or a webcam) through ARKit's 52 shapes; other languages | FL2's fitting step | A line from video beside the same line from text |
| R-face (research) | Decode the `.facialsetup` poses for a 3D face in the tab (REDcode's viewer) | None | A clip plays on a head in the tab as it does in the game |

### Requests this needs (proposed; not filed)

| Tool | Request | For |
|---|---|---|
| REDbridge | #14 (open): `.anims` import from glTF **keeping float tracks**, and `anims.info`/`infoMany` returning a clip's tracks | FL0 to FL2 |
| EDGEwave | Speak Line with ElevenLabs timings (`with-timestamps`), forced alignment for Re-Voice and recorded lines; the timings beside the WAV (its `voice.json`) and through `EDGEwaveApi` | FL2 |
| EDGEwave | The `.wem` route finished (its V2 step 5) | FL3 |
| EDGEquest | An API to add a voiced line to a scene with given clip names, and to write the mod `.lipmap` and its ArchiveXL entry | FL3 |
| REDnode | Play a scene line (voice and lip sync) on a spawned character; #39 (play an animation on a spawned character) may cover part | FL3 |
| EDGEdir | Nothing new: it reads a line's clip through EDGEfab's API for its lip sync lane | FL1 |

The license boundary holds: ElevenLabs is reached through EDGEwave with the modder's key; Audio2Face, MediaPipe and video services are separate tools or services; WolvenKit only through REDbridge. Whether numbers fitted on the game's lines may ship with EDGEfab, or each modder fits on their own game, is the owner's question.

## Sources

- JALI and Cyberpunk: [80.lv, a new look at JALI](https://80.lv/articles/cyberpunk-2077-a-new-look-at-jali-tech-for-facial-animation); [TechSpot](https://www.techspot.com/news/87205-cd-projekt-red-used-ai-lip-sync-cyberpunk.html); [JALI research page](https://www.dgp.toronto.edu/~karan/jali/index.html); [JALI at Annecy 2025](https://www.gamedeveloper.com/press-release/jali-inc-returns-to-annecy-2025-to-showcase-next-gen-automated-facial-animation-tools-and-workflows)
- Community tools: [Lipsync Animator on GitHub](https://github.com/andreaolivato/cyberpunk2077-lipsync-animator) (its `docs/face-tracks.md`); [on Nexus](https://www.nexusmods.com/cyberpunk2077/mods/36187); [lipsync.tools](https://lipsync.tools/); RED modding wiki, [Generating vanilla lipsync animation sets](https://wiki.redmodding.org/cyberpunk-2077-modding/modding-guides/quest/generating-vanilla-lipsync-animation-sets)
- Audio to face: [Audio2Face-3D paper](https://arxiv.org/abs/2508.16401v1); [Audio2Face-3D SDK](https://github.com/NVIDIA/Audio2Face-3D-SDK); [NIM release notes](https://docs.nvidia.com/ace/audio2face-3d-microservice/2.0/text/changelog.html); [NGC catalog](https://catalog.ngc.nvidia.com/orgs/nim/teams/nvidia/containers/audio2face-3d); [MetaHuman audio-driven animation](https://dev.epicgames.com/documentation/metahuman/audio-driven-animation); [Speech Graphics, 80.lv](https://80.lv/articles/a-deep-dive-into-speech-graphics-facial-animation-solutions)
- Video to face: [MediaPipe Face Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker); [MetaHuman animation from mono video](https://dev.epicgames.com/documentation/metahuman/animation-from-mono-video); [DeepMotion face tracking FAQ](https://deepmotion.com/post/animate-3d-face-tracking-faq); [QuickMagic face mocap](https://www.quickmagic.ai/tools/face-mocap-ai); [Video2ARKitBlendshapes](https://github.com/hillday/Video2ARKitBlendshapes)
- Timings with speech: [ElevenLabs, convert with timestamps](https://elevenlabs.io/docs/fr/api-reference/text-to-speech/convert-with-timestamps.md); [ElevenLabs, streaming with timestamps](https://elevenlabs.io/docs/api-reference/streaming-with-timestamps); [ElevenLabs forced alignment (fal.ai listing)](https://fal.ai/models/fal-ai/elevenlabs/forced-alignment/api); [Azure, facial position with viseme](https://learn.microsoft.com/azure/ai-services/speech-service/how-to-speech-synthesis-viseme)
- Talking-head video: [VEED, best talking head APIs 2026](https://www.veed.io/learn/best-talking-head-video-apis); [VEED, best lip sync API](https://www.veed.io/learn/best-lipsync-api); [HeyGen, talking head APIs](https://www.heygen.com/blog/best-talking-head-video-apis); [Hedra, AI lip sync](https://mkt.hedra.com/uses/ai-lip-sync)
