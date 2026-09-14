// Minimal ambient typing for the `file-type` package. It's ESM-only and its
// package.json `exports` map isn't resolvable under this project's
// `moduleResolution: "node"` setting, so we hand-declare the one export we
// use rather than switching the whole project's module resolution mode.
// Loaded at runtime via src/lib/dynamicImport.ts, not a normal import.
declare module "file-type" {
  export interface FileTypeResult {
    ext: string;
    mime: string;
  }
  export function fileTypeFromBuffer(input: Uint8Array | ArrayBuffer | Buffer): Promise<FileTypeResult | undefined>;
}
