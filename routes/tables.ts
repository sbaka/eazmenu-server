import { SingleTableWithQrCodeImage } from './../../../packages/shared/src/query-models/TableWithQrCodeImage';
import { Router } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import QRCode from "qrcode";
import { authenticate } from "../middleware";
import { storage } from "../storage";
import { rateLimits } from "../security";
import { insertTableSchema, restaurants, Table, tables, TableWithQrCodeImage } from "@eazmenu/shared";
import { db } from "@db";
import logger, { sanitizeError } from "../logger";
import { generateTableHashId } from "../qr-utils";

const router = Router();

// Get tables by restaurant
router.get("/api/tables", authenticate, async (req, res) => {
  try {
    const restaurantId = parseInt(req.query.restaurantId as string);
    if (isNaN(restaurantId)) {
      return res.status(400).json({ message: "Missing or invalid restaurantId" });
    }
    
    // Validate restaurant ownership
    const restaurant = await db.query.restaurants.findFirst({
      where: and(eq(restaurants.id, restaurantId), eq(restaurants.merchantId, req.user!.id))
    });
    if (!restaurant) {
      return res.status(403).json({ message: "Restaurant not found or access denied" });
    }
    
    const tables = await storage.getTablesByRestaurantId(restaurantId);
    res.json(tables);
  } catch (error) {
    logger.error(`Error fetching tables: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Create table
router.post("/api/tables", authenticate, async (req, res) => {
  try {
    const restaurantId = req.body.restaurantId;
    if (!restaurantId || isNaN(Number(restaurantId))) {
      return res.status(400).json({ message: "Missing or invalid restaurantId" });
    }
    
    // Validate restaurant ownership before creating table
    const restaurant = await db.query.restaurants.findFirst({
      where: and(eq(restaurants.id, Number(restaurantId)), eq(restaurants.merchantId, req.user!.id))
    });
    if (!restaurant) {
      return res.status(403).json({ message: "Restaurant not found or access denied" });
    }
    
    // Prepare data for validation - convert number to integer and ensure required fields
    const tableData = {
      number: parseInt(req.body.number.toString()),
      seats: Number(req.body.seats),
      restaurantId: Number(restaurantId),
      active: req.body.active !== undefined ? Boolean(req.body.active) : true,
      qrCode: generateTableHashId(Number(restaurantId), parseInt(req.body.number.toString())),
    };
    
    const validatedData = insertTableSchema.parse(tableData);
    const table = await storage.createTable(validatedData);
    res.status(201).json(table);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Validation error", 
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      });
    }
    logger.error(`Error creating table: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Update table
router.put("/api/tables/:id", authenticate, async (req, res) => {
  try {
    const tableId = parseInt(req.params.id);
    if (isNaN(tableId)) {
      return res.status(400).json({ message: "Invalid table ID" });
    }
    
    // Validate table ownership
    const table = await db.query.tables.findFirst({
      where: eq(tables.id, tableId),
      with: { restaurant: true }
    });
    
    if (!table || table.restaurant.merchantId !== req.user!.id) {
      return res.status(403).json({ message: "Table not found or access denied" });
    }
    
    const updated = await storage.updateTable(tableId, {...req.body, updatedAt: new Date()}, req.user!.id);
    if (!updated) {
      return res.status(404).json({ message: "Table not found" });
    }
    res.json(updated);
  } catch (error) {
    logger.error(`Error updating table: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete table
router.delete("/api/tables/:id", authenticate, async (req, res) => {
  try {
    const tableId = parseInt(req.params.id);
    if (isNaN(tableId)) {
      return res.status(400).json({ message: "Invalid table ID" });
    }
    
    // Validate table ownership
    const table = await db.query.tables.findFirst({
      where: eq(tables.id, tableId),
      with: { restaurant: true }
    });
    
    if (!table || table.restaurant.merchantId !== req.user!.id) {
      return res.status(403).json({ message: "Table not found or access denied" });
    }
    
    const success = await storage.deleteTable(tableId, req.user!.id);
    if (!success) {
      return res.status(404).json({ message: "Table not found or could not be deleted" });
    }
    res.status(204).send();
  } catch (error) {
    logger.error(`Error deleting table: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Get QR images for all tables
router.get("/api/tables/qrcodes/all", authenticate, rateLimits.heavy, async (req, res) => {
  try {
    // Get restaurants owned by this merchant
    const restaurants = await storage.getRestaurantsByMerchantId(req.user!.id);
    if (restaurants.length === 0) {
      return res.status(404).json({ message: "No restaurants found" });
    }
    
    // For now, use the first restaurant (you might want to add restaurantId parameter)
    const restaurant = restaurants[0];
    const tables = await storage.getTablesByRestaurantId(restaurant.id);
    
    // Process tables in chunks to avoid blocking the event loop
    const CHUNK_SIZE = 10;
    const qrCodes = [];
    
    // Function to process a chunk of tables
    const processChunk = async (startIdx: number) => {
      const endIdx = Math.min(startIdx + CHUNK_SIZE, tables.length);
      const chunk = tables.slice(startIdx, endIdx);
      
      const chunkResults : TableWithQrCodeImage[] = await Promise.all(
        chunk.map(async (table: Table) => {
          // Use API domain from environment or request host
          const apiHost = process.env.API_DOMAIN || req.headers.host || "localhost:3002";
          const protocol = process.env.NODE_ENV === 'production' ? 'https' : (req.protocol || "http");
          // Generate URL that redirects to customer menu API with QR code
          const menuUrl = `${protocol}://${apiHost}/api/customer/menu?qrCode=${table.qrCode}&lang=en`;
          
          // Generate QR code as data URL
          const qrCodeDataUrl = await QRCode.toDataURL(menuUrl);
          
          return {
            table,
            imageUrl: menuUrl,
            qrCodeBase64: qrCodeDataUrl,
          };
        })
      );
      
      return chunkResults;
    };
    
    // Process chunks sequentially to avoid memory issues
    for (let i = 0; i < tables.length; i += CHUNK_SIZE) {
      const chunkResults = await processChunk(i);
      qrCodes.push(...chunkResults);
    }
    
    res.json(qrCodes);
  } catch (error) {
    logger.error(`Error generating QR codes: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/api/tables/:id/qrcode", authenticate, async (req, res) => {
  try {
    const tableId = parseInt(req.params.id);
    const merchantId = req.query.merchantId ? parseInt(req.query.merchantId as string) : req.user!.id;
    
    if (isNaN(tableId)) {
      return res.status(400).json({ message: "Invalid table ID" });
    }
    
    // Validate table ownership
    const table = await db.query.tables.findFirst({
      where: eq(tables.id, tableId),
      with: { restaurant: true }
    });
    
    if (!table || table.restaurant.merchantId !== merchantId) {
      return res.status(403).json({ message: "Table not found or access denied" });
    }
    
    // Use API domain from environment or request host
    const apiHost = process.env.API_DOMAIN || req.headers.host || "localhost:3002";
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : (req.protocol || "http");
    // Generate URL that redirects to customer menu API with QR code
    const menuUrl = `${protocol}://${apiHost}/api/customer/menu?qrCode=${table.qrCode}&lang=en`;
    const qrCodeDataUrl = await QRCode.toDataURL(menuUrl);
    
    const response: SingleTableWithQrCodeImage = {
      tableId: table.id,
      imageUrl: menuUrl,
      qrCodeBase64: qrCodeDataUrl,
    };
    
    return res.json(response);
  } catch (error) {
    logger.error(`Error generating QR code: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

export default router; 