import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ProductCategory } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const tiers = [
  {
    slug: "base",
    name: "Base",
    monthlyFee: 4500,
    tagline: "Member pricing and a weekly delivery slot.",
    sortOrder: 1,
    perks: [
      "Member pricing on every product",
      "One fixed delivery day per week",
      "Standing basket that repeats automatically",
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
      "Free delivery on your set delivery day",
      "Combo pricing on paired produce",
      "Top-up orders at member pricing",
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
      "Trained assistant priority suggestions",
    ],
  },
];

const zones = [
  { slug: "lekki-ajah", name: "Lekki / Ajah", area: "Lekki, Ajah, Sangotedo" },
  { slug: "ikeja-gra", name: "Ikeja / GRA", area: "Ikeja, Magodo, Ogudu" },
  { slug: "yaba-surulere", name: "Yaba / Surulere", area: "Yaba, Surulere, Ebute Metta" },
];

type SeedProduct = {
  slug: string;
  name: string;
  category: ProductCategory;
  unit: string;
  memberPrice: number;
  marketPrice: number;
  inSeason: boolean;
  source: string;
  description: string;
  imageEmoji: string;
  featured?: boolean;
};

const products: SeedProduct[] = [
  { slug: "pawpaw", name: "Pawpaw", category: "FRUIT", unit: "1 whole", memberPrice: 900, marketPrice: 1200, inSeason: true, source: "Ogun State farms", description: "Sweet, ripe pawpaw picked within days of delivery.", imageEmoji: "🥭", featured: true },
  { slug: "watermelon", name: "Watermelon", category: "FRUIT", unit: "1 whole", memberPrice: 1800, marketPrice: 2500, inSeason: true, source: "Oyo State farms", description: "Full-size watermelon, sweet and well-ripened.", imageEmoji: "🍉" },
  { slug: "pineapple", name: "Pineapple", category: "FRUIT", unit: "1 whole", memberPrice: 1200, marketPrice: 1600, inSeason: true, source: "Ogun State farms", description: "Golden, ready-to-eat pineapple.", imageEmoji: "🍍", featured: true },
  { slug: "banana", name: "Banana", category: "FRUIT", unit: "1 bunch", memberPrice: 1000, marketPrice: 1400, inSeason: true, source: "Ondo State farms", description: "A full bunch of ripe bananas.", imageEmoji: "🍌" },
  { slug: "orange", name: "Orange", category: "FRUIT", unit: "6 pieces", memberPrice: 1100, marketPrice: 1500, inSeason: true, source: "Ondo State farms", description: "Juicy oranges, hand-picked.", imageEmoji: "🍊" },
  { slug: "apple", name: "Apple", category: "FRUIT", unit: "4 pieces", memberPrice: 2200, marketPrice: 2900, inSeason: false, source: "Partner cold-chain import", description: "Crisp apples, held cold from farm to door.", imageEmoji: "🍎" },
  { slug: "mango", name: "Mango", category: "FRUIT", unit: "3 pieces", memberPrice: 1300, marketPrice: 1800, inSeason: true, source: "Oyo State farms", description: "Ripe, fragrant mangoes.", imageEmoji: "🥭" },
  { slug: "avocado", name: "Avocado", category: "FRUIT", unit: "3 pieces", memberPrice: 1600, marketPrice: 2100, inSeason: true, source: "Ondo State farms", description: "Creamy avocados, ready to eat within days.", imageEmoji: "🥑", featured: true },
  { slug: "cucumber", name: "Cucumber", category: "VEGETABLE", unit: "3 pieces", memberPrice: 700, marketPrice: 1000, inSeason: true, source: "Ogun State farms", description: "Crisp, fresh cucumbers.", imageEmoji: "🥒" },
  { slug: "tomato", name: "Tomato", category: "VEGETABLE", unit: "1kg", memberPrice: 1200, marketPrice: 1700, inSeason: true, source: "Oyo State farms", description: "Ripe, firm tomatoes.", imageEmoji: "🍅", featured: true },
  { slug: "bell-pepper", name: "Bell Pepper (Tatashe)", category: "VEGETABLE", unit: "1kg", memberPrice: 1500, marketPrice: 2000, inSeason: true, source: "Ogun State farms", description: "Red bell peppers, sold by the kilo.", imageEmoji: "🫑" },
  { slug: "carrot", name: "Carrot", category: "VEGETABLE", unit: "1kg", memberPrice: 900, marketPrice: 1300, inSeason: true, source: "Oyo State farms", description: "Sweet, crunchy carrots.", imageEmoji: "🥕" },
  { slug: "spinach", name: "Spinach (Green)", category: "VEGETABLE", unit: "1 bunch", memberPrice: 500, marketPrice: 800, inSeason: true, source: "Ogun State farms", description: "Fresh leafy greens, cut to order.", imageEmoji: "🥬" },
  { slug: "ugu", name: "Ugu (Fluted Pumpkin Leaf)", category: "VEGETABLE", unit: "1 bunch", memberPrice: 600, marketPrice: 900, inSeason: true, source: "Ondo State farms", description: "A Lagos kitchen staple, freshly cut.", imageEmoji: "🥬", featured: true },
  { slug: "onion", name: "Onion", category: "VEGETABLE", unit: "1kg", memberPrice: 900, marketPrice: 1300, inSeason: true, source: "Oyo State farms", description: "Firm, dry onions.", imageEmoji: "🧅" },
  { slug: "ginger", name: "Ginger", category: "VEGETABLE", unit: "500g", memberPrice: 800, marketPrice: 1100, inSeason: true, source: "Ogun State farms", description: "Fresh root ginger.", imageEmoji: "🫚" },
  { slug: "sweet-potato", name: "Sweet Potato", category: "VEGETABLE", unit: "1kg", memberPrice: 800, marketPrice: 1100, inSeason: true, source: "Oyo State farms", description: "Orange-fleshed sweet potatoes.", imageEmoji: "🍠" },
  { slug: "plantain", name: "Plantain", category: "VEGETABLE", unit: "4 pieces", memberPrice: 1000, marketPrice: 1400, inSeason: true, source: "Ondo State farms", description: "Ripe plantain, ready to fry or roast.", imageEmoji: "🍌" },
  { slug: "cabbage", name: "Cabbage", category: "VEGETABLE", unit: "1 whole", memberPrice: 700, marketPrice: 1000, inSeason: true, source: "Oyo State farms", description: "Full head of fresh cabbage.", imageEmoji: "🥬" },
  { slug: "green-beans", name: "Green Beans", category: "VEGETABLE", unit: "500g", memberPrice: 900, marketPrice: 1300, inSeason: false, source: "Ogun State farms", description: "Tender green beans.", imageEmoji: "🫛" },
  { slug: "breakfast-combo", name: "Family Breakfast Combo", category: "COMBO", unit: "1 pack", memberPrice: 3200, marketPrice: 4300, inSeason: true, source: "Ogun & Oyo State farms", description: "Pawpaw, banana, orange and avocado, sized for a family breakfast.", imageEmoji: "🧺", featured: true },
  { slug: "soup-combo", name: "Soup Pot Vegetable Combo", category: "COMBO", unit: "1 pack", memberPrice: 2400, marketPrice: 3300, inSeason: true, source: "Ogun & Ondo State farms", description: "Ugu, spinach, tomato, pepper and onion for a pot of soup.", imageEmoji: "🧺" },
  { slug: "smoothie-combo", name: "Smoothie Starter Combo", category: "COMBO", unit: "1 pack", memberPrice: 2800, marketPrice: 3800, inSeason: true, source: "Ogun & Ondo State farms", description: "Pineapple, banana, mango and ginger, ready to blend.", imageEmoji: "🧺", featured: true },
  { slug: "recovery-combo", name: "Post-Workout Recovery Combo", category: "COMBO", unit: "1 pack", memberPrice: 3000, marketPrice: 4000, inSeason: true, source: "Ogun & Oyo State farms", description: "Banana, watermelon, sweet potato and spinach.", imageEmoji: "🧺" },
];

async function main() {
  for (const tier of tiers) {
    await prisma.subscriptionTier.upsert({
      where: { slug: tier.slug },
      update: tier,
      create: tier,
    });
  }

  for (const zone of zones) {
    await prisma.zone.upsert({
      where: { slug: zone.slug },
      update: zone,
      create: zone,
    });
  }

  for (const product of products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: product,
      create: product,
    });
  }

  console.log(`Seeded ${tiers.length} tiers, ${zones.length} zones, ${products.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
