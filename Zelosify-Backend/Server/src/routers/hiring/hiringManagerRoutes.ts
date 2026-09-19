import { Router, RequestHandler } from "express";
import { authenticateUser } from "../../middlewares/auth/authenticateMiddleware.js";
import { authorizeRole } from "../../middlewares/auth/authorizeMiddleware.js";
import {
  getHiringManagerOpenings,
  createHiringManagerOpening,
  getOpeningProfiles,
  shortlistProfile,
  rejectProfile,
  updateOpeningStatus,
  previewProfile,
} from "../../controllers/hiring/hiringManagerOpeningController.js";

const router = Router();

// All Hiring Manager endpoints require authentication and HIRING_MANAGER role
router.use(authenticateUser as RequestHandler);
router.use(authorizeRole("HIRING_MANAGER") as RequestHandler);

/**
 * GET /api/v1/hiring-manager/openings
 * Search & paginate openings owned by authenticated Hiring Manager
 */
router.get("/openings", getHiringManagerOpenings as any);

/**
 * POST /api/v1/hiring-manager/openings
 * Create new contract opening owned by authenticated Hiring Manager
 */
router.post("/openings", createHiringManagerOpening as any);

/**
 * GET /api/v1/hiring-manager/openings/:id/profiles
 * Get profiles submitted to opening owned by authenticated Hiring Manager
 */
router.get("/openings/:id/profiles", getOpeningProfiles as any);

/**
 * PATCH /api/v1/hiring-manager/openings/:id/status
 * Update opening status (OPEN, ON_HOLD, CLOSED)
 */
router.patch("/openings/:id/status", updateOpeningStatus as any);

/**
 * POST /api/v1/hiring-manager/profiles/:id/shortlist
 * Shortlist candidate profile
 */
router.post("/profiles/:id/shortlist", shortlistProfile as any);

/**
 * POST /api/v1/hiring-manager/profiles/:id/reject
 * Reject candidate profile
 */
router.post("/profiles/:id/reject", rejectProfile as any);

/**
 * GET /api/v1/hiring-manager/profiles/:id/preview
 * Generate presigned URL for PDF resume preview
 */
router.get("/profiles/:id/preview", previewProfile as any);

export default router;
