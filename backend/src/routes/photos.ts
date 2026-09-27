import { Router } from "express";
import path from "path";
import fs from "fs";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { verifyPhotoToken } from "../lib/photoUrls";
import { driveConfigured, streamPhoto } from "../lib/googleDrive";

// Serves a profile photo only for a valid signed link (see lib/photoUrls).
// The link is only ever given out by API responses that already checked the
// viewer is allowed to see the photo (owner, or accepted photo request).
const router = Router();

router.get("/:token", async (req, res) => {
  const stored = verifyPhotoToken(req.params.token);
  if (!stored) return res.status(404).json({ error: "not_found" });

  res.setHeader("Cache-Control", "private, max-age=3600");
  res.setHeader("X-Robots-Tag", "noindex");
  // The web app lives on a different domain from the API. helmet's default
  // "same-origin" would stop the browser from showing the image there. The
  // signature already controls who can load it.
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

  if (stored.startsWith("/uploads/")) {
    const file = path.basename(stored);
    const full = path.join(path.resolve(env.UPLOAD_DIR), file);
    if (!fs.existsSync(full)) return res.status(404).json({ error: "not_found" });
    return res.sendFile(full);
  }

  const drive = stored.match(/^\/api\/profile\/photos\/drive\/([A-Za-z0-9_-]+)$/);
  if (drive && driveConfigured) {
    try {
      const { stream, mimeType } = await streamPhoto(drive[1]);
      res.setHeader("Content-Type", mimeType);
      return stream.pipe(res);
    } catch (err) {
      logger.warn({ err }, "failed to stream photo from Drive");
    }
  }
  return res.status(404).json({ error: "not_found" });
});

export default router;
