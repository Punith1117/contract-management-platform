import type { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "../../types/typeIndex.js";
import { formatPublicKey } from "../../utils/jwt/formatPubKey.js";
import { isValidRole } from "../../utils/RBAC/isValidRole.js";

const publicKey = formatPublicKey(process.env.KEYCLOAK_RS256_SIG);

export function authorizeRole(requiredrole: string) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    // Validate the provided role string
    if (!isValidRole(requiredrole)) {
      res.status(400).json({ message: "Invalid role provided." });
      return;
    }

    // 1. If user object already populated by authenticateUser (e.g. dev token or JWKS lookup)
    if (req.user && req.user.role) {
      if (req.user.role === requiredrole) {
        return next();
      } else {
        return res.status(403).json({
          message: `Access Denied: User role (${req.user.role}) does not match required role (${requiredrole})`,
        });
      }
    }

    const token =
      req.headers.authorization?.split(" ")[1] || req.cookies.access_token;

    if (!token) {
      res.status(401).json({ message: "Missing token" });
      return;
    }

    // Validate public key
    if (!publicKey) {
      res.status(500).json({ message: "Public key not configured" });
      return;
    }

    jwt.verify(
      token,
      publicKey,
      { algorithms: ["RS256"] },
      async (err, decoded) => {
        if (err || typeof decoded !== "object") {
          return res.status(401).json({
            message: "Token verification failed",
            error: err?.message,
          });
        }

        const roles = (decoded as any).realm_access?.roles || [];
        if (!roles.includes(requiredrole)) {
          return res.status(403).json({
            message: `Access Denied: User does not have required role ${requiredrole}`,
          });
        }
        console.log("Authorize Role Middleware Passed ✅ : ", req.user);
        next();
      }
    );
  };
}
