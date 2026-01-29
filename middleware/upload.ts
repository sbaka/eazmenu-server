import multer from 'multer';
import { nanoid } from 'nanoid';
import { createClient } from '@supabase/supabase-js';
import { Request, Response, NextFunction } from 'express';
import logger, { sanitizeError } from '../logger';

// Dynamic import for file-type (ESM module)
async function getFileType(buffer: Buffer) {
  const fileType = await import('file-type') as any;
  return fileType.fileTypeFromBuffer(buffer);
}

// Supabase client configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'menu-items';

// Allowed image MIME types and their magic bytes
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

// Initialize Supabase client (lazy initialization)
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabase) {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for file uploads');
    }
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabase;
}

// Use memory storage for Supabase upload
const memoryStorage = multer.memoryStorage();

// Basic MIME type filter (additional magic byte validation happens after)
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
  }
};

// Create multer instance with memory storage
export const uploadMenuItemImage = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Only allow 1 file
  }
});

// Middleware to validate magic bytes and upload to Supabase
export async function validateAndUploadToSupabase(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const file = req.file;
    
    if (!file) {
      return next();
    }
    
    // Validate magic bytes - this prevents MIME type spoofing
    const fileType = await getFileType(file.buffer);
    
    if (!fileType || !ALLOWED_MIME_TYPES.includes(fileType.mime)) {
      res.status(400).json({ 
        message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.' 
      });
      return;
    }
    
    // Generate unique filename
    const uniqueSuffix = nanoid(10);
    const ext = fileType.ext;
    const filename = `menu-item-${uniqueSuffix}.${ext}`;
    
    // Upload to Supabase Storage
    const supabaseClient = getSupabaseClient();
    const { error } = await supabaseClient.storage
      .from(BUCKET_NAME)
      .upload(filename, file.buffer, {
        contentType: fileType.mime,
        cacheControl: '3600',
        upsert: false,
      });
    
    if (error) {
      logger.error(`Supabase upload error: ${sanitizeError(error)}`);
      res.status(500).json({ message: 'Failed to upload image' });
      return;
    }
    
    // Get public URL
    const { data: urlData } = supabaseClient.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename);
    
    // Attach the URL to the request for use in route handlers
    (req as any).uploadedImageUrl = urlData.publicUrl;
    (req as any).uploadedFileName = filename;
    
    next();
  } catch (error) {
    logger.error(`Upload validation error: ${sanitizeError(error)}`);
    res.status(500).json({ message: 'Failed to process upload' });
  }
}

// Helper function to get image URL from uploaded file (for compatibility)
export const getImageUrl = (filename: string): string => {
  if (!supabaseUrl) {
    // Fallback for local development without Supabase
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3002}`;
    return `${baseUrl}/uploads/menu-items/${filename}`;
  }
  
  const supabaseClient = getSupabaseClient();
  const { data } = supabaseClient.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filename);
  
  return data.publicUrl;
};

// Helper function to delete uploaded file from Supabase
export const deleteUploadedFile = async (filename: string): Promise<void> => {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      // Supabase not configured, skip deletion
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Supabase not configured, skipping file deletion');
      }
      return;
    }
    
    const supabaseClient = getSupabaseClient();
    const { error } = await supabaseClient.storage
      .from(BUCKET_NAME)
      .remove([filename]);
    
    if (error) {
      logger.error(`Error deleting file from Supabase: ${sanitizeError(error)}`);
    }
  } catch (error) {
    logger.error(`Error deleting uploaded file: ${sanitizeError(error)}`);
  }
};

// Helper function to extract filename from imageUrl
export const getFilenameFromUrl = (imageUrl: string): string | null => {
  try {
    const url = new URL(imageUrl);
    const pathname = url.pathname;
    const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
    return filename.startsWith('menu-item-') ? filename : null;
  } catch (error) {
    return null;
  }
};
