import prisma from "../config/prisma/prisma.js";

/**
 * Seeds the database with tenant "Bruce Wayne Corp", hiring manager, vendor user,
 * and 12 realistic job openings.
 */
async function seedOpenings() {
  try {
    console.log("🌱 Starting Seeding Process...");

    // 1. Upsert Tenant: Bruce Wayne Corp
    let tenant = await prisma.tenants.findFirst({
      where: { companyName: "Bruce Wayne Corp" },
    });

    if (!tenant) {
      tenant = await prisma.tenants.create({
        data: {
          companyName: "Bruce Wayne Corp",
        },
      });
      console.log(`✅ Created Tenant: ${tenant.companyName} (${tenant.tenantId})`);
    } else {
      console.log(`ℹ️ Found Existing Tenant: ${tenant.companyName} (${tenant.tenantId})`);
    }

    // 2. Upsert Hiring Manager User
    let hiringManager = await prisma.user.findFirst({
      where: { email: "bwayne.hm@waynecorp.com" },
    });

    if (!hiringManager) {
      hiringManager = await prisma.user.create({
        data: {
          email: "bwayne.hm@waynecorp.com",
          username: "bruce.wayne",
          firstName: "Bruce",
          lastName: "Wayne",
          role: "HIRING_MANAGER",
          tenantId: tenant.tenantId,
          externalId: "hm-bwayne-001",
          department: "Engineering",
        },
      });
      console.log(`✅ Created Hiring Manager: ${hiringManager.firstName} ${hiringManager.lastName}`);
    } else {
      console.log(`ℹ️ Found Hiring Manager: ${hiringManager.firstName} ${hiringManager.lastName}`);
    }

    // 3. Upsert IT Vendor User
    let vendorUser = await prisma.user.findFirst({
      where: { email: "lucius.vendor@techpartners.com" },
    });

    if (!vendorUser) {
      vendorUser = await prisma.user.create({
        data: {
          email: "lucius.vendor@techpartners.com",
          username: "lucius.fox",
          firstName: "Lucius",
          lastName: "Fox",
          role: "IT_VENDOR",
          tenantId: tenant.tenantId,
          externalId: "vendor-lfox-001",
          department: "Vendor Management",
        },
      });
      console.log(`✅ Created IT Vendor User: ${vendorUser.firstName} ${vendorUser.lastName}`);
    } else {
      console.log(`ℹ️ Found IT Vendor User: ${vendorUser.firstName} ${vendorUser.lastName}`);
    }

    // 4. Seed Openings (12 openings)
    const seedOpeningsData = [
      {
        title: "Senior Full Stack Engineer (React & Node.js)",
        description: "Looking for an experienced Full Stack Engineer to lead building high-throughput contract APIs and modern React applications.",
        location: "Remote",
        contractType: "Full-Time Contract",
        experienceMin: 5,
        experienceMax: 8,
      },
      {
        title: "Cloud Infrastructure Architect (AWS/DevOps)",
        description: "Architect and manage AWS S3, ECS, Kubernetes clusters, and Terraform infrastructure for enterprise workloads.",
        location: "Gotham City / Onsite",
        contractType: "6 Months",
        experienceMin: 8,
        experienceMax: 12,
      },
      {
        title: "Python AI/ML Engineer (LLMs & Tool Calling)",
        description: "Build autonomous AI agents, tool orchestrators, vector search, and structured output parsing models.",
        location: "Remote",
        contractType: "12 Months",
        experienceMin: 3,
        experienceMax: 6,
      },
      {
        title: "Lead Cybersecurity Specialist",
        description: "Ensure SOC2 compliance, penetration testing, zero-trust architecture, and strict RBAC policy enforcement.",
        location: "Gotham City / Hybrid",
        contractType: "Full-Time Contract",
        experienceMin: 7,
        experienceMax: 10,
      },
      {
        title: "Frontend Engineer (Next.js & TypeScript)",
        description: "Develop responsive, high-performance web user interfaces using Next.js App Router, Redux Toolkit, and Tailwind CSS.",
        location: "Metropolis / Hybrid",
        contractType: "6 Months",
        experienceMin: 3,
        experienceMax: 5,
      },
      {
        title: "Backend Systems Engineer (Go & PostgreSQL)",
        description: "Design transactional data storage schemas, microservices, and high-concurrency event-driven processing queues.",
        location: "Remote",
        contractType: "12 Months",
        experienceMin: 4,
        experienceMax: 7,
      },
      {
        title: "Mobile Application Developer (React Native)",
        description: "Build cross-platform mobile apps for iOS and Android with secure offline storage and real-time push notifications.",
        location: "New York / Onsite",
        contractType: "3 Months",
        experienceMin: 2,
        experienceMax: 5,
      },
      {
        title: "Data Engineer (PySpark & Snowflake)",
        description: "Construct scalable ETL pipelines, data warehouses, and analytics data models for business operations.",
        location: "Remote",
        contractType: "6 Months",
        experienceMin: 4,
        experienceMax: 8,
      },
      {
        title: "DevOps & Kubernetes Engineer",
        description: "Automate CI/CD pipelines, container orchestration, Prometheus monitoring, and infrastructure cost optimization.",
        location: "Gotham City / Onsite",
        contractType: "12 Months",
        experienceMin: 5,
        experienceMax: 9,
      },
      {
        title: "QA Automation Lead (Cypress/Playwright)",
        description: "Develop end-to-end automated test suites for frontend user journeys and REST API endpoints.",
        location: "Remote",
        contractType: "6 Months",
        experienceMin: 5,
        experienceMax: 8,
      },
      {
        title: "Product Security Consultant",
        description: "Conduct threat modeling, code audits, container scanning, and secure API integration reviews.",
        location: "Hybrid",
        contractType: "3 Months",
        experienceMin: 6,
        experienceMax: 10,
      },
      {
        title: "UI/UX Product Designer",
        description: "Design modern design systems, wireframes, high-fidelity UI mockups, and conduct user feedback sessions.",
        location: "Remote",
        contractType: "6 Months",
        experienceMin: 3,
        experienceMax: 6,
      },
    ];

    // Clear existing openings for clean seed (optional)
    const countExisting = await prisma.opening.count({
      where: { tenantId: tenant.tenantId },
    });

    if (countExisting === 0) {
      for (const item of seedOpeningsData) {
        await prisma.opening.create({
          data: {
            ...item,
            tenantId: tenant.tenantId,
            hiringManagerId: hiringManager.id,
            status: "OPEN",
          },
        });
      }
      console.log(`✅ Successfully seeded ${seedOpeningsData.length} openings for tenant ${tenant.companyName}`);
    } else {
      console.log(`ℹ️ Tenant ${tenant.companyName} already has ${countExisting} openings.`);
    }

    console.log("🎉 Seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding openings:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedOpenings();
