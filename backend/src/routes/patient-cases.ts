import { Hono } from "hono";
import { prisma } from "../prisma";
import { auth } from "../auth";

const patientCasesRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// POST /api/cases — create new patient case
patientCasesRouter.post("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const body = await c.req.json().catch(() => ({}));
  const patientCase = await prisma.patientCase.create({
    data: { userId: user.id, patientName: body.patientName || "", date: body.date || "" },
  });
  return c.json({ data: patientCase }, 201);
});

// GET /api/cases — list current user's cases with nested form statuses
patientCasesRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const cases = await prisma.patientCase.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      billingForms: { select: { id: true, status: true } },
      consentForms: { select: { id: true, status: true } },
      caseStudyForms: { select: { id: true, status: true } },
      medicalLienForms: { select: { id: true, status: true } },
    },
  });
  return c.json({ data: cases });
});

// GET /api/cases/:id — get single case with nested form statuses
patientCasesRouter.get("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const id = c.req.param("id");
  const patientCase = await prisma.patientCase.findUnique({
    where: { id },
    include: {
      billingForms: { select: { id: true, status: true } },
      consentForms: { select: { id: true, status: true } },
      caseStudyForms: { select: { id: true, status: true } },
      medicalLienForms: { select: { id: true, status: true } },
    },
  });
  if (!patientCase || patientCase.userId !== user.id) {
    return c.json({ error: { message: "Not found" } }, 404);
  }
  return c.json({ data: patientCase });
});

// PUT /api/cases/:id — update case
patientCasesRouter.put("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const id = c.req.param("id");
  const existing = await prisma.patientCase.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return c.json({ error: { message: "Not found" } }, 404);
  }
  const body = await c.req.json();
  const patientCase = await prisma.patientCase.update({ where: { id }, data: body });
  return c.json({ data: patientCase });
});

export { patientCasesRouter };
