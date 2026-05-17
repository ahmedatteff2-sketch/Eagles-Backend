import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("GET /api/healthz", () => {
  it("returns 200 ok regardless of auth", async () => {
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("404 fallback", () => {
  it("returns JSON 404 for unknown /api routes (not the SPA fallback)", async () => {
    const res = await request(app).get("/api/this-does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: "Not found" });
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });
});
