import { Response } from "express";
import { AuthenticatedRequest } from "../../types/common.js";
import { VendorOpeningService } from "../../services/vendor/vendorOpeningService.js";

const vendorOpeningService = new VendorOpeningService();

/**
 * Helper to safely extract tenantId from authenticated user request
 */
const getTenantId = (req: AuthenticatedRequest): string => {
  const tenantId = req.user?.tenantId || req.user?.tenant?.tenantId;
  if (!tenantId) {
    throw { status: 401, message: "Tenant context not found on authenticated user" };
  }
  return tenantId;
};

/**
 * GET /api/v1/vendor/openings
 */
export const getVendorOpenings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { page, limit, search, status } = req.query;

    const result = await vendorOpeningService.getOpenings({
      tenantId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search: search ? String(search) : undefined,
      status: status ? String(status) : undefined,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[VendorOpeningController] Error in getVendorOpenings:", error);
    const status = error.status || 500;
    return res.status(status).json({
      message: error.message || "Failed to fetch vendor openings",
    });
  }
};

/**
 * GET /api/v1/vendor/openings/:id
 */
export const getVendorOpeningById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Opening ID parameter is required" });
    }

    const opening = await vendorOpeningService.getOpeningById(tenantId, id);

    if (!opening) {
      return res.status(404).json({ message: "Opening not found or unauthorized" });
    }

    return res.status(200).json({ data: opening });
  } catch (error: any) {
    console.error("[VendorOpeningController] Error in getVendorOpeningById:", error);
    const status = error.status || 500;
    return res.status(status).json({
      message: error.message || "Failed to fetch opening details",
    });
  }
};

/**
 * POST /api/v1/vendor/openings/:id/profiles/presign
 */
export const presignProfileUpload = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const { fileName, contentType, fileSize } = req.body;

    if (!fileName || !contentType || fileSize === undefined) {
      return res.status(400).json({
        message: "fileName, contentType, and fileSize are required fields",
      });
    }

    const result = await vendorOpeningService.presignProfileUpload({
      tenantId,
      openingId: id,
      fileName: String(fileName),
      contentType: String(contentType),
      fileSize: Number(fileSize),
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[VendorOpeningController] Error in presignProfileUpload:", error);
    const status = error.status || 500;
    return res.status(status).json({
      message: error.message || "Failed to generate presigned upload URL",
    });
  }
};

/**
 * POST /api/v1/vendor/openings/:id/profiles/upload
 */
export const submitProfileUpload = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const { s3Key } = req.body;

    if (!s3Key) {
      return res.status(400).json({ message: "s3Key is required" });
    }

    const uploadedBy = req.user?.email || req.user?.username || req.user?.id || "IT_VENDOR";

    const profile = await vendorOpeningService.submitProfile({
      tenantId,
      openingId: id,
      s3Key: String(s3Key),
      uploadedBy,
    });

    return res.status(201).json({
      message: "Profile submitted successfully",
      data: profile,
    });
  } catch (error: any) {
    console.error("[VendorOpeningController] Error in submitProfileUpload:", error);
    const status = error.status || 500;
    return res.status(status).json({
      message: error.message || "Failed to submit profile record",
    });
  }
};

/**
 * DELETE /api/v1/vendor/profiles/:id
 */
export const deleteVendorProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const profileId = Number(req.params.id);

    if (isNaN(profileId)) {
      return res.status(400).json({ message: "Invalid profile ID" });
    }

    const result = await vendorOpeningService.softDeleteProfile(tenantId, profileId);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[VendorOpeningController] Error in deleteVendorProfile:", error);
    const status = error.status || 500;
    return res.status(status).json({
      message: error.message || "Failed to soft delete profile",
    });
  }
};

/**
 * GET /api/v1/vendor/profiles/:id/preview
 */
export const previewVendorProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const profileId = Number(req.params.id);

    if (isNaN(profileId)) {
      return res.status(400).json({ message: "Invalid profile ID" });
    }

    const result = await vendorOpeningService.presignPreviewUrl(tenantId, profileId);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[VendorOpeningController] Error in previewVendorProfile:", error);
    const status = error.status || 500;
    return res.status(status).json({
      message: error.message || "Failed to generate preview URL",
    });
  }
};
