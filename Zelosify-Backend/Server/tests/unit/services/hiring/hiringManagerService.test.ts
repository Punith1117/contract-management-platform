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
    getObjectURL: vi.fn(),
  })),
}));

import { HiringManagerService } from "../../../../src/services/hiring/hiringManagerService.js";

describe("HiringManagerService - access isolation", () => {
  const service = new HiringManagerService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not allow a hiring manager to access another manager's opening", async () => {
    findFirstMock.mockResolvedValue(null);

    await expect(
      service.getProfilesForOpening({
        tenantId: "tenant-A",
        hiringManagerId: "hm-A",
        openingId: "opening-owned-by-hm-B",
      }),
    ).rejects.toMatchObject({
      status: 404,
    });

    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "opening-owned-by-hm-B",
          tenantId: "tenant-A",
          hiringManagerId: "hm-A",
        },
      }),
    );
  });
});
