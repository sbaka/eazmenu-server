# QR Code Architecture

This document explains the QR code system architecture with proper separation of concerns.

## Architecture Overview

The QR code system is now organized into three distinct layers:

### 1. Utilities Layer (`qr-utils.ts`)
**Purpose**: Pure utility functions with no external dependencies
- Hash generation and validation
- Format detection and parsing
- No database operations
- No business logic

**Key Functions**:
- `generateTableHashId()` - Creates 8-character base36 hash IDs
- `isValidHashIdFormat()` - Validates hash format
- `getQrCodeType()` - Determines QR code type (hash/legacy/invalid)
- `parseLegacyQrCode()` - Parses legacy format QR codes

### 2. Service Layer (`services/qr-code-service.ts`)
**Purpose**: Business logic and coordination between utilities and database
- Orchestrates QR code operations
- Handles database lookups
- Implements business rules
- Error handling and logging

**Key Functions**:
- `generateQrCodeForTable()` - Business logic for QR code generation
- `findTableByQrCode()` - Comprehensive table lookup with fallbacks
- `validateQrCode()` - Validates QR codes against active tables
- `getTableInfoFromLegacyQrCode()` - Extracts info from legacy codes

### 3. Storage Layer (`storage.ts`)
**Purpose**: Data persistence and high-level application logic
- Uses service layer for QR code operations
- Handles complex business workflows
- Database transactions and queries

## QR Code Types

### Hash-based QR Codes (New)
- **Format**: 8-character base36 string (e.g., `00hob4l7`)
- **Generation**: SHA-256 hash of `restaurantId-tableNumber-salt`
- **Lookup**: Direct database query by `qrCode` field
- **Benefits**: Short, URL-safe, unique per restaurant+table

### Legacy QR Codes (Backward Compatibility)
- **Format**: `restaurantId-tableNumber` (e.g., `1-5`)
- **Lookup**: Parse and query by restaurant ID + table number
- **Status**: Supported but deprecated

## Data Flow

```
Client Request
    ↓
Storage Layer (getMenuByTableQrCode)
    ↓
Service Layer (findTableByQrCode)
    ↓
Utilities Layer (getQrCodeType, parseLegacyQrCode)
    ↓
Database Query
    ↓
Response
```

## Benefits of This Architecture

1. **Separation of Concerns**: Each layer has a single responsibility
2. **Testability**: Pure functions in utilities layer are easy to test
3. **Maintainability**: Changes to one layer don't affect others
4. **Reusability**: Service layer can be used by different storage implementations
5. **Backward Compatibility**: Supports both new and legacy QR code formats

## Migration Strategy

1. **Phase 1**: New tables get hash-based QR codes
2. **Phase 2**: Legacy QR codes continue to work via fallback lookup
3. **Phase 3**: Optional migration of existing tables to hash-based codes
4. **Phase 4**: Eventually deprecate legacy format support

## Example Usage

```typescript
// Generate QR code for a new table
const qrCode = generateQrCodeForTable(restaurantId, tableNumber);

// Find table by any QR code format
const result = await findTableByQrCode(qrCode);
if (result.isValid) {
  console.log(`Found table: ${result.table.number}`);
  console.log(`QR code type: ${result.qrCodeType}`);
}

// Validate QR code
const isValid = await validateQrCode(qrCode);
``` 