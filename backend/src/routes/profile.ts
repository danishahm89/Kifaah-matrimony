import { NextFunction, Response, Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { z } from "zod";
import type { fileTypeFromBuffer as FileTypeFromBuffer } from "file-type";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { logger } from "../lib/logger";
import dynamicImport from "../lib/dynamicImport";
import { appConfig } from "../lib/appConfig";
import { driveConfigured, driveUploadEnabled, uploadPhoto, deletePhoto } from "../lib/googleDrive";
import { signPhotoUrl, randomPhotoName } from "../lib/photoUrls";
import { findContactDetails, CONTACT_BLOCKED_MESSAGE } from "../lib/contactGuard";
import { recordContactAttempt } from "../lib/contactAttempts";

// Free-text profile fields other members can read. None may carry contact details.
const GUARDED_FIELDS = ["name", "about", "family", "wali", "city", "dietCustom", "habitsCustom", "likesCustom", "dislikesCustom"] as const;

const router = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Buffer in memory (not straight to disk) — nothing touches disk until it's
// been magic-byte checked and re-encoded (CONTRACT §7.3). SVG is
// deliberately not in this list: it can carry script content.
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: appConfig.upload.maxFileSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "file"));
  },
});

/** Turns multer's rejection (bad type/too large) into a clean 400 instead of falling through to the generic 500 handler. */
function handleUploadErrors(err: unknown, _req: AuthedRequest, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "file_too_large", message: `Photo must be ${appConfig.upload.maxFileSizeMb}MB or smaller.` });
    }
    return res.status(400).json({ error: "invalid_image", message: "Only JPEG, PNG or WEBP images are allowed." });
  }
  next(err);
}

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const profile = await prisma.profile.findUnique({ where: { userId: req.userId! } });
  res.json(profile ? { ...profile, photoUrl: signPhotoUrl(profile.photoUrl) } : profile);
});

// All Profile fields are optional/partial-updatable per CONTRACT §4 except
// name/age which are required for the candidate to be displayable at all,
// but even those are allowed to arrive incrementally.
const profileUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    age: z.number().int().min(18).max(99).optional(),
    // Only clearing is allowed here; a new photo must go through POST /photo.
    photoUrl: z.null().optional(),
    sect: z.string().optional(),
    prayer: z.string().optional(),
    modesty: z.string().optional(),
    wali: z.string().min(1).optional(),
    eduProf: z.string().optional(),
    profField: z.string().optional(),
    family: z.string().optional(),
    height: z.string().optional(),
    city: z.string().optional(),
    marital: z.string().optional(),
    about: z.string().optional(),
    fasting: z.string().optional(),
    quran: z.string().optional(),
    hajj: z.string().optional(),
    polygamy: z.string().optional(),
    diet: z.string().optional(),
    dietCustom: z.string().optional(),
    smoking: z.string().optional(),
    habits: z.string().optional(),
    habitsCustom: z.string().optional(),
    likes: z.string().optional(),
    likesCustom: z.string().optional(),
    dislikes: z.string().optional(),
    dislikesCustom: z.string().optional(),
    phone: z.string().optional(),
    contactEmail: z.string().optional(),
    state: z.string().max(80).nullable().optional(),
    motherTongue: z.string().max(80).nullable().optional(),
    education: z.string().max(80).nullable().optional(),
    profession: z.string().max(80).nullable().optional(),
    // Partner preferences; null = any.
    prefMinAge: z.number().int().min(18).max(99).nullable().optional(),
    prefMaxAge: z.number().int().min(18).max(99).nullable().optional(),
    prefState: z.string().max(80).nullable().optional(),
    prefSect: z.string().max(80).nullable().optional(),
    prefMarital: z.string().max(80).nullable().optional(),
  })
  .refine((d) => d.prefMinAge == null || d.prefMaxAge == null || d.prefMinAge <= d.prefMaxAge, {
    message: "prefMinAge must be <= prefMaxAge",
    path: ["prefMaxAge"],
  })
  ;

router.put("/me", requireAuth, async (req: AuthedRequest, res) => {
  // Strip empty-string wali so groom profiles aren't blocked — treat blank
  // as "not provided". The profileComplete formula enforces wali for brides.
  if (req.body && typeof req.body.wali === 'string' && req.body.wali.trim() === '') {
    delete req.body.wali;
  }
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  }
  // Wali is required non-empty once present — reject an explicit blank, but
  // allow the field to simply be omitted on a partial update.
  if (parsed.data.wali !== undefined && parsed.data.wali.trim() === "") {
    return res.status(400).json({ error: "wali_required" });
  }

  // Keep the older combined fields filled so older app builds and the match
  // score (which reads profField) keep working.
  if (parsed.data.education || parsed.data.profession) {
    const parts = [parsed.data.education, parsed.data.profession].filter(Boolean);
    parsed.data.eduProf = parts.join(" · ");
    if (parsed.data.profession) parsed.data.profField = parsed.data.profession;
  }

  for (const field of GUARDED_FIELDS) {
    const value = parsed.data[field];
    if (typeof value !== "string") continue;
    const contact = findContactDetails(value);
    if (contact.blocked) {
      await recordContactAttempt(req.userId!, "profile", contact.kinds, { field });
      return res
        .status(422)
        .json({ error: "contact_details_not_allowed", field, kinds: contact.kinds, message: CONTACT_BLOCKED_MESSAGE });
    }
  }

  const profile = await prisma.profile.upsert({
    where: { userId: req.userId! },
    update: parsed.data,
    create: { userId: req.userId!, wali: "", ...parsed.data },
  });

  res.json({ ...profile, photoUrl: signPhotoUrl(profile.photoUrl) });
});

router.post("/photo", requireAuth, upload.single("file"), handleUploadErrors, async (req: AuthedRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: "file_required" });
  }

  // Verify actual file content via magic bytes — never trust the
  // client-supplied MIME type/extension (CONTRACT §7.3). `file-type` ships
  // as an ESM-only package, so it's loaded via a genuine dynamic import()
  // (see src/lib/dynamicImport.ts) rather than a static one, since this
  // project otherwise compiles to CommonJS.
  const fileTypeModule = (await dynamicImport("file-type")) as { fileTypeFromBuffer: typeof FileTypeFromBuffer };
  const detected = await fileTypeModule.fileTypeFromBuffer(req.file.buffer);
  if (!detected || !ALLOWED_MIME.has(detected.mime)) {
    return res.status(400).json({ error: "invalid_image", message: "Only JPEG, PNG or WEBP images are allowed." });
  }

  let outputBuffer: Buffer;
  try {
    // Re-encode through sharp regardless of input format: strips
    // EXIF/metadata, normalizes to a sane max dimension, and re-saves as
    // JPEG so nothing but actual decoded pixel data ever reaches disk.
    outputBuffer = await sharp(req.file.buffer)
      .rotate() // apply EXIF orientation before stripping it
      .resize({
        width: appConfig.upload.maxDimensionPx,
        height: appConfig.upload.maxDimensionPx,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    logger.warn({ err }, "photo re-encode failed");
    return res.status(400).json({ error: "invalid_image", message: "Could not process this image." });
  }

  let photoUrl: string;
  if (driveUploadEnabled) {
    // Random name: no member name or id in a file that sits in shared storage.
    const filename = randomPhotoName();

    let fileId: string;
    try {
      fileId = await uploadPhoto(outputBuffer, filename, "image/jpeg");
    } catch (err) {
      logger.warn({ err }, "Google Drive upload failed");
      return res.status(502).json({ error: "upload_failed", message: "Could not upload photo. Please try again." });
    }
    photoUrl = `/api/profile/photos/drive/${fileId}`;
  } else {
    const filename = randomPhotoName();
    await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), outputBuffer);
    photoUrl = `/uploads/${filename}`;
  }

  const previous = (await prisma.profile.findUnique({ where: { userId: req.userId! }, select: { photoUrl: true } }))
    ?.photoUrl;
  await prisma.profile.upsert({
    where: { userId: req.userId! },
    update: { photoUrl },
    create: { userId: req.userId!, wali: "", photoUrl },
  });

  // Files now have random names, so remove the old photo ourselves instead of
  // relying on a same-name overwrite. Best effort only.
  if (previous && previous !== photoUrl) {
    try {
      if (previous.startsWith("/uploads/")) {
        await fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(previous)));
      } else {
        const m = previous.match(/\/photos\/drive\/([A-Za-z0-9_-]+)$/);
        if (m && driveConfigured) await deletePhoto(m[1]);
      }
    } catch (err) {
      logger.warn({ err }, "could not remove previous photo");
    }
  }
  res.json({ photoUrl: signPhotoUrl(photoUrl) });
});


export default router;
