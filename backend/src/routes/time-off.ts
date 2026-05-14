import { Hono } from "hono";
import { prisma } from "../prisma";
import { auth } from "../auth";

const timeOffRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// GET /api/time-off/my-profile — return isManager flag for current user
timeOffRouter.get("/my-profile", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  return c.json({ data: { isManager: dbUser?.isManager ?? false } });
});

// GET /api/time-off — list requests (managers see all, techs see their own)
timeOffRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  const requests = await prisma.timeOffRequest.findMany({
    where: dbUser?.isManager ? undefined : { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return c.json({ data: requests });
});

// POST /api/time-off — create a request
timeOffRouter.post("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const body = await c.req.json();
  const { startDate, endDate, reason } = body as { startDate: string; endDate: string; reason?: string };
  const request = await prisma.timeOffRequest.create({
    data: {
      userId: user.id,
      userName: user.name,
      startDate,
      endDate,
      reason: reason ?? "",
      status: "pending",
    },
  });
  return c.json({ data: request }, 201);
});

// DELETE /api/time-off/:id — delete own request (only pending)
timeOffRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const id = c.req.param("id");
  const existing = await prisma.timeOffRequest.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return c.json({ error: { message: "Not found" } }, 404);
  }
  await prisma.timeOffRequest.delete({ where: { id } });
  return c.body(null, 204);
});

// POST /api/time-off/:id/approve — manager approves
timeOffRouter.post("/:id/approve", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.isManager) {
    return c.json({ error: { message: "Forbidden: managers only" } }, 403);
  }
  const id = c.req.param("id");
  const request = await prisma.timeOffRequest.update({
    where: { id },
    data: { status: "approved", reviewedBy: user.name },
  });
  return c.json({ data: request });
});

// POST /api/time-off/:id/deny — manager denies
timeOffRouter.post("/:id/deny", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.isManager) {
    return c.json({ error: { message: "Forbidden: managers only" } }, 403);
  }
  const id = c.req.param("id");
  const request = await prisma.timeOffRequest.update({
    where: { id },
    data: { status: "denied", reviewedBy: user.name },
  });
  return c.json({ data: request });
});

// POST /api/time-off/toggle-manager — hidden admin: toggle own manager status
timeOffRouter.post("/toggle-manager", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isManager: !dbUser?.isManager },
  });
  return c.json({ data: { isManager: updated.isManager } });
});

export { timeOffRouter };
