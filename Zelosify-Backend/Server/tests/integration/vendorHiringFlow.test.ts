import {
  beforeAll,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import request from "supertest";

// -----------------------------------------------------------------------------
// Test users
// -----------------------------------------------------------------------------

const vendorUser = {
  id: "integration-vendor-user",
  username: "integration-vendor",
  email: "integration-vendor@test.com",
  role: "IT_VENDOR",
  department: "Engineering",
  provider: "KEYCLOAK",
  tenantId: "integration-tenant",
};

const vendorUserB = {
  id: "integration-vendor-user-b",
  username: "integration-vendor-b",
  email: "integration-vendor-b@test.com",
  role: "IT_VENDOR",
  department: "Engineering",
  provider: "KEYCLOAK",
  tenantId: "integration-tenant",
};

const hiringManagerUser = {
  id: "integration-hiring-manager",
  username: "integration-hiring-manager",
  email: "integration-hiring-manager@test.com",
  role: "HIRING_MANAGER",
  department: "Engineering",
  provider: "KEYCLOAK",
  tenantId: "integration-tenant",
};

// -----------------------------------------------------------------------------
// Mock authentication
// -----------------------------------------------------------------------------

vi.mock(
  "../../src/middlewares/auth/authenticateMiddleware.js",
  () => ({
    authenticateUser: vi.fn(
      (req: any, _res: any, next: any) => {
        const role = req.headers["x-test-role"];

        if (role === "IT_VENDOR") {
          req.user = vendorUser;
        }

        if (role === "IT_VENDOR_B") {
          req.user = vendorUserB;
        }

        if (role === "HIRING_MANAGER") {
          req.user = hiringManagerUser;
        }

        next();
      },
    ),
  }),
);

// -----------------------------------------------------------------------------
// Mock Keycloak
// -----------------------------------------------------------------------------

vi.mock("../../src/config/keycloak/keycloak.js", async () => {
  const session = await import("express-session");

  return {
    setupKeycloakConfig: vi.fn(async () => ({
      keycloak: {
        middleware: () => (
          _req: any,
          _res: any,
          next: any,
        ) => next(),
      },
      memoryStore: new session.MemoryStore(),
    })),
  };
});

// -----------------------------------------------------------------------------
// Mock AI boundary
// -----------------------------------------------------------------------------
//
// We do NOT mock Groq.
// We do NOT mock individual AI tools.
//
// AgentOrchestrator is already tested separately.
//
// The integration test only needs to know:
// "When the worker evaluates this profile, what does the AI system return?"
// -----------------------------------------------------------------------------

const { evaluateCandidateMock } = vi.hoisted(() => ({
  evaluateCandidateMock: vi.fn(),
}));

vi.mock(
  "../../src/services/ai/agent/AgentOrchestrator.js",
  () => ({
    AgentOrchestrator: vi.fn().mockImplementation(() => ({
      evaluateCandidate: evaluateCandidateMock,
    })),
  }),
);

// -----------------------------------------------------------------------------
// Imports after mocks
// -----------------------------------------------------------------------------

import prisma from "../../src/config/prisma/prisma.js";
import { setupApp } from "../../src/app.js";
import { resumeWorker } from "../../src/workers/resumeWorker.js";
import { resumeQueue } from "../../src/queues/resumeQueue.js";

// -----------------------------------------------------------------------------
// Integration test
// -----------------------------------------------------------------------------

describe(
  "Vendor → Resume Processing → AI Recommendation → Shortlist",
  () => {
    let app: Awaited<ReturnType<typeof setupApp>>;
    let openingId: string;
    let profileId: number;

    beforeAll(async () => {
      // Clean test queue
      await resumeQueue.obliterate({ force: true });

      app = await setupApp();

      await prisma.$connect();

      // -----------------------------------------------------------------------
      // Clean previous test data
      // -----------------------------------------------------------------------

      await prisma.hiringProfile.deleteMany({
        where: {
          opening: {
            tenantId: vendorUser.tenantId,
          },
        },
      });

      await prisma.opening.deleteMany({
        where: {
          tenantId: vendorUser.tenantId,
        },
      });

      await prisma.user.deleteMany({
        where: {
          id: {
            in: [
              vendorUser.id,
              vendorUserB.id,
              hiringManagerUser.id,
            ],
          },
        },
      });

      await prisma.tenants.deleteMany({
        where: {
          tenantId: vendorUser.tenantId,
        },
      });

      // -----------------------------------------------------------------------
      // Create tenant
      // -----------------------------------------------------------------------

      await prisma.tenants.create({
        data: {
          tenantId: vendorUser.tenantId,
          companyName: "Integration Test Tenant",
        },
      });

      // -----------------------------------------------------------------------
      // Create users
      // -----------------------------------------------------------------------

      await prisma.user.create({
        data: {
          id: vendorUser.id,
          username: vendorUser.username,
          email: vendorUser.email,
          role: "IT_VENDOR",
          department: vendorUser.department,
          provider: "KEYCLOAK",
          tenantId: vendorUser.tenantId,
        },
      });

      await prisma.user.create({
        data: {
          id: vendorUserB.id,
          username: vendorUserB.username,
          email: vendorUserB.email,
          role: "IT_VENDOR",
          department: vendorUserB.department,
          provider: "KEYCLOAK",
          tenantId: vendorUser.tenantId,
        },
      });

      await prisma.user.create({
        data: {
          id: hiringManagerUser.id,
          username: hiringManagerUser.username,
          email: hiringManagerUser.email,
          role: "HIRING_MANAGER",
          department: hiringManagerUser.department,
          provider: "KEYCLOAK",
          tenantId: vendorUser.tenantId,
        },
      });

      // -----------------------------------------------------------------------
      // Create opening
      // -----------------------------------------------------------------------

      const opening = await prisma.opening.create({
        data: {
          tenantId: vendorUser.tenantId,
          hiringManagerId: hiringManagerUser.id,
          title: "Senior Backend Engineer",
          description:
            "Node.js, PostgreSQL and TypeScript backend engineer.",
          location: "Bengaluru",
          contractType: "CONTRACT",
          experienceMin: 3,
          experienceMax: 6,
          status: "OPEN",
        },
      });

      openingId = opening.id;

      // -----------------------------------------------------------------------
      // Start worker
      // -----------------------------------------------------------------------

      await resumeWorker.waitUntilReady();
      await resumeQueue.waitUntilReady();
    });

    afterAll(async () => {
      await prisma.hiringProfile.deleteMany({
        where: {
          opening: {
            tenantId: vendorUser.tenantId,
          },
        },
      });

      await prisma.opening.deleteMany({
        where: {
          tenantId: vendorUser.tenantId,
        },
      });

      await prisma.user.deleteMany({
        where: {
          id: {
            in: [
              vendorUser.id,
              vendorUserB.id,
              hiringManagerUser.id,
            ],
          },
        },
      });

      await prisma.tenants.deleteMany({
        where: {
          tenantId: vendorUser.tenantId,
        },
      });

      await resumeWorker.close();
      await resumeQueue.close();
      await prisma.$disconnect();
    });

    it(
      "completes Upload → Submit → Recommend → Shortlist",
      async () => {
        // ---------------------------------------------------------------------
        // Mock AI result
        // ---------------------------------------------------------------------

        evaluateCandidateMock.mockResolvedValue({
          recommended: true,
          recommendationScore: 1,
          recommendationReason:
            "Strong skill match with experience within the required range.",
          recommendationVersion: "v1.1",
          recommendationConfidence: 0.95,
        });

        // ---------------------------------------------------------------------
        // 1. Vendor requests upload URL
        // ---------------------------------------------------------------------

        const presignResponse = await request(app)
          .post(
            `/api/v1/vendor/openings/${openingId}/profiles/presign`,
          )
          .set("x-test-role", "IT_VENDOR")
          .send({
            fileName: "candidate-resume.pdf",
            contentType: "application/pdf",
            fileSize: 1024,
          });

        expect(presignResponse.status).toBe(200);

        const s3Key = presignResponse.body.key;

        expect(s3Key).toContain(
          `${vendorUser.tenantId}/${openingId}/`,
        );

        // ---------------------------------------------------------------------
        // 2. Vendor submits profile
        // ---------------------------------------------------------------------

        const submitResponse = await request(app)
          .post(
            `/api/v1/vendor/openings/${openingId}/profiles/upload`,
          )
          .set("x-test-role", "IT_VENDOR")
          .send({ s3Key });

        expect(submitResponse.status).toBe(201);

        profileId = submitResponse.body.data.id;

        // AI fields should initially be empty
        const submittedProfile =
          await prisma.hiringProfile.findUnique({
            where: { id: profileId },
          });

        expect(submittedProfile?.status).toBe("SUBMITTED");
        expect(submittedProfile?.recommended).toBeNull();

        // ---------------------------------------------------------------------
        // Verify Vendor Upload Isolation (Vendors only see their own uploads)
        // ---------------------------------------------------------------------

        // Vendor A sees their own upload
        const vendorAGetResponse = await request(app)
          .get(`/api/v1/vendor/openings/${openingId}`)
          .set("x-test-role", "IT_VENDOR");
        expect(vendorAGetResponse.status).toBe(200);
        expect(vendorAGetResponse.body.data.profiles).toHaveLength(1);
        expect(vendorAGetResponse.body.data.profiles[0].id).toBe(profileId);

        // Vendor B in the same tenant cannot see Vendor A's upload
        const vendorBGetResponse = await request(app)
          .get(`/api/v1/vendor/openings/${openingId}`)
          .set("x-test-role", "IT_VENDOR_B");
        expect(vendorBGetResponse.status).toBe(200);
        expect(vendorBGetResponse.body.data.profiles).toHaveLength(0);

        // Vendor B count in openings list is 0
        const vendorBListResponse = await request(app)
          .get(`/api/v1/vendor/openings`)
          .set("x-test-role", "IT_VENDOR_B");
        expect(vendorBListResponse.status).toBe(200);
        expect(vendorBListResponse.body.data[0].profilesCount).toBe(0);

        // Vendor B cannot preview Vendor A's profile
        const vendorBPreviewResponse = await request(app)
          .get(`/api/v1/vendor/profiles/${profileId}/preview`)
          .set("x-test-role", "IT_VENDOR_B");
        expect(vendorBPreviewResponse.status).toBe(404);

        // Vendor B cannot delete Vendor A's profile
        const vendorBDeleteResponse = await request(app)
          .delete(`/api/v1/vendor/profiles/${profileId}`)
          .set("x-test-role", "IT_VENDOR_B");
        expect(vendorBDeleteResponse.status).toBe(404);

        // ---------------------------------------------------------------------
        // 3. Wait for BullMQ worker + AI result
        // ---------------------------------------------------------------------

        const timeout = Date.now() + 10_000;

        let profile;

        while (Date.now() < timeout) {
          profile =
            await prisma.hiringProfile.findUnique({
              where: { id: profileId },
            });

          if (
            profile?.recommended !== null &&
            profile?.recommended !== undefined
          ) {
            break;
          }

          await new Promise((resolve) =>
            setTimeout(resolve, 200),
          );
        }

        expect(profile?.recommended).toBe(true);
        expect(profile?.recommendationScore).toBe(1);
        expect(
          profile?.recommendationReason,
        ).toBeTruthy();
        expect(
          profile?.recommendationVersion,
        ).toBe("v1.1");
        expect(
          profile?.recommendationConfidence,
        ).toBe(0.95);

        // Confirm worker actually called AI boundary
        expect(
          evaluateCandidateMock,
        ).toHaveBeenCalledTimes(1);

        // ---------------------------------------------------------------------
        // 4. Hiring Manager sees recommendation
        // ---------------------------------------------------------------------

        const profilesResponse = await request(app)
          .get(
            `/api/v1/hiring-manager/openings/${openingId}/profiles`,
          )
          .set("x-test-role", "HIRING_MANAGER");

        expect(profilesResponse.status).toBe(200);

        const profiles =
          profilesResponse.body.data.profiles;

        expect(profiles).toHaveLength(1);
        expect(profiles[0].id).toBe(profileId);
        expect(profiles[0].recommended).toBe(true);
        expect(profiles[0].recommendationScore).toBe(1);

        // ---------------------------------------------------------------------
        // 5. Hiring Manager shortlists candidate
        // ---------------------------------------------------------------------

        const shortlistResponse = await request(app)
          .post(
            `/api/v1/hiring-manager/profiles/${profileId}/shortlist`,
          )
          .set("x-test-role", "HIRING_MANAGER")
          .send();

        expect(shortlistResponse.status).toBe(200);

        // ---------------------------------------------------------------------
        // 6. Verify final state
        // ---------------------------------------------------------------------

        const finalProfile =
          await prisma.hiringProfile.findUnique({
            where: { id: profileId },
          });

        expect(finalProfile?.status).toBe("SHORTLISTED");
        expect(
          finalProfile?.shortlistedBy,
        ).toBe(hiringManagerUser.id);
        expect(
          finalProfile?.shortlistedAt,
        ).not.toBeNull();

        // AI recommendation survived the human workflow
        expect(finalProfile?.recommended).toBe(true);
        expect(
          finalProfile?.recommendationScore,
        ).toBe(1);
      },
      15_000,
    );
  },
);
