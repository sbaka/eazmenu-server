import { db } from "./index";
import { ingredients, type IngredientCategory } from "@sbaka/shared";

// Common ingredients organized by category
const SEED_INGREDIENTS: Array<{ name: string; category: IngredientCategory; isAllergen?: boolean }> = [
  // Vegetables
  { name: "Tomato", category: "vegetables" },
  { name: "Onion", category: "vegetables" },
  { name: "Garlic", category: "vegetables" },
  { name: "Carrot", category: "vegetables" },
  { name: "Potato", category: "vegetables" },
  { name: "Bell Pepper", category: "vegetables" },
  { name: "Cucumber", category: "vegetables" },
  { name: "Lettuce", category: "vegetables" },
  { name: "Spinach", category: "vegetables" },
  { name: "Mushroom", category: "vegetables" },
  { name: "Zucchini", category: "vegetables" },
  { name: "Eggplant", category: "vegetables" },
  { name: "Broccoli", category: "vegetables" },
  { name: "Cauliflower", category: "vegetables" },
  { name: "Celery", category: "vegetables", isAllergen: true },
  
  // Fruits
  { name: "Lemon", category: "fruits" },
  { name: "Lime", category: "fruits" },
  { name: "Orange", category: "fruits" },
  { name: "Apple", category: "fruits" },
  { name: "Avocado", category: "fruits" },
  { name: "Mango", category: "fruits" },
  { name: "Pineapple", category: "fruits" },
  
  // Proteins
  { name: "Chicken", category: "proteins" },
  { name: "Beef", category: "proteins" },
  { name: "Pork", category: "proteins" },
  { name: "Lamb", category: "proteins" },
  { name: "Turkey", category: "proteins" },
  { name: "Duck", category: "proteins" },
  { name: "Egg", category: "proteins", isAllergen: true },
  { name: "Tofu", category: "proteins", isAllergen: true },
  
  // Dairy
  { name: "Milk", category: "dairy", isAllergen: true },
  { name: "Butter", category: "dairy", isAllergen: true },
  { name: "Cheese", category: "dairy", isAllergen: true },
  { name: "Cream", category: "dairy", isAllergen: true },
  { name: "Yogurt", category: "dairy", isAllergen: true },
  { name: "Mozzarella", category: "dairy", isAllergen: true },
  { name: "Parmesan", category: "dairy", isAllergen: true },
  { name: "Feta", category: "dairy", isAllergen: true },
  
  // Grains
  { name: "Rice", category: "grains" },
  { name: "Pasta", category: "grains", isAllergen: true },
  { name: "Bread", category: "grains", isAllergen: true },
  { name: "Flour", category: "grains", isAllergen: true },
  { name: "Quinoa", category: "grains" },
  { name: "Oats", category: "grains", isAllergen: true },
  { name: "Couscous", category: "grains", isAllergen: true },
  
  // Spices
  { name: "Salt", category: "spices" },
  { name: "Black Pepper", category: "spices" },
  { name: "Paprika", category: "spices" },
  { name: "Cumin", category: "spices" },
  { name: "Coriander", category: "spices" },
  { name: "Turmeric", category: "spices" },
  { name: "Cinnamon", category: "spices" },
  { name: "Chili Powder", category: "spices" },
  { name: "Oregano", category: "spices" },
  { name: "Thyme", category: "spices" },
  { name: "Mustard", category: "spices", isAllergen: true },
  
  // Herbs
  { name: "Basil", category: "herbs" },
  { name: "Parsley", category: "herbs" },
  { name: "Cilantro", category: "herbs" },
  { name: "Mint", category: "herbs" },
  { name: "Rosemary", category: "herbs" },
  { name: "Dill", category: "herbs" },
  
  // Oils
  { name: "Olive Oil", category: "oils" },
  { name: "Vegetable Oil", category: "oils" },
  { name: "Sesame Oil", category: "oils", isAllergen: true },
  { name: "Coconut Oil", category: "oils" },
  
  // Seafood
  { name: "Salmon", category: "seafood", isAllergen: true },
  { name: "Tuna", category: "seafood", isAllergen: true },
  { name: "Shrimp", category: "seafood", isAllergen: true },
  { name: "Cod", category: "seafood", isAllergen: true },
  { name: "Crab", category: "seafood", isAllergen: true },
  { name: "Lobster", category: "seafood", isAllergen: true },
  { name: "Squid", category: "seafood", isAllergen: true },
  
  // Nuts
  { name: "Almond", category: "nuts", isAllergen: true },
  { name: "Walnut", category: "nuts", isAllergen: true },
  { name: "Cashew", category: "nuts", isAllergen: true },
  { name: "Peanut", category: "nuts", isAllergen: true },
  { name: "Pistachio", category: "nuts", isAllergen: true },
  { name: "Pine Nut", category: "nuts", isAllergen: true },
  
  // Sweeteners
  { name: "Sugar", category: "sweeteners" },
  { name: "Honey", category: "sweeteners" },
  { name: "Maple Syrup", category: "sweeteners" },
  { name: "Brown Sugar", category: "sweeteners" },
  
  // Condiments
  { name: "Soy Sauce", category: "condiments", isAllergen: true },
  { name: "Vinegar", category: "condiments" },
  { name: "Ketchup", category: "condiments" },
  { name: "Mayonnaise", category: "condiments", isAllergen: true },
  { name: "Hot Sauce", category: "condiments" },
  { name: "Worcestershire Sauce", category: "condiments", isAllergen: true },
];

async function seedIngredients() {
  console.log("Seeding ingredients...");
  
  // Check if ingredients already exist
  const existingIngredients = await db.query.ingredients.findMany();
  if (existingIngredients.length > 0) {
    console.log(`Ingredients already seeded (${existingIngredients.length} found), skipping.`);
    return;
  }

  // Insert all ingredients
  await db.insert(ingredients).values(
    SEED_INGREDIENTS.map((ing) => ({
      name: ing.name,
      category: ing.category,
      isAllergen: ing.isAllergen ?? false,
    }))
  );

  console.log(`Seeded ${SEED_INGREDIENTS.length} ingredients.`);
}

export async function runSeed() {
  try {
    console.log("Starting database seed...");

    // Seed global ingredients (these are shared across all restaurants)
    await seedIngredients();

    // Check if there are existing restaurants (proxy for existing data)
    const existingRestaurants = await db.query.restaurants.findMany();
    if (existingRestaurants.length > 0) {
      console.log(`Database already has ${existingRestaurants.length} restaurants, skipping restaurant seed.`);
      console.log("Note: Merchants are auto-created when users first authenticate via Supabase.");
      return;
    }

    console.log("No existing data found. Seed data will be created when a user authenticates via Supabase.");
    console.log("To seed demo data, first authenticate a user, then run seed again with their restaurant ID.");
    console.log("Database seed check completed.");
  } catch (error) {
    console.error("Error checking database:", error);
  }
}

// Run seed if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSeed();
}
