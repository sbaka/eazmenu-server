/**
 * CLI script to seed analytics events, orders, and tables for a restaurant.
 *
 * Usage:
 *   npx tsx scripts/seed-analytics.ts <restaurant-id> [--days=30] [--force]
 *
 * Options:
 *   --days=N   Number of days of historical data to generate (default: 30)
 *   --force    Delete existing analytics events and orders before seeding
 *
 * What it creates:
 *   - Tables (if none exist): 4 tables with 2-8 seats
 *   - Realistic orders with 1-4 items each, distributed over N days
 *   - Order statuses: mostly Served, some Cancelled, recent ones in progress
 *   - menu_item_events across all menu items (view/click/addToCart/ordered funnel)
 *   - Time-distributed data with daily/hourly variation (lunch & dinner peaks)
 *
 * Safety:
 *   - Validates the restaurant exists and has menu items
 *   - Skips if data already exists (unless --force)
 */

import { db } from "../db/index";
import {
    restaurants,
    categories,
    menuItems,
    menuItemEvents,
    orders,
    orderItems,
    tables,
    type MenuItemEventType,
    type OrderStatus,
} from "@sbaka/shared";
import { eq, inArray, count } from "drizzle-orm";
import crypto from "crypto";
import { generateTableHashId } from "../qr-utils";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Funnel drop-off ratios — each step is a fraction of the previous */
const FUNNEL_RATIOS: Record<MenuItemEventType, number> = {
    view: 1.0,
    click: 0.6,
    addToCart: 0.25,
    ordered: 0.15,
};

/** Hourly weight distribution (0-23h) simulating lunch + dinner peaks */
const HOURLY_WEIGHTS = [
    0.01, 0.01, 0.01, 0.01, 0.01, 0.02, // 0-5: almost nothing
    0.03, 0.04, 0.05, 0.06, 0.08, 0.12, // 6-11: morning ramp
    0.14, 0.12, 0.08, 0.06, 0.05, 0.07, // 12-17: lunch peak then dip
    0.10, 0.14, 0.13, 0.10, 0.06, 0.03, // 18-23: dinner peak
];

/** Weekend multiplier (Fri-Sun get more traffic) */
const DAY_MULTIPLIERS = [0.7, 0.8, 0.9, 1.0, 1.1, 1.3, 1.2]; // Sun-Sat

/** Base views per item per day (will be scaled by item popularity) */
const BASE_VIEWS_PER_ITEM_PER_DAY = 8;

/** Base orders per day for the restaurant */
const BASE_ORDERS_PER_DAY = 12;

/** Tables to create if none exist */
const DEFAULT_TABLES = [
    { number: 1, seats: 2 },
    { number: 2, seats: 4 },
    { number: 3, seats: 4 },
    { number: 4, seats: 6 },
];

/** Possible notes customers leave on order items */
const ORDER_NOTES = [
    null, null, null, null, null, null, // mostly no notes
    "No onions please",
    "Extra sauce",
    "Well done",
    "Gluten-free if possible",
    "No ice",
    "Extra hot",
    "Mild spice",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickHour(): number {
    const totalWeight = HOURLY_WEIGHTS.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalWeight;
    for (let h = 0; h < 24; h++) {
        r -= HOURLY_WEIGHTS[h];
        if (r <= 0) return h;
    }
    return 12;
}

function generateSessionId(): string {
    return crypto.randomBytes(8).toString("hex");
}

function buildTimestamp(baseDate: Date, hour: number): Date {
    const d = new Date(baseDate);
    d.setHours(hour, randomInt(0, 59), randomInt(0, 59), randomInt(0, 999));
    return d;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    const args = process.argv.slice(2);
    const force = args.includes("--force");
    const daysArg = args.find((a) => a.startsWith("--days="));
    const days = daysArg ? parseInt(daysArg.split("=")[1], 10) : 30;
    const idArg = args.find((a) => !a.startsWith("--"));
    const restaurantId = parseInt(idArg ?? "", 10);

    if (!restaurantId || isNaN(restaurantId)) {
        console.error(
            "Usage: npx tsx scripts/seed-analytics.ts <restaurant-id> [--days=30] [--force]"
        );
        process.exit(1);
    }

    if (isNaN(days) || days < 1 || days > 365) {
        console.error("--days must be between 1 and 365");
        process.exit(1);
    }

    // 1. Validate restaurant
    const [restaurant] = await db
        .select()
        .from(restaurants)
        .where(eq(restaurants.id, restaurantId))
        .limit(1);

    if (!restaurant) {
        console.error(`Restaurant with id ${restaurantId} not found.`);
        process.exit(1);
    }

    console.log(`Restaurant: "${restaurant.name}" (id=${restaurantId})`);

    // 2. Get all menu items (with prices) for this restaurant
    const restaurantCategories = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.restaurantId, restaurantId));

    if (restaurantCategories.length === 0) {
        console.error("No categories found. Seed menu data first (npm run db:seed-demo).");
        process.exit(1);
    }

    const categoryIds = restaurantCategories.map((c) => c.id);
    const items = await db
        .select({
            id: menuItems.id,
            name: menuItems.name,
            price: menuItems.price,
            isFeatured: menuItems.isFeatured,
        })
        .from(menuItems)
        .where(inArray(menuItems.categoryId, categoryIds));

    if (items.length === 0) {
        console.error("No menu items found. Seed menu data first.");
        process.exit(1);
    }

    console.log(`Found ${items.length} menu items across ${categoryIds.length} categories.`);

    // 3. Ensure tables exist
    let restaurantTables = await db
        .select({ id: tables.id, number: tables.number })
        .from(tables)
        .where(eq(tables.restaurantId, restaurantId));

    if (restaurantTables.length === 0) {
        console.log("No tables found — creating default tables...");
        for (const t of DEFAULT_TABLES) {
            const qrCode = generateTableHashId(restaurantId, t.number);
            const [inserted] = await db
                .insert(tables)
                .values({
                    number: t.number,
                    seats: t.seats,
                    restaurantId,
                    qrCode,
                    active: true,
                })
                .returning({ id: tables.id, number: tables.number });
            restaurantTables.push(inserted);
            console.log(`  Table #${t.number} (${t.seats} seats) — QR: ${qrCode}`);
        }
    } else {
        console.log(`Found ${restaurantTables.length} existing tables.`);
    }

    // 4. Handle --force: wipe existing seed data
    if (force) {
        const [existingEvents] = await db
            .select({ count: count() })
            .from(menuItemEvents)
            .where(eq(menuItemEvents.restaurantId, restaurantId));

        const [existingOrders] = await db
            .select({ count: count() })
            .from(orders)
            .where(eq(orders.restaurantId, restaurantId));

        if (existingEvents.count > 0) {
            console.log(`--force: deleting ${existingEvents.count} analytics events...`);
            await db.delete(menuItemEvents).where(eq(menuItemEvents.restaurantId, restaurantId));
        }
        if (existingOrders.count > 0) {
            console.log(`--force: deleting ${existingOrders.count} orders (and their items)...`);
            await db.delete(orders).where(eq(orders.restaurantId, restaurantId));
        }
    } else {
        // Check for existing data without --force
        const [existingEvents] = await db
            .select({ count: count() })
            .from(menuItemEvents)
            .where(eq(menuItemEvents.restaurantId, restaurantId));

        const [existingOrders] = await db
            .select({ count: count() })
            .from(orders)
            .where(eq(orders.restaurantId, restaurantId));

        if (existingEvents.count > 0 || existingOrders.count > 0) {
            console.error(
                `Already ${existingEvents.count} events and ${existingOrders.count} orders. Use --force to wipe and re-seed.`
            );
            process.exit(1);
        }
    }

    // 5. Assign popularity tiers to items
    const itemPopularity = items.map((item) => ({
        ...item,
        popularityMultiplier: item.isFeatured
            ? 1.5 + Math.random() * 1.0 // 1.5-2.5x
            : 0.4 + Math.random() * 1.2, // 0.4-1.6x
    }));

    // -----------------------------------------------------------------------
    // 6. Generate orders
    // -----------------------------------------------------------------------
    console.log("\nGenerating orders...");
    const now = new Date();
    let orderCounter = 0;

    type SeedOrder = {
        orderNumber: string;
        tableId: number;
        status: OrderStatus;
        restaurantId: number;
        total: number;
        sessionId: string | null;
        servedAt: Date | null;
        hidden: boolean;
        createdAt: Date;
        updatedAt: Date;
    };

    type SeedOrderItem = {
        menuItemId: number;
        quantity: number;
        price: number;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
    };

    const allOrders: Array<{ order: SeedOrder; items: SeedOrderItem[] }> = [];

    for (let d = days - 1; d >= 0; d--) {
        const date = new Date(now);
        date.setDate(date.getDate() - d);
        date.setHours(0, 0, 0, 0);

        const dayOfWeek = date.getDay();
        const dayMultiplier = DAY_MULTIPLIERS[dayOfWeek];
        const recencyMultiplier = 0.7 + 0.3 * ((days - d) / days);

        const dailyOrders = Math.round(
            BASE_ORDERS_PER_DAY * dayMultiplier * recencyMultiplier
        );

        for (let o = 0; o < dailyOrders; o++) {
            const hour = pickHour();
            const timestamp = buildTimestamp(date, hour);
            const table = restaurantTables[randomInt(0, restaurantTables.length - 1)];

            // Pick 1-4 random items for this order
            const itemCount = randomInt(1, 4);
            const shuffled = [...items].sort(() => Math.random() - 0.5);
            const pickedItems = shuffled.slice(0, itemCount);

            const orderItemsList: SeedOrderItem[] = pickedItems.map((item) => {
                const qty = Math.random() < 0.2 ? randomInt(2, 3) : 1;
                return {
                    menuItemId: item.id,
                    quantity: qty,
                    price: item.price,
                    notes: ORDER_NOTES[randomInt(0, ORDER_NOTES.length - 1)],
                    createdAt: timestamp,
                    updatedAt: timestamp,
                };
            });

            const total = orderItemsList.reduce((sum, oi) => sum + oi.price * oi.quantity, 0);

            // Determine status based on how old the order is
            let status: OrderStatus;
            let servedAt: Date | null = null;
            let hidden = false;
            const hoursAgo = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);

            if (hoursAgo < 1) {
                // Very recent: still in progress
                const r = Math.random();
                if (r < 0.4) status = "Received";
                else if (r < 0.7) status = "Preparing";
                else status = "Ready";
            } else if (hoursAgo < 3) {
                // A few hours old: mostly served
                const r = Math.random();
                if (r < 0.1) status = "Ready";
                else if (r < 0.15) status = "Cancelled";
                else {
                    status = "Served";
                    servedAt = new Date(timestamp.getTime() + randomInt(10, 45) * 60 * 1000);
                    hidden = true;
                }
            } else {
                // Older: served or cancelled
                if (Math.random() < 0.08) {
                    status = "Cancelled";
                } else {
                    status = "Served";
                    servedAt = new Date(timestamp.getTime() + randomInt(10, 45) * 60 * 1000);
                    hidden = true;
                }
            }

            orderCounter++;
            const orderNumber = `ORD${String(orderCounter).padStart(6, "0")}`;

            allOrders.push({
                order: {
                    orderNumber,
                    tableId: table.id,
                    status,
                    restaurantId,
                    total,
                    sessionId: generateSessionId(),
                    servedAt,
                    hidden,
                    createdAt: timestamp,
                    updatedAt: servedAt ?? timestamp,
                },
                items: orderItemsList,
            });
        }
    }

    console.log(`Generated ${allOrders.length} orders over ${days} days.`);

    // Insert orders + items in batches inside transactions
    const ORDER_BATCH = 50;
    let insertedOrders = 0;

    for (let i = 0; i < allOrders.length; i += ORDER_BATCH) {
        const batch = allOrders.slice(i, i + ORDER_BATCH);
        await db.transaction(async (tx) => {
            for (const { order, items: oItems } of batch) {
                const [inserted] = await tx.insert(orders).values(order).returning({ id: orders.id });
                if (oItems.length > 0) {
                    await tx.insert(orderItems).values(
                        oItems.map((oi) => ({ ...oi, orderId: inserted.id }))
                    );
                }
            }
        });
        insertedOrders += batch.length;
        process.stdout.write(`\r  Inserted ${insertedOrders}/${allOrders.length} orders...`);
    }

    // Print order summary
    const orderSummary = {
        Received: allOrders.filter((o) => o.order.status === "Received").length,
        Preparing: allOrders.filter((o) => o.order.status === "Preparing").length,
        Ready: allOrders.filter((o) => o.order.status === "Ready").length,
        Served: allOrders.filter((o) => o.order.status === "Served").length,
        Cancelled: allOrders.filter((o) => o.order.status === "Cancelled").length,
    };

    console.log(`\n\nOrder breakdown:`);
    console.log(`  Received:   ${orderSummary.Received}`);
    console.log(`  Preparing:  ${orderSummary.Preparing}`);
    console.log(`  Ready:      ${orderSummary.Ready}`);
    console.log(`  Served:     ${orderSummary.Served}`);
    console.log(`  Cancelled:  ${orderSummary.Cancelled}`);

    // -----------------------------------------------------------------------
    // 7. Generate analytics events
    // -----------------------------------------------------------------------
    console.log("\nGenerating analytics events...");

    const events: Array<{
        menuItemId: number;
        restaurantId: number;
        eventType: MenuItemEventType;
        sessionId: string | null;
        createdAt: Date;
    }> = [];

    for (let d = days - 1; d >= 0; d--) {
        const date = new Date(now);
        date.setDate(date.getDate() - d);
        date.setHours(0, 0, 0, 0);

        const dayOfWeek = date.getDay();
        const dayMultiplier = DAY_MULTIPLIERS[dayOfWeek];
        const recencyMultiplier = 0.7 + 0.3 * ((days - d) / days);

        for (const item of itemPopularity) {
            const dailyViews = Math.round(
                BASE_VIEWS_PER_ITEM_PER_DAY *
                item.popularityMultiplier *
                dayMultiplier *
                recencyMultiplier
            );

            for (let v = 0; v < dailyViews; v++) {
                const hour = pickHour();
                const timestamp = buildTimestamp(date, hour);
                const sessionId = generateSessionId();

                const eventTypes: MenuItemEventType[] = ["view"];

                if (Math.random() < FUNNEL_RATIOS.click) eventTypes.push("click");
                if (
                    eventTypes.includes("click") &&
                    Math.random() < FUNNEL_RATIOS.addToCart / FUNNEL_RATIOS.click
                )
                    eventTypes.push("addToCart");
                if (
                    eventTypes.includes("addToCart") &&
                    Math.random() < FUNNEL_RATIOS.ordered / FUNNEL_RATIOS.addToCart
                )
                    eventTypes.push("ordered");

                for (const eventType of eventTypes) {
                    events.push({
                        menuItemId: item.id,
                        restaurantId,
                        eventType,
                        sessionId,
                        createdAt: timestamp,
                    });
                }
            }
        }
    }

    console.log(`Generated ${events.length} analytics events over ${days} days.`);

    // Bulk insert events in batches
    const EVENT_BATCH = 1000;
    let insertedEvents = 0;

    for (let i = 0; i < events.length; i += EVENT_BATCH) {
        const batch = events.slice(i, i + EVENT_BATCH);
        await db.insert(menuItemEvents).values(batch);
        insertedEvents += batch.length;
        process.stdout.write(`\r  Inserted ${insertedEvents}/${events.length} events...`);
    }

    // Print event summary
    const eventSummary = {
        view: events.filter((e) => e.eventType === "view").length,
        click: events.filter((e) => e.eventType === "click").length,
        addToCart: events.filter((e) => e.eventType === "addToCart").length,
        ordered: events.filter((e) => e.eventType === "ordered").length,
    };

    console.log(`\n\nEvent breakdown:`);
    console.log(`  Views:       ${eventSummary.view}`);
    console.log(`  Clicks:      ${eventSummary.click}`);
    console.log(`  Add to cart: ${eventSummary.addToCart}`);
    console.log(`  Ordered:     ${eventSummary.ordered}`);

    console.log("\nSeed complete.");
    process.exit(0);
}

main().catch((err) => {
    console.error("Analytics seed failed:", err);
    process.exit(1);
});
