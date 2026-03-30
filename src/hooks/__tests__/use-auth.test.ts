import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignInAction = vi.fn();
const mockSignUpAction = vi.fn();
vi.mock("@/actions", () => ({
  signIn: (...args: unknown[]) => mockSignInAction(...args),
  signUp: (...args: unknown[]) => mockSignUpAction(...args),
}));

const mockGetAnonWorkData = vi.fn();
const mockClearAnonWork = vi.fn();
vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: () => mockGetAnonWorkData(),
  clearAnonWork: () => mockClearAnonWork(),
}));

const mockGetProjects = vi.fn();
vi.mock("@/actions/get-projects", () => ({
  getProjects: () => mockGetProjects(),
}));

const mockCreateProject = vi.fn();
vi.mock("@/actions/create-project", () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
}));

const { useAuth } = await import("@/hooks/use-auth");

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-project-id" });
});

describe("initial state", () => {
  test("isLoading starts as false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("exposes signIn and signUp functions", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });
});

describe("signIn", () => {
  test("calls signIn action with email and password", async () => {
    mockSignInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "password123");
    });

    expect(mockSignInAction).toHaveBeenCalledWith("user@example.com", "password123");
  });

  test("sets isLoading to true during sign-in and false after", async () => {
    let resolveSignIn!: (value: unknown) => void;
    mockSignInAction.mockReturnValue(new Promise((r) => (resolveSignIn = r)));
    const { result } = renderHook(() => useAuth());

    let signInPromise: Promise<unknown>;
    act(() => {
      signInPromise = result.current.signIn("user@example.com", "pass");
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignIn({ success: false, error: "err" });
      await signInPromise!;
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("returns the result from the action on failure", async () => {
    mockSignInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });
    const { result } = renderHook(() => useAuth());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.signIn("user@example.com", "wrong");
    });

    expect(returned).toEqual({ success: false, error: "Invalid credentials" });
  });

  test("returns the result from the action on success", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.signIn("user@example.com", "pass");
    });

    expect(returned).toEqual({ success: true });
  });

  test("sets isLoading to false even when action throws", async () => {
    mockSignInAction.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("does not call handlePostSignIn when sign-in fails", async () => {
    mockSignInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "wrong");
    });

    expect(mockGetProjects).not.toHaveBeenCalled();
    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("signUp", () => {
  test("calls signUp action with email and password", async () => {
    mockSignUpAction.mockResolvedValue({ success: false, error: "Email already registered" });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@example.com", "password123");
    });

    expect(mockSignUpAction).toHaveBeenCalledWith("new@example.com", "password123");
  });

  test("sets isLoading to true during sign-up and false after", async () => {
    let resolveSignUp!: (value: unknown) => void;
    mockSignUpAction.mockReturnValue(new Promise((r) => (resolveSignUp = r)));
    const { result } = renderHook(() => useAuth());

    let signUpPromise: Promise<unknown>;
    act(() => {
      signUpPromise = result.current.signUp("new@example.com", "pass");
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignUp({ success: false, error: "err" });
      await signUpPromise!;
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("returns the result from the action", async () => {
    mockSignUpAction.mockResolvedValue({ success: false, error: "Email already registered" });
    const { result } = renderHook(() => useAuth());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.signUp("existing@example.com", "pass");
    });

    expect(returned).toEqual({ success: false, error: "Email already registered" });
  });

  test("sets isLoading to false even when action throws", async () => {
    mockSignUpAction.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@example.com", "pass").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("does not call handlePostSignIn when sign-up fails", async () => {
    mockSignUpAction.mockResolvedValue({ success: false, error: "Email already registered" });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("existing@example.com", "pass");
    });

    expect(mockGetProjects).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("handlePostSignIn — anonymous work exists", () => {
  const anonWork = {
    messages: [{ role: "user", content: "make a button" }],
    fileSystemData: { "/App.jsx": "export default () => <button />" },
  };

  beforeEach(() => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(anonWork);
    mockCreateProject.mockResolvedValue({ id: "anon-project-id" });
  });

  test("creates a project with anonymous work data", async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockCreateProject).toHaveBeenCalledWith({
      name: expect.stringMatching(/^Design from /),
      messages: anonWork.messages,
      data: anonWork.fileSystemData,
    });
  });

  test("clears anonymous work after creating project", async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockClearAnonWork).toHaveBeenCalledOnce();
  });

  test("redirects to the new project", async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
  });

  test("does not fetch existing projects when anon work is present", async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockGetProjects).not.toHaveBeenCalled();
  });
});

describe("handlePostSignIn — anon work has no messages", () => {
  beforeEach(() => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
  });

  test("falls through to fetch existing projects when messages array is empty", async () => {
    mockGetProjects.mockResolvedValue([{ id: "existing-project" }]);
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockGetProjects).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith("/existing-project");
  });
});

describe("handlePostSignIn — existing projects", () => {
  beforeEach(() => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(null);
  });

  test("redirects to the most recent project", async () => {
    mockGetProjects.mockResolvedValue([
      { id: "recent-project" },
      { id: "older-project" },
    ]);
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockPush).toHaveBeenCalledWith("/recent-project");
  });

  test("does not create a new project when existing projects are found", async () => {
    mockGetProjects.mockResolvedValue([{ id: "existing-project" }]);
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockCreateProject).not.toHaveBeenCalled();
  });
});

describe("handlePostSignIn — no existing projects", () => {
  beforeEach(() => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "brand-new-project" });
  });

  test("creates a new blank project", async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockCreateProject).toHaveBeenCalledWith({
      name: expect.stringMatching(/^New Design #\d+$/),
      messages: [],
      data: {},
    });
  });

  test("redirects to the newly created project", async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockPush).toHaveBeenCalledWith("/brand-new-project");
  });

  test("same post-sign-in flow runs after successful signUp", async () => {
    mockSignUpAction.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@example.com", "pass");
    });

    expect(mockCreateProject).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith("/brand-new-project");
  });
});
