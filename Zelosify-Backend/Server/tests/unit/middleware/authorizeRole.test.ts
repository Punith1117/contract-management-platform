import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../../src/types/typeIndex.js";

import { authorizeRole } from "../../../src/middlewares/auth/authorizeMiddleware.ts";

describe("authorizeRole", () => {
  const createResponse = () => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    return res as unknown as Response;
  };

  const createRequest = (
    user?: AuthenticatedRequest["user"],
  ): AuthenticatedRequest => {
    return {
      user,
      headers: {},
      cookies: {},
    } as AuthenticatedRequest;
  };

  const createUser = (
    role: string,
  ): NonNullable<AuthenticatedRequest["user"]> => ({
    id: "user-1",
    username: "test-user",
    email: "test@example.com",
    role,
    department: "Engineering",
    provider: "KEYCLOAK",
    tenantId: "tenant-1",
    tenant: {
      tenantId: "tenant-1",
      companyName: "Test Company",
    },
  });

  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
    vi.clearAllMocks();
  });

  it("allows a user with the required role", async () => {
    const req = createRequest(createUser("IT_VENDOR"));
    const res = createResponse();

    await authorizeRole("IT_VENDOR")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects a user with a different role", async () => {
    const req = createRequest(createUser("HIRING_MANAGER"));
    const res = createResponse();

    await authorizeRole("IT_VENDOR")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message:
        "Access Denied: User role (HIRING_MANAGER) does not match required role (IT_VENDOR)",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an invalid required role", async () => {
    const req = createRequest(createUser("IT_VENDOR"));
    const res = createResponse();

    await authorizeRole("INVALID_ROLE")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid role provided.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects the request when no token is provided", async () => {
    const req = createRequest();
    const res = createResponse();

    await authorizeRole("IT_VENDOR")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Missing token",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
