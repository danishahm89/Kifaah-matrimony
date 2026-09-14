import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    globalSetup: ["./tests/globalSetup.ts"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
    // All test files share one real Postgres test database, and a couple of
    // files truncate tables in beforeAll/afterAll — running files in
    // parallel would let one file's cleanup race another file's in-flight
    // requests (foreign-key violations, flaky counts). Keep files
    // sequential; tests within a file still run in registration order.
    fileParallelism: false,
  },
});
