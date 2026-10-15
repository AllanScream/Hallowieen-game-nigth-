# Prompts + job file for Kolya's 16-direction walk sheets (9 unique facings; the other 7 are mirrors).
# Each sheet: 5 x 2 grid = 8 walk frames + 2 idle frames, poses taken from a 3D mannequin guide (tools/mannequin.py).
#   python3 tools/walkjobs.py [tag ...]  -> art/prompts/k16_<tag>.txt, art/jobs_k16.json
import json, sys
VIEWS = {
    'p0':  "SIDE PROFILE facing RIGHT: he walks to the right across the image; we see his right side, his face in profile looking right",
    'p22': "PROFILE facing RIGHT, turned a little (about 20 degrees) toward the viewer: he walks to the right and slightly down; we see his right side and a bit of the front of his hoodie and face",
    'p45': "3/4 FRONT view facing DOWN-RIGHT: he walks toward the lower-right corner; we see his face and chest and his right side",
    'p67': "almost FRONT view facing DOWN and a little to the right (about 20 degrees right of straight toward the viewer): he walks toward the viewer; we see his face and the whole front of his hoodie, slightly turned to his left (our right)",
    'p90': "FRONT view: he walks straight toward the viewer (down the image); we see his face and the whole front of his hoodie, symmetric",
    'm22': "PROFILE facing RIGHT, turned a little (about 20 degrees) away from the viewer: he walks to the right and slightly up; we see his right side and a bit of his back; his face is in lost profile (cheek and ear, nose just visible)",
    'm45': "3/4 BACK view facing UP-RIGHT: he walks away from the viewer toward the upper-right corner; we see his back, the back of his hood and hair, and a little of his right cheek",
    'm67': "almost BACK view facing UP and a little to the right: he walks away from the viewer; we see his back, the back of his hood and hair, slightly turned so a bit of his right side shows",
    'm90': "BACK view: he walks straight away from the viewer (up the image); we see his back, the back of his hood and hair, symmetric, no face",
}
TPL = """SPRITE SHEET of the young man Kolya from Image 2 (identical face, messy light-brown hair, oversized black-brown hoodie, charcoal cargo trousers with side pockets, dark sneakers, same proportions, colours and pixel style); Image 3 is his turnaround sheet.
Image 4 is the POSE GUIDE: a 3D mannequin rendered from the game camera in a 5 x 2 grid of equal cells read left to right, top row frames 1-5, bottom row frames 6-10. Redraw Kolya in EXACTLY the mannequin's pose in every cell: the same leg angles, knee bends, which foot is forward, which foot is lifted, the same arm swing, the same body facing and the same place in the cell, standing on that cell's ground line, the same size in every cell (about 400 px tall). The mannequin's RED limbs are Kolya's RIGHT arm and leg, the BLUE limbs are his LEFT arm and leg. Do NOT draw the mannequin, the red and blue colours, the grey boxes, the lines or the numbers.
VIEW (all 10 frames): {view}; seen from the game's high camera (looking down about 30 degrees).
FRAMES 1-8 are one smooth WALK CYCLE (a relaxed stroll), every frame clearly different:
1 right foot forward touching down, left leg behind, legs apart; left arm forward, right arm back.
2 right foot planted under the body, left heel lifting behind.
3 left leg swinging forward past the right leg, left knee bent, left foot off the ground.
4 left leg reaching forward, right heel lifting.
5 left foot forward touching down, right leg behind, legs apart; right arm forward, left arm back.
6 left foot planted, right heel lifting behind.
7 right leg swinging forward past the left leg, right knee bent, right foot off the ground.
8 right leg reaching forward, left heel lifting.
FRAMES 9-10: standing still, relaxed, feet apart under the hips, arms hanging (10 is a tiny breathing variation of 9).
Hands relaxed and empty. Every figure complete and clean, identical character design, size and colours in all 10 frames, crisp pixel clusters, transparent background, no shadow, no ground, no text."""
tags = sys.argv[1:] or list(VIEWS)
jobs = []
for t in tags:
    open(f'art/prompts/k16_{t}.txt', 'w').write(TPL.format(view=VIEWS[t]))
    jobs.append({"name": f"k16_{t}", "prompt": f"art/prompts/k16_{t}.txt", "size": "1536x1024", "alpha": "native", "quality": "medium",
                 "ref": ["art/gen/kolya_se.png=Kolya, the current approved in-game sprite (identity, outfit, colours, pixel style)",
                         "refs/kolya.png=Kolya turnaround sheet: front, 3/4, side and back views",
                         f"art/guides/w16_{t}.png=POSE GUIDE only: 3D mannequin poses per frame (red = right limbs, blue = left limbs), 5 x 2 grid; do not draw it"]})
json.dump(jobs, open('art/jobs_k16.json', 'w'), indent=1, ensure_ascii=False)
print(len(jobs), 'jobs:', ' '.join(j['name'] for j in jobs))
