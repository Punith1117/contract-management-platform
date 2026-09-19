import prisma from "../../config/prisma/prisma.js";
import { createStorageService } from "../storage/storageFactory.js";
import { OpeningStatus, ProfileStatus } from "@prisma/client";

const storageService = createStorageService();

export class HiringManagerService {
  /**
   * Get openings created by / assigned to the authenticated Hiring Manager
   */
  async getOpenings(params: {
    tenantId: string;
    hiringManagerId: string;
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
    const skip = (page - 1) * limit;

    const whereCondition: any = {
      tenantId: params.tenantId,
      hiringManagerId: params.hiringManagerId,
    };

    if (params.status && Object.values(OpeningStatus).includes(params.status as OpeningStatus)) {
      whereCondition.status = params.status as OpeningStatus;
    }

    if (params.search && params.search.trim() !== "") {
      const searchStr = params.search.trim();
      whereCondition.OR = [
        { title: { contains: searchStr, mode: "insensitive" } },
        { description: { contains: searchStr, mode: "insensitive" } },
        { location: { contains: searchStr, mode: "insensitive" } },
      ];
    }

    const [openings, total] = await Promise.all([
      prisma.opening.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: { postedDate: "desc" },
        include: {
          _count: {
            select: {
              hiringProfiles: {
                where: { isDeleted: false },
              },
            },
          },
        },
      }),
      prisma.opening.count({ where: whereCondition }),
    ]);

    const formattedOpenings = openings.map((op) => ({
      id: op.id,
      title: op.title,
      description: op.description,
      location: op.location,
      contractType: op.contractType,
      experienceMin: op.experienceMin,
      experienceMax: op.experienceMax,
      status: op.status,
      postedDate: op.postedDate,
      expectedCompletionDate: op.expectedCompletionDate,
      actionDate: op.actionDate,
      profilesCount: op._count.hiringProfiles,
    }));

    return {
      data: formattedOpenings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Create a new opening for authenticated Hiring Manager
   */
  async createOpening(params: {
    tenantId: string;
    hiringManagerId: string;
    title: string;
    description?: string;
    location?: string;
    contractType?: string;
    experienceMin: number;
    experienceMax?: number;
    expectedCompletionDate?: string | Date;
  }) {
    if (!params.title || params.title.trim() === "") {
      throw { status: 400, message: "Title is required" };
    }

    if (params.experienceMin === undefined || params.experienceMin < 0) {
      throw { status: 400, message: "experienceMin must be a non-negative number" };
    }

    if (params.experienceMax !== undefined && params.experienceMax < params.experienceMin) {
      throw { status: 400, message: "experienceMax must be greater than or equal to experienceMin" };
    }

    const newOpening = await prisma.opening.create({
      data: {
        tenantId: params.tenantId,
        hiringManagerId: params.hiringManagerId,
        title: params.title.trim(),
        description: params.description ? params.description.trim() : null,
        location: params.location ? params.location.trim() : null,
        contractType: params.contractType ? params.contractType.trim() : null,
        experienceMin: Number(params.experienceMin),
        experienceMax: params.experienceMax !== undefined ? Number(params.experienceMax) : null,
        expectedCompletionDate: params.expectedCompletionDate ? new Date(params.expectedCompletionDate) : null,
        status: "OPEN",
      },
    });

    return newOpening;
  }

  /**
   * Get opening details & non-deleted profiles for Hiring Manager
   */
  async getProfilesForOpening(params: {
    tenantId: string;
    hiringManagerId: string;
    openingId: string;
  }) {
    const opening = await prisma.opening.findFirst({
      where: {
        id: params.openingId,
        tenantId: params.tenantId,
        hiringManagerId: params.hiringManagerId,
      },
      include: {
        hiringProfiles: {
          where: { isDeleted: false },
          orderBy: { submittedAt: "desc" },
        },
      },
    });

    if (!opening) {
      throw { status: 404, message: "Opening not found or unauthorized" };
    }

    const formattedProfiles = opening.hiringProfiles.map((p) => {
      const parts = p.s3Key.split("/");
      const lastPart = parts[parts.length - 1] || p.s3Key;
      const fileName = lastPart.includes("_") ? lastPart.substring(lastPart.indexOf("_") + 1) : lastPart;

      let decisionCategory: "RECOMMENDED" | "BORDERLINE" | "NOT_RECOMMENDED" | "PENDING" = "PENDING";
      if (p.recommendationScore !== null && p.recommendationScore !== undefined) {
        if (p.recommendationScore >= 0.75) {
          decisionCategory = "RECOMMENDED";
        } else if (p.recommendationScore >= 0.50) {
          decisionCategory = "BORDERLINE";
        } else {
          decisionCategory = "NOT_RECOMMENDED";
        }
      }

      return {
        id: p.id,
        openingId: p.openingId,
        s3Key: p.s3Key,
        fileName,
        uploadedBy: p.uploadedBy,
        submittedAt: p.submittedAt,
        status: p.status,
        shortlistedBy: p.shortlistedBy,
        shortlistedAt: p.shortlistedAt,
        rejectedBy: p.rejectedBy,
        rejectedAt: p.rejectedAt,

        // Optional AI fields (may be null!)
        recommended: p.recommended,
        recommendationScore: p.recommendationScore,
        decisionCategory,
        recommendationReason: p.recommendationReason,
        recommendationLatencyMs: p.recommendationLatencyMs,
        recommendationVersion: p.recommendationVersion,
        recommendationConfidence: p.recommendationConfidence,
        recommendedAt: p.recommendedAt,
      };
    });

    return {
      opening: {
        id: opening.id,
        title: opening.title,
        description: opening.description,
        location: opening.location,
        contractType: opening.contractType,
        experienceMin: opening.experienceMin,
        experienceMax: opening.experienceMax,
        status: opening.status,
        postedDate: opening.postedDate,
        expectedCompletionDate: opening.expectedCompletionDate,
        actionDate: opening.actionDate,
      },
      profiles: formattedProfiles,
    };
  }

  /**
   * Shortlist profile
   */
  async shortlistProfile(params: {
    tenantId: string;
    hiringManagerId: string;
    profileId: number;
  }) {
    const profile = await prisma.hiringProfile.findUnique({
      where: { id: params.profileId },
      include: { opening: true },
    });

    if (
      !profile ||
      profile.isDeleted ||
      profile.opening.tenantId !== params.tenantId ||
      profile.opening.hiringManagerId !== params.hiringManagerId
    ) {
      throw { status: 404, message: "Profile not found or unauthorized" };
    }

    const updatedProfile = await prisma.hiringProfile.update({
      where: { id: params.profileId },
      data: {
        status: ProfileStatus.SHORTLISTED,
        shortlistedBy: params.hiringManagerId,
        shortlistedAt: new Date(),
        rejectedBy: null,
        rejectedAt: null,
      },
    });

    return {
      message: "Profile shortlisted successfully",
      profile: updatedProfile,
    };
  }

  /**
   * Reject profile
   */
  async rejectProfile(params: {
    tenantId: string;
    hiringManagerId: string;
    profileId: number;
  }) {
    const profile = await prisma.hiringProfile.findUnique({
      where: { id: params.profileId },
      include: { opening: true },
    });

    if (
      !profile ||
      profile.isDeleted ||
      profile.opening.tenantId !== params.tenantId ||
      profile.opening.hiringManagerId !== params.hiringManagerId
    ) {
      throw { status: 404, message: "Profile not found or unauthorized" };
    }

    const updatedProfile = await prisma.hiringProfile.update({
      where: { id: params.profileId },
      data: {
        status: ProfileStatus.REJECTED,
        rejectedBy: params.hiringManagerId,
        rejectedAt: new Date(),
        shortlistedBy: null,
        shortlistedAt: null,
      },
    });

    return {
      message: "Profile rejected successfully",
      profile: updatedProfile,
    };
  }

  /**
   * Update Opening Status (OPEN, ON_HOLD, CLOSED)
   */
  async updateOpeningStatus(params: {
    tenantId: string;
    hiringManagerId: string;
    openingId: string;
    status: OpeningStatus;
  }) {
    if (!Object.values(OpeningStatus).includes(params.status)) {
      throw { status: 400, message: `Invalid status: ${params.status}` };
    }

    const opening = await prisma.opening.findFirst({
      where: {
        id: params.openingId,
        tenantId: params.tenantId,
        hiringManagerId: params.hiringManagerId,
      },
    });

    if (!opening) {
      throw { status: 404, message: "Opening not found or unauthorized" };
    }

    const updated = await prisma.opening.update({
      where: { id: params.openingId },
      data: {
        status: params.status,
        actionDate: new Date(),
      },
    });

    return {
      message: `Opening status updated to ${params.status}`,
      opening: updated,
    };
  }

  /**
   * Presign GET S3 URL for PDF preview after authorization
   */
  async presignPreviewUrl(params: {
    tenantId: string;
    hiringManagerId: string;
    profileId: number;
  }) {
    const profile = await prisma.hiringProfile.findUnique({
      where: { id: params.profileId },
      include: { opening: true },
    });

    if (
      !profile ||
      profile.isDeleted ||
      profile.opening.tenantId !== params.tenantId ||
      profile.opening.hiringManagerId !== params.hiringManagerId
    ) {
      throw { status: 404, message: "Profile not found or unauthorized" };
    }

    const previewUrl = await storageService.getObjectURL(profile.s3Key);
    return { previewUrl };
  }
}
