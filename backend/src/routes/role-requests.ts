import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../prisma";
import { auth } from "../auth";

const OWNER_EMAIL = "west_nds@yahoo.com";

const roleRequestSchema = z.object({
  requestedRole: z.enum(["technician", "manager"]),
});

const roleRequestsRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// POST /api/role-requests — submit a role request (any authenticated user)
roleRequestsRouter.post("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const body = await c.req.json();
  const parsed = roleRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { message: "Invalid request body" } }, 400);
  }

  const { requestedRole } = parsed.data;

  // Technicians are auto-approved (default role), no DB record needed
  if (requestedRole === "technician") {
    return c.json({ data: { status: "approved", requestedRole: "technician" } });
  }

  // Manager request: check for existing pending request
  const existing = await prisma.roleRequest.findFirst({
    where: { userId: user.id, status: "pending" },
  });

  if (existing) {
    return c.json({ data: existing });
  }

  const roleRequest = await prisma.roleRequest.create({
    data: {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      requestedRole: "manager",
      status: "pending",
    },
  });

  return c.json({ data: roleRequest }, 201);
});

// GET /api/role-requests — list pending manager role requests (owner only)
roleRequestsRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  if (user.email !== OWNER_EMAIL) {
    return c.json({ error: { message: "Forbidden: owner only" } }, 403);
  }

  const requests = await prisma.roleRequest.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
  });

  return c.json({ data: requests });
});

// POST /api/role-requests/:id/approve — approve a role request (owner only)
roleRequestsRouter.post("/:id/approve", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  if (user.email !== OWNER_EMAIL) {
    return c.json({ error: { message: "Forbidden: owner only" } }, 403);
  }

  const id = c.req.param("id");

  const found = await prisma.roleRequest.findUnique({ where: { id } });
  if (!found) {
    return c.json({ error: { message: "Role request not found" } }, 404);
  }

  const updatedRequest = await prisma.roleRequest.update({
    where: { id },
    data: { status: "approved", reviewedBy: user.name },
  });

  // Promote user to manager if the role was manager
  if (found.requestedRole === "manager") {
    await prisma.user.update({
      where: { id: found.userId },
      data: { isManager: true },
    });
  }

  return c.json({ data: updatedRequest });
});

// POST /api/role-requests/:id/deny — deny a role request (owner only)
roleRequestsRouter.post("/:id/deny", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  if (user.email !== OWNER_EMAIL) {
    return c.json({ error: { message: "Forbidden: owner only" } }, 403);
  }

  const id = c.req.param("id");

  const found = await prisma.roleRequest.findUnique({ where: { id } });
  if (!found) {
    return c.json({ error: { message: "Role request not found" } }, 404);
  }

  const updatedRequest = await prisma.roleRequest.update({
    where: { id },
    data: { status: "denied", reviewedBy: user.name },
  });

  return c.json({ data: updatedRequest });
});

export { roleRequestsRouter };
