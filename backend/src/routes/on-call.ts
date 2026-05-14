import { Hono } from "hono";
import { prisma } from "../prisma";
import { auth } from "../auth";

const onCallRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// GET /api/on-call — list all on-call entries
onCallRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const entries = await prisma.onCallEntry.findMany({
    orderBy: { date: "asc" },
  });
  return c.json({ data: entries });
});

// POST /api/on-call — create or update an entry for a date
onCallRouter.post("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.isManager) {
    return c.json({ error: { message: "Forbidden: managers only" } }, 403);
  }
  const body = await c.req.json();
  const { techName, date, notes } = body as { techName: string; date: string; notes?: string };
  // Upsert by date
  const existing = await prisma.onCallEntry.findFirst({ where: { date } });
  let entry;
  if (existing) {
    entry = await prisma.onCallEntry.update({
      where: { id: existing.id },
      data: { techName, notes: notes ?? "" },
    });
  } else {
    entry = await prisma.onCallEntry.create({
      data: { techName, date, notes: notes ?? "" },
    });
  }
  return c.json({ data: entry }, 201);
});

// DELETE /api/on-call/:id — delete an entry
onCallRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.isManager) {
    return c.json({ error: { message: "Forbidden: managers only" } }, 403);
  }
  const id = c.req.param("id");
  await prisma.onCallEntry.delete({ where: { id } });
  return c.body(null, 204);
});

// GET /api/on-call/coverage-requests
onCallRouter.get("/coverage-requests", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  const isManager = dbUser?.isManager ?? false;

  const requests = await prisma.onCallCoverageRequest.findMany({
    where: isManager ? undefined : { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
  });

  return c.json({ data: requests });
});

// POST /api/on-call/coverage-requests
onCallRouter.post("/coverage-requests", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const body = await c.req.json().catch(() => ({}));
  const dates = Array.isArray(body.dates) ? body.dates as string[] : [];
  const reason = typeof body.reason === "string" ? body.reason : "";
  if (dates.length === 0) {
    return c.json({ error: { message: "At least one date is required" } }, 400);
  }
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  const request = await prisma.onCallCoverageRequest.create({
    data: {
      userId: user.id,
      requesterName: dbUser?.name ?? user.name ?? "",
      dates: JSON.stringify(dates),
      reason,
      status: "pending",
      managerNote: "",
    },
  });
  return c.json({ data: request }, 201);
});

// PUT /api/on-call/coverage-requests/:id
onCallRouter.put("/coverage-requests/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.isManager) {
    return c.json({ error: { message: "Forbidden: managers only" } }, 403);
  }
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const status = body.status as string;
  if (status !== "approved" && status !== "denied") {
    return c.json({ error: { message: "status must be approved or denied" } }, 400);
  }
  const existing = await prisma.onCallCoverageRequest.findUnique({ where: { id } });
  if (!existing) return c.json({ error: { message: "Not found" } }, 404);
  const updated = await prisma.onCallCoverageRequest.update({
    where: { id },
    data: { status, managerNote: body.managerNote ?? "" },
  });
  return c.json({ data: updated });
});

// DELETE /api/on-call/coverage-requests/:id
onCallRouter.delete("/coverage-requests/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const id = c.req.param("id");
  const existing = await prisma.onCallCoverageRequest.findUnique({ where: { id } });
  if (!existing) return c.json({ error: { message: "Not found" } }, 404);
  if (existing.userId !== user.id) {
    return c.json({ error: { message: "Forbidden" } }, 403);
  }
  if (existing.status !== "pending") {
    return c.json({ error: { message: "Can only cancel pending requests" } }, 400);
  }
  await prisma.onCallCoverageRequest.delete({ where: { id } });
  return c.body(null, 204);
});

export { onCallRouter };
