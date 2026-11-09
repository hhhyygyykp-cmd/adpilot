// Creates a local demonstration account the same way the iPhone app does:
// no browser Origin or Sec-Fetch headers, then a bearer token plus CSRF token.
// Refuses any host that is not this machine. Does not call paid generation.
import http from "node:http";

const base = process.env.ADPILOT_URL ?? "http://127.0.0.1:3000";
const url = new URL(base);
if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
  console.error("This script only talks to a local AdPilot server.");
  process.exit(1);
}

const email = "demo@adpilot.local";
const password = "DemoPass123";
const session = { token: "", csrf: "" };

function call(method, path, body) {
  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
  const headers = { Accept: "application/json" };
  if (payload) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = String(payload.length);
  }
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  if (session.csrf && method !== "GET" && method !== "HEAD") headers["X-CSRF-Token"] = session.csrf;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 80,
        path,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let data = {};
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch {
            data = { error: raw.slice(0, 180) };
          }
          if ((res.statusCode ?? 500) >= 400) {
            const error = new Error(data.error || `${method} ${path} failed (${res.statusCode})`);
            error.status = res.statusCode;
            reject(error);
            return;
          }
          if (data.token) session.token = data.token;
          if (data.csrf) session.csrf = data.csrf;
          resolve(data);
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

try {
  const registered = await call("POST", "/api/auth/register", {
    name: "Demo Owner",
    email,
    password,
    language: "en",
  });
  if (!registered.token || !registered.csrf) throw new Error("Local register did not return a phone session.");
  console.log("Created the local demo account.");
} catch (error) {
  if (error.status !== 409) throw error;
  const loggedIn = await call("POST", "/api/auth/login", { email, password });
  if (!loggedIn.token || !loggedIn.csrf) throw new Error("Local login did not return a phone session.");
  console.log("The local demo account already existed. Signed in.");
}

const me = await call("GET", "/api/auth/me");
if (me.customer?.email !== email) throw new Error("Signed-in profile did not load.");

const listed = await call("GET", "/api/businesses");
let business = listed.businesses?.[0];
if (!business) {
  const started = await call("POST", "/api/businesses");
  business = started.business;
  await call("POST", `/api/businesses/${business.id}/conversation`, { text: "Harbor Coffee" });
  business = (await call("POST", `/api/businesses/${business.id}/conversation`, { skipRemaining: true })).business;
  console.log("Saved the Harbor Coffee demonstration business.");
} else {
  console.log(`Business profile loaded: ${business.name || "(unnamed)"}`);
}

const campaign = await call("POST", "/api/campaigns", {
  prompt: "A lunch special for Harbor Coffee, made for the weekday crowd.",
  businessId: business.id,
});
if (!campaign.campaign?.id) throw new Error("Advertisement draft did not start.");
console.log(`Advertisement draft loaded: ${campaign.campaign.id}`);

console.log("");
console.log("Local demo sign-in for the iPhone Simulator:");
console.log(`  email     ${email}`);
console.log(`  password  ${password}`);
console.log("Paid image and video generation was not called.");
