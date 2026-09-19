import { Router, RequestHandler } from "express";
import { authenticateUser } from "../../middlewares/auth/authenticateMiddleware.js";
import { authorizeRole } from "../../middlewares/auth/authorizeMiddleware.js";
import {
  getVendorOpenings,
  getVendorOpeningById,
  presignProfileUpload,
  submitProfileUpload,
  deleteVendorProfile,
  previewVendorProfile,
} from "../../controllers/vendor/vendorOpeningController.js";

const router = Router();

// All vendor opening and profile endpoints require authentication and IT_VENDOR role
router.use(authenticateUser as RequestHandler);
router.use(authorizeRole("IT_VENDOR") as RequestHandler);

/**
 * GET /api/v1/vendor/openings
 * Search & paginate openings for authenticated vendor's tenant
 */
router.get("/openings", getVendorOpenings as any);

/**
 * GET /api/v1/vendor/openings/:id
 * Get opening details and submitted profiles
 */
router.get("/openings/:id", getVendorOpeningById as any);

/**
 * POST /api/v1/vendor/openings/:id/profiles/presign
 * Presign S3 URL for profile PDF upload
 */
router.post("/openings/:id/profiles/presign", presignProfileUpload as any);

/**
 * POST /api/v1/vendor/openings/:id/profiles/upload
 * Atomically create profile record after S3 upload
 */
router.post("/openings/:id/profiles/upload", submitProfileUpload as any);

/**
 * DELETE /api/v1/vendor/profiles/:id
 * Soft delete profile record
 */
router.delete("/profiles/:id", deleteVendorProfile as any);

/**
 * GET /api/v1/vendor/profiles/:id/preview
 * Generate presigned URL for browser PDF preview
 */
router.get("/profiles/:id/preview", previewVendorProfile as any);

export default router;
