import { Hono } from "hono";
import { prisma } from "../prisma";
import { auth } from "../auth";
import { generateMedicalLienPdf } from "../lib/generate-medical-lien-pdf";

const medicalLienFormsRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// POST /api/medical-lien-forms — create new form
medicalLienFormsRouter.post("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const body = await c.req.json().catch(() => ({}));
  const form = await prisma.medicalLienForm.create({
    data: { userId: user.id, ...body },
  });
  return c.json({ data: form }, 201);
});

// GET /api/medical-lien-forms — list current user's forms
medicalLienFormsRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const forms = await prisma.medicalLienForm.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return c.json({ data: forms });
});

// GET /api/medical-lien-forms/:id — get single form
medicalLienFormsRouter.get("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const id = c.req.param("id");
  const form = await prisma.medicalLienForm.findUnique({ where: { id } });
  if (!form || form.userId !== user.id) {
    return c.json({ error: { message: "Not found" } }, 404);
  }
  return c.json({ data: form });
});

// PUT /api/medical-lien-forms/:id — update form fields
medicalLienFormsRouter.put("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const id = c.req.param("id");
  const existing = await prisma.medicalLienForm.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return c.json({ error: { message: "Not found" } }, 404);
  }
  const body = await c.req.json();
  const form = await prisma.medicalLienForm.update({ where: { id }, data: body });
  return c.json({ data: form });
});

// POST /api/medical-lien-forms/:id/submit — set status to "submitted"
medicalLienFormsRouter.post("/:id/submit", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const id = c.req.param("id");
  const existing = await prisma.medicalLienForm.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return c.json({ error: { message: "Not found" } }, 404);
  }
  const form = await prisma.medicalLienForm.update({
    where: { id },
    data: { status: "submitted" },
  });
  return c.json({ data: form });
});

// GET /api/medical-lien-forms/:id/pdf — generate PDF
medicalLienFormsRouter.get("/:id/pdf", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const id = c.req.param("id");
  const form = await prisma.medicalLienForm.findUnique({ where: { id } });
  if (!form || form.userId !== user.id) {
    return c.json({ error: { message: "Not found" } }, 404);
  }
  try {
    const pdfBuffer = await generateMedicalLienPdf(form as unknown as Record<string, unknown>);
    const patientName = (form.patientName as string) || id;
    const filename = `medical-lien-${patientName.replace(/\s+/g, "-")}.pdf`;
    return new Response(pdfBuffer.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (err) {
    console.error("Medical Lien PDF generation error:", err);
    return c.json({ error: { message: "Failed to generate PDF" } }, 500);
  }
});

export { medicalLienFormsRouter };
