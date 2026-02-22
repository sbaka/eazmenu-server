import QRCode from "qrcode";
import sharp from "sharp";
import PDFDocument from "pdfkit";
import archiver from "archiver";
import { PassThrough } from "stream";
import logger, { sanitizeError } from "../logger";

// ── Types ──────────────────────────────────────────────────────────────

export type ExportFormat = "png" | "jpg" | "pdf";
export type PdfLayout = "grid" | "single";
export type ExportResolution = "standard" | "high" | "print";

export interface QrExportOptions {
    format: ExportFormat;
    layout?: PdfLayout;
    branding?: boolean;
    resolution?: ExportResolution;
    restaurantName?: string;
}

export interface QrTableEntry {
    tableNumber: number;
    tableId: number;
    menuUrl: string;
}

// ── Resolution map (extensible for subscription tiers) ────────────────

const RESOLUTION_MAP: Record<ExportResolution, number> = {
    standard: 300,
    high: 600,
    print: 1200,
};

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Sanitize a string for use as a filename (kebab-case, ASCII-safe).
 */
export function sanitizeFilename(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "restaurant";
}

// ── Core generation ────────────────────────────────────────────────────

/**
 * Generate a high-resolution QR code PNG buffer.
 */
export async function generateQrBuffer(
    menuUrl: string,
    resolution: ExportResolution = "high"
): Promise<Buffer> {
    const width = RESOLUTION_MAP[resolution];
    const buffer = await QRCode.toBuffer(menuUrl, {
        type: "png",
        width,
        margin: 2,
        errorCorrectionLevel: "H",
        color: { dark: "#000000", light: "#ffffff" },
    });
    return buffer;
}

/**
 * Add restaurant name + table number label below the QR image using sharp.
 * Returns a new PNG buffer.
 */
export async function addBrandingToQrImage(
    qrBuffer: Buffer,
    tableNumber: number,
    restaurantName: string,
    resolution: ExportResolution = "high"
): Promise<Buffer> {
    const qrWidth = RESOLUTION_MAP[resolution];
    const fontSize = Math.max(16, Math.round(qrWidth * 0.045));
    const padding = Math.round(qrWidth * 0.06);
    const lineHeight = Math.round(fontSize * 1.4);
    const labelHeight = lineHeight * 2 + padding * 2; // 2 lines: restaurant name + table label
    const totalHeight = qrWidth + labelHeight;

    // Create SVG text overlay for the label area
    const svgLabel = `
    <svg width="${qrWidth}" height="${labelHeight}">
      <rect width="${qrWidth}" height="${labelHeight}" fill="#ffffff"/>
      <text x="${qrWidth / 2}" y="${padding + fontSize}" 
            font-family="Arial, Helvetica, sans-serif" 
            font-size="${fontSize}px" font-weight="bold"
            fill="#111111" text-anchor="middle">
        ${escapeXml(restaurantName)}
      </text>
      <text x="${qrWidth / 2}" y="${padding + fontSize + lineHeight}" 
            font-family="Arial, Helvetica, sans-serif" 
            font-size="${Math.round(fontSize * 0.85)}px"
            fill="#444444" text-anchor="middle">
        Table ${tableNumber}
      </text>
    </svg>`;

    const labelBuffer = await sharp(Buffer.from(svgLabel))
        .resize(qrWidth, labelHeight)
        .png()
        .toBuffer();

    // Composite: QR on top, label on bottom
    const result = await sharp({
        create: {
            width: qrWidth,
            height: totalHeight,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
    })
        .composite([
            { input: qrBuffer, top: 0, left: 0 },
            { input: labelBuffer, top: qrWidth, left: 0 },
        ])
        .png()
        .toBuffer();

    return result;
}

/**
 * Convert a PNG buffer to the requested format.
 */
export async function convertToFormat(
    pngBuffer: Buffer,
    format: "png" | "jpg"
): Promise<Buffer> {
    if (format === "png") return pngBuffer;
    return sharp(pngBuffer).jpeg({ quality: 95 }).toBuffer();
}

// ── PDF generation ─────────────────────────────────────────────────────

/**
 * Generate a PDF with one QR code per page.
 */
export async function generatePdfSingle(
    entries: Array<{ buffer: Buffer; tableNumber: number }>,
    restaurantName: string,
    branding: boolean
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 50 });
        const chunks: Buffer[] = [];

        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const pageWidth = doc.page.width - 100; // margins
        const qrSize = Math.min(pageWidth, 400);

        entries.forEach((entry, index) => {
            if (index > 0) doc.addPage();

            const xCenter = (doc.page.width - qrSize) / 2;
            let yPos = 80;

            if (branding) {
                doc
                    .fontSize(22)
                    .font("Helvetica-Bold")
                    .text(restaurantName, 50, yPos, { align: "center", width: pageWidth });
                yPos += 40;
            }

            doc
                .fontSize(18)
                .font("Helvetica")
                .text(`Table ${entry.tableNumber}`, 50, yPos, {
                    align: "center",
                    width: pageWidth,
                });
            yPos += 40;

            doc.image(entry.buffer, xCenter, yPos, { width: qrSize, height: qrSize });

            yPos += qrSize + 20;
            doc
                .fontSize(11)
                .fillColor("#666666")
                .text("Scan to view menu and place orders", 50, yPos, {
                    align: "center",
                    width: pageWidth,
                })
                .fillColor("#000000");
        });

        doc.end();
    });
}

/**
 * Generate a PDF with QR codes in a grid layout.
 * Default: 2 columns × 3 rows per page.
 */
export async function generatePdfGrid(
    entries: Array<{ buffer: Buffer; tableNumber: number }>,
    restaurantName: string,
    branding: boolean
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 40 });
        const chunks: Buffer[] = [];

        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const cols = 2;
        const rows = 3;
        const perPage = cols * rows;
        const contentWidth = doc.page.width - 80; // left + right margin
        const contentHeight = doc.page.height - 120; // top + bottom margin
        const cellWidth = contentWidth / cols;
        const cellHeight = contentHeight / rows;
        const qrSize = Math.min(cellWidth - 30, cellHeight - 60);
        const marginLeft = 40;
        const marginTop = 60;

        const totalPages = Math.ceil(entries.length / perPage);

        for (let page = 0; page < totalPages; page++) {
            if (page > 0) doc.addPage();

            // Page header
            if (branding) {
                doc
                    .fontSize(16)
                    .font("Helvetica-Bold")
                    .text(restaurantName, marginLeft, 20, {
                        align: "center",
                        width: contentWidth,
                    });
            }

            const startIdx = page * perPage;
            const pageEntries = entries.slice(startIdx, startIdx + perPage);

            pageEntries.forEach((entry, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const cellX = marginLeft + col * cellWidth;
                const cellY = marginTop + row * cellHeight;

                // Center QR in cell
                const qrX = cellX + (cellWidth - qrSize) / 2;
                const qrY = cellY + 5;

                doc.image(entry.buffer, qrX, qrY, { width: qrSize, height: qrSize });

                // Table label below QR
                doc
                    .fontSize(12)
                    .font("Helvetica-Bold")
                    .text(`Table ${entry.tableNumber}`, cellX, qrY + qrSize + 5, {
                        align: "center",
                        width: cellWidth,
                    });
            });
        }

        doc.end();
    });
}

// ── ZIP generation ─────────────────────────────────────────────────────

/**
 * Generate a ZIP archive from named buffers.
 * Returns a readable stream (for piping to response).
 */
export function createZipStream(
    files: Array<{ name: string; buffer: Buffer }>
): PassThrough {
    const passthrough = new PassThrough();
    const archive = archiver("zip", { zlib: { level: 6 } });

    archive.on("error", (err) => {
        logger.error(`ZIP archive error: ${sanitizeError(err)}`);
        passthrough.destroy(err);
    });

    archive.pipe(passthrough);

    for (const file of files) {
        archive.append(file.buffer, { name: file.name });
    }

    archive.finalize();
    return passthrough;
}

// ── Orchestrator ───────────────────────────────────────────────────────

/**
 * Build export buffers for a list of tables.
 * Returns an array of { name, buffer } ready for ZIP or single-file response.
 */
export async function buildExportFiles(
    entries: QrTableEntry[],
    options: QrExportOptions
): Promise<{ files: Array<{ name: string; buffer: Buffer }>; contentType: string; filename: string }> {
    const {
        format,
        layout = "grid",
        branding = false,
        resolution = "high",
        restaurantName = "restaurant",
    } = options;

    const slug = sanitizeFilename(restaurantName);
    const ext = format === "jpg" ? "jpg" : "png";

    // Generate QR buffers for all tables
    const qrEntries = await Promise.all(
        entries.map(async (entry) => {
            let buffer = await generateQrBuffer(entry.menuUrl, resolution);
            if (branding && restaurantName) {
                buffer = await addBrandingToQrImage(buffer, entry.tableNumber, restaurantName, resolution);
            }
            return { buffer, tableNumber: entry.tableNumber };
        })
    );

    // PDF export
    if (format === "pdf") {
        const pdfBuffer =
            layout === "single"
                ? await generatePdfSingle(qrEntries, restaurantName, branding)
                : await generatePdfGrid(qrEntries, restaurantName, branding);

        return {
            files: [{ name: `${slug}-qr-codes.pdf`, buffer: pdfBuffer }],
            contentType: "application/pdf",
            filename: `${slug}-qr-codes.pdf`,
        };
    }

    // Image export — convert to requested format
    const imageFiles = await Promise.all(
        qrEntries.map(async (entry) => {
            const converted = await convertToFormat(entry.buffer, format as "png" | "jpg");
            return {
                name: `${slug}-table-${entry.tableNumber}.${ext}`,
                buffer: converted,
            };
        })
    );

    // Single image → return directly
    if (imageFiles.length === 1) {
        return {
            files: imageFiles,
            contentType: format === "jpg" ? "image/jpeg" : "image/png",
            filename: imageFiles[0].name,
        };
    }

    // Multiple images → ZIP
    return {
        files: imageFiles,
        contentType: "application/zip",
        filename: `${slug}-qr-codes.zip`,
    };
}

// ── XML Escape ─────────────────────────────────────────────────────────

function escapeXml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
