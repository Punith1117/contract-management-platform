import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirstMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
}));

vi.mock("../../../../src/config/prisma/prisma.js", () => ({
  default: {
    opening: {
      findFirst: findFirstMock,
    },
  },
}));

vi.mock("../../../../src/services/storage/storageFactory.js", () => ({
  createStorageService: vi.fn(() => ({
    getUploadURL: vi.fn(),
    getObjectURL: vi.fn(),
  })),
}));

vi.mock("../../../../src/queues/resumeQueue.js", () => ({
  enqueueResumeProcessingJob: vi.fn(),
}));

import { VendorOpeningService } from "../../../../src/services/vendor/vendorOpeningService.js";

describe("VendorOpeningService - tenant isolation", () => {
  const service = new VendorOpeningService();

  beforeEach(() => {
    vi.clearAllMocks();
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
});
