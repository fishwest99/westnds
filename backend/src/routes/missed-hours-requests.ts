import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../prisma";
import { auth } from "../auth";

const missedHoursRequestsRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

const requestBodySchema = z.object({
  facilityName: z.string().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "startTime must be HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "endTime must be HH:MM"),
  travelMinutes: z.number().int().min(0).default(0),
  notes: z.string().optional().default(""),
  reason: z.string(),
});

// POST /api/missed-hours-requests — submit a missed hours request
missedHoursRequestsRouter.post("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const parsed = requestBodySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: { message: parsed.error.issues[0]?.message ?? "Invalid body" } }, 400);
  }
  const body = parsed.data;

  const request = await prisma.missedHoursRequest.create({
    data: {
      userId: user.id,
      facilityName: body.facilityName,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      travelMinutes: body.travelMinutes,
      notes: body.notes,
      reason: body.reason,
      status: "pending",
    },
  });

  return c.json({ data: request }, 201);
});

// GET /api/missed-hours-requests/my-requests — get current user's requests
missedHoursRequestsRouter.get("/my-requests", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const requests = await prisma.missedHoursRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ data: requests });
});

// GET /api/missed-hours-requests/pending — manager views all pending requests
missedHoursRequestsRouter.get("/pending", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.isManager) return c.json({ error: { message: "Managers only" } }, 403);

  const requests = await prisma.missedHoursRequest.findMany({
    where: { status: "pending" },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ data: requests });
});

// PUT /api/missed-hours-requests/:id/approve — manager approves a request
missedHoursRequestsRouter.put("/:id/approve", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.isManager) return c.json({ error: { message: "Managers only" } }, 403);

  const id = c.req.param("id");
  const request = await prisma.missedHoursRequest.findUnique({ where: { id } });
  if (!request) return c.json({ error: { message: "Not found" } }, 404);

  // Create a work entry from the request data
  await prisma.workEntry.create({
    data: {
      userId: request.userId,
      facilityName: request.facilityName,
      date: request.date,
      startTime: request.startTime,
      endTime: request.endTime,
      travelMinutes: request.travelMinutes,
      notes: request.notes,
    },
  });

  const updated = await prisma.missedHoursRequest.update({
    where: { id },
    data: { status: "approved", reviewedBy: user.id },
  });

  return c.json({ data: updated });
});

// PUT /api/missed-hours-requests/:id/deny — manager denies a request
missedHoursRequestsRouter.put("/:id/deny", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.isManager) return c.json({ error: { message: "Managers only" } }, 403);

  const id = c.req.param("id");
  const request = await prisma.missedHoursRequest.findUnique({ where: { id } });
  if (!request) return c.json({ error: { message: "Not found" } }, 404);

  const updated = await prisma.missedHoursRequest.update({
    where: { id },
    data: { status: "denied", reviewedBy: user.id },
  });

  return c.json({ data: updated });
});

export { missedHoursRequestsRouter };
