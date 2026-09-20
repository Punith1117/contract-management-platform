import prisma from "../../config/prisma/prisma.js";
import { createStorageService } from "../storage/storageFactory.js";
import { OpeningStatus } from "@prisma/client";
import { enqueueResumeProcessingJob } from "../../queues/resumeQueue.js";

const storageService = createStorageService();

export class VendorOpeningService {
  /**
   * Get openings for vendor's tenant with DB-level pagination & search
   */
  async getOpenings(params: {
    tenantId: string;
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
          hiringManager: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
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

    const formattedOpenings = openings.map((opening) => ({
      id: opening.id,
      title: opening.title,
      description: opening.description,
      location: opening.location,
      contractType: opening.contractType,
      experienceMin: opening.experienceMin,
      experienceMax: opening.experienceMax,
      status: opening.status,
      postedDate: opening.postedDate,
      hiringManagerName: opening.hiringManager
        ? `${opening.hiringManager.firstName || ""} ${opening.hiringManager.lastName || ""}`.trim() || opening.hiringManager.email
        : "N/A",
      profilesCount: opening._count.hiringProfiles,
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
   * Get detailed opening with active (non-deleted) submitted profiles
   */
  async getOpeningById(tenantId: string, openingId: string) {
    const opening = await prisma.opening.findFirst({
      where: {
        id: openingId,
        tenantId,
      },
      include: {
        hiringManager: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        hiringProfiles: {
          where: { isDeleted: false },
          orderBy: { submittedAt: "desc" },
          select: {
            id: true,
            s3Key: true,
            uploadedBy: true,
            submittedAt: true,
            status: true,
            recommended: true,
            recommendationScore: true,
            recommendationReason: true,
          },
        },
      },
    });

    if (!opening) {
      return null;
    }

    return {
      id: opening.id,
      title: opening.title,
      description: opening.description,
      location: opening.location,
      contractType: opening.contractType,
      experienceMin: opening.experienceMin,
      experienceMax: opening.experienceMax,
      status: opening.status,
      postedDate: opening.postedDate,
      hiringManagerName: opening.hiringManager
        ? `${opening.hiringManager.firstName || ""} ${opening.hiringManager.lastName || ""}`.trim() || opening.hiringManager.email
        : "N/A",
      profilesCount: opening.hiringProfiles.length,
      profiles: opening.hiringProfiles.map((p) => {
        const parts = p.s3Key.split("/");
        const lastPart = parts[parts.length - 1] || p.s3Key;
        const fileName = lastPart.includes("_") ? lastPart.substring(lastPart.indexOf("_") + 1) : lastPart;
        return {
          id: p.id,
          s3Key: p.s3Key,
          fileName,
          uploadedBy: p.uploadedBy,
          submittedAt: p.submittedAt,
          status: p.status,
        };
      }),
    };
  }

  /**
   * Presign S3 URL for PDF upload
   */
  async presignProfileUpload(params: {
    tenantId: string;
    openingId: string;
    fileName: string;
    contentType: string;
    fileSize: number;
  }) {
    const opening = await prisma.opening.findFirst({
      where: {
        id: params.openingId,
        tenantId: params.tenantId,
      },
    });

    if (!opening) {
      throw { status: 404, message: "Opening not found or tenant unauthorized" };
    }

    if (opening.status !== "OPEN") {
      throw { status: 400, message: `Opening is currently ${opening.status} and not accepting submissions` };
    }

    if (
      params.contentType !== "application/pdf" &&
      !params.fileName.toLowerCase().endsWith(".pdf") &&
      params.contentType !==
        "application/vnd.openxmlformats-officedocument.presentationml.presentation" &&
      !params.fileName.toLowerCase().endsWith(".pptx")
    ) {
      throw { status: 400, message: "Only PDF and PPTX resumes are accepted" };
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    if (params.fileSize > MAX_FILE_SIZE) {
      throw { status: 400, message: "File size exceeds maximum limit of 10 MB" };
    }

    const cleanFileName = params.fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const timestamp = Date.now();
    const key = `${params.tenantId}/${params.openingId}/${timestamp}_${cleanFileName}`;

    const uploadUrl = await storageService.getUploadURL(key);

    return {
      uploadUrl,
      key,
      expiresIn: 3600,
    };
  }

  /**
   * Submit profile metadata after successful S3 upload (in Prisma Transaction)
   */
  async submitProfile(params: {
    tenantId: string;
    openingId: string;
    s3Key: string;
    uploadedBy: string;
  }) {
    const expectedPrefix = `${params.tenantId}/${params.openingId}/`;
    if (!params.s3Key.startsWith(expectedPrefix)) {
      throw { status: 400, message: "Invalid S3 key format or tenant namespace mismatch" };
    }

    const opening = await prisma.opening.findFirst({
      where: {
        id: params.openingId,
        tenantId: params.tenantId,
      },
    });

    if (!opening) {
      throw { status: 404, message: "Opening not found or tenant unauthorized" };
    }

    if (opening.status !== "OPEN") {
      throw { status: 400, message: "Opening is not accepting submissions" };
    }

    const newProfile = await prisma.$transaction(async (tx) => {
      const profile = await tx.hiringProfile.create({
        data: {
          openingId: params.openingId,
          s3Key: params.s3Key,
          uploadedBy: params.uploadedBy,
          status: "SUBMITTED",
          isDeleted: false,
        },
      });

      return profile;
    });

    // Enqueue BullMQ job asynchronously for AI processing
    enqueueResumeProcessingJob(newProfile.id).catch((err) =>
      console.error("[VendorOpeningService] Queue error:", err)
    );

    const parts = newProfile.s3Key.split("/");
    const lastPart = parts[parts.length - 1] || newProfile.s3Key;
    const fileName = lastPart.includes("_") ? lastPart.substring(lastPart.indexOf("_") + 1) : lastPart;

    return {
      id: newProfile.id,
      openingId: newProfile.openingId,
      s3Key: newProfile.s3Key,
      fileName,
      uploadedBy: newProfile.uploadedBy,
      submittedAt: newProfile.submittedAt,
      status: newProfile.status,
    };
  }

  /**
   * Soft delete profile
   */
  async softDeleteProfile(tenantId: string, profileId: number) {
    const profile = await prisma.hiringProfile.findUnique({
      where: { id: profileId },
      include: { opening: true },
    });

    if (!profile || profile.opening.tenantId !== tenantId) {
      throw { status: 404, message: "Profile not found or tenant unauthorized" };
    }

    if (profile.isDeleted) {
      return { message: "Profile is already deleted" };
    }

    await prisma.hiringProfile.update({
      where: { id: profileId },
      data: { isDeleted: true },
    });

    return { message: "Profile deleted successfully" };
  }

  /**
   * Presign GET URL for PDF preview
   */
  async presignPreviewUrl(tenantId: string, profileId: number) {
    const profile = await prisma.hiringProfile.findUnique({
      where: { id: profileId },
      include: { opening: true },
    });

    if (!profile || profile.opening.tenantId !== tenantId || profile.isDeleted) {
      throw { status: 404, message: "Profile not found or unauthorized" };
    }

    const previewUrl = await storageService.getObjectURL(profile.s3Key);
    return { previewUrl };
  }
}
