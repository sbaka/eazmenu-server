# Signed URL Upload Architecture

## Overview

This document describes the signed URL upload architecture implemented for image uploads in Eazmenu. This approach offloads file transfer from the server to Supabase Storage, reducing server load and improving upload performance.

## Architecture Diagram

```
┌─────────────┐    1. Request Signed URL    ┌─────────────┐
│   Frontend  │ ──────────────────────────► │   Backend   │
│   (Admin)   │                             │   Server    │
└─────────────┘                             └─────────────┘
      │                                           │
      │                                           │ 2. Create Signed URL
      │                                           ▼
      │                                     ┌─────────────┐
      │ ◄─────────────────────────────────  │  Supabase   │
      │     Return: signedUrl, filePath     │  Storage    │
      │                                     └─────────────┘
      │                                           ▲
      │ 3. Upload directly to Supabase            │
      └───────────────────────────────────────────┘
      │
      │ 4. Confirm Upload
      ▼
┌─────────────┐    5. Verify & Update Entity    ┌─────────────┐
│   Frontend  │ ─────────────────────────────►  │   Backend   │
│   (Admin)   │                                 │   Server    │
└─────────────┘                                 └─────────────┘
```

## Flow

### 1. Request Signed URL

Frontend calls `POST /api/uploads/signed-url` with:
- `bucketType`: 'menu-items', 'restaurant-banners', or 'restaurant-logos'
- `extension`: File extension (jpg, png, gif, webp)
- `restaurantId`: Optional, for ownership validation
- `categoryId`: Optional, for menu item ownership validation

### 2. Generate Signed URL

Backend:
- Validates user owns the restaurant/category
- Generates unique file path
- Creates signed upload URL (valid for 1 hour)
- Tracks pending upload for orphan cleanup

### 3. Direct Upload

Frontend uploads directly to Supabase using the signed URL:
- Supports progress tracking via XMLHttpRequest
- Bypasses server completely for file transfer

### 4. Confirm Upload

Frontend calls `POST /api/uploads/confirm` with:
- `filePath`: Path returned from signed URL request
- `bucketType`: Same as original request
- `entityType`: 'restaurant' or 'menu-item'
- `entityId`: ID of entity to update (0 for new items)
- `imageField`: 'banner', 'logo', or 'image'

### 5. Backend Verification

Backend:
- Verifies file exists in Supabase
- Deletes old image if replacing
- Updates entity with new image URL
- Removes from pending uploads tracking

## Orphan Cleanup

Files that are uploaded but never confirmed are cleaned up automatically:

- Worker runs every 15 minutes
- Deletes files pending for more than 1 hour
- Prevents storage waste from abandoned uploads

## Files Created/Modified

### Server

**New Files:**
- `server/routes/uploads.ts` - Upload routes for signed URLs
- `server/workers/orphan-cleanup.ts` - Background cleanup worker

**Modified Files:**
- `server/services/storage.service.ts` - Added signed URL functions
- `server/routes/index.ts` - Export upload routes
- `server/routes.ts` - Register routes and worker

### Admin Frontend

**New Files:**
- `admin/src/lib/api/upload-service.ts` - Upload service with helpers
- `admin/src/hooks/use-signed-url-upload.ts` - React hook for uploads

**Modified Files:**
- `admin/src/features/restaurants/hooks/use-restaurant-image-upload.ts` - Use signed URLs
- `admin/src/features/admin/hooks/use-menu-item-mutations.tsx` - Use signed URLs

## API Reference

### POST /api/uploads/signed-url

Request signed upload URL.

**Request Body:**
```json
{
  "bucketType": "restaurant-banners",
  "extension": "jpg",
  "restaurantId": 123
}
```

**Response:**
```json
{
  "signedUrl": "https://...",
  "token": "abc123",
  "filePath": "123/banner-xzy.jpg",
  "publicUrl": "https://..."
}
```

### POST /api/uploads/confirm

Confirm successful upload.

**Request Body:**
```json
{
  "filePath": "123/banner-xzy.jpg",
  "bucketType": "restaurant-banners",
  "entityType": "restaurant",
  "entityId": 123,
  "imageField": "banner"
}
```

**Response:**
```json
{
  "message": "Upload confirmed",
  "bannerUrl": "https://...",
  "restaurant": { ... }
}
```

### POST /api/uploads/cancel

Cancel pending upload.

**Request Body:**
```json
{
  "filePath": "123/banner-xzy.jpg",
  "bucketType": "restaurant-banners"
}
```

## Usage Examples

### Restaurant Image Upload

```typescript
import { useRestaurantImageUpload } from '@/features/restaurants/hooks';

function BannerUpload({ restaurantId }: { restaurantId: number }) {
  const { uploadImage, isUploading, progress } = useRestaurantImageUpload();
  
  const handleUpload = async (file: File) => {
    await uploadImage.mutateAsync({
      restaurantId,
      imageType: 'banner',
      file,
    });
  };
  
  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />
      {isUploading && progress && (
        <ProgressBar value={progress.percentage} />
      )}
    </div>
  );
}
```

### Menu Item Image Upload

```typescript
import { useSignedUrlUpload } from '@/hooks/use-signed-url-upload';

function MenuItemImageUpload({ menuItemId, categoryId }: Props) {
  const { uploadImage, isUploading, progress } = useSignedUrlUpload({
    invalidateQueries: ['/menu-items'],
  });
  
  const handleUpload = async (file: File) => {
    await uploadImage({
      file,
      bucketType: 'menu-items',
      entityType: 'menu-item',
      entityId: menuItemId,
      imageField: 'image',
      categoryId,
    });
  };
  
  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />
      {isUploading && progress && (
        <ProgressBar value={progress.percentage} />
      )}
    </div>
  );
}
```

## Benefits

1. **Reduced Server Load**: File data never passes through the server
2. **Better Performance**: Direct upload to Supabase CDN
3. **Progress Tracking**: Real-time upload progress via XMLHttpRequest
4. **Automatic Cleanup**: Orphaned files are cleaned up automatically
5. **Backward Compatible**: Falls back to FormData upload if needed

## Feature Flag

A feature flag `USE_SIGNED_URL_UPLOADS` is available in `use-menu-item-mutations.tsx` to enable/disable signed URL uploads for gradual rollout.

