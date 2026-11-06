import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Memory storage for Cloudinary user image gallery uploads ──────────────────
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new Error("Only JPEG, PNG, WebP, and GIF images are allowed")
      );
    }

    cb(null, true);
  },
});

/**
 * Express middleware wrapper for single image upload that handles
 * Multer validation errors (file size, format) cleanly with 400 Bad Request.
 */
export const handleSingleUpload = (fieldName = "image") => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            message: "File size exceeds 5MB limit",
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }
      next();
    });
  };
};

// ── Multer disk storage for Image Analyzer Agent ──────────────────────────────
import os from "os";

export const TEMP_UPLOAD_DIR = process.env.TEMP_UPLOAD_DIR || path.join(os.tmpdir(), "nexusmind_uploads");

export function ensureUploadDir() {
  try {
    if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
      fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn(`[Upload Middleware] Failed to create temp upload directory: ${err.message}`);
  }
}

// Initial directory check
ensureUploadDir();

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDir();
    cb(null, TEMP_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const isPdf =
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf");
    const defaultExt = isPdf ? ".pdf" : ".jpg";
    const ext = path.extname(file.originalname).toLowerCase() || defaultExt;
    const prefix = isPdf ? "pdf" : "img";
    cb(null, `${prefix}-${uniqueSuffix}${ext}`);
  },
});

const ALLOWED_CHAT_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

export const chatUpload = multer({
  storage: diskStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_CHAT_MIMES.includes(file.mimetype)) {
      const err = new Error(
        "Only valid image files (JPEG, PNG, WebP, GIF) and PDF documents are allowed"
      );
      err.code = "INVALID_FILE_TYPE";
      return cb(err, false);
    }
    cb(null, true);
  },
});

/**
 * Validates file signature (magic bytes) for common image formats and PDFs:
 * - PDF:  25 50 44 46 (%PDF)
 * - JPEG: FF D8 FF
 * - PNG:  89 50 4E 47 0D 0A 1A 0A
 * - GIF:  47 49 46 38
 * - WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
 */
export async function validateFileSignature(filePath) {
  let fileHandle = null;
  try {
    fileHandle = await fs.promises.open(filePath, "r");
    const buffer = Buffer.alloc(12);
    const { bytesRead } = await fileHandle.read(buffer, 0, 12, 0);
    if (bytesRead < 4) return false;

    // PDF: %PDF (25 50 44 46)
    if (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    ) {
      return true;
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return true;
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return true;
    }
    // GIF: GIF87a or GIF89a (47 49 46 38)
    if (
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38
    ) {
      return true;
    }
    // WebP: RIFF ... WEBP
    if (
      bytesRead >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  } finally {
    if (fileHandle) {
      await fileHandle.close().catch(() => {});
    }
  }
}

// Preserve backwards-compatible alias
export const validateImageSignature = validateFileSignature;

/**
 * Middleware for single file upload (image or PDF) on chat route.
 * Handles both multipart/form-data and application/json requests transparently.
 * Validates file size, MIME type, and file signature.
 */
export const handleChatUpload = (req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    return next();
  }

  chatUpload.single("file")(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File size exceeds 10MB limit",
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || "Invalid file upload",
      });
    }

    // If file was uploaded, validate its binary signature
    if (req.file && req.file.path) {
      const isValid = await validateFileSignature(req.file.path);
      if (!isValid) {
        try {
          if (fs.existsSync(req.file.path)) {
            await fs.promises.unlink(req.file.path);
          }
        } catch {
          // ignore cleanup error
        }
        return res.status(400).json({
          success: false,
          message: "Invalid file: binary signature does not match supported format",
        });
      }
    }

    next();
  });
};

export default upload;
