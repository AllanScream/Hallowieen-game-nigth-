# v7 art batch: Kolya with the phone flashlight / the airsoft rifle in 16 directions (9 drawn facings each), the raid cars facing
# east (they now drive in from Kolya's end of the street), the three «forgiven» pictures and backyard decor for the north of the map.
#   python3 tools/jobs7.py  -> art/prompts/*.txt, art/jobs_v7.json
import json, sys
sys.path.insert(0, 'tools')
from walkjobs import VIEWS                                    # the 9 facing descriptions (importing it also rewrites k16 prompts: harmless)
HOLD = {
    't': ("In his RIGHT hand he holds his black smartphone up in front of his chest like a flashlight, its back toward where he walks, "
          "and the phone's FLASHLIGHT is ON: a small, very bright white LED glowing on the back of the phone. The right arm stays raised holding "
          "the phone at chest height in EVERY frame (the mannequin's yellow block is the phone); only his LEFT arm swings with the walk.",
          "standing still, relaxed, holding the lit phone forward at chest height"),
    'r': ("He carries a black AIRSOFT assault rifle (M4 style carbine, short) with a bright ORANGE muzzle tip in BOTH hands at hip-ready: "
          "the stock tucked under his right arm against his side, the barrel pointing straight FORWARD in his walking direction and a little down, "
          "his left hand on the handguard. Both arms hold the rifle the same way in EVERY frame (the mannequin's black stick is the rifle); "
          "the orange tip is always clearly visible unless his body hides it.",
          "standing still, rifle held at hip-ready pointing forward"),
}
TPL = """SPRITE SHEET of the young man Kolya from Image 2 (identical face, messy light-brown hair, oversized black-brown hoodie, charcoal cargo trousers with side pockets, dark sneakers, same proportions, colours and pixel style); Image 3 is his turnaround sheet.
Image 4 is the POSE GUIDE: a 3D mannequin rendered from the game camera in a 5 x 2 grid of equal cells read left to right, top row frames 1-5, bottom row frames 6-10. Redraw Kolya in EXACTLY the mannequin's pose in every cell: the same leg angles, knee bends, which foot is forward, which foot is lifted, the same arms, the same body facing and the same place in the cell, standing on that cell's ground line, the same size in every cell (about 400 px tall). The mannequin's RED limbs are Kolya's RIGHT arm and leg, the BLUE limbs are his LEFT arm and leg. Do NOT draw the mannequin, the red and blue colours, the grey boxes, the lines or the numbers.
VIEW (all 10 frames): {view}; seen from the game's high camera (looking down about 30 degrees).
{hold}
FRAMES 1-8 are one smooth WALK CYCLE, every frame clearly different (the legs move a lot, readable even from the front and the back):
1 right foot forward touching down, left leg behind, legs apart.
2 right foot planted under the body, left heel lifting behind.
3 left leg swinging forward past the right leg, left knee bent high, left foot off the ground.
4 left leg reaching forward, right heel lifting.
5 left foot forward touching down, right leg behind, legs apart.
6 left foot planted, right heel lifting behind.
7 right leg swinging forward past the left leg, right knee bent high, right foot off the ground.
8 right leg reaching forward, left heel lifting.
FRAMES 9-10: {idle} (10 is a tiny breathing variation of 9).
Every figure complete and clean, identical character design, size and colours in all 10 frames, crisp pixel clusters, transparent background, no shadow, no ground, no text."""
jobs = []
for k, (hold, idle) in HOLD.items():
    for t, view in VIEWS.items():
        n = f'k16{k}_{t}'; open(f'art/prompts/{n}.txt', 'w').write(TPL.format(view=view, hold=hold, idle=idle))
        jobs.append({"name": n, "prompt": f"art/prompts/{n}.txt", "size": "1536x1024", "alpha": "native", "quality": "medium",
                     "ref": ["art/gen/kolya_se.png=Kolya, the current approved in-game sprite (identity, outfit, colours, pixel style)",
                             "refs/kolya.png=Kolya turnaround sheet: front, 3/4, side and back views",
                             f"art/guides/w16{k}_{t}.png=POSE GUIDE only: 3D mannequin poses per frame (red = right limbs, blue = left limbs, the held object in yellow or black), 5 x 2 grid; do not draw it"]})
CAR = ("The SAME vehicle as Image 2 (identical model, paint, markings, emblem, roof equipment and pixel style), now driving the OTHER way along the street: "
       "its long body axis still runs diagonally from the upper-right to the lower-left of the image (about 26 degrees from horizontal), but its FRONT points to the "
       "UPPER-RIGHT and its rear (tail lights, rear bumper) is at the LOWER-LEFT; we see its other side facing the viewer and the roof, exactly the camera and "
       "orientation of the car in Image 3. Seen from the game high camera: orthographic isometric 3/4 view looking down about 30 degrees. "
       "{extra} Isolated, no road, no shadow, centred, margin.")
for n, src, extra in [('car_police_e', 'car_police', 'The light bar on the roof stays off (no glow).'), ('car_army_e', 'car_army', 'The amber roof beacon stays off (no glow).')]:
    open(f'art/prompts/{n}.txt', 'w').write(CAR.format(extra=extra))
    jobs.append({"name": n, "prompt": f"art/prompts/{n}.txt", "size": "1024x1024", "alpha": "native", "quality": "medium",
                 "ref": [f"art/gen/{src}.png=the vehicle itself (identity, paint, markings) — currently facing the lower-left",
                         "art/gen/car_a.png=orientation reference only: a car whose front points to the upper-right (match this camera and direction)"]})
CG = """Image 1 is the STYLE reference: a warm painterly anime illustration of a Halloween night — match its art style, rendering, lighting (candles, jack-o'-lanterns, warm orange and purple glow), level of detail and mood. Wide 16:9 cinematic composition, no text, no captions, no speech bubbles, no watermark, no letters on any object.
Image 2 is the character sheet of {who}. Keep the face, hair and outfit identical to the sheet, drawn in the style of Image 1.
SCENE: {scene}"""
GIFTS = {
    'kirill': ('Kirill (young man with glasses, light-brown hair, grey hoodie)',
               'Kirill stands in the open doorway of his cosy house at night, porch lamp and jack-o\'-lanterns around him, holding up a tall black-and-red energy-drink can with a hammer drawn on it, grinning, giving a thumbs-up with the other hand; a bowl of Halloween candy on a stool next to him. Friendly, forgiving, a little bit smug. Medium shot.'),
    'raiva': ('Raiva (young man with black hair, glasses, dark hoodie over a red shirt — a programmer and sysadmin)',
              'Raiva sits at his desk in a dim room lit by monitors with code and a blinking server rack behind him, happily holding a new soldering iron with a small orange flame-shaped decoration on the handle, testing it on a circuit board with a tiny curl of smoke; a smile of a happy nerd. Medium shot.'),
    'elf': ('Elf (young woman with pointed elf ears, very long silver-white hair, light green eyes), wearing a white bedsheet ghost costume pushed back like a hood',
            'Elf on the porch of her house at night, motion-sensor floodlight above, holding a big glass of caramel latte with whipped cream and caramel drizzle in both hands, eyes closed with pleasure after the first sip, a soft forgiving smile; pumpkins and fallen maple leaves around. Medium close shot.'),
}
for k, (who, scene) in GIFTS.items():
    n = f'cg_gift_{k}'; open(f'art/prompts/{n}.txt', 'w').write(CG.format(who=who, scene=scene))
    jobs.append({"name": n, "prompt": f"art/prompts/{n}.txt", "size": "1536x1024", "alpha": "none", "quality": "high", "no_style_ref": True,
                 "ref": ["refs/party_style.png=STYLE reference (art style, lighting, mood)", f"refs/{k}.png=character sheet: {k}"]})
DECOR = {
    'shed': 'A small wooden garden shed in a backyard: dark weathered planks, a slanted shingle roof covered with fallen maple leaves, a small dusty window, a closed door with a hanging paper bat, a rake leaning against the wall.',
    'swingset': 'A wooden backyard swing set: an A-frame with two rope swings with wooden seats, one swing slightly moving, a small plastic jack-o\'-lantern hanging from the top beam, fallen leaves at the base.',
    'trampoline': 'A round backyard trampoline with a black mat, a blue padded rim and a safety net on poles, a few orange maple leaves lying on the mat.',
    'clothesline': 'A backyard clothesline between two T-shaped wooden posts with white sheets hanging on it, one sheet with two black eye holes like a Halloween ghost, a wicker laundry basket on the ground.',
    'pumpkin_patch': 'A small backyard vegetable bed of dark soil framed by planks, full of orange pumpkins of different sizes with curly green vines, a little scarecrow with a straw hat on a stick in the corner.',
    'greenhouse': 'A small backyard greenhouse: a metal frame with foggy glass panes, potted plants and tomato vines visible inside, a faint warm light inside, fallen leaves on its roof.',
}
for n, d in DECOR.items():
    open(f'art/prompts/{n}.txt', 'w').write(d + ' Seen from the game high camera, isometric 3/4 view, exactly the camera, scale and pixel style of Image 1. Night-time palette. Isolated, no ground, no shadow, centred, margin.')
    jobs.append({"name": n, "prompt": f"art/prompts/{n}.txt", "size": "1024x1024", "alpha": "native", "quality": "medium"})
json.dump(jobs, open('art/jobs_v7.json', 'w'), indent=1, ensure_ascii=False)
print(len(jobs), 'jobs:', ' '.join(j['name'] for j in jobs))
