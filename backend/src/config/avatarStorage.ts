import fs from "fs/promises";
import path from "path";
import type { Request } from "express";
import { uploadAvatarObject as uploadAvatarToR2 } from "./r2.js";

const R2_ENDPOINT = process.env.R2_ENDPOINT || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET = process.env.R2_BUCKET || "";
const CDN_BASE_URL = (process.env.CDN_BASE_URL || "").replace(/\/$/, "");

export function isR2Configured(): boolean {
  return Boolean(
    R2_ENDPOINT &&
      R2_ACCESS_KEY_ID &&
      R2_SECRET_ACCESS_KEY &&
      R2_BUCKET &&
      CDN_BASE_URL
  );
}

export function getAvatarStorageMode(): "r2" | "local" {
  return isR2Configured() ? "r2" : "local";
}

/** Directory that is exposed at GET /media/… */
export function getAvatarUploadsRoot(): string {
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  if (!dbUrl.startsWith("file:")) {
    return path.resolve(process.env.AVATAR_UPLOAD_DIR || "data/uploads");
  }

  let dbPath = dbUrl.slice(5).split("?")[0] ?? "";
  if (!dbPath) {
    return path.resolve(process.env.AVATAR_UPLOAD_DIR || "data/uploads");
  }
  if (!path.isAbsolute(dbPath)) {
    dbPath = path.join(process.cwd(), "prisma", dbPath);
  }
  return path.join(path.dirname(path.resolve(dbPath)), "uploads");
}

export function getPublicBaseUrl(req: Request): string {
  const fromEnv = (process.env.PUBLIC_BASE_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const host = req.get("host");
  if (host) {
    const forwarded = req.get("x-forwarded-proto") || "http";
    const proto = forwarded.split(",")[0]?.trim() || "http";
    return `${proto}://${host}`;
  }

  return `http://localhost:${process.env.PORT || 8080}`;
}

async function saveAvatarLocally(
  key: string,
  body: Buffer,
  publicBaseUrl: string
): Promise<{ key: string; url: string }> {
  const root = getAvatarUploadsRoot();
  const filePath = path.join(root, key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, body);
  const url = `${publicBaseUrl.replace(/\/$/, "")}/media/${key}`;
  return { key, url };
}

export async function saveAvatarFile(
  key: string,
  body: Buffer,
  contentType: string,
  publicBaseUrl: string
): Promise<{ key: string; url: string }> {
  if (isR2Configured()) {
    return uploadAvatarToR2(key, body, contentType);
  }
  return saveAvatarLocally(key, body, publicBaseUrl);
}
