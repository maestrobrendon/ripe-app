import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ProductCategory, OrderUnit, DeliveryDay } from "../src/generated/prisma/client";
import { dbConnectionString } from "../src/lib/db-url";

const adapter = new PrismaPg({ connectionString: dbConnectionString() });
const prisma = new PrismaClient({ adapter });

const tiers = [
  {
    slug: "base",
    name: "Base",
    monthlyFee: 4500,
    tagline: "Member pricing and a standing weekly basket.",
    sortOrder: 1,
    perks: [
      "Member pricing on every product",
      "Standing weekly basket you edit before you are charged",
      "Skip or pause any week, penalty-free",
    ],
  },
  {
    slug: "mid",
    name: "Mid",
    monthlyFee: 6500,
    tagline: "Everything in Base, plus free delivery and combo pricing.",
    sortOrder: 2,
    perks: [
      "Everything in Base",
      "Free delivery on your set delivery days",
      "Combo pricing on boxes and baskets",
    ],
  },
  {
    slug: "premium",
    name: "Premium",
    monthlyFee: 8500,
    tagline: "Everything in Mid, plus first access to seasonal produce.",
    sortOrder: 3,
    perks: [
      "Everything in Mid",
      "Early access to seasonal produce",
      "Priority sourcing from partner farms",
    ],
  },
];

const zones: {
  slug: string;
  name: string;
  area: string;
  isServed: boolean;
  deliveryDays: DeliveryDay[];
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  sortOrder: number;
}[] = [
  { slug: "lekki-phase-1", name: "Lekki Phase 1", area: "Lekki Phase 1, Oniru", isServed: true, deliveryDays: ["MONDAY", "WEDNESDAY", "FRIDAY"], centerLat: 6.442, centerLng: 3.472, radiusKm: 4, sortOrder: 1 },
  { slug: "vi-ikoyi", name: "Victoria Island / Ikoyi", area: "VI, Ikoyi, Obalende", isServed: true, deliveryDays: ["MONDAY", "WEDNESDAY", "FRIDAY"], centerLat: 6.43, centerLng: 3.424, radiusKm: 4, sortOrder: 2 },
  { slug: "ajah", name: "Ajah", area: "Ajah, Sangotedo, Abraham Adesanya", isServed: true, deliveryDays: ["WEDNESDAY", "FRIDAY"], centerLat: 6.469, centerLng: 3.568, radiusKm: 6, sortOrder: 3 },
  { slug: "ikeja-gra", name: "Ikeja / GRA", area: "Ikeja, GRA, Magodo, Ogudu", isServed: true, deliveryDays: ["MONDAY", "WEDNESDAY", "FRIDAY"], centerLat: 6.601, centerLng: 3.351, radiusKm: 6, sortOrder: 4 },
  { slug: "yaba-surulere", name: "Yaba / Surulere", area: "Yaba, Surulere, Ebute Metta", isServed: true, deliveryDays: ["MONDAY", "FRIDAY"], centerLat: 6.508, centerLng: 3.379, radiusKm: 5, sortOrder: 5 },
  { slug: "gbagada-ketu", name: "Gbagada / Ketu", area: "Gbagada, Ketu, Ojota", isServed: true, deliveryDays: ["WEDNESDAY", "FRIDAY"], centerLat: 6.56, centerLng: 3.389, radiusKm: 5, sortOrder: 6 },
  { slug: "epe", name: "Epe", area: "Epe, Poka, Ejinrin", isServed: false, deliveryDays: [], centerLat: 6.585, centerLng: 3.983, radiusKm: 10, sortOrder: 7 },
];

type SeedProduct = {
  slug: string;
  name: string;
  category: ProductCategory;
  unit: string;
  orderUnit: OrderUnit;
  minOrderQty: number;
  stepQty: number;
  memberPrice: number;
  standardPrice: number;
  inSeason: boolean;
  source: string;
  description: string;
  educationCopy: string;
  benefitsCopy: string;
  storageTips: string;
  tags: string[];
  imageEmoji: string;
  featured?: boolean;
};

const P = (
  p: Omit<SeedProduct, "inSeason" | "featured" | "tags"> & { inSeason?: boolean; featured?: boolean; tags?: string[] },
): SeedProduct => ({
  inSeason: true,
  featured: false,
  tags: [],
  ...p,
});

// Per-product extras for the detail page. Anything omitted is generated from the
// fields above so every product still reads well.
type Extra = {
  blurb?: string;
  sourcingLine?: string;
  howToEnjoy?: string;
  related?: string[];
  rating?: [number, number]; // [average, count]
};

const EXTRAS: Record<string, Extra> = {
  pineapple: {
    blurb:
      "One ripe pineapple, picked at the right time and delivered ready to cut. Sweet, juicy and firm, with none of the sharp, underripe bite you get from fruit that travelled too long.",
    sourcingLine: "Hand-picked for sweetness and delivered within days of harvest.",
    howToEnjoy:
      "Cut into rings or chunks and eat cold. Blend into a smoothie, grill alongside fish or chicken, or add to a fruit salad.",
    related: ["mango", "banana", "pineapple-chunks", "smoothie-box"],
    rating: [4.8, 34],
  },
  watermelon: {
    blurb:
      "A full-size watermelon, cut from the vine once it is properly ripe. Deep red inside, crisp and sweet, and big enough to share or keep in the fridge through the week.",
    sourcingLine: "Vine-ripened and checked for sweetness before it leaves us.",
    howToEnjoy:
      "Slice and eat chilled, cube it for a fruit cup, or blend with a little lime and mint for a cold drink.",
    related: ["mixed-fruit-cup", "watermelon-cubes", "pineapple", "recovery-box"],
    rating: [4.7, 21],
  },
  avocado: {
    blurb:
      "Creamy West African avocados, delivered firm so you can ripen them to the day you need. Rich, smooth and mild, with a texture that holds up in a salad or on toast.",
    howToEnjoy:
      "Spread on bread with salt and pepper, fold through a salad, or mash with tomato, onion and lime.",
    related: ["tomato", "cucumber", "mixed-fruit-cup", "breakfast-box"],
    rating: [4.9, 48],
  },
  tomato: {
    blurb:
      "Firm, ripe field tomatoes sold by the kilo. Picked at the turning stage so they arrive in good condition and finish ripening on your counter over a day or two.",
    howToEnjoy:
      "Blend with pepper and onion for stew, slice into a salad, or roast whole with oil and salt.",
    related: ["bell-pepper", "onion", "chilli", "soup-box"],
    rating: [4.6, 29],
  },
  banana: {
    blurb:
      "A full hand of bananas, delivered with a touch of green so they ripen through the week rather than all at once. Sweet, soft and good for snacking or baking.",
    howToEnjoy:
      "Eat as a snack, slice over breakfast, blend into a smoothie, or freeze overripe ones for later.",
    related: ["pawpaw", "orange", "smoothie-box", "recovery-box"],
    rating: [4.5, 40],
  },
  "breakfast-box": {
    blurb:
      "A fixed weekly mix of pawpaw, banana, oranges and avocado, sized for a household of four. A simple way to keep fruit on the table every morning without planning it.",
    sourcingLine: "Each item selected and quality checked, then packed together with care.",
    howToEnjoy:
      "Set out a shared fruit plate at breakfast, pack pieces for school and work, or blend the softer fruit into smoothies.",
    related: ["smoothie-box", "weekly-staples-box", "mixed-fruit-cup", "avocado"],
    rating: [4.8, 17],
  },
  "weekly-staples-box": {
    blurb:
      "The vegetables a kitchen goes through in a normal week: tomato, onion, pepper, plantain, carrot and greens, in one box at combo pricing for members.",
    howToEnjoy:
      "Covers the stew base, a starch and a side. Most weeknight meals are already half-shopped when this arrives.",
    related: ["soup-box", "tomato", "onion", "breakfast-box"],
    rating: [4.7, 22],
  },
  "pineapple-chunks": {
    blurb:
      "Fresh pineapple, peeled, cored and cut into a tub the morning your order goes out. All of the fruit, none of the prep.",
    sourcingLine: "Cut fresh to order and packed cold.",
    howToEnjoy:
      "Eat straight from the tub, add to yoghurt or a fruit cup, or thread onto skewers for the grill.",
    related: ["mixed-fruit-cup", "watermelon-cubes", "pineapple", "mango"],
    rating: [4.9, 12],
  },
  "mixed-fruit-cup": {
    blurb:
      "A grab-and-go cup of pawpaw, pineapple, watermelon and banana, cut and mixed fresh. The mix rotates with whatever is at its best that week.",
    sourcingLine: "Cut fresh to order from fruit selected that morning.",
    howToEnjoy: "Breakfast on the move, a mid-afternoon snack, or a light dessert straight from the fridge.",
    related: ["pineapple-chunks", "watermelon-cubes", "coleslaw-mix", "breakfast-box"],
    rating: [4.8, 9],
  },
  "coleslaw-mix": {
    blurb:
      "Cabbage and carrot, washed and shredded into a bag. Coleslaw becomes a matter of stirring in dressing.",
    howToEnjoy: "Dress with mayonnaise, a little sugar and lime for classic coleslaw, or use it raw in wraps.",
    related: ["stir-fry-veg-mix", "carrot", "cabbage", "mixed-fruit-cup"],
    rating: [4.6, 8],
  },
  "smoothie-box": {
    blurb:
      "A week of blends in one box: pineapple, banana, mango and ginger, picked slightly riper since it is going straight into a blender.",
    howToEnjoy: "Peel, chop and freeze on arrival, then blend from frozen with water, milk or yoghurt.",
    related: ["pineapple", "banana", "mango", "breakfast-box"],
    rating: [4.7, 14],
  },
  mango: {
    blurb:
      "Ripe, fragrant local mangoes sold by the piece, so you can buy a couple or a dozen. Soft, sweet and juicy when they give slightly to a gentle squeeze.",
    howToEnjoy: "Eat fresh over a plate, cube into a salsa with onion and lime, or blend into a smoothie.",
    related: ["pineapple", "banana", "smoothie-box", "mixed-fruit-cup"],
    rating: [4.7, 19],
  },
};

const products: SeedProduct[] = [
  P({
    slug: "pineapple", name: "Pineapple", category: "FRUIT", unit: "per pineapple", orderUnit: "PIECE", minOrderQty: 1, stepQty: 1,
    memberPrice: 1200, standardPrice: 1600, source: "Trusted local farmers", imageEmoji: "🍍", featured: true,
    description: "Golden, ready-to-eat pineapple.",
    educationCopy: "Grown on smallholder farms by our local partners. We take fruit that is picked ripe, not gassed, so it reaches you sweet rather than sharp.",
    benefitsCopy: "High in vitamin C and manganese, and a good source of fibre. People often eat it fresh, blend it, or grill it alongside fish.",
    storageTips: "Keep at room temperature for two to three days, or refrigerate cut chunks in a sealed container for up to four days.",
  }),
  P({
    slug: "watermelon", name: "Watermelon", category: "FRUIT", unit: "per watermelon", orderUnit: "PIECE", minOrderQty: 1, stepQty: 1,
    memberPrice: 1800, standardPrice: 2500, source: "Trusted local farmers", imageEmoji: "🍉", featured: true,
    description: "Full-size watermelon, sweet and well ripened.",
    educationCopy: "Field-grown by local farmers and cut when the underside patch turns creamy yellow, which is the sign it ripened on the vine.",
    benefitsCopy: "Mostly water, so it is hydrating and low in calories. Contains lycopene and vitamin A.",
    storageTips: "Whole melons keep for a week in a cool spot. Once cut, wrap and refrigerate and use within three days.",
  }),
  P({
    slug: "pawpaw", name: "Pawpaw", category: "FRUIT", unit: "per pawpaw", orderUnit: "PIECE", minOrderQty: 1, stepQty: 1,
    memberPrice: 900, standardPrice: 1200, source: "Trusted local farmers", imageEmoji: "🥭", featured: true,
    description: "Sweet, ripe pawpaw picked within days of delivery.",
    educationCopy: "Also called papaya. Ours is delivered at the point where the skin is turning from green to yellow, so it finishes ripening at home.",
    benefitsCopy: "A good source of vitamin C, folate and the enzyme papain. Commonly eaten at breakfast with a squeeze of lime.",
    storageTips: "Ripen on the counter until it gives to gentle pressure, then refrigerate and eat within two days.",
  }),
  P({
    slug: "banana", name: "Banana", category: "FRUIT", unit: "per bunch", orderUnit: "PIECE", minOrderQty: 1, stepQty: 1,
    memberPrice: 1000, standardPrice: 1400, source: "Trusted local farmers", imageEmoji: "🍌", featured: true,
    description: "A full hand of ripe bananas.",
    educationCopy: "Grown by local partners and delivered with a little green at the tips so they last the week rather than turning all at once.",
    benefitsCopy: "Potassium, vitamin B6 and quick-release energy. A common choice before or after exercise.",
    storageTips: "Keep out of the fridge until ripe. Separating the hand slows ripening. Freeze peeled overripe ones for smoothies.",
  }),
  P({
    slug: "orange", name: "Orange", category: "FRUIT", unit: "per pair of 2", orderUnit: "PAIR", minOrderQty: 4, stepQty: 2,
    memberPrice: 380, standardPrice: 500, source: "Trusted local farmers", imageEmoji: "🍊",
    description: "Juicy oranges, hand-picked. Sold in pairs.",
    educationCopy: "These are local sweet-orange varieties, green-skinned even when ripe, which is normal for the tropics.",
    benefitsCopy: "Vitamin C, fibre and plant compounds called flavonoids. Usually eaten fresh or squeezed.",
    storageTips: "Keep at room temperature for up to a week, or refrigerate for two weeks.",
  }),
  P({
    slug: "apple", name: "Apple", category: "FRUIT", unit: "per pair of 2", orderUnit: "PAIR", minOrderQty: 2, stepQty: 2,
    memberPrice: 1100, standardPrice: 1450, source: "Specialty import partner", imageEmoji: "🍎", inSeason: false,
    description: "Crisp apples, held cold from farm to door.",
    educationCopy: "Apples are not grown at scale in Nigeria, so these are imported and kept in cold storage. We only list them when the quality holds up.",
    benefitsCopy: "Fibre, vitamin C and antioxidants, most of it in the skin. A portable snack.",
    storageTips: "Refrigerate in the crisper drawer, away from strong-smelling foods. They keep for several weeks.",
  }),
  P({
    slug: "mango", name: "Mango", category: "FRUIT", unit: "per piece", orderUnit: "PIECE", minOrderQty: 2, stepQty: 1,
    memberPrice: 450, standardPrice: 600, source: "Trusted local farmers", imageEmoji: "🥭",
    description: "Ripe, fragrant mangoes.",
    educationCopy: "Local varieties, in season through the middle of the year. Sold by the piece so you can buy a couple or a dozen.",
    benefitsCopy: "Vitamin A and C, and fibre. Eaten fresh, in salads, or blended.",
    storageTips: "Ripen at room temperature until fragrant and slightly soft, then refrigerate for up to five days.",
  }),
  P({
    slug: "avocado", name: "Avocado", category: "FRUIT", unit: "per piece", orderUnit: "PIECE", minOrderQty: 2, stepQty: 1,
    memberPrice: 550, standardPrice: 700, source: "Trusted local farmers", imageEmoji: "🥑", featured: true,
    description: "Creamy avocados, ready to eat within days.",
    educationCopy: "The large, smooth-skinned West African type. Delivered firm so you can ripen them to your preference.",
    benefitsCopy: "Monounsaturated fat, fibre, potassium and folate. Spread on bread, added to salads, or eaten with pepper and salt.",
    storageTips: "Ripen on the counter. Once soft, refrigerate for two days. Lemon or lime juice slows browning on cut halves.",
  }),
  P({
    slug: "lime", name: "Lime", category: "FRUIT", unit: "per pair of 2", orderUnit: "PAIR", minOrderQty: 4, stepQty: 2,
    memberPrice: 200, standardPrice: 280, source: "Trusted local farmers", imageEmoji: "🍋",
    description: "Sharp, juicy limes.",
    educationCopy: "Small green limes, thin-skinned and heavy for their size, which means more juice.",
    benefitsCopy: "Vitamin C and a bright acidity that lifts stews, drinks and marinades.",
    storageTips: "Room temperature for a week, or refrigerate for up to a month. Roll before juicing.",
  }),
  P({
    slug: "spinach", name: "Green Spinach (Efo Tete)", category: "VEGETABLE", unit: "per 250g", orderUnit: "WEIGHT", minOrderQty: 250, stepQty: 250,
    memberPrice: 450, standardPrice: 650, source: "Trusted local farmers", imageEmoji: "🥬",
    description: "Fresh leafy greens, cut to order.",
    educationCopy: "Efo tete, the soft green amaranth used across Yoruba kitchens. Cut the morning it is delivered because it wilts fast.",
    benefitsCopy: "Iron, folate, vitamin A and vitamin K. Usually stir-fried briefly with pepper, onion and crayfish.",
    storageTips: "Refrigerate unwashed in a loose bag and use within two days. Wash just before cooking.",
  }),
  P({
    slug: "ugu", name: "Ugu (Fluted Pumpkin Leaf)", category: "VEGETABLE", unit: "per 250g", orderUnit: "WEIGHT", minOrderQty: 250, stepQty: 250,
    memberPrice: 500, standardPrice: 750, source: "Trusted local farmers", imageEmoji: "🥬", featured: true,
    description: "A Lagos kitchen staple, freshly cut.",
    educationCopy: "Fluted pumpkin leaf, the backbone of Nigerian soups like egusi and edikaikong. Ours is cut young so the stalks are tender.",
    benefitsCopy: "Iron, protein for a leafy green, and vitamins A and C. Often blended for juice as well as cooked in soup.",
    storageTips: "Refrigerate wrapped in paper inside a bag for up to three days. Slice and wash right before use.",
  }),
  P({
    slug: "scent-leaf", name: "Scent Leaf (Efirin)", category: "VEGETABLE", unit: "per 100g", orderUnit: "WEIGHT", minOrderQty: 100, stepQty: 100,
    memberPrice: 300, standardPrice: 450, source: "Trusted local farmers", imageEmoji: "🌿",
    description: "Aromatic scent leaf, cut fresh.",
    educationCopy: "African basil, known as efirin or nchanwu. A little goes a long way. Used to finish pepper soup, yam and sauces.",
    benefitsCopy: "Aromatic oils that add flavour without salt. Traditionally used in teas.",
    storageTips: "Stand stems in a little water like cut flowers, loosely covered, in the fridge. Use within three days.",
  }),
  P({
    slug: "chilli", name: "Chilli Pepper (Ata Rodo)", category: "VEGETABLE", unit: "per 250g", orderUnit: "WEIGHT", minOrderQty: 250, stepQty: 250,
    memberPrice: 700, standardPrice: 950, source: "Trusted local farmers", imageEmoji: "🌶️",
    description: "Hot scotch bonnet peppers.",
    educationCopy: "Ata rodo, the scotch bonnet that gives Nigerian stews their heat and fruity aroma.",
    benefitsCopy: "Vitamin C and capsaicin, the compound behind the heat. Used in almost every savoury Nigerian dish.",
    storageTips: "Refrigerate in a paper bag for up to a week, or blend and freeze in portions.",
  }),
  P({
    slug: "ginger", name: "Ginger", category: "VEGETABLE", unit: "per 250g", orderUnit: "WEIGHT", minOrderQty: 250, stepQty: 250,
    memberPrice: 450, standardPrice: 650, source: "Trusted local farmers", imageEmoji: "🫚",
    description: "Fresh root ginger.",
    educationCopy: "Firm, plump rhizomes. Younger ginger has thinner skin and less fibre.",
    benefitsCopy: "Warming aromatic used in drinks, marinades and stir-fries. Common in home remedies for nausea.",
    storageTips: "Refrigerate unpeeled in a bag for three weeks, or freeze whole and grate from frozen.",
  }),
  P({
    slug: "tomato", name: "Tomato", category: "VEGETABLE", unit: "per kg", orderUnit: "WEIGHT", minOrderQty: 1000, stepQty: 500,
    memberPrice: 1200, standardPrice: 1700, source: "Trusted local farmers", imageEmoji: "🍅", featured: true,
    description: "Ripe, firm tomatoes.",
    educationCopy: "Field tomatoes, picked at the turning stage so they arrive firm and finish ripening in a day or two.",
    benefitsCopy: "Vitamin C, potassium and lycopene, which the body absorbs better once tomatoes are cooked. The base of Nigerian stew.",
    storageTips: "Keep on the counter, not the fridge, which dulls the flavour. Refrigerate only very ripe ones and use within two days.",
  }),
  P({
    slug: "bell-pepper", name: "Bell Pepper (Tatashe)", category: "VEGETABLE", unit: "per kg", orderUnit: "WEIGHT", minOrderQty: 1000, stepQty: 500,
    memberPrice: 1500, standardPrice: 2000, source: "Trusted local farmers", imageEmoji: "🫑",
    description: "Red bell peppers, sold by the kilo.",
    educationCopy: "Tatashe, the mild red pepper blended with ata rodo and onion to make the classic stew base.",
    benefitsCopy: "Very high in vitamin C, plus vitamin A. Adds body and colour to stew without heat.",
    storageTips: "Refrigerate in the crisper for up to a week. Blended pepper base freezes well for a month.",
  }),
  P({
    slug: "carrot", name: "Carrot", category: "VEGETABLE", unit: "per kg", orderUnit: "WEIGHT", minOrderQty: 500, stepQty: 500,
    memberPrice: 900, standardPrice: 1300, source: "Trusted local farmers", imageEmoji: "🥕",
    description: "Sweet, crunchy carrots.",
    educationCopy: "Grown in cooler upland areas and packed by our local partners. Delivered with tops removed so they keep longer.",
    benefitsCopy: "Beta-carotene, which the body turns into vitamin A, plus fibre. Eaten raw, in salads, jollof and stews.",
    storageTips: "Refrigerate in a bag in the crisper for two to three weeks. Keep away from apples, which make them bitter.",
  }),
  P({
    slug: "onion", name: "Onion", category: "VEGETABLE", unit: "per kg", orderUnit: "WEIGHT", minOrderQty: 1000, stepQty: 500,
    memberPrice: 900, standardPrice: 1300, source: "Trusted local farmers", imageEmoji: "🧅",
    description: "Firm, dry onions.",
    educationCopy: "Red onions, cured and dry-skinned, supplied through our pack house. Dry skin is the sign they will store well.",
    benefitsCopy: "Fibre and plant compounds, and the aromatic base of nearly every Nigerian savoury dish.",
    storageTips: "Store in a cool, dry, airy spot out of the fridge. Keep away from potatoes.",
  }),
  P({
    slug: "cucumber", name: "Cucumber", category: "VEGETABLE", unit: "per piece", orderUnit: "PIECE", minOrderQty: 2, stepQty: 1,
    memberPrice: 300, standardPrice: 420, source: "Trusted local farmers", imageEmoji: "🥒",
    description: "Crisp, fresh cucumbers.",
    educationCopy: "Field cucumbers, picked young so the seeds are small and the flesh stays crunchy.",
    benefitsCopy: "Mostly water, so hydrating and low in calories. Eaten in salads or as a snack with salt and pepper.",
    storageTips: "Refrigerate and use within four to five days. Keep away from tomatoes and bananas.",
  }),
  P({
    slug: "plantain", name: "Plantain", category: "VEGETABLE", unit: "per piece", orderUnit: "PIECE", minOrderQty: 3, stepQty: 1,
    memberPrice: 280, standardPrice: 380, source: "Trusted local farmers", imageEmoji: "🍌",
    description: "Plantain, delivered at the stage you choose.",
    educationCopy: "Green plantain is for boiling and frying firm, yellow-black is for sweet dodo. Tell us in the notes which you prefer.",
    benefitsCopy: "Complex carbohydrate, potassium and fibre. A filling staple across the day.",
    storageTips: "Ripen at room temperature. Slow it down in the fridge once it reaches the ripeness you want.",
  }),
  P({
    slug: "sweet-potato", name: "Sweet Potato", category: "VEGETABLE", unit: "per kg", orderUnit: "WEIGHT", minOrderQty: 1000, stepQty: 500,
    memberPrice: 800, standardPrice: 1100, source: "Trusted local farmers", imageEmoji: "🍠",
    description: "Orange-fleshed sweet potatoes.",
    educationCopy: "The orange-fleshed type, which is sweeter and higher in vitamin A than the pale kind.",
    benefitsCopy: "Beta-carotene, fibre and slow-release energy. Roasted, boiled or made into chips.",
    storageTips: "Store in a cool, dark, airy place, not the fridge. They keep for a couple of weeks.",
  }),
  P({
    slug: "cabbage", name: "Cabbage", category: "VEGETABLE", unit: "per head", orderUnit: "PIECE", minOrderQty: 1, stepQty: 1,
    memberPrice: 700, standardPrice: 1000, source: "Trusted local farmers", imageEmoji: "🥬",
    description: "Full head of fresh cabbage.",
    educationCopy: "Tight, heavy heads, packed by our local partners. Weight for size is the sign of a fresh one.",
    benefitsCopy: "Vitamin C, vitamin K and fibre. Shredded raw for coleslaw or added to stir-fries and jollof.",
    storageTips: "Refrigerate whole in a bag for up to two weeks. Cut halves brown at the edge, so trim before use.",
  }),

  // Boxes & baskets
  P({
    slug: "breakfast-box", name: "Family Breakfast Box", category: "BOX_BUNDLE", unit: "per box", orderUnit: "PIECE", minOrderQty: 1, stepQty: 1,
    memberPrice: 3200, standardPrice: 4300, source: "Trusted local farmers", imageEmoji: "🧺", featured: true,
    description: "Pawpaw, banana, oranges and avocado, sized for a family breakfast.",
    educationCopy: "A fixed mix built for a household of four across a week of breakfasts. Contents shift slightly with the season.",
    benefitsCopy: "A spread of vitamin C, potassium and fibre across the week without having to plan it.",
    storageTips: "Unpack on arrival. Refrigerate the pawpaw and avocado once ripe, keep the bananas and oranges out.",
  }),
  P({
    slug: "soup-box", name: "Soup Pot Box", category: "BOX_BUNDLE", unit: "per box", orderUnit: "PIECE", minOrderQty: 1, stepQty: 1,
    memberPrice: 2400, standardPrice: 3300, source: "Trusted local farmers", imageEmoji: "🧺",
    description: "Ugu, spinach, tomato, pepper and onion for a pot of soup.",
    educationCopy: "Everything green and aromatic for one large pot of Nigerian soup, portioned so nothing is left to spoil.",
    benefitsCopy: "Iron and vitamins A and C from the leaves, plus the pepper and onion base.",
    storageTips: "Cook the leaves within two days. The tomato, pepper and onion keep longer.",
  }),
  P({
    slug: "smoothie-box", name: "Smoothie Starter Box", category: "BOX_BUNDLE", unit: "per box", orderUnit: "PIECE", minOrderQty: 1, stepQty: 1,
    memberPrice: 2800, standardPrice: 3800, source: "Trusted local farmers", imageEmoji: "🧺", featured: true,
    description: "Pineapple, banana, mango and ginger, ready to blend.",
    educationCopy: "A week of blends. Fruit is picked slightly riper than usual since it is going straight into a blender.",
    benefitsCopy: "Vitamin C, potassium and fibre. Freeze portions so a smoothie is a two-minute job.",
    storageTips: "Peel and chop, then freeze in bags on arrival. Blend from frozen with water, milk or yoghurt.",
  }),
  P({
    slug: "recovery-box", name: "Post-Workout Recovery Box", category: "BOX_BUNDLE", unit: "per box", orderUnit: "PIECE", minOrderQty: 1, stepQty: 1,
    memberPrice: 3000, standardPrice: 4000, source: "Trusted local farmers", imageEmoji: "🧺",
    description: "Banana, watermelon, sweet potato and spinach.",
    educationCopy: "A mix people commonly reach for after training: quick carbohydrate, fluids and greens.",
    benefitsCopy: "Potassium and carbohydrate from the banana and sweet potato, fluids from the watermelon, iron from the spinach.",
    storageTips: "Refrigerate the watermelon and spinach. Keep the bananas and sweet potato at room temperature.",
  }),
  P({
    slug: "weekly-staples-box", name: "Weekly Staples Box", category: "BOX_BUNDLE", unit: "per box", orderUnit: "PIECE", minOrderQty: 1, stepQty: 1,
    memberPrice: 4200, standardPrice: 5600, source: "Trusted local farmers", imageEmoji: "🧺", featured: true,
    description: "Tomato, onion, pepper, plantain, carrot and greens for the week.",
    educationCopy: "The vegetables a Nigerian kitchen goes through in a normal week, in one box, at combo pricing for members.",
    benefitsCopy: "Covers the stew base plus greens and a starch, so most weeknight meals are already half-shopped.",
    storageTips: "Onions and plantain out of the fridge. Everything else in the crisper drawer.",
  }),

  // Seasonal
  P({
    slug: "corn", name: "Fresh Corn", category: "SEASONAL", unit: "per pair of 2", orderUnit: "PAIR", minOrderQty: 2, stepQty: 2,
    memberPrice: 500, standardPrice: 700, source: "Trusted local farmers", imageEmoji: "🌽",
    description: "Sweet corn on the cob, in season now.",
    educationCopy: "Picked young while the kernels are still milky. Corn starts turning its sugar to starch the moment it is picked, so we move it fast.",
    benefitsCopy: "Fibre, some B vitamins and the antioxidants lutein and zeaxanthin. Boiled or roasted, often with ube.",
    storageTips: "Cook the day it arrives if you can. Otherwise refrigerate in the husk and use within two days.",
  }),
  P({
    slug: "garden-egg", name: "Garden Egg", category: "SEASONAL", unit: "per 500g", orderUnit: "WEIGHT", minOrderQty: 500, stepQty: 250,
    memberPrice: 600, standardPrice: 850, source: "Trusted local farmers", imageEmoji: "🍆",
    description: "Crisp garden eggs, seasonal.",
    educationCopy: "Small white and green African aubergines. Slightly bitter, which is the point. Served with groundnut paste.",
    benefitsCopy: "Low in calories, with fibre and some potassium. Eaten raw as a snack or cooked into sauce.",
    storageTips: "Refrigerate in a bag for up to a week. The green ones keep a little longer than the white.",
  }),
  P({
    slug: "agbalumo", name: "African Star Apple (Agbalumo)", category: "SEASONAL", unit: "per 500g", orderUnit: "WEIGHT", minOrderQty: 500, stepQty: 250,
    memberPrice: 900, standardPrice: 1200, source: "Trusted local farmers", imageEmoji: "⭐",
    description: "Agbalumo, only around for a few weeks.",
    educationCopy: "Also called udara. A short season around the turn of the year. Sweet-and-sour, sticky, and eaten straight from the skin.",
    benefitsCopy: "Vitamin C and fibre. A seasonal treat rather than an everyday fruit.",
    storageTips: "Ripen at room temperature until it softens and the skin darkens. Eat within a couple of days.",
  }),
  P({
    slug: "velvet-tamarind", name: "Velvet Tamarind (Awin)", category: "SEASONAL", unit: "per 250g", orderUnit: "WEIGHT", minOrderQty: 250, stepQty: 250,
    memberPrice: 700, standardPrice: 950, source: "Trusted local farmers", imageEmoji: "🟤",
    description: "Awin, a tangy seasonal snack.",
    educationCopy: "Small hard-shelled pods with a tart, powdery pulp around the seed. A childhood snack across the south west.",
    benefitsCopy: "Sharp, tangy and low in calories. Eaten as a snack, or steeped for a drink.",
    storageTips: "Keep dry at room temperature. The shells protect the pulp for a couple of weeks.",
  }),

  // Fresh Cuts (pre-cut, ready to eat)
  P({
    slug: "pineapple-chunks", name: "Pineapple Chunks", category: "FRUIT", unit: "per 400g tub", orderUnit: "PIECE", minOrderQty: 1, stepQty: 1,
    memberPrice: 1400, standardPrice: 1800, source: "Trusted local farmers", imageEmoji: "🍍", tags: ["fresh-cuts"], featured: true,
    description: "Peeled, cored and cut. Ready to eat.",
    educationCopy: "Cut from the same pineapples we sell whole, prepared the morning your order goes out.",
    benefitsCopy: "Vitamin C and fibre, with none of the prep. Good for lunchboxes and the office fridge.",
    storageTips: "Keep refrigerated and eat within three days of delivery. Do not leave out of the fridge for more than two hours.",
  }),
  P({
    slug: "watermelon-cubes", name: "Watermelon Cubes", category: "FRUIT", unit: "per 500g tub", orderUnit: "PIECE", minOrderQty: 1, stepQty: 1,
    memberPrice: 1300, standardPrice: 1700, source: "Trusted local farmers", imageEmoji: "🍉", tags: ["fresh-cuts"],
    description: "Rind removed, cut into cubes.",
    educationCopy: "A whole watermelon is a lot to get through. This is a single tub, cut and ready.",
    benefitsCopy: "Hydrating and low in calories. Keep a tub in the fridge for a quick cold snack.",
    storageTips: "Refrigerate and eat within two days. Drain any liquid that collects before serving.",
  }),
  P({
    slug: "mixed-fruit-cup", name: "Mixed Fruit Cup", category: "FRUIT", unit: "per 350g cup", orderUnit: "PIECE", minOrderQty: 1, stepQty: 1,
    memberPrice: 1500, standardPrice: 1900, source: "Trusted local farmers", imageEmoji: "🥗", tags: ["fresh-cuts"], featured: true,
    description: "Pawpaw, pineapple, watermelon and banana, cut and mixed.",
    educationCopy: "A rotating mix of whatever is at its best that week, cut into one grab-and-go cup.",
    benefitsCopy: "A spread of vitamins from several fruits in one portion. Built for breakfast on the move.",
    storageTips: "Keep cold and eat within two days. Banana softens fastest, so eat sooner rather than later.",
  }),
  P({
    slug: "coleslaw-mix", name: "Coleslaw Mix", category: "VEGETABLE", unit: "per 300g bag", orderUnit: "PIECE", minOrderQty: 1, stepQty: 1,
    memberPrice: 900, standardPrice: 1200, source: "Trusted local farmers", imageEmoji: "🥗", tags: ["fresh-cuts"],
    description: "Shredded cabbage and carrot, ready to dress.",
    educationCopy: "Cabbage and carrot, washed and shredded, so coleslaw is just a matter of adding dressing.",
    benefitsCopy: "Vitamin C, vitamin K and fibre. A quick side for rice and grilled meat or fish.",
    storageTips: "Refrigerate and use within three days. Dress only the portion you are about to eat.",
  }),
  P({
    slug: "stir-fry-veg-mix", name: "Stir-fry Vegetable Mix", category: "VEGETABLE", unit: "per 350g bag", orderUnit: "PIECE", minOrderQty: 1, stepQty: 1,
    memberPrice: 1100, standardPrice: 1450, source: "Trusted local farmers", imageEmoji: "🥗", tags: ["fresh-cuts"],
    description: "Sliced pepper, cabbage, carrot and onion for a fast stir-fry.",
    educationCopy: "The vegetables for a stir-fry or fried rice, sliced and portioned so a weeknight meal comes together in minutes.",
    benefitsCopy: "A mix of vitamins A, C and K with fibre. Cook hot and fast to keep the crunch.",
    storageTips: "Refrigerate and use within three days. Add to a very hot pan straight from the fridge.",
  }),
];

const recipes: {
  slug: string;
  title: string;
  summary: string;
  goalTags: string[];
  ingredientSlugs: string[];
  instructions: string;
}[] = [
  {
    slug: "efo-riro",
    title: "Everyday Efo Riro",
    summary: "The Yoruba spinach stew, built on the soup box vegetables.",
    goalTags: ["general-wellness", "family-household"],
    ingredientSlugs: ["spinach", "ugu", "tomato", "bell-pepper", "chilli", "onion"],
    instructions:
      "Blend the tomato, bell pepper, chilli and half the onion.\nFry the rest of the onion in oil, then add the blend and cook down until the oil rises.\nStir in your protein and stock, season, and simmer for ten minutes.\nAdd the washed, sliced greens, stir, and cook for three to five minutes.\nServe with rice, yam or eba.",
  },
  {
    slug: "pineapple-ginger-smoothie",
    title: "Pineapple and Ginger Smoothie",
    summary: "A three-ingredient blend from the smoothie box.",
    goalTags: ["post-workout-recovery", "general-wellness"],
    ingredientSlugs: ["pineapple", "banana", "ginger"],
    instructions:
      "Peel and chop the pineapple and banana, freeze if you have time.\nGrate a small piece of ginger.\nBlend with water, coconut water or milk until smooth.\nTaste and add more ginger or a little lime.",
  },
  {
    slug: "dodo-and-eggs",
    title: "Dodo and Eggs",
    summary: "Fried ripe plantain with peppered eggs.",
    goalTags: ["family-household"],
    ingredientSlugs: ["plantain", "tomato", "chilli", "onion"],
    instructions:
      "Slice ripe plantain and fry in hot oil until deep gold. Drain.\nDice the tomato, chilli and onion and soften in a little oil.\nPour in beaten, seasoned eggs and stir gently until just set.\nServe the eggs over or alongside the dodo.",
  },
  {
    slug: "roast-sweet-potato-spinach",
    title: "Roast Sweet Potato with Wilted Spinach",
    summary: "A simple recovery plate from the recovery box.",
    goalTags: ["post-workout-recovery", "weight-management"],
    ingredientSlugs: ["sweet-potato", "spinach", "onion"],
    instructions:
      "Cut the sweet potato into wedges, toss with oil and salt, roast hot until soft and caramelised.\nSoften sliced onion in a pan, add the washed spinach, and cook until just wilted.\nPile the spinach over the wedges and finish with pepper.",
  },
  {
    slug: "cucumber-tomato-side",
    title: "Cucumber and Tomato Side",
    summary: "No-cook, five minutes, from fridge staples.",
    goalTags: ["weight-management", "general-wellness"],
    ingredientSlugs: ["cucumber", "tomato", "onion", "lime"],
    instructions:
      "Dice the cucumber and tomato, slice the onion thin.\nToss with a squeeze of lime, a little oil, salt and pepper.\nLet it sit for ten minutes before serving.",
  },
  {
    slug: "coleslaw",
    title: "Quick Coleslaw",
    summary: "Uses the Fresh Cuts coleslaw mix.",
    goalTags: ["family-household"],
    ingredientSlugs: ["coleslaw-mix", "carrot"],
    instructions:
      "Tip the coleslaw mix into a bowl.\nStir together mayonnaise, a little sugar, salt and a squeeze of lime or vinegar.\nFold the dressing through just before serving so it stays crisp.",
  },
  {
    slug: "family-fruit-plate",
    title: "Family Fruit Plate",
    summary: "A shared breakfast plate from the breakfast box.",
    goalTags: ["family-household", "general-wellness"],
    ingredientSlugs: ["pawpaw", "banana", "orange", "avocado"],
    instructions:
      "Slice the pawpaw and avocado, peel and segment the oranges, slice the bananas.\nArrange on one large plate.\nFinish with a squeeze of lime over the avocado and pawpaw.",
  },
  {
    slug: "pepper-soup-veg",
    title: "Scent Leaf Pepper Soup Base",
    summary: "The aromatic base for a light pepper soup.",
    goalTags: ["general-wellness"],
    ingredientSlugs: ["scent-leaf", "chilli", "onion", "ginger"],
    instructions:
      "Bring stock to a simmer with sliced onion, grated ginger and chilli to taste.\nAdd your protein and cook through.\nStir in a handful of torn scent leaf right at the end and turn off the heat.",
  },
];

async function main() {
  for (const tier of tiers) {
    await prisma.subscriptionTier.upsert({ where: { slug: tier.slug }, update: tier, create: tier });
  }
  for (const zone of zones) {
    await prisma.deliveryZone.upsert({ where: { slug: zone.slug }, update: zone, create: zone });
  }
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  const relatedSlugsFor = (product: SeedProduct): string[] => {
    const picked = (EXTRAS[product.slug]?.related ?? []).filter(
      (s) => bySlug.has(s) && s !== product.slug,
    );
    if (picked.length > 0) return picked;
    return products
      .filter((p) => p.category === product.category && p.slug !== product.slug)
      .slice(0, 4)
      .map((p) => p.slug);
  };

  for (const product of products) {
    const extra = EXTRAS[product.slug] ?? {};
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        ...product,
        blurb: extra.blurb ?? `${product.description} ${product.educationCopy}`,
        sourcingLine: extra.sourcingLine ?? "Freshly selected and quality checked before it leaves us.",
        howToEnjoyCopy:
          extra.howToEnjoy ?? "Best eaten fresh. See the recipes it appears in for more ideas.",
        ratingAvg: extra.rating?.[0] ?? null,
        ratingCount: extra.rating?.[1] ?? 0,
      },
      create: {
        ...product,
        blurb: extra.blurb ?? `${product.description} ${product.educationCopy}`,
        sourcingLine: extra.sourcingLine ?? "Freshly selected and quality checked before it leaves us.",
        howToEnjoyCopy:
          extra.howToEnjoy ?? "Best eaten fresh. See the recipes it appears in for more ideas.",
        ratingAvg: extra.rating?.[0] ?? null,
        ratingCount: extra.rating?.[1] ?? 0,
      },
    });
  }

  const allProducts = await prisma.product.findMany();
  const idBySlug = new Map(allProducts.map((p) => [p.slug, p.id]));

  // Second pass: resolve related product slugs to ids now that every product exists.
  for (const product of products) {
    const ids = relatedSlugsFor(product)
      .map((s) => idBySlug.get(s))
      .filter((id): id is string => Boolean(id));
    await prisma.product.update({ where: { slug: product.slug }, data: { relatedProductIds: ids } });
  }

  for (const recipe of recipes) {
    const data = {
      slug: recipe.slug,
      title: recipe.title,
      summary: recipe.summary,
      goalTags: recipe.goalTags,
      instructions: recipe.instructions,
      ingredientProductIds: recipe.ingredientSlugs
        .map((s) => idBySlug.get(s))
        .filter((id): id is string => Boolean(id)),
    };
    await prisma.recipe.upsert({ where: { slug: recipe.slug }, update: data, create: data });
  }

  console.log(
    `Seeded ${tiers.length} tiers, ${zones.length} zones, ${products.length} products, ${recipes.length} recipes.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
