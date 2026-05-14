import { Hono } from "hono";
import { prisma } from "../prisma";
import { auth } from "../auth";
import { generateBillingFormPdf } from "../lib/generate-billing-pdf";

const billingFormsRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// POST /api/billing-forms — create new billing form
billingFormsRouter.post("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const body = await c.req.json().catch(() => ({}));
  const form = await prisma.billingForm.create({
    data: { userId: user.id, ...body },
  });
  return c.json({ data: form }, 201);
});

// GET /api/billing-forms — list current user's billing forms
billingFormsRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const forms = await prisma.billingForm.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return c.json({ data: forms });
});

// GET /api/billing-forms/:id — get single form
billingFormsRouter.get("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const id = c.req.param("id");
  const form = await prisma.billingForm.findUnique({ where: { id } });
  if (!form || form.userId !== user.id) {
    return c.json({ error: { message: "Not found" } }, 404);
  }
  return c.json({ data: form });
});

// PUT /api/billing-forms/:id — update form fields
billingFormsRouter.put("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const id = c.req.param("id");
  const existing = await prisma.billingForm.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return c.json({ error: { message: "Not found" } }, 404);
  }
  const body = await c.req.json();
  const form = await prisma.billingForm.update({ where: { id }, data: body });
  return c.json({ data: form });
});

// POST /api/billing-forms/:id/submit — set status to "submitted"
billingFormsRouter.post("/:id/submit", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const id = c.req.param("id");
  const existing = await prisma.billingForm.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return c.json({ error: { message: "Not found" } }, 404);
  }
  const form = await prisma.billingForm.update({
    where: { id },
    data: { status: "submitted" },
  });
  return c.json({ data: form });
});

// GET /api/billing-forms/:id/pdf — generate PDF
billingFormsRouter.get("/:id/pdf", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const id = c.req.param("id");
  const form = await prisma.billingForm.findUnique({ where: { id } });
  if (!form || form.userId !== user.id) {
    return c.json({ error: { message: "Not found" } }, 404);
  }
  try {
    const pdfBuffer = await generateBillingFormPdf(form as unknown as Record<string, unknown>);
    const patientName = (form.patientName as string) || id;
    const filename = `billing-form-${patientName.replace(/\s+/g, "-")}.pdf`;
    return new Response(pdfBuffer.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (err) {
    console.error("Billing PDF generation error:", err);
    return c.json({ error: { message: "Failed to generate PDF" } }, 500);
  }
});

export { billingFormsRouter };
