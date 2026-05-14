import { Hono } from "hono";
import { prisma } from "../prisma";
import { auth } from "../auth";

const calendarEventsRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// GET /api/calendar-events — list all events, optional ?month=YYYY-MM filter
calendarEventsRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const month = c.req.query("month"); // e.g. "2026-05"

  const events = await prisma.calendarEvent.findMany({
    where: month
      ? { date: { startsWith: month } }
      : undefined,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return c.json({ data: events });
});

// POST /api/calendar-events — create an event (any authenticated user)
calendarEventsRouter.post("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const body = await c.req.json() as {
    title: string;
    date: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    description?: string;
  };

  const { title, date, startTime, endTime, location, description } = body;

  if (!title || !date) {
    return c.json({ error: { message: "title and date are required" } }, 400);
  }

  const event = await prisma.calendarEvent.create({
    data: {
      userId: user.id,
      createdByName: user.name,
      title,
      date,
      startTime: startTime ?? "",
      endTime: endTime ?? "",
      location: location ?? "",
      description: description ?? "",
    },
  });

  return c.json({ data: event }, 201);
});

// DELETE /api/calendar-events/:id — managers only
calendarEventsRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.isManager) {
    return c.json({ error: { message: "Forbidden: managers only" } }, 403);
  }

  const id = c.req.param("id");
  const existing = await prisma.calendarEvent.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: { message: "Not found" } }, 404);
  }

  await prisma.calendarEvent.delete({ where: { id } });
  return c.body(null, 204);
});

export { calendarEventsRouter };
