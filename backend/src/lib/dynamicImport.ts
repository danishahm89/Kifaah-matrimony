// TypeScript downlevels `await import(...)` to `require(...)` when compiling
// to CommonJS, which breaks loading ESM-only packages (e.g. `file-type`
// v15+) from this CommonJS project. Routing the call through `Function`
// keeps it as a genuine dynamic `import()` at runtime, which Node's
// CJS/ESM interop can load ESM from.
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string
) => Promise<unknown>;

export default dynamicImport;
