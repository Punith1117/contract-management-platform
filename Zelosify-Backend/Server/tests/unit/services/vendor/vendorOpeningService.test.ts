import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirstMock, transactionMock, presignMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  transactionMock: vi.fn(),
  presignMock: vi.fn(),
}));

vi.mock("../../../../src/config/prisma/prisma.js", () => ({
  default: {
    opening: {
      findFirst: findFirstMock,
    },
    $transaction: transactionMock,
  },
}));

vi.mock("../../../../src/services/storage/storageFactory.js", () => ({
  createStorageService: vi.fn(() => ({
    getUploadURL: presignMock,
    getObjectURL: vi.fn(),
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
});