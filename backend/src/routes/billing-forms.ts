import { Hono } from "hono";
import { prisma } from "../prisma";
import { auth } from "../auth";
import { generateBillingFormPdf } from "../lib/generate-billing-pdf";
import { loadCompanyForCase } from "../lib/load-form-company";

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

  // Auto-import as work entry if not already imported and time fields are present
  const alreadyImported = await prisma.workEntry.findFirst({
    where: { billingFormId: id },
  });

  if (
    !alreadyImported &&
    form.startTime.trim() !== "" &&
    form.endTime.trim() !== ""
  ) {
    // Convert MM/DD/YYYY -> YYYY-MM-DD; fall back to today if invalid
    function convertDate(d: string): string {
      const m = d.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!m) return null as unknown as string;
      const [, month, day, year] = m as [string, string, string, string];
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    function todayIso(): string {
      const now = new Date();
      const y = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      return `${y}-${mo}-${d}`;
    }

    const isoDate = convertDate(form.date) ?? todayIso();
    const drivingRaw = parseInt(form.drivingTime ?? "0", 10);
    const travelMinutes = isNaN(drivingRaw) || drivingRaw < 0 ? 0 : drivingRaw;
    const notes = `Auto-imported from billing form - ${form.patientName || ""}`.trim();

    await prisma.workEntry.create({
      data: {
        userId: form.userId,
        billingFormId: form.id,
        facilityName: form.facility || "",
        date: isoDate,
        startTime: form.startTime,
        endTime: form.endTime,
        travelMinutes,
        notes,
      },
    });
  }

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
    const company = await loadCompanyForCase(form.caseId);
    const pdfBuffer = await generateBillingFormPdf(form as unknown as Record<string, unknown>, company);
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
