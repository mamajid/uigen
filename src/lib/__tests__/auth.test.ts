// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { jwtVerify, SignJWT } from "jose";

vi.mock("server-only", () => ({}));

const mockSet = vi.fn();
const mockGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ set: mockSet, get: mockGet }),
}));

const { createSession, getSession } = await import("@/lib/auth");

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

async function makeToken(payload: object, expiresIn = "7d") {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

beforeEach(() => {
  mockSet.mockClear();
  mockGet.mockClear();
});

test("sets auth-token cookie", async () => {
  await createSession("user-1", "user@example.com");
  expect(mockSet).toHaveBeenCalledOnce();
  expect(mockSet.mock.calls[0][0]).toBe("auth-token");
});

test("JWT payload contains userId and email", async () => {
  await createSession("user-1", "user@example.com");
  const token = mockSet.mock.calls[0][1] as string;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  expect(payload.userId).toBe("user-1");
  expect(payload.email).toBe("user@example.com");
});

test("cookie is httpOnly with lax sameSite and root path", async () => {
  await createSession("user-1", "user@example.com");
  const options = mockSet.mock.calls[0][2] as Record<string, unknown>;
  expect(options.httpOnly).toBe(true);
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
});

test("cookie expires in ~7 days", async () => {
  const before = Date.now();
  await createSession("user-1", "user@example.com");
  const after = Date.now();

  const options = mockSet.mock.calls[0][2] as Record<string, unknown>;
  const expires = (options.expires as Date).getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  expect(expires).toBeGreaterThanOrEqual(before + sevenDays - 1000);
  expect(expires).toBeLessThanOrEqual(after + sevenDays + 1000);
});

test("secure flag is false outside production", async () => {
  await createSession("user-1", "user@example.com");
  const options = mockSet.mock.calls[0][2] as Record<string, unknown>;
  expect(options.secure).toBe(false);
});

test("secure flag is true in production", async () => {
  const original = process.env.NODE_ENV;
  vi.stubEnv("NODE_ENV", "production");

  await createSession("user-1", "user@example.com");
  const options = mockSet.mock.calls[0][2] as Record<string, unknown>;
  expect(options.secure).toBe(true);

  vi.stubEnv("NODE_ENV", original);
});

// getSession

test("getSession returns null when no cookie is present", async () => {
  mockGet.mockReturnValue(undefined);
  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns payload for a valid token", async () => {
  const token = await makeToken({ userId: "user-1", email: "user@example.com" });
  mockGet.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session?.userId).toBe("user-1");
  expect(session?.email).toBe("user@example.com");
});

test("getSession returns null for a malformed token", async () => {
  mockGet.mockReturnValue({ value: "not-a-valid-jwt" });
  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns null for an expired token", async () => {
  const token = await makeToken({ userId: "user-1", email: "user@example.com" }, "-1s");
  mockGet.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns null for a token signed with a different secret", async () => {
  const wrongSecret = new TextEncoder().encode("wrong-secret");
  const token = await new SignJWT({ userId: "user-1", email: "user@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(wrongSecret);
  mockGet.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session).toBeNull();
});
