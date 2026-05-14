import { Hono } from "hono";
import { prisma } from "../prisma";
import { auth } from "../auth";

const consentFormRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// GET /api/consent-forms — list user's forms
consentFormRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const forms = await prisma.consentForm.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return c.json({ data: forms });
});

// GET /api/consent-forms/latest — get the user's most recent draft or create one
consentFormRouter.get("/latest", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  let form = await prisma.consentForm.findFirst({
    where: { userId: user.id, status: "draft" },
    orderBy: { createdAt: "desc" },
  });
  if (!form) {
    form = await prisma.consentForm.create({
      data: { userId: user.id, status: "draft" },
    });
  }
  return c.json({ data: form });
});

// POST /api/consent-forms — create new form
consentFormRouter.post("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const body = await c.req.json();
  const form = await prisma.consentForm.create({
    data: { userId: user.id, ...body },
  });
  return c.json({ data: form }, 201);
});

// PUT /api/consent-forms/:id — update form
consentFormRouter.put("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const id = c.req.param("id");
  const existing = await prisma.consentForm.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return c.json({ error: { message: "Not found" } }, 404);
  }
  const body = await c.req.json();
  const form = await prisma.consentForm.update({ where: { id }, data: body });
  return c.json({ data: form });
});

// POST /api/consent-forms/:id/submit — submit form
consentFormRouter.post("/:id/submit", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const id = c.req.param("id");
  const existing = await prisma.consentForm.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return c.json({ error: { message: "Not found" } }, 404);
  }
  const form = await prisma.consentForm.update({
    where: { id },
    data: { status: "submitted", submittedAt: new Date() },
  });
  return c.json({ data: form });
});

export { consentFormRouter };
