# Basket: Menu Research (draft v1)

*Prepared 10 Oct 2026 for Basket, Lagos. This is research and a draft. Check prices and stock with suppliers before anything goes live.*

**How to read this doc**

- `slug` = an item already in the Basket catalogue (from `prisma/seed.ts`; pre-cut Fresh Cuts and box bundles are left out).
- `slug†` = a **suggested addition** (not in the catalogue yet). The slug is only a proposal.
- **Basket share "N of M (today K)"**: M is every non-pantry ingredient. N is how many Basket would supply once the † additions exist. K is how many it supplies with today's catalogue.
- **Pantry basics** (not counted): salt, black pepper, cooking oil, water, sugar, and the usual dried spices a Lagos kitchen already has (curry powder, paprika, cumin, chilli flakes, dried thyme). This is a slightly wider definition than "salt, oil, pepper, water". If the team wants it strict, count the spices as "grab it elsewhere".
- Copy is about food (flavour, speed, freshness). No health or medical claims.

**Today's catalogue (54 fresh SKUs)**

- **Fruit:** pineapple, watermelon, pawpaw, banana, orange, apple, green-apple, pear, mango, avocado, lime, tangerine, guava, passion-fruit, coconut, young-coconut, dates, raspberries, blueberries, blackberries, red-grapes, green-grapes, black-grapes, peaches, nectarines.
- **Vegetables:** spinach (efo tete), ugu, scent-leaf, chilli, ginger, tomato, beef-tomato, bell-pepper, carrot, onion, cucumber, plantain, sweet-potato, cabbage, beetroot, mushrooms, iceberg-lettuce, romaine-lettuce, salad-mix.
- **Herbs:** thyme, rosemary, parsley, mint.
- **Seasonal:** corn, garden-egg, agbalumo, velvet-tamarind, green-mango.

---

## 1. Produce available in Nigeria / Lagos markets

**Sources and caveats**

- Month-by-month timing is mostly from Kitchen Butterfly's *Seasonal Guide to Nigerian Fruits & Vegetables* V1.3 (2018) ([PDF](https://www.kitchenbutterfly.com/wp-content/uploads/2018/01/2018_Nigerian_SeasonalProduceCalendar_V1.3.pdf), [article](https://kitchenbutterfly.com/2016/in-season-nigerias-1st-seasonal-produce-calendar)). It is national rather than Lagos-specific, and its month grid didn't extract cleanly, so treat its months as approximate. It lists bananas, oranges, pawpaw, pineapple and watermelon as available all year.
- Mile 12 is Lagos's main wholesale produce hub. It is open 24 hours, aggregates produce from northern Nigeria and neighbouring countries, and is known for tomatoes, peppers, carrots, green beans, leafy vegetables, apples, grapes and oranges ([BusinessDay](https://archive.businessday.ng/features/article/mile-12-market-preferred-destination-for-lagos-wholesalers-retailers/), [ColdHubs](https://coldhubs.com/?p=1231)).
- Plateau State (Jos) supplies most "temperate" vegetables, including about 90% of Nigeria's Irish potatoes ([PotatoPro 2025](https://www.potatopro.com/node/168517), [FreshPlaza](https://www.freshplaza.com/africa/article/9643766/irish-potato-harvest-commences-in-nigeria/)).
- NIHORT is the federal institute for fruit and vegetable research; it lists tomato, pepper, okra and onion as major fruiting vegetables ([Gazette NGR](https://gazettengr.com/vegetable-production-fortune-changer-for-farmers-nihort/)).
- Tomato prices swing hard with the season ([HortiDaily](https://www.hortidaily.com/article/9793370/nigeria-s-tomato-supply-rises-ahead-of-december-demand)).
- **Not verified online:**
  - Shoprite, Spar and Prince Ebeano don't publish produce lists or prices I could reach.
  - Zucchini, coriander, eggplant, kale and rocket in Lagos are based on general trade knowledge plus one Lagos premium-veg supplier listing ([Pegga Ventures](https://connectciti.com/listing/pegga-ventures): broccoli, spring onions). Confirm these with suppliers before listing them.
- **"Imported"** here means mostly flown or shipped in (South Africa, Europe, Middle East). These items are priced in dollars and their prices move with the naira.

**Season codes:** **YR** = year-round. **Peak** = when it is cheapest or best. **Dry** ≈ Nov–Mar. **Rains** ≈ Apr–Oct, with a short "August break".

### Fruit

| # | Produce | Local name(s) | Season / availability | Local vs imported | Basket status |
|---|---|---|---|---|---|
| 1 | Pineapple | Ọ̀pẹ̀ òyìnbó (Yo), akwụ oyibo (Ig), abarba (Ha) | YR | Local | `pineapple` |
| 2 | Watermelon | Bàrà (Yo), kankana (Ha) | YR; peak dry season (northern supply) | Local | `watermelon` |
| 3 | Pawpaw / papaya | Ìbẹ́pẹ (Yo), gwanda (Ha) | YR | Local | `pawpaw` |
| 4 | Banana | Ọ̀gẹ̀dẹ̀ wẹ́wẹ́ (Yo), ayaba (Ha) | YR | Local | `banana` |
| 5 | Sweet orange | Ọsàn (Yo), lemu (Ha) | YR; best Oct–Jan | Local | `orange` |
| 6 | Tangerine | — | Mainly late dry season; exact months uncertain | Local + imported | `tangerine` |
| 7 | Lime | Ọsàn wẹ́wẹ́ / "lemon" in everyday speech | YR, peaks mid-year | Local | `lime` |
| 8 | Lemon (true yellow lemon) | — | YR in supermarkets | Mostly imported, some local | `lemon†` |
| 9 | Grapefruit / shaddock | — | ~Sep–Dec | Local | suggested (`grapefruit†`), low priority |
| 10 | Mango (assorted) | Mángòrò (Yo), mangwaro (Ha) | Peak Mar–Jun; patchy off-season | Local | `mango` |
| 11 | Green (unripe) mango | — | Feb–May (pre-season) | Local | `green-mango` |
| 12 | Avocado | "Pear" (Lagos), ube oyibo (Ig) | Two windows: roughly Jan–May and Sep–Dec (uncertain) | Local; imported fills gaps | `avocado` |
| 13 | Guava | Gova | Peak rains ~Jul–Sep | Local | `guava` |
| 14 | Passion fruit | — | Most of the year; peaks ~Aug–Mar (Plateau-grown) | Local | `passion-fruit` |
| 15 | Coconut (mature) | Àgbọn (Yo), aki oyibo (Ig), kwakwa (Ha) | YR (Badagry / coastal) | Local | `coconut` |
| 16 | Young / green coconut | — | YR | Local | `young-coconut` |
| 17 | Fresh dates | Dàbínò (Ha) | ~May–Oct (northern harvest); dried dates YR | Local (north) + imported dried | `dates` |
| 18 | African star apple | Agbalumo (Yo), udara (Ig) | Dry season ~Dec–Apr | Local | `agbalumo` |
| 19 | Velvet tamarind | Awin (Yo), icheku (Ig), tsamiyar biri (Ha) | Dry season ~Dec–Apr (uncertain) | Local | `velvet-tamarind` |
| 20 | Soursop | Ẹ̀kọ òyìnbó / abo | Several short harvests; KB marks early year | Local | `soursop†`, good for smoothies |
| 21 | Cashew apple | Kaju | ~Feb–Apr | Local | niche; not recommended (bruises fast) |
| 22 | African pear / bush pear | Ube (Ig), elemi | ~Jun–Sep | Local | niche, eaten cooked; skip for global menu |
| 23 | Hog plum | Iyeye (Yo) | ~Feb–May (KB) | Local | niche |
| 24 | Jackfruit | — | ~Apr–Jul (KB) | Local, scarce | skip |
| 25 | Apple (red) | — | YR | Imported | `apple` |
| 26 | Green apple | — | YR | Imported | `green-apple` |
| 27 | Pear | — | YR, patchy | Imported | `pear` |
| 28 | Grapes (red / green / black) | — | YR in supermarkets and Mile 12 | Imported | `red-grapes`, `green-grapes`, `black-grapes` |
| 29 | Peaches / nectarines | — | Mostly Nov–Apr (Southern Hemisphere season); uncertain off-season | Imported | `peaches`, `nectarines` |
| 30 | Raspberries / blueberries / blackberries | — | Patchy and expensive; frozen is more reliable | Imported | `raspberries`, `blueberries`, `blackberries` |
| 31 | Strawberries | — | Small Plateau dry-season crop; otherwise imported | Mixed, uncertain | suggested (`strawberries†`), low priority |
| 32 | Pomegranate | — | Seasonal imports | Imported | suggested (`pomegranate†`), garnish only |
| 33 | Plantain | Ọ̀gẹ̀dẹ̀ àgbagbà (Yo), ogede (Ig) | YR | Local | `plantain` |

### Fruiting and other vegetables

| # | Produce | Local name(s) | Season / availability | Local vs imported | Basket status |
|---|---|---|---|---|---|
| 34 | Tomato | Tòmátì (Yo), tumatur (Ha) | YR; **cheapest ~Dec–Apr** (northern dry-season crop), **scarce and expensive ~May–Aug** | Local | `tomato` |
| 35 | Beefsteak tomato | — | YR (greenhouse) | Local greenhouse + imported | `beef-tomato` |
| 36 | Cherry tomato | — | Greenhouse farms; patchy | Local greenhouse | suggested (`cherry-tomato†`) |
| 37 | Bell pepper / red long pepper | Tàtàṣé (Yo) | YR; greenhouse bells are steadier | Local | `bell-pepper` |
| 38 | Scotch bonnet / chilli | Ata rodo (Yo), ose (Ig) | YR | Local | `chilli` |
| 39 | Onion (mostly red-skinned) | Àlùbọ́sà (Yo), albasa (Ha) | YR; northern harvest Feb–May | Local | `onion` |
| 40 | Spring onion | Àlùbọ́sà eléwé | YR in Lagos markets | Local | **`spring-onion†`** |
| 41 | Garlic | Ayù (Yo), tafarnuwa (Ha) | YR | Local (Kano / Kebbi) + Chinese imports | **`garlic†`** |
| 42 | Ginger | Atalẹ̀ (Yo), citta (Ha) | YR; Kaduna harvest ~Nov–Feb | Local | `ginger` |
| 43 | Fresh turmeric | Atalẹ̀ pupa | YR in markets (KB lists it) | Local | suggested (`turmeric†`) |
| 44 | Carrot | — | YR; best Oct–Dec (KB) | Local (Plateau, Kano) | `carrot` |
| 45 | Cucumber | Kúkúmbà | YR; peak ~Sep–Oct (KB) | Local | `cucumber` |
| 46 | Cabbage (green) | — | YR | Local (Plateau) | `cabbage` |
| 47 | Red cabbage | — | Supermarkets, patchy | Local (Plateau), limited | suggested (`red-cabbage†`) |
| 48 | Green beans | — | YR (Plateau) | Local | suggested (`green-beans†`) |
| 49 | Okra | Ila (Yo), okwuru (Ig), kubewa (Ha) | YR; peak rains | Local | suggested (`okra†`); fits stir-fries |
| 50 | Garden egg (white / green) | Igbá (Yo), anara (Ig), gauta (Ha) | Most of the year; peaks vary | Local | `garden-egg` |
| 51 | Purple eggplant / aubergine | — | Supermarkets and greenhouse; patchy | Local greenhouse, limited | suggested (`eggplant†`), **availability uncertain** |
| 52 | Zucchini / courgette | — | Premium supermarkets; patchy | Local greenhouse / Plateau, limited | suggested (`zucchini†`), **availability uncertain** |
| 53 | Broccoli | — | Supermarkets; expensive | Local (Plateau) + imported | suggested (`broccoli†`) |
| 54 | Cauliflower | — | Supermarkets; expensive | Local (Plateau) + imported | suggested (`cauliflower†`) |
| 55 | Fresh maize (corn) | Àgbàdo (Yo), ọka (Ig), masara (Ha) | Main ~Apr–Aug, second ~Sep–Oct | Local | `corn`. Note: local maize is starchier than imported sweetcorn |
| 56 | Sweetcorn (true sweet variety) | — | Patchy | Imported / some greenhouse | treat as a `corn` variant |
| 57 | Button mushrooms | Olú | YR in supermarkets | Local growers + imported | `mushrooms` |
| 58 | Beetroot | — | YR | Local (Plateau) | `beetroot` |
| 59 | Pumpkin / butternut | Ẹ̀lẹ́gẹ́dẹ́ (pumpkin) | Local pumpkin in the rains; butternut patchy | Local; butternut limited | suggested (`pumpkin†`) |
| 60 | Celery | — | Supermarkets, patchy | Mostly imported | low priority |
| 61 | Leek | — | Patchy | Local (Plateau), limited | low priority |
| 62 | Bitter gourd | Ejirin | Seasonal | Local | skip |

### Leafy greens

| # | Produce | Local name(s) | Season / availability | Local vs imported | Basket status |
|---|---|---|---|---|---|
| 63 | Green amaranth ("spinach") | Ẹ̀fọ́ tẹ̀tẹ̀ (Yo), inine (Ig), alayyafo (Ha) | YR; peak rains | Local | `spinach`. Note: this is amaranth, not European spinach |
| 64 | Fluted pumpkin leaf | Ugu (Ig) | YR | Local | `ugu` |
| 65 | Lagos spinach (celosia) | Ẹ̀fọ́ ṣọ́kọ̀ (Yo) | YR | Local | suggested (`efo-shoko†`), works as a cooked green |
| 66 | Waterleaf | Gbúre (Yo), mmong mmong ikong (Ef) | YR; peak rains | Local | suggested (`waterleaf†`), mostly for traditional cooking |
| 67 | Jute mallow | Ewédú (Yo), rama (Ha) | YR | Local | traditional; low priority |
| 68 | Bitter leaf | Ewúro (Yo), onugbu (Ig) | YR | Local | traditional; low priority |
| 69 | Moringa leaf | Ewé igbálẹ̀, zogale (Ha) | YR | Local | suggested for smoothies (`moringa†`), copy must stay food-only |
| 70 | Uziza leaf | — | YR | Local | niche |
| 71 | Iceberg lettuce | — | YR (Plateau / greenhouse); wilts in the heat | Local | `iceberg-lettuce` |
| 72 | Romaine / cos lettuce | — | YR (greenhouse) | Local | `romaine-lettuce` |
| 73 | Mixed salad leaves | — | YR (greenhouse) | Local greenhouse | `salad-mix` |
| 74 | True spinach (*Spinacia*) | — | Rare | Plateau / greenhouse, uncertain | skip for now |
| 75 | Kale / rocket | — | Urban greenhouse farms only | Local, uncertain | watch list |

### Herbs

| # | Produce | Local name(s) | Season / availability | Local vs imported | Basket status |
|---|---|---|---|---|---|
| 76 | Scent leaf (clove basil) | Efinrin (Yo), nchanwu (Ig), daidoya (Ha) | YR | Local | `scent-leaf` |
| 77 | Sweet basil | — | Greenhouse / supermarkets | Local greenhouse | suggested (`basil†`) |
| 78 | Coriander / cilantro | — | Lagos supermarkets and some herb sellers; grown in the north | Local + imported | **`coriander†`** |
| 79 | Parsley | — | YR in supermarkets | Local greenhouse + imported | `parsley` |
| 80 | Mint | Ewé mínítì | YR; grows easily locally | Local | `mint` |
| 81 | Thyme (fresh) | — | Supermarkets | Mostly imported / greenhouse | `thyme` |
| 82 | Rosemary | — | Supermarkets | Mostly imported / greenhouse | `rosemary` |
| 83 | Lemongrass | Ewé tii, koko oba | YR | Local | suggested (`lemongrass†`) |

### Roots and tubers

| # | Produce | Local name(s) | Season / availability | Local vs imported | Basket status |
|---|---|---|---|---|---|
| 84 | Sweet potato | Ọ̀dùnkún (Yo) | YR | Local | `sweet-potato` |
| 85 | Irish potato | — | YR; Plateau rain-fed harvest mid-year plus dry-season crop | Local (Plateau) | suggested (`irish-potato†`) |
| 86 | Yam | Iṣu (Yo), ji (Ig), doya (Ha) | Old yam YR; **new yam ~Aug–Oct** | Local | suggested (`yam†`), Family boxes |
| 87 | Cocoyam / taro | Kókò, ede (Ig) | Rainy season | Local | skip for global menu |
| 88 | Cassava (fresh) | Ẹ̀gẹ́ | YR (mostly processed) | Local | skip |
| 89 | Tiger nut | Ọ̀fió (Yo), aya (Ha) | Dry season (KB) | Local | suggested (`tiger-nut†`), tiger-nut milk smoothies |

That's 89 items. The 54 in-catalogue items appear above, with grapes and berries grouped into single rows.

---

## 2. Recipe patterns scouted from meal-kit and recipe sites

Coverage notes:

- **BBC Good Food:** it blocks my crawler, so I couldn't cite any of its pages.
- **Green Chef:** its recipe pages weren't indexed in search.
- **Instead,** the patterns below come from Mob, HelloFresh (UK/CA/NZ/US), Blue Apron, and a couple of public recipe frameworks. Every link below came up in my searches.

| # | Format | Why it works for Basket | Example source(s) |
|---|---|---|---|
| 1 | **Shawarma / kebab bowl** (spiced meat on a chopped salad with yogurt-garlic sauce) | Mostly salad by volume; very familiar in Lagos | [Mob: Spiced Chicken Shawarma Rice Bowl](https://www.mob.co.uk/recipes/spiced-chicken-shawarma-rice-bowl) · [HelloFresh CA: Shawarma-Style Chicken Bowls (card)](https://hellofresh.ca/recipecards/card/6674c6263d7908a0f17bc535-en-CA.pdf) |
| 2 | **Street-style wrap** (protein, crunchy slaw, sauce, flatbread) | One bought item (bread), the rest is produce | [Mob: Homemade Chicken Shawarma](https://www.mob.co.uk/recipes/chicken-shawarma) · [Mob: Chicken Skewer Naan Wraps](https://www.mob.co.uk/recipes/chicken-skewer-naan-wraps) |
| 3 | **Veg-forward tacos with crema** (roast veg, beans, avocado) | Sweet potato, avocado, lime are all Basket items | [HelloFresh: Sweet Potato & Black Bean Tacos (card)](https://www.hellofresh.com/recipecards/card/sweet-potato-and-black-bean-tacos-5b47c48630006c27ae498513-045f5c93.pdf) · [Blue Apron: Veggie Tacos (card)](https://media.blueapron.com/recipes/33183/c_card_pdfs/1659625156-15110-0020-9414/2PV2_VeggieTacos__WEB.pdf) · [Blue Apron: Paneer Veggie Tacos (card)](https://media.blueapron.com/recipes/37368/c_card_pdfs/1678300569-49-0135-3337/2PRE22_PaneerVeggieTacos_WEB.pdf) |
| 4 | **Fruit salsa on a protein** (mango, pineapple, chilli, lime) | Uses Basket's strongest local fruit | [Mob: Spiced Fish with Mango Salsa](https://www.mob.co.uk/recipes/mobs-caribbean-fish) · [Mob: Creamy Spiced Chickpeas with Mango Salsa](https://www.mob.co.uk/recipes/creamy-spiced-chickpeas-with-mango-salsa-crispy-tofu) |
| 5 | **Fruit-and-chicken skewers with a fruit salad** | Grill-friendly; mango on two fronts | [Mob: Basil Chicken Skewers with Mango Salad](https://www.mob.co.uk/recipes/basil-chicken-skewers-with-mango-salad) |
| 6 | **Halloumi and herb salad bowl** | One cheese item plus produce | [Mob: Halloumi, Tomato, Chickpea & Herb Salad Bowl](https://www.mob.co.uk/recipes/halloumi-tomato-chickpea-herb-salad-bowl) · [HelloFresh UK: Healthy Halloumi Bowl (card)](https://hellofresh.co.uk/recipecards/card/healthy-halloumi-bowl-5de7c1911d397356fc5d159c-ddc8fd90.pdf) |
| 7 | **Stone fruit and salty cheese** (peach/nectarine, halloumi, hot honey) | Makes use of the imported premium fruit | [Mob: Hot Honey Halloumi & Crispy Rice Bowl](https://www.mob.co.uk/recipes/hot-honey-halloumi-crispy-rice-bowl) |
| 8 | **Bread salad (fattoush)** | Lettuce, tomato, cucumber, herbs: almost all Basket | [HelloFresh NZ: Honey Halloumi & Fattoush Salad](https://www.hellofresh.co.nz/recipes/honey-halloumi-and-fattoush-salad-6840cf6b6329c8e5b722cdb4) |
| 9 | **Thai-style shredded salads** (som tam, chopped salads) | Green mango, carrot, cucumber, chilli, lime | [Mob: Thai Prawn Mango Som Tam Salad](https://www.mob.co.uk/recipes/thai-prawn-mango-som-tam-salad) · [Mob: Thai-Inspired Chicken & Mango Chopped Salad](https://www.mob.co.uk/recipes/thai-inspired-chicken-mango-chopped-salad) · [Mob: Chopped Salad collection](https://www.mob.co.uk/recipes/collections/best-chopped-salad-recipes) |
| 10 | **Noodle salads** (cold noodles, herbs, crunchy veg) | Herbs and cucumber carry the dish | [Mob: Shredded Chicken Noodle Salad](https://www.mob.co.uk/recipes/shredded-chicken-noodle-salad) · [Mob: Chicken Soba Noodle Salad](https://mob.co.uk/recipes/chicken-soba-noodle-salad) |
| 11 | **Lettuce cups** (larb-style mince in lettuce) | The lettuce replaces the carb, so the dish is mostly produce | [Mob: Thai Steak Salad Lettuce Cups](https://www.mob.co.uk/recipes/thai-steak-salad-lettuce-cups) · [Mob: Pork Lettuce Cups](https://www.mob.co.uk/recipes/pork-lettuce-cups) |
| 12 | **15–30 min stir-fry** (peppers, carrot, beans, ginger, garlic) | Classic meal-kit format; buyers bring only noodles and sauce | [HelloFresh UK: Hoisin Chicken Stir-Fry](https://www.hellofresh.co.uk/recipes/hoisin-chicken-stir-fry-5f184fdb787cc57f4f2b1b79) · [HelloFresh UK: Fragrant Veggie Noodle Stir-Fry](https://www.hellofresh.co.uk/recipes/fragrant-chicken-noodle-stir-fry-6633506c270adf4f95c58165) · [HelloFresh CA: Honey-Sesame Halloumi Stir-Fry](https://www.hellofresh.ca/recipes/superquick-honey-sesame-halloumi-stir-fry-6a0b28af87acb8550baec7df) |
| 13 | **Veg fried rice** (day-old rice and a lot of veg) | Uses up the end-of-week veg; Lagos already loves fried rice | [Mob: Veggie Egg Fried Rice](https://www.mob.co.uk/recipes/veggie-egg-fried-rice) · [Mob: Fajita Fried Rice](https://www.mob.co.uk/recipes/fajita-fried-rice) |
| 14 | **Burrito / rice bowls** (rice, beans, salsa, avocado) | Kids can build their own; good for Family | [Mob: Easy Burrito Bowl](https://www.mob.co.uk/recipes/easy-burrito-bowl) · [Mob: Spicy Chicken Laab Rice Bowl](https://www.mob.co.uk/recipes/spicy-chicken-laab-rice-bowl) |
| 15 | **Roast-veg grain bowl** (one tray of roast veg, grain, greens, dressing) | Template recipe that rotates with the season | [BMC: Grain Bowl Framework](https://bmc.org/recipes/grain-bowl-framework) · [American Heart Association: Roasted Vegetable Grain Bowl](https://recipes.heart.org/en/recipes/hcm-roasted-vegetable-grain-bowl) |
| 16 | **Smoothie and smoothie bowl** | 100% fruit; links to the existing Smoothie and Recovery boxes | [Mob: Tropical Sunshine Smoothie](https://www.mob.co.uk/recipes/tropical-sunshine-smoothie) · [Mob: Tropical Sunshine Smoothie Bowl](https://www.mob.co.uk/recipes/tropical-sunshine-smoothie-bowl) |
| 17 | **Smashed cucumber salad** | Viral format, only 3–4 ingredients, uses cucumber | [Mob: Crispy Rice & Smashed Cucumber Salad](https://www.mob.co.uk/recipes/crispy-rice-and-smashed-cucumber-salad) |

**Patterns across the sites**

- **One protein, one carb, everything else fresh.** That split is what makes about 80% produce achievable.
- **A "hero sauce" made from produce.** Examples: avocado crema, garlic-yogurt, lime-chilli dressing, herb pesto.
- **Crunch from raw veg** (slaw, pickled onion) instead of fried toppings.
- **20–35 minute cook times and 4–6 steps** on nearly every meal-kit card.

---

## 3. Recipe library draft (30 recipes)

Goal tags: **Lighter** (weight management) · **Training** (post-workout recovery) · **Family** (household) · **Everyday** (general wellness).

### Summary table

| # | Recipe | Tags | Time | Serves | Diff. | Basket share |
|---|---|---|---|---|---|---|
| 1 | Crunchy Chicken Shawarma Bowl | Lighter, Training | 35 | 4 | Easy | 9 of 11 (today 8) |
| 2 | Lagos-Night Shawarma Wraps | Family, Everyday | 30 | 4 | Easy | 10 of 12 (today 9) |
| 3 | Mango-Chilli Chicken Skewers & Mango Salad | Training, Everyday | 30 | 4 | Easy | 9 of 11 (today 7) |
| 4 | Sweet Potato & Black Bean Tacos | Family, Everyday | 35 | 4 | Easy | 8 of 10 (today 7) |
| 5 | Green Mango Crunch Salad (som tam-style) | Lighter | 20 | 2 | Easy | 9 of 11 (today 7) |
| 6 | Halloumi, Tomato & Herb Bowl | Lighter, Everyday | 25 | 2 | Easy | 8 of 10 (today 6) |
| 7 | Fattoush Crunch Salad | Lighter, Family | 20 | 4 | Easy | 9 of 10 (today 7) |
| 8 | Ginger Chicken & Veg Noodle Stir-fry | Family, Training | 25 | 4 | Easy | 10 of 13 (today 8) |
| 9 | Mushroom, Greens & Ginger Rice Bowl | Lighter, Everyday | 20 | 2 | Easy | 8 of 10 (today 6) |
| 10 | Rainbow Veggie Egg Fried Rice | Family, Everyday | 25 | 4 | Easy | 9 of 12 (today 6) |
| 11 | Fresh Burrito Bowl | Family, Training | 30 | 4 | Easy | 9 of 11 (today 8) |
| 12 | Roast Root Grain Bowl, Lime-Tahini | Everyday, Lighter | 40 | 4 | Easy | 8 of 10 (today 7) |
| 13 | Dodo & Beans Power Bowl | Training, Family | 30 | 2 | Easy | 8 of 10 (today 7) |
| 14 | Tropical Sunshine Smoothie | Everyday, Training | 5 | 2 | Easy | 6 of 7 (today 6) |
| 15 | Green Glow Smoothie | Lighter, Everyday | 5 | 2 | Easy | 7 of 7 (today 7) |
| 16 | Berry & Date Recovery Smoothie Bowl | Training | 10 | 2 | Easy | 7 of 9 (today 7) |
| 17 | Watermelon, Cucumber & Mint Salad | Lighter, Family | 10 | 4 | Easy | 6 of 7 (today 6) |
| 18 | Nectarine, Halloumi & Hot-Honey Salad | Everyday | 20 | 2 | Easy | 7 of 9 (today 7) |
| 19 | Pawpaw Breakfast Boats | Lighter, Family | 10 | 2 | Easy | 6 of 8 (today 6) |
| 20 | Avocado Smash Toast, Tomato-Chilli Salsa & Egg | Everyday, Training | 15 | 2 | Easy | 7 of 9 (today 6) |
| 21 | Thai-style Chicken Lettuce Cups | Lighter, Training | 20 | 3 | Easy | 9 of 11 (today 6) |
| 22 | Crispy Fish Tacos, Pineapple Slaw | Family, Everyday | 30 | 4 | Medium | 8 of 10 (today 7) |
| 23 | Green Shakshuka | Family, Everyday | 30 | 4 | Easy | 7 of 9 (today 6) |
| 24 | Sesame Smashed Cucumber & Avocado Salad | Lighter | 15 | 2 | Easy | 8 of 10 (today 5) |
| 25 | Beetroot, Orange & Lentil Salad | Lighter, Everyday | 30 | 4 | Easy | 7 of 9 (today 6) |
| 26 | Mushroom & Pepper Fajitas | Family, Everyday | 25 | 4 | Easy | 9 of 11 (today 7) |
| 27 | Charred Corn & Avocado Street-Corn Salad | Lighter, Family | 20 | 4 | Easy | 7 of 8 (today 6) |
| 28 | Smoky Garden Egg Mezze Bowl | Everyday, Lighter | 35 | 4 | Medium | 7 of 9 (today 5) |
| 29 | Coconut, Sweet Potato & Greens Curry Bowl | Family, Everyday | 40 | 4 | Medium | 10 of 11 (today 9) |
| 30 | Scent-Leaf & Ugu Pesto Pasta | Everyday, Family | 25 | 4 | Easy | 8 of 10 (today 6) |

**Totals.** With the suggested additions, the average share is about 82% (range 75–100%). With today's catalogue it is about 69%: most recipes only miss garlic, coriander, spring onion or lemon.

---

### 1. Crunchy Chicken Shawarma Bowl
*All the shawarma flavour, none of the wrap: piled high on crunchy greens.*
- **Tags:** Lighter, Training
- **Time:** 35 min · **Serves:** 4 · **Difficulty:** Easy
- **Basket:** `romaine-lettuce`, `cabbage`, `tomato`, `cucumber`, `onion`, `parsley`, `lime`, `chilli`, `garlic†`
- **Grab it elsewhere:** boneless chicken thighs, plain Greek yogurt
- **Pantry:** salt, pepper, oil, cumin, paprika
- **Basket share:** 9 of 11 (today 8 of 11)
- **Method:**
  1. Mix half the yogurt with lime juice, grated garlic, the spices and salt. Coat the chicken and leave it 10 minutes (or overnight).
  2. Pan-grill the chicken for 5–6 minutes a side until cooked through. Rest it, then slice.
  3. Shred the lettuce and cabbage. Dice the tomato, cucumber and onion, then toss with parsley and a squeeze of lime.
  4. Stir the rest of the yogurt with a little garlic, lime and salt to make the sauce.
  5. Pile up the greens, top with the chicken, then add the sauce and sliced chilli.
- **Inspired by:** [Mob](https://www.mob.co.uk/recipes/spiced-chicken-shawarma-rice-bowl), [HelloFresh CA](https://hellofresh.ca/recipecards/card/6674c6263d7908a0f17bc535-en-CA.pdf)

### 2. Lagos-Night Shawarma Wraps
*The Lagos street classic, made fresher and crunchier at home, with an avocado-garlic sauce instead of mayo.*
- **Tags:** Family, Everyday
- **Time:** 30 min · **Serves:** 4 · **Difficulty:** Easy
- **Basket:** `cabbage`, `carrot`, `cucumber`, `tomato`, `onion`, `parsley`, `lime`, `chilli`, `avocado`, `garlic†`
- **Grab it elsewhere:** chicken strips, flatbreads / shawarma bread
- **Pantry:** salt, pepper, oil, curry powder, paprika
- **Basket share:** 10 of 12 (today 9 of 12)
- **Method:**
  1. Toss the chicken with the spices, salt and oil. Sear it in a hot pan for 6–8 minutes until charred and cooked.
  2. Finely shred the cabbage and grate the carrot. Slice the cucumber, tomato and onion.
  3. Blend the avocado with garlic, lime juice, salt and a splash of water to make a smooth sauce.
  4. Warm the flatbreads, spread on the sauce, and layer the slaw, chicken, parsley and chilli.
  5. Roll the wraps tightly and toast them seam-side down for 1 minute.
- **Inspired by:** [Mob: Homemade Chicken Shawarma](https://www.mob.co.uk/recipes/chicken-shawarma)

### 3. Mango-Chilli Chicken Skewers & Mango Salad
*Sticky-sweet, chilli-hot skewers with a juicy mango crunch on the side.*
- **Tags:** Training, Everyday
- **Time:** 30 min · **Serves:** 4 · **Difficulty:** Easy
- **Basket:** `mango` (×2), `cucumber`, `onion`, `chilli`, `lime`, `mint`, `salad-mix`, `garlic†`, `basil†`
- **Grab it elsewhere:** chicken breast, soy sauce
- **Pantry:** salt, oil, sugar
- **Basket share:** 9 of 11 (today 7 of 11)
- **Method:**
  1. Blend half a mango with garlic, chilli, soy and lime to make a glaze. Coat the chicken cubes and thread them onto skewers.
  2. Grill or pan-cook the skewers for 10–12 minutes, turning and brushing with glaze, until sticky and cooked.
  3. Cut the remaining mango and the cucumber into matchsticks, and thinly slice the onion.
  4. Toss with salad leaves, mint, basil, lime juice and a pinch of salt and sugar.
  5. Serve the skewers on the salad.
- **Inspired by:** [Mob: Basil Chicken Skewers with Mango Salad](https://www.mob.co.uk/recipes/basil-chicken-skewers-with-mango-salad)

### 4. Sweet Potato & Black Bean Tacos
*Roasty sweet potato, smoky beans and a cool avocado crema, in tacos ready in about 35 minutes.*
- **Tags:** Family, Everyday
- **Time:** 35 min · **Serves:** 4 · **Difficulty:** Easy
- **Basket:** `sweet-potato`, `avocado`, `lime`, `onion`, `cabbage`, `chilli`, `tomato`, `coriander†`
- **Grab it elsewhere:** black beans (or local black-eyed beans), small tortillas
- **Pantry:** salt, oil, cumin, paprika
- **Basket share:** 8 of 10 (today 7 of 10)
- **Method:**
  1. Cube the sweet potato, toss with oil, cumin and salt, and roast at 200°C for 20 minutes.
  2. Warm the beans with paprika and a little chopped onion.
  3. Mash the avocado with lime and salt into a crema.
  4. Dice the tomato with onion, chilli and coriander for a quick salsa, and shred the cabbage.
  5. Fill warm tortillas with potato, beans, cabbage, salsa and crema.
- **Inspired by:** [HelloFresh](https://www.hellofresh.com/recipecards/card/sweet-potato-and-black-bean-tacos-5b47c48630006c27ae498513-045f5c93.pdf)

### 5. Green Mango Crunch Salad (som tam-style)
*Sour, hot, salty and crunchy: a 20-minute salad that wakes everything up.*
- **Tags:** Lighter
- **Time:** 20 min · **Serves:** 2 · **Difficulty:** Easy
- **Basket:** `green-mango`, `carrot`, `cucumber`, `tomato`, `chilli`, `lime`, `mint`, `garlic†`, `coriander†`
- **Grab it elsewhere:** fish sauce, roasted groundnuts
- **Pantry:** sugar
- **Basket share:** 9 of 11 (today 7 of 11)
- **Method:**
  1. Peel the green mango and carrot and shred both into long strips. Cut the cucumber into matchsticks.
  2. Pound or crush the garlic and chilli with sugar, then stir in the fish sauce and lime juice.
  3. Halve the tomatoes and lightly bruise them in the dressing.
  4. Toss in the shredded veg and the herbs.
  5. Top with crushed groundnuts. *Training swap:* add grilled prawns (bought separately).
- **Inspired by:** [Mob: Thai Prawn Mango Som Tam](https://www.mob.co.uk/recipes/thai-prawn-mango-som-tam-salad)
- **Season note:** green mango is around ~Feb–May. Out of season, use firm, under-ripe `mango` or `green-apple`.

### 6. Halloumi, Tomato & Herb Bowl
*Salty, golden halloumi on a big tumble of tomato and herbs.*
- **Tags:** Lighter, Everyday
- **Time:** 25 min · **Serves:** 2 · **Difficulty:** Easy
- **Basket:** `beef-tomato`, `cucumber`, `onion`, `parsley`, `mint`, `salad-mix`, `lemon†`, `garlic†`
- **Grab it elsewhere:** halloumi, chickpeas (canned)
- **Pantry:** salt, pepper, oil, cumin
- **Basket share:** 8 of 10 (today 6 of 10)
- **Method:**
  1. Roast the drained chickpeas with oil, cumin and salt at 200°C for 15 minutes.
  2. Cut the tomatoes into wedges, dice the cucumber and finely slice the onion.
  3. Whisk lemon juice, grated garlic, oil and salt into a dressing.
  4. Fry the halloumi slices for 1–2 minutes a side until golden.
  5. Toss the leaves, veg and herbs with the dressing, then top with the chickpeas and halloumi.
- **Inspired by:** [Mob](https://www.mob.co.uk/recipes/halloumi-tomato-chickpea-herb-salad-bowl)

### 7. Fattoush Crunch Salad
*A Lebanese bread salad: crisp greens, loads of herbs and toasty pitta chips.*
- **Tags:** Lighter, Family
- **Time:** 20 min · **Serves:** 4 · **Difficulty:** Easy
- **Basket:** `romaine-lettuce`, `tomato`, `cucumber`, `bell-pepper`, `onion`, `parsley`, `mint`, `lemon†`, `garlic†`
- **Grab it elsewhere:** pitta or flatbread
- **Pantry:** salt, oil, paprika (or sumac, if you have it)
- **Basket share:** 9 of 10 (today 7 of 10)
- **Method:**
  1. Tear the pitta, toss it with oil and salt, and bake at 200°C for 8–10 minutes until crisp.
  2. Chop the lettuce, tomato, cucumber, pepper and onion into bite-size pieces.
  3. Whisk lemon juice, garlic, oil, salt and paprika or sumac.
  4. Toss the veg with lots of parsley and mint.
  5. Add the pitta chips just before serving so they stay crunchy.
- **Inspired by:** [HelloFresh NZ: Honey Halloumi & Fattoush](https://www.hellofresh.co.nz/recipes/honey-halloumi-and-fattoush-salad-6840cf6b6329c8e5b722cdb4)

### 8. Ginger Chicken & Veg Noodle Stir-fry
*A crowd-pleasing wok of noodles with more veg than noodle.*
- **Tags:** Family, Training
- **Time:** 25 min · **Serves:** 4 · **Difficulty:** Easy
- **Basket:** `bell-pepper`, `carrot`, `cabbage`, `mushrooms`, `onion`, `ginger`, `chilli`, `lime`, `garlic†`, `spring-onion†`
- **Grab it elsewhere:** chicken breast, egg noodles, soy sauce
- **Pantry:** oil, sugar
- **Basket share:** 10 of 13 (today 8 of 13)
- **Method:**
  1. Cook the noodles, drain and toss with a little oil.
  2. Mix soy, lime juice, sugar, grated ginger and garlic into a sauce.
  3. Stir-fry thin chicken strips on high heat for 4–5 minutes, then set aside.
  4. Stir-fry the sliced pepper, carrot, cabbage, mushrooms and onion for 3–4 minutes, keeping some crunch.
  5. Return the chicken, add the noodles and sauce, and toss. Finish with spring onion and chilli.
- **Inspired by:** [HelloFresh UK: Hoisin Chicken Stir-Fry](https://www.hellofresh.co.uk/recipes/hoisin-chicken-stir-fry-5f184fdb787cc57f4f2b1b79)

### 9. Mushroom, Greens & Ginger Rice Bowl
*Savoury mushrooms and silky greens over rice in about 20 minutes.*
- **Tags:** Lighter, Everyday
- **Time:** 20 min · **Serves:** 2 · **Difficulty:** Easy
- **Basket:** `mushrooms`, `spinach`, `bell-pepper`, `onion`, `ginger`, `chilli`, `garlic†`, `spring-onion†`
- **Grab it elsewhere:** rice, soy sauce
- **Pantry:** oil, sugar
- **Basket share:** 8 of 10 (today 6 of 10)
- **Method:**
  1. Put the rice on to cook.
  2. Sear the sliced mushrooms in a hot dry pan until browned, then add oil, onion and pepper.
  3. Add the ginger, garlic and chilli and cook for 1 minute.
  4. Stir in the efo tete until just wilted, then add soy and a pinch of sugar.
  5. Spoon over the rice and scatter with spring onion.
- **Inspired by:** [HelloFresh UK: Fragrant Veggie Noodle Stir-Fry](https://www.hellofresh.co.uk/recipes/fragrant-chicken-noodle-stir-fry-6633506c270adf4f95c58165)

### 10. Rainbow Veggie Egg Fried Rice
*The end-of-week fridge rescue: more colour than rice.*
- **Tags:** Family, Everyday
- **Time:** 25 min · **Serves:** 4 · **Difficulty:** Easy
- **Basket:** `carrot`, `bell-pepper`, `corn`, `onion`, `cabbage`, `ginger`, `garlic†`, `spring-onion†`, `zucchini†`
- **Grab it elsewhere:** cooked day-old rice, eggs, soy sauce
- **Pantry:** oil
- **Basket share:** 9 of 12 (today 6 of 12)
- **Method:**
  1. Dice all the veg small and cut the corn off the cob.
  2. Scramble the eggs in a hot wok, then remove.
  3. Stir-fry the onion, ginger and garlic, then the carrot, corn, pepper, zucchini and cabbage, for 4 minutes.
  4. Add the rice and fry until hot and slightly crisp.
  5. Return the eggs, season with soy, and finish with spring onion.
- **Inspired by:** [Mob: Veggie Egg Fried Rice](https://www.mob.co.uk/recipes/veggie-egg-fried-rice)

### 11. Fresh Burrito Bowl
*Build-your-own bowls with rice, beans, charred corn and all the salsa.*
- **Tags:** Family, Training
- **Time:** 30 min · **Serves:** 4 · **Difficulty:** Easy
- **Basket:** `bell-pepper`, `onion`, `corn`, `tomato`, `avocado`, `lime`, `chilli`, `romaine-lettuce`, `coriander†`
- **Grab it elsewhere:** rice, kidney or black beans
- **Pantry:** salt, oil, cumin, paprika
- **Basket share:** 9 of 11 (today 8 of 11)
- **Method:**
  1. Cook the rice, then stir through lime juice and chopped coriander.
  2. Char the corn and sliced peppers and onion in a hot pan with the spices.
  3. Warm the beans with a pinch of cumin and salt.
  4. Dice the tomato with chilli, onion and lime for a salsa, and slice the avocado.
  5. Set everything out with shredded lettuce and let everyone build their own bowl.
- **Inspired by:** [Mob: Easy Burrito Bowl](https://www.mob.co.uk/recipes/easy-burrito-bowl)

### 12. Roast Root Grain Bowl, Lime-Tahini
*One tray of roast roots, a scoop of grain and a dressing worth licking off the spoon.*
- **Tags:** Everyday, Lighter
- **Time:** 40 min · **Serves:** 4 · **Difficulty:** Easy
- **Basket:** `sweet-potato`, `beetroot`, `carrot`, `onion`, `spinach`, `avocado`, `lime`, `garlic†`
- **Grab it elsewhere:** quinoa or brown rice, tahini
- **Pantry:** salt, pepper, oil, cumin
- **Basket share:** 8 of 10 (today 7 of 10)
- **Method:**
  1. Cut the sweet potato, beetroot, carrot and onion into chunks, toss with oil, cumin and salt, and roast at 200°C for 30 minutes.
  2. Cook the grain.
  3. Whisk tahini with lime juice, garlic, salt and water until pourable.
  4. Wilt the efo tete in a pan for 1 minute.
  5. Bowl up the grain, greens, roast veg and sliced avocado, then drizzle with the dressing.
- **Inspired by:** [BMC Grain Bowl Framework](https://bmc.org/recipes/grain-bowl-framework)

### 13. Dodo & Beans Power Bowl (fusion)
*Sweet fried plantain, beans and a fresh salsa: a Lagos favourite turned into a bowl.*
- **Tags:** Training, Family
- **Time:** 30 min · **Serves:** 2 · **Difficulty:** Easy
- **Basket:** `plantain`, `avocado`, `tomato`, `onion`, `cucumber`, `chilli`, `lime`, `coriander†`
- **Grab it elsewhere:** black-eyed beans (cooked or canned), eggs
- **Pantry:** salt, oil, paprika
- **Basket share:** 8 of 10 (today 7 of 10)
- **Method:**
  1. Slice the ripe plantain on the diagonal and pan-fry or air-fry until caramelised.
  2. Warm the beans with a little onion, paprika and salt.
  3. Boil the eggs for 7 minutes, then peel and halve.
  4. Dice the tomato, cucumber, onion and chilli with lime and coriander.
  5. Bowl up the beans, dodo, salsa, avocado and eggs.
- **Inspired by:** the burrito/grain-bowl format (pattern 14)

### 14. Tropical Sunshine Smoothie
*A golden glass of mango, pineapple and a ginger kick.*
- **Tags:** Everyday, Training
- **Time:** 5 min · **Serves:** 2 · **Difficulty:** Easy
- **Basket:** `mango`, `pineapple`, `banana`, `ginger`, `lime`, `young-coconut`
- **Grab it elsewhere:** Greek yogurt (optional, for a thicker post-training version)
- **Pantry:** ice / water
- **Basket share:** 6 of 7 (today 6 of 7)
- **Method:**
  1. Crack the young coconut. Save the water and scoop out the soft flesh.
  2. Chop the mango, pineapple and banana (freeze them ahead for a thicker shake).
  3. Blend with the coconut water and flesh, a thumb of ginger and a squeeze of lime.
  4. Add yogurt if you like it thicker, then blend again.
  5. Taste, adjust with lime, and serve cold.
- **Inspired by:** [Mob: Tropical Sunshine Smoothie](https://www.mob.co.uk/recipes/tropical-sunshine-smoothie)

### 15. Green Glow Smoothie
*Bright, zingy and green: apple and ginger lead, the greens stay in the background.*
- **Tags:** Lighter, Everyday
- **Time:** 5 min · **Serves:** 2 · **Difficulty:** Easy
- **Basket:** `spinach` (small handful, or `romaine-lettuce`), `cucumber`, `green-apple`, `banana`, `ginger`, `lime`, `mint`
- **Grab it elsewhere:** none
- **Pantry:** water, ice
- **Basket share:** 7 of 7 (today 7 of 7)
- **Method:**
  1. Wash the greens well. Chop the cucumber, apple and banana.
  2. Blend everything with a thumb of ginger, a few mint leaves, lime juice and a cup of cold water.
  3. Blend for a full minute until smooth.
  4. Taste: more lime for zing, more banana for sweetness.
  5. Serve over ice.
- **Note:** efo tete is strong raw, so keep it to a small handful.

### 16. Berry & Date Recovery Smoothie Bowl
*A thick, spoonable berry bowl with dates for sweetness and crunchy toppings.*
- **Tags:** Training
- **Time:** 10 min · **Serves:** 2 · **Difficulty:** Easy
- **Basket:** `blueberries`, `raspberries`, `banana`, `dates`, `passion-fruit`, `mint`, `coconut`
- **Grab it elsewhere:** Greek yogurt, granola or oats
- **Pantry:** —
- **Basket share:** 7 of 9 (today 7 of 9)
- **Method:**
  1. Pit the dates and soak them in hot water for 5 minutes.
  2. Blend the berries (frozen works best), banana, dates and yogurt until very thick.
  3. Spoon into bowls.
  4. Top with passion fruit pulp, toasted coconut shavings, granola and torn mint.
  5. Eat straight away.
- **Inspired by:** [Mob: Tropical Sunshine Smoothie Bowl](https://www.mob.co.uk/recipes/tropical-sunshine-smoothie-bowl)
- **Note:** imported berries are pricey. `mango` + `banana` is a cheaper version.

### 17. Watermelon, Cucumber & Mint Salad
*A cold, salty-sweet salad for hot Lagos afternoons.*
- **Tags:** Lighter, Family
- **Time:** 10 min · **Serves:** 4 · **Difficulty:** Easy
- **Basket:** `watermelon`, `cucumber`, `mint`, `lime`, `onion`, `chilli`
- **Grab it elsewhere:** feta
- **Pantry:** salt, oil
- **Basket share:** 6 of 7 (today 6 of 7)
- **Method:**
  1. Cube the chilled watermelon and cucumber.
  2. Very thinly slice the onion and soak it in lime juice for 5 minutes to soften.
  3. Toss the melon, cucumber, onion and lime together.
  4. Crumble over the feta and add torn mint and a little chilli.
  5. Finish with a drizzle of oil and a pinch of salt.

### 18. Nectarine, Halloumi & Hot-Honey Salad
*Juicy stone fruit, squeaky halloumi and a chilli-honey drizzle.*
- **Tags:** Everyday
- **Time:** 20 min · **Serves:** 2 · **Difficulty:** Easy
- **Basket:** `nectarines` (or `peaches`), `salad-mix`, `cucumber`, `onion`, `mint`, `lime`, `chilli`
- **Grab it elsewhere:** halloumi, honey
- **Pantry:** salt, oil
- **Basket share:** 7 of 9 (today 7 of 9)
- **Method:**
  1. Warm the honey with finely chopped chilli to make a hot honey.
  2. Slice the nectarines, cucumber and onion.
  3. Fry the halloumi until golden, then brush it with hot honey.
  4. Toss the leaves, fruit and veg with lime, oil, salt and mint.
  5. Top with the halloumi and the rest of the hot honey.
- **Inspired by:** [Mob: Hot Honey Halloumi Bowl](https://www.mob.co.uk/recipes/hot-honey-halloumi-crispy-rice-bowl)

### 19. Pawpaw Breakfast Boats
*Halved pawpaw becomes the bowl, filled with yogurt, fruit and crunch.*
- **Tags:** Lighter, Family
- **Time:** 10 min · **Serves:** 2 · **Difficulty:** Easy
- **Basket:** `pawpaw`, `lime`, `passion-fruit`, `pineapple`, `blueberries`, `mint`
- **Grab it elsewhere:** Greek yogurt, granola
- **Pantry:** —
- **Basket share:** 6 of 8 (today 6 of 8)
- **Method:**
  1. Halve a small pawpaw lengthways and scoop out the seeds.
  2. Squeeze lime over the flesh.
  3. Fill each half with yogurt.
  4. Top with diced pineapple, blueberries and passion fruit pulp.
  5. Finish with granola and mint.

### 20. Avocado Smash Toast, Tomato-Chilli Salsa & Egg
*The café brunch, made at home in 15 minutes.*
- **Tags:** Everyday, Training
- **Time:** 15 min · **Serves:** 2 · **Difficulty:** Easy
- **Basket:** `avocado`, `tomato`, `onion`, `chilli`, `lime`, `spinach`, `coriander†`
- **Grab it elsewhere:** sourdough or good bread, eggs
- **Pantry:** salt, pepper, oil
- **Basket share:** 7 of 9 (today 6 of 9)
- **Method:**
  1. Toast the bread.
  2. Mash the avocado with lime, salt and chilli.
  3. Dice the tomato and onion with coriander and lime into a salsa.
  4. Wilt the efo tete in a pan, then fry or poach the eggs.
  5. Stack: toast, avocado, greens, egg, salsa.

### 21. Thai-style Chicken Lettuce Cups
*Hot, zesty chicken spooned into cold, crisp lettuce: lettuce instead of bread.*
- **Tags:** Lighter, Training
- **Time:** 20 min · **Serves:** 3 · **Difficulty:** Easy
- **Basket:** `iceberg-lettuce`, `carrot`, `cucumber`, `mint`, `lime`, `chilli`, `coriander†`, `spring-onion†`, `garlic†`
- **Grab it elsewhere:** minced chicken, fish sauce
- **Pantry:** oil, sugar
- **Basket share:** 9 of 11 (today 6 of 11)
- **Method:**
  1. Separate the iceberg into cups and chill them in cold water.
  2. Fry the garlic and chilli, then add the mince and cook until browned, about 6 minutes.
  3. Take off the heat and season with fish sauce, lime and a pinch of sugar.
  4. Stir in the spring onion, mint and coriander.
  5. Spoon into the lettuce cups and top with shredded carrot and cucumber.
- **Inspired by:** [Mob: Thai Steak Salad Lettuce Cups](https://www.mob.co.uk/recipes/thai-steak-salad-lettuce-cups)

### 22. Crispy Fish Tacos, Pineapple Slaw
*Spiced fish, a sweet-sharp pineapple slaw and avocado: Friday-night tacos.*
- **Tags:** Family, Everyday
- **Time:** 30 min · **Serves:** 4 · **Difficulty:** Medium
- **Basket:** `cabbage`, `carrot`, `pineapple`, `onion`, `lime`, `chilli`, `avocado`, `coriander†`
- **Grab it elsewhere:** firm white fish fillets (e.g. croaker or tilapia), small tortillas
- **Pantry:** salt, oil, paprika, cumin
- **Basket share:** 8 of 10 (today 7 of 10)
- **Method:**
  1. Shred the cabbage, grate the carrot and dice the pineapple. Toss with lime, salt and chilli.
  2. Rub the fish with paprika, cumin and salt.
  3. Pan-fry the fish in hot oil for 2–3 minutes a side until crisp-edged, then flake it.
  4. Mash the avocado with lime and salt.
  5. Fill warm tortillas with avocado, fish, slaw and coriander.
- **Inspired by:** [Mob: Spiced Fish with Mango Salsa](https://www.mob.co.uk/recipes/mobs-caribbean-fish), [Blue Apron taco cards](https://media.blueapron.com/recipes/33183/c_card_pdfs/1659625156-15110-0020-9414/2PV2_VeggieTacos__WEB.pdf)

### 23. Green Shakshuka
*Eggs poached in a pepper-tomato sauce, with greens folded through.*
- **Tags:** Family, Everyday
- **Time:** 30 min · **Serves:** 4 · **Difficulty:** Easy
- **Basket:** `tomato`, `bell-pepper`, `onion`, `chilli`, `spinach`, `parsley`, `garlic†`
- **Grab it elsewhere:** eggs, crusty bread
- **Pantry:** salt, oil, cumin, paprika
- **Basket share:** 7 of 9 (today 6 of 9)
- **Method:**
  1. Soften the sliced onion and pepper in oil for 8 minutes, then add the garlic, chilli and spices.
  2. Add the chopped tomatoes and simmer for 10 minutes until jammy.
  3. Fold in the efo tete until wilted.
  4. Make 6–8 wells, crack in the eggs, cover and cook for 5–7 minutes.
  5. Scatter with parsley and serve with bread.
- **Season note:** tomatoes get expensive around May–Aug. Use more `bell-pepper` in those months.

### 24. Sesame Smashed Cucumber & Avocado Salad
*Smash, salt, dress: the viral cucumber salad, with creamy avocado.*
- **Tags:** Lighter
- **Time:** 15 min · **Serves:** 2 · **Difficulty:** Easy
- **Basket:** `cucumber`, `avocado`, `salad-mix`, `lime`, `chilli`, `garlic†`, `spring-onion†`, `coriander†`
- **Grab it elsewhere:** soy sauce, sesame seeds
- **Pantry:** salt, sugar, oil
- **Basket share:** 8 of 10 (today 5 of 10)
- **Method:**
  1. Smash the cucumbers with a rolling pin, break them into chunks, salt them and leave for 10 minutes.
  2. Whisk soy, lime, grated garlic, chilli, sugar and oil.
  3. Drain the cucumbers and toss them in the dressing.
  4. Fold in the cubed avocado and leaves.
  5. Top with spring onion, coriander and toasted sesame.
- **Inspired by:** [Mob: Crispy Rice & Smashed Cucumber Salad](https://www.mob.co.uk/recipes/crispy-rice-and-smashed-cucumber-salad)

### 25. Beetroot, Orange & Lentil Salad
*Earthy beetroot, juicy orange and lentils in a jewel-coloured salad that keeps well.*
- **Tags:** Lighter, Everyday
- **Time:** 30 min · **Serves:** 4 · **Difficulty:** Easy
- **Basket:** `beetroot`, `orange`, `salad-mix`, `onion`, `mint`, `parsley`, `lemon†`
- **Grab it elsewhere:** cooked lentils, feta
- **Pantry:** salt, pepper, oil
- **Basket share:** 7 of 9 (today 6 of 9)
- **Method:**
  1. Boil or roast the beetroot until tender, about 25 minutes, then peel and cut into wedges.
  2. Segment the oranges and save the juice.
  3. Whisk the orange juice, lemon, oil and salt.
  4. Toss the lentils, thin-sliced onion, herbs and leaves with half the dressing.
  5. Top with beetroot, orange and feta, then the rest of the dressing.
- **Inspired by:** Mob's Lentil & Halloumi Salad with Orange Dressing. I only found it on Mob's [staging site](https://staging2.mob.co.uk/recipes/lentil-halloumi-salad-with-orange-dressing), so confirm the live URL before citing it.

### 26. Mushroom & Pepper Fajitas
*Sizzling, smoky mushrooms and peppers wrapped up with a fresh salsa.*
- **Tags:** Family, Everyday
- **Time:** 25 min · **Serves:** 4 · **Difficulty:** Easy
- **Basket:** `mushrooms`, `bell-pepper`, `onion`, `tomato`, `avocado`, `lime`, `chilli`, `garlic†`, `coriander†`
- **Grab it elsewhere:** tortillas, grated cheese
- **Pantry:** salt, oil, paprika, cumin
- **Basket share:** 9 of 11 (today 7 of 11)
- **Method:**
  1. Slice the mushrooms, peppers and onion into strips.
  2. Sear in a very hot pan in batches so they char instead of steaming.
  3. Add the garlic and spices for the last minute, then squeeze over lime.
  4. Chop the tomato, chilli and coriander into a salsa, and slice the avocado.
  5. Serve everything in the middle of the table with warm tortillas and cheese.
- **Inspired by:** [Mob: Fajita Fried Rice](https://www.mob.co.uk/recipes/fajita-fried-rice)

### 27. Charred Corn & Avocado Street-Corn Salad
*Smoky corn, creamy avocado and a squeeze of lime: Mexican street corn in a bowl.*
- **Tags:** Lighter, Family
- **Time:** 20 min · **Serves:** 4 · **Difficulty:** Easy
- **Basket:** `corn`, `avocado`, `tomato`, `onion`, `chilli`, `lime`, `coriander†`
- **Grab it elsewhere:** feta (stand-in for cotija)
- **Pantry:** salt, oil, paprika
- **Basket share:** 7 of 8 (today 6 of 8)
- **Method:**
  1. Boil the cobs for 10 minutes (local maize needs longer than sweetcorn), then char them in a dry pan or on a grill.
  2. Cut the kernels off the cob.
  3. Dice the avocado, tomato and onion, and slice the chilli.
  4. Toss with lime, salt and paprika.
  5. Crumble over the feta and finish with coriander.
- **Season note:** best ~Apr–Oct, when fresh corn is plentiful.

### 28. Smoky Garden Egg Mezze Bowl (fusion)
*Charred garden egg whipped into a baba ganoush-style dip, with a chopped salad and warm pitta.*
- **Tags:** Everyday, Lighter
- **Time:** 35 min · **Serves:** 4 · **Difficulty:** Medium
- **Basket:** `garden-egg`, `tomato`, `cucumber`, `onion`, `parsley`, `garlic†`, `lemon†`
- **Grab it elsewhere:** tahini, pitta
- **Pantry:** salt, oil, cumin
- **Basket share:** 7 of 9 (today 5 of 9)
- **Method:**
  1. Char the whole garden eggs over a gas flame or under a hot grill until collapsed, about 15 minutes.
  2. Scoop out the flesh and mash it with tahini, garlic, lemon, salt and cumin.
  3. Finely chop the tomato, cucumber, onion and parsley with lemon and oil.
  4. Warm the pitta.
  5. Spread the dip in bowls, top with the salad and serve with the pitta.
- **Note:** this also works with `eggplant†` if it gets added.

### 29. Coconut, Sweet Potato & Greens Curry Bowl
*A gentle, family-friendly coconut curry made with fresh coconut milk.*
- **Tags:** Family, Everyday
- **Time:** 40 min · **Serves:** 4 · **Difficulty:** Medium
- **Basket:** `sweet-potato`, `spinach`, `bell-pepper`, `onion`, `tomato`, `ginger`, `chilli`, `lime`, `coconut`, `garlic†`
- **Grab it elsewhere:** rice
- **Pantry:** salt, oil, curry powder
- **Basket share:** 10 of 11 (today 9 of 11)
- **Method:**
  1. Grate the coconut flesh, blend it with 2 cups of warm water, and strain to get coconut milk.
  2. Soften the onion, garlic, ginger and chilli, then add the curry powder and chopped tomato.
  3. Add the cubed sweet potato and pepper with the coconut milk, and simmer for 15–18 minutes until tender.
  4. Stir in the efo tete and lime juice, and season.
  5. Serve over rice. Leave the chilli on the side for kids.

### 30. Scent-Leaf & Ugu Pesto Pasta (fusion)
*Pesto made with Nigerian greens: peppery, herby and very green.*
- **Tags:** Everyday, Family
- **Time:** 25 min · **Serves:** 4 · **Difficulty:** Easy
- **Basket:** `scent-leaf`, `ugu`, `tomato`, `mushrooms`, `bell-pepper`, `lime`, `garlic†`, `zucchini†`
- **Grab it elsewhere:** pasta, roasted groundnuts (or cashews)
- **Pantry:** salt, pepper, oil
- **Basket share:** 8 of 10 (today 6 of 10)
- **Method:**
  1. Cook the pasta and save a cup of the cooking water.
  2. Blend 1 part scent leaf to 2 parts ugu with garlic, groundnuts, lime, salt and plenty of oil.
  3. Sauté the sliced mushrooms, pepper and zucchini until golden.
  4. Toss the pasta with the pesto, veg and a splash of pasta water.
  5. Top with halved tomatoes.
- **Note:** scent leaf (*Ocimum gratissimum*) is a basil relative with a strong, clove-like taste. The ugu softens it.

---

## 4. Suggested catalogue additions, ranked by recipes unlocked

"Unlocks" = the number of the 30 recipes above that list the item. Each recipe also gives a workable swap so it doesn't depend on the item.

| Rank | Addition (proposed slug) | Recipes unlocked (of 30) | Which recipes | Sourceable in Lagos? | Notes |
|---|---|---|---|---|---|
| 1 | **Garlic** (`garlic†`) | **17** | 1, 2, 3, 5, 6, 7, 8, 9, 10, 12, 21, 23, 24, 26, 28, 29, 30 | **Yes, easily.** Every market; local (Kano / Kebbi) and imported | Cheap, keeps for weeks. The biggest single gain in basket share |
| 2 | **Coriander / cilantro** (`coriander†`) | **10** | 4, 5, 11, 13, 20, 21, 22, 24, 26, 27 | **Mostly.** Supermarkets and herb traders; quality varies and it wilts fast | Short shelf life, so pack with damp paper. Fallback: `parsley` or `mint` |
| 3 | **Spring onion** (`spring-onion†`) | **5** | 8, 9, 10, 21, 24 | **Yes.** Common in Lagos markets | Cheap; a good garnish item |
| 4 | **Lemon** (`lemon†`) | **4** | 6, 7, 25, 28 | **Yes, at a premium.** Mostly imported | `lime` works in all four, so lowest urgency of the top four |
| 5 | **Zucchini / courgette** (`zucchini†`) | **2** | 10, 30 | **Uncertain.** Greenhouse / Plateau supply is patchy | Stock seasonally; adds variety to stir-fries and bowls |
| 6 | **Sweet basil** (`basil†`) | **1** | 3 | **Partly.** Greenhouse growers | `scent-leaf` is the local alternative |

**Watch list: not used in the 30, but would open the next batch**

- **Eggplant / aubergine** (uncertain supply). Roast-veg trays and a "proper" baba ganoush; `garden-egg` covers this today.
- **Green beans** (yes, Plateau). A HelloFresh stir-fry staple.
- **Cherry tomato** (greenhouse, patchy). Salads and pasta.
- **Red cabbage** (patchy). Adds colour to slaws and tacos.
- **Broccoli** (Plateau / imported, pricey). Stir-fries and grain bowls.
- **Irish potato** (yes, Plateau). Family traybakes.
- **Lemongrass and fresh turmeric** (yes, local). Thai-style salads and smoothies.
- **Soursop and tiger nut** (yes, seasonal). Local-hero smoothies.
- **Okra** (yes). Charred-okra stir-fry and tacos.

**Recommendation.** Add **garlic, coriander and spring onion** first: all three are cheap, easy to find in Lagos, and between them unlock 23 of the 30 recipes. Add **lemon** as an optional upsell. Pilot **zucchini** only once a reliable greenhouse supplier is confirmed.

---

### Open questions for the team

1. **Pantry definition.** Is it OK to treat dried spices and sugar as pantry basics? If not, most shares fall by about 1.
2. **Seasonal swaps on recipe cards.** Seasonal items (`green-mango`, `corn`, `agbalumo`, `velvet-tamarind`) need an automatic "swap when out of season" rule on recipe cards.
3. **Imported fruit.** Berries, stone fruit and grapes carry FX price risk. Recipes 16, 18 and 19 should each have a local-fruit version (mango, pineapple, pawpaw).
4. **Supplier checks.** Confirm zucchini, coriander and eggplant supply with Mile 12 aggregators or greenhouse farms (and with Shoprite / Spar / Ebeano buyers) before listing them.
