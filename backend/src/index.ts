import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { billingFormsRouter } from "./routes/billing-forms";
import { caseStudyFormsRouter } from "./routes/case-study-forms";
import { medicalLienFormsRouter } from "./routes/medical-lien-forms";
import { calendarEventsRouter } from "./routes/calendar-events";
import { consentFormRouter } from "./routes/consent-forms";
import { onCallRouter } from "./routes/on-call";
import { roleRequestsRouter } from "./routes/role-requests";
import { timeOffRouter } from "./routes/time-off";
import { workEntriesRouter } from "./routes/work-entries";
import { patientCasesRouter } from "./routes/patient-cases";

const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.dev\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecodeapp\.com$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.dev$/,
  /^https:\/\/vibecode\.dev$/,
];

app.use(
  "*",
  cors({
    origin: (origin) => (origin && allowed.some((re) => re.test(origin)) ? origin : null),
    credentials: true,
  })
);

app.use("*", logger());

app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    c.set("user", null);
    c.set("session", null);
    await next();
    return;
  }
  c.set("user", session.user);
  c.set("session", session.session);

  // Ensure owner always has manager privileges
  if (session?.user?.email === "west_nds@yahoo.com") {
    const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (dbUser && !dbUser.isManager) {
      await prisma.user.update({ where: { id: session.user.id }, data: { isManager: true } });
    }
  }

  await next();
});

app.get("/health", (c) => c.json({ status: "ok" }));
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));
app.route("/api/billing-forms", billingFormsRouter);
app.route("/api/case-study-forms", caseStudyFormsRouter);
app.route("/api/calendar-events", calendarEventsRouter);
app.route("/api/consent-forms", consentFormRouter);
app.route("/api/on-call", onCallRouter);
app.route("/api/role-requests", roleRequestsRouter);
app.route("/api/time-off", timeOffRouter);
app.route("/api/work-entries", workEntriesRouter);
app.route("/api/cases", patientCasesRouter);
app.route("/api/medical-lien-forms", medicalLienFormsRouter);

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};
