/**
 * CLI script to permanently delete a restaurant and all its related data.
 *
 * Usage:
 *   npx tsx scripts/drop-restaurant.ts <restaurant-id>
 *
 * Cascaded deletions (via DB foreign keys):
 *   - Orders & order items
 *   - Tables
 *   - Categories, menu items, translations, ingredients links
 *   - Languages & all translations
 *   - Menu item events (analytics)
 *
 * Safety:
 *   - Validates the restaurant exists before deleting
 *   - Shows a summary of what will be deleted and requires confirmation
 */

import { db, pool } from "../db/index";
import {
    restaurants,
    orders,
    tables,
    categories,
    menuItems,
    languages,
    menuItemEvents,
} from "@sbaka/shared";
import { eq, inArray, count } from "drizzle-orm";
import * as readline from "readline";

async function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function main() {
    const restaurantId = Number(process.argv[2]);

    if (!restaurantId || isNaN(restaurantId)) {
        console.error("Usage: npx tsx scripts/drop-restaurant.ts <restaurant-id>");
        process.exit(1);
    }

    // 1. Verify restaurant exists
    const restaurant = await db.query.restaurants.findFirst({
        where: eq(restaurants.id, restaurantId),
    });

    if (!restaurant) {
        console.error(`❌ Restaurant with id ${restaurantId} not found.`);
        process.exit(1);
    }

    // 2. Gather counts for summary
    const categoryRows = await db.select({ id: categories.id }).from(categories).where(eq(categories.restaurantId, restaurantId));
    const categoryIds = categoryRows.map((c) => c.id);

    const [orderCount] = await db.select({ value: count() }).from(orders).where(eq(orders.restaurantId, restaurantId));
    const [tableCount] = await db.select({ value: count() }).from(tables).where(eq(tables.restaurantId, restaurantId));
    const [categoryCount] = await db.select({ value: count() }).from(categories).where(eq(categories.restaurantId, restaurantId));
    const menuItemCount = categoryIds.length > 0
        ? (await db.select({ value: count() }).from(menuItems).where(inArray(menuItems.categoryId, categoryIds)))[0]
        : { value: 0 };
    const [languageCount] = await db.select({ value: count() }).from(languages).where(eq(languages.restaurantId, restaurantId));
    const [eventCount] = await db.select({ value: count() }).from(menuItemEvents).where(eq(menuItemEvents.restaurantId, restaurantId));

    // 3. Show summary
    console.log(`\n🍽️  Restaurant: "${restaurant.name}" (id: ${restaurantId})`);
    console.log(`   Merchant ID: ${restaurant.merchantId}`);
    console.log(`\n   The following data will be permanently deleted:`);
    console.log(`   ├─ Orders:      ${orderCount.value}`);
    console.log(`   ├─ Tables:      ${tableCount.value}`);
    console.log(`   ├─ Categories:  ${categoryCount.value}`);
    console.log(`   ├─ Menu items:  ${menuItemCount.value}`);
    console.log(`   ├─ Languages:   ${languageCount.value}`);
    console.log(`   ├─ Events:      ${eventCount.value}`);
    console.log(`   └─ + all translations, ingredients links, order items\n`);

    // 4. Confirm
    const answer = await prompt("⚠️  Type the restaurant name to confirm deletion: ");
    if (answer !== restaurant.name) {
        console.log("❌ Name did not match. Aborting.");
        process.exit(1);
    }

    // 5. Delete (cascades handle all child rows)
    const [deleted] = await db.delete(restaurants).where(eq(restaurants.id, restaurantId)).returning();

    if (deleted) {
        console.log(`\n✅ Restaurant "${deleted.name}" (id: ${deleted.id}) and all related data deleted.`);
    } else {
        console.error("❌ Delete failed unexpectedly.");
    }

    await pool.end();
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
