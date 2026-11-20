// Mouth shapes for live lip sync (docs/lipsync.md, "Live lip sync", spikes LS2 and LS4): a spoken line as a
// sequence of a few shapes, each one number, which the changed face graph turns into the game's lip sync tracks.
// Version 0: made by hand from how each sound is formed and the tracks' names, not fitted and not yet judged in
// the game. A track here is the pose's name; the graph adds to its `<name>LipsyncPoseOutput` track.

/** One mouth shape: the speech sounds it stands for and how far it moves each pose (0 to 1). */
export interface MouthShape {
  /** A short id, also the button's name in the test app. */
  id: string;
  /** What it is, in plain words. */
  says: string;
  /** Pose name to weight. */
  poses: Record<string, number>;
}

const sides = (name: string, weight: number): Record<string, number> => ({ [`lips_l_${name}`]: weight, [`lips_r_${name}`]: weight });
const apart = (weight: number): Record<string, number> => ({ lips_apart_up: weight, lips_apart_dn: weight });

/** The shapes, in the order the graph's feature carries them. Rest is no shape: every number at 0. */
export const MouthShapes: MouthShape[] = [
  { id: "aa", says: "open, as in father", poses: { jaw_mid_open: 0.7, ...apart(0.3) } },
  { id: "eh", says: "half open, as in bed or bit", poses: { jaw_mid_open: 0.4, ...apart(0.3), ...sides("corner_wide", 0.3) } },
  { id: "ee", says: "wide, as in see", poses: { jaw_mid_open: 0.2, ...apart(0.3), ...sides("corner_wide", 0.7) } },
  { id: "oh", says: "round and open, as in go", poses: { jaw_mid_open: 0.5, ...sides("funnel", 0.6) } },
  { id: "oo", says: "round and small, as in you or w", poses: { jaw_mid_open: 0.2, ...sides("purse", 0.8), ...sides("funnel", 0.4) } },
  { id: "mbp", says: "lips closed, as in m, b, p", poses: { lips_together_up: 1, lips_together_dn: 1 } },
  { id: "fv", says: "lower lip to the teeth, as in f, v", poses: { jaw_mid_open: 0.15, lips_suck_dn: 0.6, ...sides("upper_raise", 0.3) } },
  { id: "th", says: "tongue between the teeth, as in th", poses: { jaw_mid_open: 0.3, ...apart(0.3), tongue_mid_fwd: 0.8 } },
  { id: "tdn", says: "tongue tip up, as in t, d, n, l", poses: { jaw_mid_open: 0.3, ...apart(0.3), tongue_mid_tip_up: 0.8 } },
  { id: "kg", says: "back of the tongue up, as in k, g", poses: { jaw_mid_open: 0.35, ...apart(0.2), tongue_mid_base_up: 0.7 } },
  { id: "sz", says: "teeth together, as in s, z", poses: { jaw_mid_open: 0.1, ...apart(0.4), ...sides("corner_wide", 0.4) } },
  { id: "sh", says: "lips pushed out, as in sh, ch, j", poses: { jaw_mid_open: 0.2, ...apart(0.3), ...sides("funnel", 0.5), ...sides("purse", 0.3) } },
  { id: "r", says: "slightly round, as in r", poses: { jaw_mid_open: 0.25, ...sides("purse", 0.4), ...sides("funnel", 0.3) } },
];

/** How the numbers reach the face graph: an anim feature the changed graph declares (LS1: `SetInputFloat` does
 *  nothing, `ApplyFeature` works). The class is one of the game's own with enough floats; its field names mean
 *  nothing here, they are only slots. */
export const MouthFeature = {
  /** The feature's name in the graph, given to ApplyFeature. */
  name: "edgefab_mouth",
  /** The game class, as the graph names it and as scripts make it. */
  className: "animAnimFeature_FPPCamera",
  scriptName: "AnimFeature_FPPCamera",
  /** One slot per shape, in MouthShapes' order. */
  fields: ["fov", "deltaYaw", "deltaYawExternal", "deltaYawInput", "yawSpeed", "yawMaxLeft", "yawMaxRight", "deltaPitch", "deltaPitchExternal", "deltaPitchInput", "pitchSpeed", "pitchMin", "pitchMax"],
  /** 0: the graph eases each number toward what was sent; 1: it uses the number as sent. */
  raw: "resetYawSpeed",
} as const;

/** The feature's fields for these shape weights (by shape id; the others 0), ready for the game's `$new`. */
export function mouthFeatureFields(weights: Record<string, number>, raw = false): Record<string, number> {
  const out: Record<string, number> = { [MouthFeature.raw]: raw ? 1 : 0 };
  MouthShapes.forEach((shape, i) => (out[MouthFeature.fields[i]] = Math.max(0, Math.min(1, weights[shape.id] ?? 0))));
  return out;
}
