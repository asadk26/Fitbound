import { inFrame, LM } from '../exercise/geometry';
import type { PoseFrame } from '../exercise/types';
import { VIEW_PARTS, type ViewPart, type ViewSummary } from './protocol';

const PART_LMS: Record<ViewPart, readonly number[]> = {
  head: [LM.NOSE],
  shoulders: [LM.L_SHOULDER, LM.R_SHOULDER],
  elbows: [LM.L_ELBOW, LM.R_ELBOW],
  wrists: [LM.L_WRIST, LM.R_WRIST],
  hips: [LM.L_HIP, LM.R_HIP],
  knees: [LM.L_KNEE, LM.R_KNEE],
  ankles: [LM.L_ANKLE, LM.R_ANKLE],
};

const SEEN = 0.5;

/**
 * What the camera can see, as words rather than pixels: which body parts are
 * visible and the body's bounding box in 0..1 frame coordinates. No frame at
 * all (nobody detected) reads as nothing seen.
 */
export function viewSummary(frame: PoseFrame | null): ViewSummary {
  const parts = {} as ViewSummary['parts'];
  let box: ViewSummary['box'] = null;
  for (const p of VIEW_PARTS) {
    let n = 0;
    for (const i of PART_LMS[p]) {
      const l = frame?.landmarks[i];
      if (!l || l.visibility < SEEN || !inFrame(l, frame!.aspect)) continue;
      n++;
      const x = l.x / frame!.aspect;
      box = box ? [Math.min(box[0], x), Math.min(box[1], l.y), Math.max(box[2], x), Math.max(box[3], l.y)] : [x, l.y, x, l.y];
    }
    // The head is one landmark: seen means fully seen.
    parts[p] = (p === 'head' ? n * 2 : n) as 0 | 1 | 2;
  }
  const r = (v: number) => Math.round(Math.max(-0.5, Math.min(1.5, v)) * 1000) / 1000;
  return { parts, box: box && (box.map(r) as ViewSummary['box']) };
}

const NAMES: Record<ViewPart, string> = { head: 'head', shoulders: 'shoulders', elbows: 'elbows', wrists: 'hands', hips: 'hips', knees: 'knees', ankles: 'feet' };

/** Plain-language list of what the camera is missing ("hands, feet"). */
export function missingParts(v: ViewSummary): { missing: string[]; partial: string[] } {
  const missing: string[] = [];
  const partial: string[] = [];
  for (const p of VIEW_PARTS) {
    if (v.parts[p] === 0) missing.push(NAMES[p]);
    else if (v.parts[p] === 1) partial.push(NAMES[p]);
  }
  return { missing, partial };
}
