import { Response } from "express";
import { AuthenticatedRequest } from "../../types/common.js";
import { HiringManagerService } from "../../services/hiring/hiringManagerService.js";

const hiringManagerService = new HiringManagerService();

const getAuthContext = (req: AuthenticatedRequest) => {
  const tenantId = req.user?.tenantId || req.user?.tenant?.tenantId;
  const hiringManagerId = req.user?.id;

  if (!tenantId || !hiringManagerId) {
    throw { status: 401, message: "User authentication context incomplete" };
  }

  return { tenantId, hiringManagerId };
};

/**
 * GET /api/v1/hiring-manager/openings
 */
export const getHiringManagerOpenings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, hiringManagerId } = getAuthContext(req);
    const { page, limit, search, status } = req.query;

    const result = await hiringManagerService.getOpenings({
      tenantId,
      hiringManagerId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search: search ? String(search) : undefined,
      status: status ? String(status) : undefined,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[HMController] Error in getHiringManagerOpenings:", error);
    const status = error.status || 500;
    return res.status(status).json({ message: error.message || "Failed to fetch openings" });
  }
};

/**
 * POST /api/v1/hiring-manager/openings
 */
export const createHiringManagerOpening = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, hiringManagerId } = getAuthContext(req);
    const { title, description, location, contractType, experienceMin, experienceMax, expectedCompletionDate } = req.body;

    const newOpening = await hiringManagerService.createOpening({
      tenantId,
      hiringManagerId,
      title,
      description,
      location,
      contractType,
      experienceMin: Number(experienceMin),
      experienceMax: experienceMax !== undefined ? Number(experienceMax) : undefined,
      expectedCompletionDate,
    });

    return res.status(201).json({
      message: "Opening created successfully",
      data: newOpening,
    });
  } catch (error: any) {
    console.error("[HMController] Error in createHiringManagerOpening:", error);
    const status = error.status || 500;
    return res.status(status).json({ message: error.message || "Failed to create opening" });
  }
};

/**
 * GET /api/v1/hiring-manager/openings/:id/profiles
 */
export const getOpeningProfiles = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, hiringManagerId } = getAuthContext(req);
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Opening ID parameter is required" });
    }

    const result = await hiringManagerService.getProfilesForOpening({
      tenantId,
      hiringManagerId,
      openingId: id,
    });

    return res.status(200).json({ data: result });
  } catch (error: any) {
    console.error("[HMController] Error in getOpeningProfiles:", error);
    const status = error.status || 500;
    return res.status(status).json({ message: error.message || "Failed to fetch opening profiles" });
  }
};

/**
 * POST /api/v1/hiring-manager/profiles/:id/shortlist
 */
export const shortlistProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, hiringManagerId } = getAuthContext(req);
    const profileId = Number(req.params.id);

    if (isNaN(profileId)) {
      return res.status(400).json({ message: "Invalid profile ID" });
    }

    const result = await hiringManagerService.shortlistProfile({
      tenantId,
      hiringManagerId,
      profileId,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[HMController] Error in shortlistProfile:", error);
    const status = error.status || 500;
    return res.status(status).json({ message: error.message || "Failed to shortlist profile" });
  }
};

/**
 * POST /api/v1/hiring-manager/profiles/:id/reject
 */
export const rejectProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, hiringManagerId } = getAuthContext(req);
    const profileId = Number(req.params.id);

    if (isNaN(profileId)) {
      return res.status(400).json({ message: "Invalid profile ID" });
    }

    const result = await hiringManagerService.rejectProfile({
      tenantId,
      hiringManagerId,
      profileId,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[HMController] Error in rejectProfile:", error);
    const status = error.status || 500;
    return res.status(status).json({ message: error.message || "Failed to reject profile" });
  }
};

/**
 * PATCH /api/v1/hiring-manager/openings/:id/status
 */
export const updateOpeningStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, hiringManagerId } = getAuthContext(req);
    const { id } = req.params;
    const { status } = req.body;

    if (!id || !status) {
      return res.status(400).json({ message: "Opening ID and status are required" });
    }

    const result = await hiringManagerService.updateOpeningStatus({
      tenantId,
      hiringManagerId,
      openingId: id,
      status,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[HMController] Error in updateOpeningStatus:", error);
    const status = error.status || 500;
    return res.status(status).json({ message: error.message || "Failed to update opening status" });
  }
};

/**
 * GET /api/v1/hiring-manager/profiles/:id/preview
 */
export const previewProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, hiringManagerId } = getAuthContext(req);
    const profileId = Number(req.params.id);

    if (isNaN(profileId)) {
      return res.status(400).json({ message: "Invalid profile ID" });
    }

    const result = await hiringManagerService.presignPreviewUrl({
      tenantId,
      hiringManagerId,
      profileId,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[HMController] Error in previewProfile:", error);
    const status = error.status || 500;
    return res.status(status).json({ message: error.message || "Failed to generate preview URL" });
  }
};
