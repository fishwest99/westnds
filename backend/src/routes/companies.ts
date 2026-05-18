import { Hono } from "hono";
import { prisma } from "../prisma";
import { auth } from "../auth";

const companiesRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// GET /api/companies — list all companies
companiesRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });
  return c.json({ data: companies });
});

// PUT /api/companies/:id — update company info (managers only)
companiesRouter.put("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.isManager) return c.json({ error: { message: "Managers only" } }, 403);
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: { name?: string; address?: string; phone?: string; fax?: string; ein?: string } = {};
  if (typeof body.name === "string") data.name = body.name;
  if (typeof body.address === "string") data.address = body.address;
  if (typeof body.phone === "string") data.phone = body.phone;
  if (typeof body.fax === "string") data.fax = body.fax;
  if (typeof body.ein === "string") data.ein = body.ein;
  const company = await prisma.company.update({ where: { id }, data });
  return c.json({ data: company });
});

export { companiesRouter };
