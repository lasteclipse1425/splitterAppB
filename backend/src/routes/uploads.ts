import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { authenticateToken, type AuthRequest } from "../middleware/auth.js";
import { getPublicBaseUrl, saveAvatarFile } from "../config/avatarStorage.js";
import { prisma } from "../config/prisma.js";

type UploadFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};
// We rely on multer to inject req.file at runtime; keep a minimal local typing for safety
type ReqFileMinimal = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname?: string;
};

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Uploads
 *   description: File uploads (avatars)
 */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.AVATAR_MAX_BYTES || 2 * 1024 * 1024), // default 2MB
  },
});

function sniffImageExt(
  buffer: Buffer
): ".webp" | ".jpg" | ".png" | ".gif" | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return ".jpg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return ".png";
  }
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46
  ) {
    return ".gif";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return ".webp";
  }
  return null;
}

function pickExtByMime(
  mime: string,
  originalname?: string,
  buffer?: Buffer
): ".webp" | ".jpg" | ".jpeg" | ".png" | ".gif" | ".heic" | null {
  const m = mime.toLowerCase();
  if (m === "image/webp") return ".webp";
  if (m === "image/jpeg" || m === "image/jpg") return ".jpg";
  if (m === "image/png") return ".png";
  if (m === "image/gif") return ".gif";
  if (m === "image/heic" || m === "image/heif") return ".heic";

  const name = (originalname || "").toLowerCase();
  if (name.endsWith(".webp")) return ".webp";
  if (name.endsWith(".jpeg") || name.endsWith(".jpg")) return ".jpg";
  if (name.endsWith(".png")) return ".png";
  if (name.endsWith(".gif")) return ".gif";
  if (name.endsWith(".heic") || name.endsWith(".heif")) return ".heic";

  if (m === "application/octet-stream" && buffer) {
    return sniffImageExt(buffer);
  }

  if (buffer) {
    return sniffImageExt(buffer);
  }

  return null;
}

/**
 * @swagger
 * /uploads/avatar:
 *   post:
 *     summary: Upload user avatar (multipart/form-data)
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *           encoding:
 *             file:
 *               contentType: image/webp, image/jpeg, image/png, image/gif
 *       description: |
 *         Upload image using multipart/form-data with the field name `file`.
 *
 *         Example (cURL):
 *
 *           curl -X POST "https://api.example.com/uploads/avatar" \
 *             -H "Authorization: Bearer <TOKEN>" \
 *             -H "Content-Type: multipart/form-data" \
 *             -F "file=@/path/to/avatar.webp"
 *     responses:
 *       200:
 *         description: Avatar uploaded and saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 avatarUrl:
 *                   type: string
 *                   example: https://static.splitter.qzz.io/avatars/123/v1696070000/avatar.webp
 *                 key:
 *                   type: string
 *                   example: avatars/123/v1696070000/avatar.webp
 *       400:
 *         description: Bad request (e.g., missing file or unsupported type)
 *       401:
 *         description: Unauthorized
 *       413:
 *         description: Payload too large (exceeds AVATAR_MAX_BYTES)
 */
router.post(
  "/avatar",
  authenticateToken,
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const file = (req as Request & { file?: ReqFileMinimal }).file;
      if (!file) {
        res.status(400).json({ error: "file is required" });
        return;
      }

      const { buffer, mimetype, size, originalname } = file;
      const maxBytes = Number(process.env.AVATAR_MAX_BYTES || 2 * 1024 * 1024);
      if (size > maxBytes) {
        res.status(413).json({ error: "File too large" });
        return;
      }

      const ext = pickExtByMime(mimetype, originalname, buffer);
      if (!ext) {
        res.status(400).json({
          error: "Unsupported image type",
          mimetype,
          originalname: originalname ?? null,
        });
        return;
      }

      // Build version from current timestamp seconds for simplicity
      const v = Math.floor(Date.now() / 1000);
      const key = `avatars/${req.user.id}/v${v}/avatar${ext}`;

      const publicBaseUrl = getPublicBaseUrl(req);
      const put = await saveAvatarFile(key, buffer, mimetype, publicBaseUrl);

      // Persist URL to user
      await prisma.user.update({
        where: { id: req.user.id },
        data: { avatarUrl: put.url },
        select: { id: true },
      });

      res.json({ success: true, avatarUrl: put.url, key: put.key });
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("POST /uploads/avatar error:", err);
      const isDev = process.env.NODE_ENV !== "production";
      res.status(500).json({
        error: "Server error",
        ...(isDev ? { detail: message } : {}),
      });
      return;
    }
  }
);

export default router;
