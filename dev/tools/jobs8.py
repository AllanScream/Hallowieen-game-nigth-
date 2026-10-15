# v8 art batch: (1) 8 more facings for Kolya's walk sheets -> 32 directions (free hands, phone light, rifle);
# (2) the rotten-pumpkin carry walk and (3) the action sheet (throw, reach, crouch) in 16 directions.
#   python3 tools/jobs8.py  -> art/guides/*, art/prompts/*.txt, art/jobs_v8.json
import json, subprocess, sys
sys.path.insert(0, 'tools')
from walkjobs import VIEWS as V9
import jobs7                                                  # HOLD texts and the 10-frame template (re-running it rewrites v7 prompts: harmless)
NEW = {
    'p11': (11.25, "PROFILE facing RIGHT, turned just a little (about 10 degrees) toward the viewer: he walks to the right; we see his right side and only a sliver of the front of his hoodie"),
    'p33': (33.75, "between PROFILE and 3/4 FRONT: facing RIGHT and DOWN-RIGHT, turned about 35 degrees toward the viewer; we see his right side and part of his face and chest"),
    'p56': (56.25, "3/4 FRONT view facing DOWN-RIGHT, turned well toward the viewer: we see most of his face and chest and a little of his right side"),
    'p78': (78.75, "almost FRONT view facing DOWN and only slightly to the right (about 10 degrees): we see his face and the whole front of his hoodie, almost symmetric"),
    'm11': (-11.25, "PROFILE facing RIGHT, turned just a little (about 10 degrees) away from the viewer: we see his right side and a sliver of his back; face in profile"),
    'm33': (-33.75, "between PROFILE and 3/4 BACK: facing RIGHT and UP-RIGHT, turned about 35 degrees away from the viewer; we see his right side and part of his back; face in lost profile"),
    'm56': (-56.25, "3/4 BACK view facing UP-RIGHT, turned well away from the viewer: we see most of his back, the back of his hood and hair, a little of his right cheek"),
    'm78': (-78.75, "almost BACK view facing UP and only slightly to the right: we see his back, the back of his hood and hair, almost symmetric, no face"),
}
PHI9 = {'p0': 0, 'p22': 22.5, 'p45': 45, 'p67': 67.5, 'p90': 90, 'm22': -22.5, 'm45': -45, 'm67': -67.5, 'm90': -90}
exag = lambda phi: 1.6 if abs(phi) >= 67 else 1.3 if abs(phi) >= 50 else 1.0
def guide(phi, out, *flags): subprocess.run(['python3', 'tools/mannequin.py', str(phi), out, *flags], check=True, capture_output=True)
FREE = ("His hands are empty and relaxed; both arms swing naturally with the walk (opposite to the legs).", "standing still, relaxed, feet apart under the hips, arms hanging")
CARRY = ("He carries a big ROTTEN pumpkin (dull orange with grey-green mold spots, a few flies, like Image 5) in BOTH hands in front of his belly, "
         "arms bent under it, in EVERY frame (the mannequin's orange ball is the pumpkin); it is heavy, so he leans back a little.",
         "standing still holding the rotten pumpkin in front of his belly")
REFS = lambda g, extra=(): ["art/gen/kolya_se.png=Kolya, the current approved in-game sprite (identity, outfit, colours, pixel style)",
                            "refs/kolya.png=Kolya turnaround sheet: front, 3/4, side and back views",
                            f"{g}=POSE GUIDE only: 3D mannequin poses per frame (red = right limbs, blue = left limbs, the held object coloured), do not draw it", *extra]
jobs = []
# (1) 32 directions: the 8 in-between facings for the three walk sets
for tag, (phi, view) in NEW.items():
    for k, flags, (hold, idle) in [('', ['--nopoint'], FREE), ('t', ['--hold', 'phone', '--nopoint'], jobs7.HOLD['t']), ('r', ['--hold', 'rifle2', '--nopoint'], jobs7.HOLD['r'])]:
        g = f'art/guides/w16{k}_{tag}.png'; guide(phi, g, *flags, '--exag', str(exag(phi))); n = f'k16{k}_{tag}'
        open(f'art/prompts/{n}.txt', 'w').write(jobs7.TPL.format(view=view, hold=hold, idle=idle))
        jobs.append({"name": n, "prompt": f"art/prompts/{n}.txt", "size": "1536x1024", "alpha": "native", "quality": "medium", "ref": REFS(g)})
# (2) carrying the rotten pumpkin, 16 directions
for tag, phi in PHI9.items():
    g = f'art/guides/w16c_{tag}.png'; guide(phi, g, '--hold', 'pumpkin', '--nopoint', '--exag', str(exag(phi))); n = f'k16c_{tag}'
    open(f'art/prompts/{n}.txt', 'w').write(jobs7.TPL.format(view=V9[tag], hold=CARRY[0], idle=CARRY[1]))
    jobs.append({"name": n, "prompt": f"art/prompts/{n}.txt", "size": "1536x1024", "alpha": "native", "quality": "medium", "ref": REFS(g, ["art/gen/rotten.png=the rotten pumpkin he carries"])})
# (3) actions, 16 directions: 3 x 2 grid
ACT = """SPRITE SHEET of the young man Kolya from Image 2 (identical face, messy light-brown hair, oversized black-brown hoodie, charcoal cargo trousers with side pockets, dark sneakers, same proportions, colours and pixel style); Image 3 is his turnaround sheet.
Image 4 is the POSE GUIDE: a 3D mannequin rendered from the game camera in a 3 x 2 grid of equal cells read left to right, top row frames 1-3, bottom row frames 4-6. Redraw Kolya in EXACTLY the mannequin's pose in every cell: the same leg and arm angles, the same lean, the same body facing and the same place in the cell, feet on that cell's ground line, the same size in every cell (about 400 px tall when standing). The mannequin's RED limbs are Kolya's RIGHT arm and leg, the BLUE limbs his LEFT arm and leg. Do NOT draw the mannequin, the colours of the guide, the grey boxes, the lines or the numbers.
VIEW (all 6 frames): {view}; seen from the game's high camera (looking down about 30 degrees).
1 standing relaxed, arms hanging.
2 overhand THROW wind-up: the right arm raised back behind his head holding a white egg, the left arm stretched forward, weight on the back (right) foot, body twisted back.
3 the RELEASE: the right arm whipping forward at head height, the egg just leaving his fingers, the body leaning forward, weight moving onto the front (left) foot.
4 FOLLOW-THROUGH: the right arm swung down and across his body, leaning forward, the right foot lifting behind him.
5 reaching his right arm straight forward at chest height (pressing a doorbell or touching a door handle), the left arm relaxed.
6 CROUCHING low, knees deeply bent, the right hand reaching down to the ground in front of him (picking something up).
Every figure complete and clean, identical character design and colours in all 6 frames, crisp pixel clusters, transparent background, no shadow, no ground, no text, no egg anywhere except in frames 2-3."""
for tag, phi in PHI9.items():
    g = f'art/guides/wa_{tag}.png'; guide(phi, g, '--actions'); n = f'ka_{tag}'
    open(f'art/prompts/{n}.txt', 'w').write(ACT.format(view=V9[tag].replace('he walks', 'he faces').replace('walks', 'faces')))
    jobs.append({"name": n, "prompt": f"art/prompts/{n}.txt", "size": "1536x1024", "alpha": "native", "quality": "medium", "ref": REFS(g)})
json.dump(jobs, open('art/jobs_v8.json', 'w'), indent=1, ensure_ascii=False)
print(len(jobs), 'jobs')
