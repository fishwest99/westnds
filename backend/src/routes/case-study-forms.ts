import { Hono } from "hono";
import { prisma } from "../prisma";
import { auth } from "../auth";
import { generateCaseStudyFormPdf } from "../lib/generate-case-study-pdf";

const caseStudyFormsRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// POST /api/case-study-forms — create new case study form
caseStudyFormsRouter.post("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const body = await c.req.json().catch(() => ({}));
  const form = await prisma.caseStudyForm.create({
    data: { userId: user.id, ...body },
  });
  return c.json({ data: form }, 201);
});

// GET /api/case-study-forms — list current user's case study forms
caseStudyFormsRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const forms = await prisma.caseStudyForm.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return c.json({ data: forms });
});

// GET /api/case-study-forms/:id — get single form
caseStudyFormsRouter.get("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const id = c.req.param("id");
  const form = await prisma.caseStudyForm.findUnique({ where: { id } });
  if (!form || form.userId !== user.id) {
    return c.json({ error: { message: "Not found" } }, 404);
  }
  return c.json({ data: form });
});

// PUT /api/case-study-forms/:id — update form fields
caseStudyFormsRouter.put("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const id = c.req.param("id");
  const existing = await prisma.caseStudyForm.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return c.json({ error: { message: "Not found" } }, 404);
  }
  const body = await c.req.json();
  const form = await prisma.caseStudyForm.update({ where: { id }, data: body });
  return c.json({ data: form });
});

// POST /api/case-study-forms/:id/submit — set status to "submitted"
caseStudyFormsRouter.post("/:id/submit", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const id = c.req.param("id");
  const existing = await prisma.caseStudyForm.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return c.json({ error: { message: "Not found" } }, 404);
  }
  const form = await prisma.caseStudyForm.update({
    where: { id },
    data: { status: "submitted" },
  });
  return c.json({ data: form });
});

// GET /api/case-study-forms/:id/pdf — generate PDF
caseStudyFormsRouter.get("/:id/pdf", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const id = c.req.param("id");
  const form = await prisma.caseStudyForm.findUnique({ where: { id } });
  if (!form || form.userId !== user.id) {
    return c.json({ error: { message: "Not found" } }, 404);
  }
  try {
    const pdfBuffer = await generateCaseStudyFormPdf(form as unknown as Record<string, unknown>);
    const patientName = (form.patientName as string) || id;
    const filename = `case-study-${patientName.replace(/\s+/g, "-")}.pdf`;
    return new Response(pdfBuffer.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (err) {
    console.error("Case study PDF generation error:", err);
    return c.json({ error: { message: "Failed to generate PDF" } }, 500);
  }
});

export { caseStudyFormsRouter };
