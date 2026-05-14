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

export { onCallRouter };
