// Test stub for the "server-only" guard package: the real package throws when
// imported outside a React Server Component context, which every test is.
// Aliased in vitest.config.ts so server modules stay unit-testable.
const stub = {};
export default stub;
