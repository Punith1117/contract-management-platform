import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findFirstMock,
  transactionMock,
  presignMock,
  findUniqueProfileMock,
  updateProfileMock,
  findManyOpeningMock,
  countOpeningMock,
} = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  transactionMock: vi.fn(),
  presignMock: vi.fn(),
  findUniqueProfileMock: vi.fn(),
  updateProfileMock: vi.fn(),
  findManyOpeningMock: vi.fn(),
  countOpeningMock: vi.fn(),
}));

vi.mock("../../../../src/config/prisma/prisma.js", () => ({
  default: {
    opening: {
      findFirst: findFirstMock,
      findMany: findManyOpeningMock,
      count: countOpeningMock,
    },
    hiringProfile: {
      findUnique: findUniqueProfileMock,
      update: updateProfileMock,
    },
    $transaction: transactionMock,
  },
}));

vi.mock("../../../../src/services/storage/storageFactory.js", () => ({
  createStorageService: vi.fn(() => ({
    getUploadURL: presignMock,
    getObjectURL: vi.fn(() => Promise.resolve("https://preview.example.com")),
  })),
}));

vi.mock("../../../../src/queues/resumeQueue.js", () => ({
  enqueueResumeProcessingJob: vi.fn(() => Promise.resolve().catch(() => {})),
}));

import { VendorOpeningService } from "../../../../src/services/vendor/vendorOpeningService.js";

describe("VendorOpeningService - tenant isolation", () => {
  const service = new VendorOpeningService();

  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockResolvedValue({
      id: 1,
      tenantId: "tenant-A",
      openingId: "opening-from-tenant-B",
      s3Key: "tenant-A/opening-from-tenant-B/resume.pdf",
      uploadedBy: "vendor-a@example.com",
      status: "SUBMITTED",
      isDeleted: false,
      submittedAt: new Date(),
    });
    presignMock.mockResolvedValue("https://presigned-url.example.com");
  });

  it("does not return an opening belonging to another tenant", async () => {
    findFirstMock.mockResolvedValue(null);

    const result = await service.getOpeningById(
      "tenant-A",
      "opening-from-tenant-B",
    );

    expect(result).toBeNull();

    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "opening-from-tenant-B",
          tenantId: "tenant-A",
        },
      }),
    );
  });

  it("does not allow profile submission to an opening belonging to another tenant", async () => {
    findFirstMock.mockResolvedValue(null);

    await expect(
      service.submitProfile({
        tenantId: "tenant-A",
        openingId: "opening-from-tenant-B",
        s3Key:
          "tenant-A/opening-from-tenant-B/resume.pdf",
        uploadedBy: "vendor-a@example.com",
      }),
    ).rejects.toMatchObject({
      status: 404,
    });

    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        id: "opening-from-tenant-B",
        tenantId: "tenant-A",
      },
    });
  });

  it("accepts PPTX resumes with correct MIME type", async () => {
    findFirstMock.mockResolvedValue({
      id: "opening-from-tenant-B",
      tenantId: "tenant-A",
      status: "OPEN",
    });

    await expect(
      service.submitProfile({
        tenantId: "tenant-A",
        openingId: "opening-from-tenant-B",
        s3Key: "tenant-A/opening-from-tenant-B/resume.pptx",
        uploadedBy: "vendor-a@example.com",
      }),
    ).resolves.toBeDefined();

    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        id: "opening-from-tenant-B",
        tenantId: "tenant-A",
      },
    });
  });

  it("accepts PPTX resumes with .pptx extension", async () => {
    findFirstMock.mockResolvedValue({
      id: "opening-from-tenant-B",
      tenantId: "tenant-A",
      status: "OPEN",
    });

    await expect(
      service.submitProfile({
        tenantId: "tenant-A",
        openingId: "opening-from-tenant-B",
        s3Key: "tenant-A/opening-from-tenant-B/resume.pptx",
        uploadedBy: "vendor-a@example.com",
      }),
    ).resolves.toBeDefined();

    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        id: "opening-from-tenant-B",
        tenantId: "tenant-A",
      },
    });
  });

  it("rejects unsupported file types in presignProfileUpload", async () => {
    findFirstMock.mockResolvedValue({
      id: "opening-from-tenant-B",
      tenantId: "tenant-A",
      status: "OPEN",
    });

    await expect(
      service.presignProfileUpload({
        tenantId: "tenant-A",
        openingId: "opening-from-tenant-B",
        fileName: "resume.doc",
        contentType: "application/msword",
        fileSize: 1024,
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Only PDF and PPTX resumes are accepted",
    });

    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        id: "opening-from-tenant-B",
        tenantId: "tenant-A",
      },
    });
  });

  it("filters profiles by uploadedBy when getting opening details", async () => {
    findFirstMock.mockResolvedValue({
      id: "opening-1",
      title: "Software Engineer",
      tenantId: "tenant-A",
      hiringProfiles: [
        {
          id: 1,
          s3Key: "tenant-A/opening-1/candidate1.pdf",
          uploadedBy: "vendor-a@example.com",
          submittedAt: new Date(),
          status: "SUBMITTED",
        },
      ],
    });

    const result = await service.getOpeningById(
      "tenant-A",
      "opening-1",
      "vendor-a@example.com"
    );

    expect(result).toBeDefined();
    expect(result?.profilesCount).toBe(1);
    expect(result?.profiles[0].uploadedBy).toBe("vendor-a@example.com");

    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "opening-1",
          tenantId: "tenant-A",
        },
        include: expect.objectContaining({
          hiringProfiles: expect.objectContaining({
            where: {
              isDeleted: false,
              uploadedBy: "vendor-a@example.com",
            },
          }),
        }),
      })
    );
  });

  it("prevents vendor from deleting another vendor's upload", async () => {
    findUniqueProfileMock.mockResolvedValue({
      id: 10,
      uploadedBy: "vendor-b@example.com",
      isDeleted: false,
      opening: { tenantId: "tenant-A" },
    });

    await expect(
      service.softDeleteProfile("tenant-A", 10, "vendor-a@example.com")
    ).rejects.toMatchObject({
      status: 404,
      message: "Profile not found or tenant unauthorized",
    });

    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it("allows vendor to delete their own upload", async () => {
    findUniqueProfileMock.mockResolvedValue({
      id: 10,
      uploadedBy: "vendor-a@example.com",
      isDeleted: false,
      opening: { tenantId: "tenant-A" },
    });
    updateProfileMock.mockResolvedValue({ id: 10, isDeleted: true });

    const result = await service.softDeleteProfile(
      "tenant-A",
      10,
      "vendor-a@example.com"
    );

    expect(result).toEqual({ message: "Profile deleted successfully" });
    expect(updateProfileMock).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { isDeleted: true },
    });
  });

  it("prevents vendor from previewing another vendor's upload", async () => {
    findUniqueProfileMock.mockResolvedValue({
      id: 10,
      s3Key: "tenant-A/opening-1/vendor-b-resume.pdf",
      uploadedBy: "vendor-b@example.com",
      isDeleted: false,
      opening: { tenantId: "tenant-A" },
    });

    await expect(
      service.presignPreviewUrl("tenant-A", 10, "vendor-a@example.com")
    ).rejects.toMatchObject({
      status: 404,
      message: "Profile not found or unauthorized",
    });
  });

  it("scopes opening profile count to uploadedBy in getOpenings", async () => {
    findManyOpeningMock.mockResolvedValue([
      {
        id: "opening-1",
        title: "Frontend Developer",
        description: "React",
        location: "Remote",
        contractType: "Full-time",
        experienceMin: 2,
        experienceMax: 4,
        status: "OPEN",
        postedDate: new Date(),
        hiringManager: null,
        _count: { hiringProfiles: 2 },
      },
    ]);
    countOpeningMock.mockResolvedValue(1);

    const result = await service.getOpenings({
      tenantId: "tenant-A",
      uploadedBy: "vendor-a@example.com",
    });

    expect(result.data[0].profilesCount).toBe(2);
    expect(findManyOpeningMock).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          _count: {
            select: {
              hiringProfiles: {
                where: {
                  isDeleted: false,
                  uploadedBy: "vendor-a@example.com",
                },
              },
            },
          },
        }),
      })
    );
  });
});