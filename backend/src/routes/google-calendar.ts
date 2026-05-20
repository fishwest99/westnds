import { Hono } from "hono";

const googleCalendarRouter = new Hono();

// GET /api/google-calendar/ical?url=<encoded calendar.google.com iCal URL>
// Proxies the request server-side to avoid browser CORS restrictions.
googleCalendarRouter.get("/ical", async (c) => {
  const url = c.req.query("url");
  if (!url) {
    return c.json({ error: { message: "Missing url query param" } }, 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return c.json({ error: { message: "Invalid url" } }, 400);
  }

  // Whitelist: only allow Google Calendar iCal URLs to prevent SSRF.
  if (parsed.hostname !== "calendar.google.com") {
    return c.json({ error: { message: "Only calendar.google.com URLs are allowed" } }, 400);
  }

  try {
    const res = await fetch(parsed.toString(), {
      headers: { "User-Agent": "WestNDx-Calendar-Proxy/1.0" },
    });
    if (!res.ok) {
      return c.json({ error: { message: `Upstream returned ${res.status}` } }, 502);
    }
    const text = await res.text();
    return new Response(text, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "public, max-age=900", // cache 15 min
      },
    });
  } catch (err) {
    console.error("Google Calendar proxy error:", err);
    return c.json({ error: { message: "Failed to fetch calendar" } }, 502);
  }
});

export { googleCalendarRouter };
