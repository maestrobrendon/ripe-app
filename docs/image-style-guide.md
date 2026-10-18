# Basket image style guide

How every recipe and produce photo on Basket is made, so the library reads as one shoot. Built in Oct 2026 from a study of current HelloFresh, Mob, Sunbasket, Purple Carrot and Marley Spoon recipe imagery, then given a Lagos look of its own.

## Recipes (hero shot)

- **Angle:** straight overhead. Drinks may also be overhead (glass rims, sun caustics); never a tilted 3/4.
- **Frame:** 4:3 landscape. One dish, off-centre, filling about 60-70% of the width and touching or breaking one edge. About a quarter of the frame is bare surface.
- **Surface by category** (one grade across all):
  - Bowls, mains, wraps, soups: warm ochre limewash plaster.
  - Salads, sides, snacks: pale sage-green glazed square tiles.
  - Breakfast, smoothies, juices, drinks, desserts: warm cream terrazzo with ochre and grey chips.
- **Ware:** hand-thrown speckled stoneware (cream, deep green), white enamel with a navy rim, terracotta side dishes, ribbed glass tumblers.
- **Props (max two):** one plain steel fork or spoon on a rumpled faded indigo adire or natural cotton napkin; one small terracotta dish (lime wedges, yaji, groundnuts). A squeezed lime half is a recurring touch.
- **Plating:** in zones (grain on one side, protein fanned or heaped on the other, veg in wedges), sauce breaking into drips, a few torn herbs. Generous portions.
- **Light:** bright natural daylight from the top-left, short soft shadows to the lower-right, crisp highlights on sauce and glaze. Hard sun with glass caustics for drinks.
- **Grade:** bright, true-to-life, slightly warm, neutral whites, everything in focus.
- **Reads as real:** patchy uneven sear, irregular cuts, a few stray grains and crumbs, drips, creased linen.
- **Reads as AI, so avoid:** symmetry, uniform cubes, plastic gloss, steam, blurred background on an overhead shot, confetti garnish, cinematic teal/orange grade, too many props.

## Produce (product tile)

- **Angle and frame:** straight overhead, 1:1 square.
- **Surface:** plain warm off-white limewash plaster for every item, lots of clean space.
- **Arrangement:** a loose natural heap of the item as sold, plus one piece cut open to show the inside where that helps (fruit, tubers, peppers). Stems and leaves stay on. No other props.
- **Light and grade:** as recipes: top-left daylight, soft visible shadows, slightly warm.
- **Imperfection:** blemishes, dry stem ends, small leaf holes, a few water droplets.

## How the images are generated

- **Default:** Recraft `recraftv4_1_raster` text-to-image, 2 credits per image. Recipes 4:3, produce 1:1.
- **Local produce the model doesn't know** (ugu, efo, scent leaf, garden egg, agbalumo and similar): Recraft `image_edit` with `nano_banana_2`, 11 credits. Input 1 is a real photo of the item (e.g. Wikimedia Commons), input 2 is an approved Basket produce shot as the style reference. Upload local files with `request_upload_url` first; Recraft can't fetch Wikimedia URLs directly.
- `recraftv4_1_flash_raster` (1 credit) drops ingredients from the prompt; use it only for rough drafts.
