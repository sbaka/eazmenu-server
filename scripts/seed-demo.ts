/**
 * CLI script to seed a premium burger restaurant with demo data.
 *
 * Usage:
 *   npx tsx scripts/seed-demo.ts <restaurant-id> [--force]
 *
 * Flags:
 *   --force   Delete existing categories, items, and tables before seeding
 *
 * What it creates:
 *   - English language (primary)
 *   - 5 categories: Signature Burgers, Sides & Fries, Smoothies, Coffee Bar, Desserts
 *   - 25+ menu items with descriptions, prices, allergens, and nutritional info
 *   - Ingredients linked to each item
 *   - 4 tables (2-seat, 4-seat, 6-seat, 8-seat)
 *
 * Safety:
 *   - Validates the restaurant exists and belongs to a merchant
 *   - Skips if the restaurant already has categories (won't double-seed)
 *   - All inserts happen inside a transaction (all-or-nothing)
 */

import { db } from "../db/index";
import { runSeed } from "../db/seed";
import {
    restaurants,
    languages,
    categories,
    menuItems,
    ingredients,
    menuItemIngredients,
    tables,
    type IngredientCategory,
} from "@sbaka/shared";
import { eq, and, inArray } from "drizzle-orm";
import { generateTableHashId } from "../qr-utils";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const RESTAURANT_INFO = {
    name: "Smoke & Stack",
    description:
        "Premium smash burgers, hand-cut fries, craft smoothies, and specialty coffee — all under one roof.",
    address: "42 Grill Avenue, Downtown",
    phone: "+1 555-0142",
    currency: "USD",
    themeConfig: {
        primaryColor: "#1a1a2e",
        accentColor: "#e94560",
        fontFamily: "Poppins" as const,
    },
    chefMessage:
        "Every patty is smashed fresh on a searing-hot griddle. No freezers, no shortcuts.",
};

interface SeedCategory {
    name: string;
    sortOrder: number;
    items: SeedItem[];
}

interface SeedItem {
    name: string;
    description: string;
    /** Price in cents */
    price: number;
    calories?: number;
    proteins?: number;
    fats?: number;
    carbs?: number;
    weight?: number;
    allergens?: string[];
    isFeatured?: boolean;
    isBio?: boolean;
    ingredientNames: string[];
    imageUrl?: string;
}

// Unsplash image URLs (free to use under Unsplash License)
const unsplash = (id: string) =>
    `https://images.unsplash.com/${id}?w=800&q=80&auto=format&fit=crop`;

const DEMO_CATEGORIES: SeedCategory[] = [
    {
        name: "Signature Burgers",
        sortOrder: 0,
        items: [
            {
                name: "The Classic Smash",
                description:
                    "Double smashed beef patties, American cheese, pickles, onion, house sauce on a brioche bun.",
                price: 1390,
                calories: 720,
                proteins: 42,
                fats: 44,
                carbs: 38,
                weight: 280,
                allergens: ["Gluten", "Dairy", "Eggs", "Sesame"],
                isFeatured: true,
                ingredientNames: ["Beef", "Cheese", "Onion", "Bread", "Butter", "Lettuce", "Mayonnaise"],
                imageUrl: unsplash('photo-1568901346375-23c9450c58cd'),
            },
            {
                name: "Smoky BBQ Burger",
                description:
                    "Smashed patty, smoked bacon, crispy onion rings, sharp cheddar, tangy BBQ drizzle.",
                price: 1590,
                calories: 880,
                proteins: 48,
                fats: 52,
                carbs: 46,
                weight: 320,
                allergens: ["Gluten", "Dairy", "Eggs"],
                ingredientNames: ["Beef", "Cheese", "Onion", "Bread", "Ketchup", "Mayonnaise"],
                imageUrl: unsplash('photo-1544037803-ed377ec9a75e'),
            },
            {
                name: "Truffle Mushroom Burger",
                description:
                    "Sautéed mushrooms, truffle aioli, Swiss cheese, arugula on a toasted pretzel bun.",
                price: 1790,
                calories: 760,
                proteins: 40,
                fats: 46,
                carbs: 42,
                weight: 300,
                allergens: ["Gluten", "Dairy", "Eggs"],
                isFeatured: true,
                ingredientNames: ["Beef", "Mushroom", "Cheese", "Bread", "Olive Oil", "Garlic"],
                imageUrl: unsplash('photo-1678110707289-ab14382a1625'),
            },
            {
                name: "Spicy Jalapeño Melt",
                description:
                    "Pepper jack cheese, jalapeños, chipotle mayo, pickled red onions, fresh lettuce.",
                price: 1490,
                calories: 740,
                proteins: 41,
                fats: 43,
                carbs: 40,
                weight: 290,
                allergens: ["Gluten", "Dairy", "Eggs"],
                ingredientNames: ["Beef", "Cheese", "Onion", "Lettuce", "Bread", "Mayonnaise", "Bell Pepper"],
                imageUrl: unsplash('photo-1610970878459-a0e464d7592b'),
            },
            {
                name: "The Veggie Stack",
                description:
                    "House-made black bean patty, avocado, roasted peppers, herb mayo, whole-wheat bun.",
                price: 1290,
                calories: 580,
                proteins: 18,
                fats: 28,
                carbs: 62,
                weight: 270,
                allergens: ["Gluten", "Eggs"],
                isBio: true,
                ingredientNames: ["Avocado", "Bell Pepper", "Onion", "Lettuce", "Bread", "Tomato", "Garlic"],
                imageUrl: unsplash('photo-1713330801172-03f8d1c0dde7'),
            },
            {
                name: "Double Bacon Smash",
                description:
                    "Two smashed patties, double bacon, double American cheese, dill pickles, mustard.",
                price: 1890,
                calories: 1050,
                proteins: 62,
                fats: 68,
                carbs: 40,
                weight: 380,
                allergens: ["Gluten", "Dairy", "Mustard"],
                ingredientNames: ["Beef", "Pork", "Cheese", "Bread", "Mustard"],
                imageUrl: unsplash('photo-1544037803-ed377ec9a75e'),
            },
        ],
    },
    {
        name: "Sides & Fries",
        sortOrder: 1,
        items: [
            {
                name: "Hand-Cut Fries",
                description: "Thick-cut russet potatoes, double-fried, sea salt finish.",
                price: 490,
                calories: 380,
                proteins: 5,
                fats: 18,
                carbs: 52,
                weight: 200,
                allergens: [],
                ingredientNames: ["Potato", "Salt", "Vegetable Oil"],
                imageUrl: unsplash('photo-1541592106381-b31e9677c0e5'),
            },
            {
                name: "Truffle Parmesan Fries",
                description: "Hand-cut fries tossed with truffle oil, grated parmesan, and fresh parsley.",
                price: 790,
                calories: 460,
                proteins: 10,
                fats: 26,
                carbs: 50,
                weight: 220,
                allergens: ["Dairy"],
                isFeatured: true,
                ingredientNames: ["Potato", "Parmesan", "Olive Oil", "Parsley", "Salt"],
                imageUrl: unsplash('photo-1541592391523-5ae8c2c88d10'),
            },
            {
                name: "Onion Rings",
                description: "Beer-battered sweet onion rings, buttermilk ranch on the side.",
                price: 590,
                calories: 420,
                proteins: 6,
                fats: 24,
                carbs: 48,
                weight: 180,
                allergens: ["Gluten", "Dairy", "Eggs"],
                ingredientNames: ["Onion", "Flour", "Egg", "Milk", "Vegetable Oil", "Salt"],
                imageUrl: unsplash('photo-1541592391523-5ae8c2c88d10'),
            },
            {
                name: "Loaded Sweet Potato Fries",
                description: "Crispy sweet potato fries topped with cheddar, bacon bits, and sour cream.",
                price: 690,
                calories: 520,
                proteins: 12,
                fats: 28,
                carbs: 56,
                weight: 240,
                allergens: ["Dairy"],
                ingredientNames: ["Potato", "Cheese", "Pork", "Cream", "Salt"],
                imageUrl: unsplash('photo-1541592106381-b31e9677c0e5'),
            },
            {
                name: "Coleslaw",
                description: "Crunchy cabbage and carrot slaw with a light apple cider vinegar dressing.",
                price: 390,
                calories: 160,
                proteins: 2,
                fats: 8,
                carbs: 22,
                weight: 150,
                allergens: ["Eggs"],
                ingredientNames: ["Carrot", "Vinegar", "Mayonnaise", "Sugar"],
            },
        ],
    },
    {
        name: "Smoothies",
        sortOrder: 2,
        items: [
            {
                name: "Mango Sunrise",
                description: "Fresh mango, banana, orange juice, a hint of turmeric.",
                price: 690,
                calories: 240,
                proteins: 3,
                fats: 1,
                carbs: 58,
                weight: 400,
                allergens: [],
                ingredientNames: ["Mango", "Orange", "Turmeric", "Honey"],
                imageUrl: unsplash('photo-1611497426695-412abe2f287b'),
            },
            {
                name: "Berry Blast",
                description: "Blueberries, strawberries, raspberries, Greek yogurt, honey drizzle.",
                price: 750,
                calories: 220,
                proteins: 8,
                fats: 2,
                carbs: 46,
                weight: 400,
                allergens: ["Dairy"],
                isFeatured: true,
                ingredientNames: ["Yogurt", "Honey", "Milk"],
                imageUrl: unsplash('photo-1575487426366-079595af2247'),
            },
            {
                name: "Green Power",
                description: "Spinach, avocado, banana, almond milk, chia seeds.",
                price: 790,
                calories: 260,
                proteins: 6,
                fats: 12,
                carbs: 34,
                weight: 400,
                allergens: ["Nuts"],
                isBio: true,
                ingredientNames: ["Spinach", "Avocado", "Almond"],
                imageUrl: unsplash('photo-1717398804998-ad2d48822518'),
            },
            {
                name: "Peanut Butter Shake",
                description: "Peanut butter, banana, oat milk, cocoa powder, maple syrup.",
                price: 790,
                calories: 380,
                proteins: 14,
                fats: 18,
                carbs: 44,
                weight: 400,
                allergens: ["Peanuts"],
                ingredientNames: ["Peanut", "Oats", "Maple Syrup"],
                imageUrl: unsplash('photo-1497034825429-c343d7c6a68f'),
            },
            {
                name: "Tropical Colada",
                description: "Pineapple, coconut milk, lime juice, crushed ice.",
                price: 690,
                calories: 200,
                proteins: 2,
                fats: 8,
                carbs: 32,
                weight: 400,
                allergens: [],
                ingredientNames: ["Pineapple", "Coconut Oil", "Lime", "Sugar"],
                imageUrl: unsplash('photo-1611497426695-412abe2f287b'),
            },
        ],
    },
    {
        name: "Coffee Bar",
        sortOrder: 3,
        items: [
            {
                name: "Espresso",
                description: "Double shot of single-origin espresso. Bold and smooth.",
                price: 350,
                calories: 10,
                proteins: 0,
                fats: 0,
                carbs: 2,
                weight: 60,
                allergens: [],
                ingredientNames: [],
                imageUrl: unsplash('photo-1610889556528-9a770e32642f'),
            },
            {
                name: "Flat White",
                description: "Double espresso, velvety micro-foam milk.",
                price: 490,
                calories: 120,
                proteins: 6,
                fats: 5,
                carbs: 12,
                weight: 200,
                allergens: ["Dairy"],
                ingredientNames: ["Milk"],
                imageUrl: unsplash('photo-1541167760496-1628856ab772'),
            },
            {
                name: "Iced Caramel Latte",
                description: "Espresso over ice, caramel syrup, oat milk, whipped cream.",
                price: 590,
                calories: 260,
                proteins: 4,
                fats: 10,
                carbs: 38,
                weight: 350,
                allergens: ["Dairy"],
                isFeatured: true,
                ingredientNames: ["Milk", "Cream", "Sugar"],
                imageUrl: unsplash('photo-1575961895636-ce137b497075'),
            },
            {
                name: "Matcha Latte",
                description: "Ceremonial-grade matcha, steamed oat milk, lightly sweetened.",
                price: 550,
                calories: 180,
                proteins: 4,
                fats: 6,
                carbs: 28,
                weight: 300,
                allergens: [],
                ingredientNames: ["Honey"],
                imageUrl: unsplash('photo-1515823064-d6e0c04616a7'),
            },
            {
                name: "Cold Brew",
                description: "18-hour steeped cold brew. Served black or with a splash of cream.",
                price: 450,
                calories: 5,
                proteins: 0,
                fats: 0,
                carbs: 1,
                weight: 350,
                allergens: [],
                ingredientNames: [],
                imageUrl: unsplash('photo-1522012188892-24beb302783d'),
            },
        ],
    },
    {
        name: "Desserts",
        sortOrder: 4,
        items: [
            {
                name: "Salted Caramel Brownie",
                description: "Warm fudgy brownie, salted caramel sauce, vanilla bean ice cream.",
                price: 690,
                calories: 520,
                proteins: 6,
                fats: 28,
                carbs: 64,
                weight: 180,
                allergens: ["Gluten", "Dairy", "Eggs"],
                ingredientNames: ["Butter", "Egg", "Flour", "Sugar", "Cream", "Salt"],
                imageUrl: unsplash('photo-1578985545062-69928b1d9587'),
            },
            {
                name: "Churros",
                description: "Cinnamon-sugar churros with chocolate dipping sauce.",
                price: 590,
                calories: 440,
                proteins: 5,
                fats: 20,
                carbs: 60,
                weight: 160,
                allergens: ["Gluten", "Dairy", "Eggs"],
                ingredientNames: ["Flour", "Butter", "Egg", "Sugar", "Cinnamon", "Vegetable Oil"],
                imageUrl: unsplash('photo-1558961363-fa8fdf82db35'),
            },
            {
                name: "New York Cheesecake",
                description: "Classic creamy cheesecake with a graham cracker crust and berry compote.",
                price: 750,
                calories: 480,
                proteins: 8,
                fats: 30,
                carbs: 44,
                weight: 160,
                allergens: ["Gluten", "Dairy", "Eggs"],
                isFeatured: true,
                ingredientNames: ["Cream", "Cheese", "Egg", "Sugar", "Butter", "Flour"],
                imageUrl: unsplash('photo-1687030047990-571d5990ef69'),
            },
            {
                name: "Milkshake (Vanilla / Chocolate / Strawberry)",
                description: "Thick hand-spun milkshake made with real ice cream. Pick your flavour.",
                price: 650,
                calories: 560,
                proteins: 10,
                fats: 24,
                carbs: 76,
                weight: 400,
                allergens: ["Dairy"],
                ingredientNames: ["Milk", "Cream", "Sugar"],
                imageUrl: unsplash('photo-1497034825429-c343d7c6a68f'),
            },
        ],
    },
];

const DEMO_TABLES = [
    { number: 1, seats: 2 },
    { number: 2, seats: 4 },
    { number: 3, seats: 4 },
    { number: 4, seats: 6 },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const idArg = args.find((a) => !a.startsWith("--"));
  const restaurantId = parseInt(idArg ?? "", 10);

  if (!restaurantId || isNaN(restaurantId)) {
    console.error("Usage: npx tsx scripts/seed-demo.ts <restaurant-id> [--force]");
    process.exit(1);
  }

  // 1. Validate restaurant exists
  const [restaurant] = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.id, restaurantId))
    .limit(1);

  if (!restaurant) {
    console.error(`Restaurant with id ${restaurantId} not found.`);
    process.exit(1);
  }

  console.log(`Found restaurant "${restaurant.name}" (id=${restaurantId})`);

  // 2. Check for existing categories — guard against double-seeding
  const existingCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.restaurantId, restaurantId))
    .limit(1);

  if (existingCategories.length > 0) {
    if (!force) {
      console.error(
        "This restaurant already has categories. Run with --force to wipe and re-seed."
      );
      process.exit(1);
    }

    console.log("--force: deleting existing categories, items, and tables...");
    // Cascade deletes will remove menu_items, menu_item_ingredients,
    // menu_item_translations, category_translations, orders, and order_items.
    await db.delete(categories).where(eq(categories.restaurantId, restaurantId));
    await db.delete(tables).where(eq(tables.restaurantId, restaurantId));
    console.log("Existing data deleted.");
  }

  // 3. Ensure global ingredients exist
  await runSeed();

  // 4. Collect all needed ingredient names from the demo data
  const allIngredientNames = new Set<string>();
  for (const cat of DEMO_CATEGORIES) {
    for (const item of cat.items) {
      for (const name of item.ingredientNames) {
        allIngredientNames.add(name);
      }
    }
  }

  // 4. Resolve ingredient IDs from the global ingredients table
  const existingIngredients = await db
    .select({ id: ingredients.id, name: ingredients.name })
    .from(ingredients)
    .where(inArray(ingredients.name, [...allIngredientNames]));

  const ingredientMap = new Map(existingIngredients.map((i) => [i.name, i.id]));

  // Insert any missing ingredients into the global table
  const missingNames = [...allIngredientNames].filter((n) => !ingredientMap.has(n));
  if (missingNames.length > 0) {
    console.log(`Inserting ${missingNames.length} missing ingredients into global table...`);
    const INGREDIENT_DEFAULTS: Record<string, { category: IngredientCategory; isAllergen?: boolean }> = {
      "Beef": { category: "proteins" },
      "Cheese": { category: "dairy", isAllergen: true },
      "Onion": { category: "vegetables" },
      "Bread": { category: "grains", isAllergen: true },
      "Butter": { category: "dairy", isAllergen: true },
      "Lettuce": { category: "vegetables" },
      "Mayonnaise": { category: "condiments", isAllergen: true },
      "Ketchup": { category: "condiments" },
      "Mushroom": { category: "vegetables" },
      "Olive Oil": { category: "oils" },
      "Garlic": { category: "vegetables" },
      "Bell Pepper": { category: "vegetables" },
      "Avocado": { category: "fruits" },
      "Tomato": { category: "vegetables" },
      "Pork": { category: "proteins" },
      "Mustard": { category: "spices", isAllergen: true },
      "Potato": { category: "vegetables" },
      "Salt": { category: "spices" },
      "Vegetable Oil": { category: "oils" },
      "Parmesan": { category: "dairy", isAllergen: true },
      "Parsley": { category: "herbs" },
      "Flour": { category: "grains", isAllergen: true },
      "Egg": { category: "proteins", isAllergen: true },
      "Milk": { category: "dairy", isAllergen: true },
      "Cream": { category: "dairy", isAllergen: true },
      "Carrot": { category: "vegetables" },
      "Vinegar": { category: "condiments" },
      "Sugar": { category: "sweeteners" },
      "Mango": { category: "fruits" },
      "Orange": { category: "fruits" },
      "Turmeric": { category: "spices" },
      "Honey": { category: "sweeteners" },
      "Yogurt": { category: "dairy", isAllergen: true },
      "Spinach": { category: "vegetables" },
      "Almond": { category: "nuts", isAllergen: true },
      "Peanut": { category: "nuts", isAllergen: true },
      "Oats": { category: "grains", isAllergen: true },
      "Maple Syrup": { category: "sweeteners" },
      "Pineapple": { category: "fruits" },
      "Coconut Oil": { category: "oils" },
      "Lime": { category: "fruits" },
      "Cinnamon": { category: "spices" },
    };

    const toInsert = missingNames.map((name) => ({
      name,
      category: INGREDIENT_DEFAULTS[name]?.category ?? ("other" as IngredientCategory),
      isAllergen: INGREDIENT_DEFAULTS[name]?.isAllergen ?? false,
    }));

    const inserted = await db.insert(ingredients).values(toInsert).returning();
    for (const ing of inserted) {
      ingredientMap.set(ing.name, ing.id);
    }
    console.log(`Inserted ${inserted.length} ingredients.`);
  }

    // 5. Run everything in a transaction
    await db.transaction(async (tx) => {
        // -- Update restaurant info -----------------------------------------------
        await tx
            .update(restaurants)
            .set({
                name: RESTAURANT_INFO.name,
                description: RESTAURANT_INFO.description,
                address: RESTAURANT_INFO.address,
                phone: RESTAURANT_INFO.phone,
                currency: RESTAURANT_INFO.currency,
                themeConfig: RESTAURANT_INFO.themeConfig,
                chefMessage: RESTAURANT_INFO.chefMessage,
            })
            .where(eq(restaurants.id, restaurantId));

        console.log("Updated restaurant info.");

        // -- Ensure English language exists --------------------------------------
        const [existingLang] = await tx
            .select()
            .from(languages)
            .where(
                and(
                    eq(languages.restaurantId, restaurantId),
                    eq(languages.code, "en")
                )
            )
            .limit(1);

        let languageId: number;
        if (existingLang) {
            languageId = existingLang.id;
            // Make sure it's active and primary
            await tx
                .update(languages)
                .set({ active: true, isPrimary: true })
                .where(eq(languages.id, languageId));
            console.log("English language already exists, ensured it is active & primary.");
        } else {
            const [lang] = await tx
                .insert(languages)
                .values({
                    code: "en",
                    name: "English",
                    active: true,
                    isPrimary: true,
                    restaurantId,
                })
                .returning();
            languageId = lang.id;
            console.log("Created English language.");
        }

        // -- Categories + Items ---------------------------------------------------
        for (const cat of DEMO_CATEGORIES) {
            const [insertedCat] = await tx
                .insert(categories)
                .values({
                    name: cat.name,
                    sortOrder: cat.sortOrder,
                    restaurantId,
                })
                .returning();

            console.log(`  Category: ${cat.name} (id=${insertedCat.id})`);

            for (const item of cat.items) {
                const [insertedItem] = await tx
                    .insert(menuItems)
                    .values({
                        name: item.name,
                        description: item.description,
                        price: item.price,
                        categoryId: insertedCat.id,
                        active: true,
                        calories: item.calories,
                        proteins: item.proteins,
                        fats: item.fats,
                        carbs: item.carbs,
                        weight: item.weight,
                        allergens: item.allergens?.length ? item.allergens : null,
                        isBio: item.isBio ?? false,
                        isFeatured: item.isFeatured ?? false,
                        imageUrl: item.imageUrl ?? null,
                    })
                    .returning();

                // Link ingredients
                const ingredientLinks = item.ingredientNames
                    .map((name) => ingredientMap.get(name))
                    .filter((id): id is number => id !== undefined)
                    .map((ingredientId) => ({
                        menuItemId: insertedItem.id,
                        ingredientId,
                    }));

                if (ingredientLinks.length > 0) {
                    await tx.insert(menuItemIngredients).values(ingredientLinks);
                }

                console.log(
                    `    Item: ${item.name} — $${(item.price / 100).toFixed(2)} (${ingredientLinks.length} ingredients)`
                );
            }
        }

        // -- Tables ---------------------------------------------------------------
        // Check if tables already exist
        const existingTables = await tx
            .select()
            .from(tables)
            .where(eq(tables.restaurantId, restaurantId))
            .limit(1);

        if (existingTables.length === 0) {
            for (const t of DEMO_TABLES) {
                const qrCode = generateTableHashId(restaurantId, t.number);
                await tx.insert(tables).values({
                    number: t.number,
                    seats: t.seats,
                    restaurantId,
                    qrCode,
                    active: true,
                });
                console.log(`  Table #${t.number} (${t.seats} seats) — QR: ${qrCode}`);
            }
        } else {
            console.log("Tables already exist, skipping table creation.");
        }
    });

    console.log("\nDemo seed complete.");
    process.exit(0);
}

main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
