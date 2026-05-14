import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../prisma";
import { auth } from "../auth";

const workEntriesRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

const entryBodySchema = z.object({
  facilityName: z.string().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "startTime must be HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "endTime must be HH:MM"),
  travelMinutes: z.number().int().min(0).default(0),
  notes: z.string().default(""),
});

/** Parse "HH:MM" into total minutes since midnight. */
function timeToMinutes(hhmm: string): number {
  const parts = hhmm.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  return h * 60 + m;
}

/** Compute the Monday-based week boundaries (Mon–Sun) for a given YYYY-MM-DD string. */
function weekBoundaries(refDate: Date): { start: Date; end: Date } {
  const day = refDate.getDay(); // 0=Sun, 1=Mon … 6=Sat
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() + diffToMon);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

/** Format a Date as YYYY-MM-DD in local time. */
function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function buildPeriodRange(
  period: "day" | "week" | "month" | "year",
  referenceDate: string
): { startDate: string; endDate: string; periodLabel: string } {
  const ref = new Date(referenceDate + "T00:00:00");
  const year = ref.getFullYear();
  const month = ref.getMonth(); // 0-based
  const dayOfMonth = ref.getDate();

  switch (period) {
    case "day": {
      const label = `${MONTH_NAMES[month]} ${dayOfMonth}, ${year}`;
      return { startDate: referenceDate, endDate: referenceDate, periodLabel: label };
    }
    case "week": {
      const { start, end } = weekBoundaries(ref);
      const startStr = toDateString(start);
      const endStr = toDateString(end);
      const sMonth = MONTH_NAMES[start.getMonth()];
      const eMonth = MONTH_NAMES[end.getMonth()];
      const sYear = start.getFullYear();
      const eYear = end.getFullYear();
      let label: string;
      if (sYear !== eYear) {
        label = `${sMonth} ${start.getDate()}, ${sYear} – ${eMonth} ${end.getDate()}, ${eYear}`;
      } else if (sMonth !== eMonth) {
        label = `${sMonth} ${start.getDate()} – ${eMonth} ${end.getDate()}, ${sYear}`;
      } else {
        label = `${sMonth} ${start.getDate()} – ${eMonth} ${end.getDate()}, ${sYear}`;
      }
      return { startDate: startStr, endDate: endStr, periodLabel: label };
    }
    case "month": {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const label = `${MONTH_NAMES[month]} ${year}`;
      return { startDate: toDateString(firstDay), endDate: toDateString(lastDay), periodLabel: label };
    }
    case "year": {
      const firstDay = new Date(year, 0, 1);
      const lastDay = new Date(year, 11, 31);
      return { startDate: toDateString(firstDay), endDate: toDateString(lastDay), periodLabel: String(year) };
    }
  }
}

const OWNER_EMAIL = "west_nds@yahoo.com";

// GET /api/work-entries/staff-overview — owner only, must be registered before /summary and /:id
workEntriesRouter.get("/staff-overview", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  if (user.email !== OWNER_EMAIL) {
    return c.json({ error: { message: "Forbidden" } }, 403);
  }

  const period = (c.req.query("period") ?? "week") as "day" | "week" | "month" | "year";
  const referenceDate = c.req.query("referenceDate") ?? toDateString(new Date());

  if (!["day", "week", "month", "year"].includes(period)) {
    return c.json({ error: { message: "period must be day, week, month, or year" } }, 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
    return c.json({ error: { message: "referenceDate must be YYYY-MM-DD" } }, 400);
  }

  const { startDate, endDate, periodLabel } = buildPeriodRange(period, referenceDate);

  const allEntries = await prisma.workEntry.findMany({
    where: { date: { gte: startDate, lte: endDate } },
    include: { user: { select: { name: true } } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  // Group by userId
  const grouped = new Map<
    string,
    {
      userId: string;
      userName: string;
      totalWorkedMinutes: number;
      totalTravelMinutes: number;
      entries: Omit<(typeof allEntries)[number], "user">[];
    }
  >();

  for (const entry of allEntries) {
    const { user: entryUser, ...entryWithoutUser } = entry;
    const userName = entryUser?.name ?? "Unknown";

    if (!grouped.has(entry.userId)) {
      grouped.set(entry.userId, {
        userId: entry.userId,
        userName,
        totalWorkedMinutes: 0,
        totalTravelMinutes: 0,
        entries: [],
      });
    }

    const group = grouped.get(entry.userId)!;
    const worked = timeToMinutes(entry.endTime) - timeToMinutes(entry.startTime);
    group.totalWorkedMinutes += worked > 0 ? worked : 0;
    group.totalTravelMinutes += entry.travelMinutes;
    group.entries.push(entryWithoutUser);
  }

  const staff = Array.from(grouped.values()).sort((a, b) =>
    a.userName.localeCompare(b.userName)
  );

  // Add entryCount derived from entries length
  const staffWithCount = staff.map((s) => ({
    ...s,
    entryCount: s.entries.length,
  }));

  return c.json({ data: { periodLabel, staff: staffWithCount } });
});

// GET /api/work-entries/summary — must be registered before /:id
workEntriesRouter.get("/summary", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const period = (c.req.query("period") ?? "week") as "day" | "week" | "month" | "year";
  const referenceDate = c.req.query("referenceDate") ?? toDateString(new Date());

  if (!["day", "week", "month", "year"].includes(period)) {
    return c.json({ error: { message: "period must be day, week, month, or year" } }, 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
    return c.json({ error: { message: "referenceDate must be YYYY-MM-DD" } }, 400);
  }

  const { startDate, endDate, periodLabel } = buildPeriodRange(period, referenceDate);

  const entries = await prisma.workEntry.findMany({
    where: {
      userId: user.id,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  let totalWorkedMinutes = 0;
  let totalTravelMinutes = 0;

  for (const entry of entries) {
    const worked = timeToMinutes(entry.endTime) - timeToMinutes(entry.startTime);
    totalWorkedMinutes += worked > 0 ? worked : 0;
    totalTravelMinutes += entry.travelMinutes;
  }

  return c.json({
    data: {
      periodLabel,
      totalWorkedMinutes,
      totalTravelMinutes,
      entryCount: entries.length,
      entries,
    },
  });
});

// GET /api/work-entries/importable-billing-forms — submitted billing forms not yet imported
workEntriesRouter.get("/importable-billing-forms", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  // Find billing form IDs already imported by this user
  const imported = await prisma.workEntry.findMany({
    where: { userId: user.id, billingFormId: { not: null } },
    select: { billingFormId: true },
  });
  const importedIds = new Set(imported.map((e) => e.billingFormId));

  // Find submitted billing forms for this user
  const forms = await prisma.billingForm.findMany({
    where: { userId: user.id, status: "submitted" },
    select: {
      id: true, patientName: true, facility: true, date: true,
      startTime: true, endTime: true, totalHours: true, drivingTime: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Only return forms not yet imported that have the required time fields
  const importable = forms.filter(
    (f) =>
      !importedIds.has(f.id) &&
      f.startTime.trim() !== "" &&
      f.endTime.trim() !== "" &&
      f.date.trim() !== ""
  );

  return c.json({ data: importable });
});

// POST /api/work-entries/import-from-billing — import selected billing forms as work entries
workEntriesRouter.post("/import-from-billing", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const body = await c.req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.billingFormIds) ? body.billingFormIds : [];
  if (ids.length === 0) {
    return c.json({ error: { message: "billingFormIds must be a non-empty array" } }, 400);
  }

  // Helper: convert MM/DD/YYYY -> YYYY-MM-DD; returns null if invalid
  function convertDate(d: string): string | null {
    const m = d.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const [, month, day, year] = m as [string, string, string, string];
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Fetch the billing forms (verify ownership)
  const forms = await prisma.billingForm.findMany({
    where: { id: { in: ids }, userId: user.id, status: "submitted" },
  });

  // Check which are already imported
  const alreadyImported = await prisma.workEntry.findMany({
    where: { userId: user.id, billingFormId: { in: ids } },
    select: { billingFormId: true },
  });
  const alreadyImportedSet = new Set(alreadyImported.map((e) => e.billingFormId));

  let imported = 0;
  for (const form of forms) {
    if (alreadyImportedSet.has(form.id)) continue;
    const isoDate = convertDate(form.date);
    if (!isoDate || !form.startTime || !form.endTime) continue;

    // Ensure times are HH:MM (they should be from billing form)
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(form.startTime) || !timeRegex.test(form.endTime)) continue;

    const drivingMins = parseInt(form.drivingTime ?? "0", 10);
    const travelMinutes = isNaN(drivingMins) || drivingMins < 0 ? 0 : drivingMins;

    await prisma.workEntry.create({
      data: {
        userId: user.id,
        billingFormId: form.id,
        facilityName: form.facility || "",
        date: isoDate,
        startTime: form.startTime,
        endTime: form.endTime,
        travelMinutes,
        notes: form.patientName ? `Patient: ${form.patientName}` : "",
      },
    });
    imported++;
  }

  return c.json({ data: { imported } });
});

// GET /api/work-entries — list current user's entries with optional date range filter
workEntriesRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);

  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");

  const entries = await prisma.workEntry.findMany({
    where: {
      userId: user.id,
      ...(startDate || endDate
        ? {
            date: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
  });

  return c.json({ data: entries });
});

// POST /api/work-entries — create an entry
workEntriesRouter.post("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.isManager) return c.json({ error: { message: "Managers only" } }, 403);

  const parsed = entryBodySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { message: parsed.error.issues[0]?.message ?? "Invalid body" } }, 400);
  }
  const body = parsed.data;

  const entry = await prisma.workEntry.create({
    data: {
      userId: user.id,
      facilityName: body.facilityName,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      travelMinutes: body.travelMinutes,
      notes: body.notes,
    },
  });

  return c.json({ data: entry }, 201);
});

// PUT /api/work-entries/:id — update own entry
workEntriesRouter.put("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.isManager) return c.json({ error: { message: "Managers only" } }, 403);

  const id = c.req.param("id");

  const parsed = entryBodySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { message: parsed.error.issues[0]?.message ?? "Invalid body" } }, 400);
  }
  const body = parsed.data;

  const existing = await prisma.workEntry.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return c.json({ error: { message: "Not found" } }, 404);
  }

  const entry = await prisma.workEntry.update({
    where: { id },
    data: {
      facilityName: body.facilityName,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      travelMinutes: body.travelMinutes,
      notes: body.notes,
    },
  });

  return c.json({ data: entry });
});

// DELETE /api/work-entries/:id — delete own entry
workEntriesRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized" } }, 401);
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.isManager) return c.json({ error: { message: "Managers only" } }, 403);

  const id = c.req.param("id");
  const existing = await prisma.workEntry.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return c.json({ error: { message: "Not found" } }, 404);
  }

  await prisma.workEntry.delete({ where: { id } });
  return c.body(null, 204);
});

export { workEntriesRouter };
