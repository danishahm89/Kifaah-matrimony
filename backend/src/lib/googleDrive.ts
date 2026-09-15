import { google } from "googleapis";
import fs from "fs";
import { Readable } from "stream";
import { env } from "./env";

const KEY_FILE = env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
const FOLDER_ID = env.GOOGLE_DRIVE_FOLDER_ID;

/** True only when both env vars are set AND the key file actually exists on disk. */
export const driveConfigured = !!(KEY_FILE && FOLDER_ID && fs.existsSync(KEY_FILE));

let driveClient: ReturnType<typeof google.drive> | null = null;

function getDrive() {
  if (!driveClient) {
    const auth = new google.auth.GoogleAuth({
      keyFile: KEY_FILE,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    driveClient = google.drive({ version: "v3", auth: auth as unknown as never });
  }
  return driveClient;
}

function bufferToStream(buffer: Buffer): Readable {
  const readable = new Readable();
  readable._read = () => {};
  readable.push(buffer);
  readable.push(null);
  return readable;
}

/**
 * Uploads a photo into the configured Drive folder under `filename`.
 * Any pre-existing file with the same name in that folder is deleted first,
 * so re-uploading a profile photo doesn't pile up duplicates.
 * The file is private to the service account (never made "anyone with the link"),
 * matching the app's requirement that photos stay hidden until mutual match.
 * Returns the new file's Drive fileId.
 */
export async function uploadPhoto(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const drive = getDrive();
  const safeName = filename.replace(/'/g, "\\'");
  const existing = await drive.files.list({
    q: `name = '${safeName}' and '${FOLDER_ID}' in parents and trashed = false`,
    fields: "files(id)",
  });
  for (const f of existing.data.files ?? []) {
    if (f.id) {
      await drive.files.delete({ fileId: f.id }).catch(() => {});
    }
  }

  const res = await drive.files.create({
    requestBody: { name: filename, parents: [FOLDER_ID as string] },
    media: { mimeType, body: bufferToStream(buffer) },
    fields: "id",
  });

  const fileId = res.data.id;
  if (!fileId) throw new Error("Google Drive upload did not return a file id");
  return fileId;
}

/** Streams a previously-uploaded photo back by its Drive fileId, for the proxy route. */
export async function streamPhoto(fileId: string): Promise<{ stream: NodeJS.ReadableStream; mimeType: string }> {
  const drive = getDrive();
  const meta = await drive.files.get({ fileId, fields: "mimeType" });
  const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "stream" });
  return { stream: res.data as unknown as NodeJS.ReadableStream, mimeType: meta.data.mimeType || "image/jpeg" };
}
