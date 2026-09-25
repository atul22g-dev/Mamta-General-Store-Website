/**
 * Admin authorization tests (9).
 *
 * `getAdminSession` is the single authorization gate every admin page and
 * mutation action runs through. Its Supabase calls are mocked here (no
 * credentials, no network) and the DB row decision matrix is exercised:
 * ADMIN+active → session; CUSTOMER / inactive / missing → null (fail closed).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockState = {
  user: null as null | { id: string; email: string },
  profile: null as null | { name: string; role: string; active: boolean },
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () =>
        mockState.user ? { data: { user: mockState.user }, error: null } : { data: { user: null }, error: null },
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: mockState.profile }),
        }),
      }),
    }),
  }),
}));

describe("admin session authorization matrix (9)", async () => {
  const { getAdminSession } = await import("@/lib/auth/session");

  beforeEach(() => {
    mockState.user = null;
    mockState.profile = null;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a session for an active ADMIN profile", async () => {
    mockState.user = { id: "u1", email: "owner@mamtastore.in" };
    mockState.profile = { name: "admin", role: "ADMIN", active: true };
    const session = await getAdminSession();
    expect(session).toEqual({ userId: "u1", email: "owner@mamtastore.in", name: "admin" });
  });

  it("denies an authenticated CUSTOMER profile", async () => {
    mockState.user = { id: "u2", email: "customer@example.com" };
    mockState.profile = { name: "", role: "CUSTOMER", active: true };
    expect(await getAdminSession()).toBeNull();
  });

  it("denies a deactivated ADMIN profile", async () => {
    mockState.user = { id: "u3", email: "owner@mamtastore.in" };
    mockState.profile = { name: "admin", role: "ADMIN", active: false };
    expect(await getAdminSession()).toBeNull();
  });

  it("denies a missing profile row (auth user without profile)", async () => {
    mockState.user = { id: "u4", email: "ghost@example.com" };
    mockState.profile = null;
    expect(await getAdminSession()).toBeNull();
  });

  it("denies unauthenticated callers without touching the profile", async () => {
    mockState.user = null;
    expect(await getAdminSession()).toBeNull();
  });
});
