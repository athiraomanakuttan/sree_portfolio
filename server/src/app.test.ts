import { test } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import {
  contactSchema,
  experienceSchema,
  categorySchema,
} from "../../shared/contracts.js";
test("validation rejects impossible dates and reserved categories", () => {
  assert.equal(categorySchema.safeParse({ name: "All" }).success, false);
  assert.equal(
    experienceSchema.safeParse({
      title: "Designer",
      company: "Studio",
      startDate: "2026-02-30",
    }).success,
    false,
  );
  assert.equal(
    experienceSchema.safeParse({
      title: "Designer",
      company: "Studio",
      startDate: "2026-09-01",
      endDate: "2026-08-01",
    }).success,
    false,
  );
  assert.equal(
    contactSchema.safeParse({
      name: "",
      email: "bad",
      phone: "",
      subject: "",
      message: "short",
    }).success,
    false,
  );
});
test("API authentication, CRUD, filtering, independent orders, password reset and safeguards", async () => {
  const db = await MongoMemoryServer.create();
  process.env.MONGODB_URI = db.getUri();
  process.env.SESSION_SECRET = "integration-test-secret-at-least-32-characters";
  process.env.APP_URL = "http://localhost:5173";
  process.env.NODE_ENV = "test";
  await mongoose.connect(db.getUri());
  const { Admin, Asset, Project } = await import("./models.js");
  await Admin.create({
    email: "admin@example.com",
    passwordHash: await bcrypt.hash("StrongPassword123", 12),
  });
  const { app, sessionStore } = await import("./app.js");
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  let cookie = "",
    csrf = "";
  async function request(
    url: string,
    method = "GET",
    body?: any,
    withCsrf = true,
  ) {
    const r = await fetch(`${origin}/api${url}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...(withCsrf && csrf ? { "X-CSRF-Token": csrf } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = r.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: r.status, data: await r.json() };
  }
  try {
    assert.equal((await request("/admin/projects")).status, 401);
    assert.equal(
      (
        await request("/auth/login", "POST", {
          email: "admin@example.com",
          password: "wrong",
        })
      ).status,
      401,
    );
    const login = await request("/auth/login", "POST", {
      email: "admin@example.com",
      password: "StrongPassword123",
    });
    assert.equal(login.status, 200);
    csrf = login.data.csrf;
    assert.equal(
      (await request("/admin/categories", "POST", { name: "Branding" }, false))
        .status,
      403,
    );
    const c1 = (
      await request("/admin/categories", "POST", { name: "Branding" })
    ).data;
    const c2 = (
      await request("/admin/categories", "POST", { name: "Packaging" })
    ).data;
    assert.equal(
      (await request("/admin/categories", "POST", { name: "branding" })).status,
      409,
    );
    assert.equal(
      (await request("/admin/categories", "POST", { name: "All" })).status,
      422,
    );
    const a = {
      url: "https://res.cloudinary.com/test/image/upload/test.jpg",
      publicId: "test/asset",
      width: 800,
      height: 800,
      alt: "Test artwork",
    };
    await Asset.create(a);
    const project = {
      name: "One",
      description: "First brand",
      year: 2026,
      categories: [c1.id],
      cover: a,
      designs: [
        { title: "Poster one", description: "", image: a },
        { title: "Poster two", description: "", image: a },
      ],
      featured: true,
    };
    const forged = await request("/admin/projects", "POST", {
      ...project,
      designs: [
        {
          title: "Forged",
          description: "",
          image: { ...a, url: "https://example.com/forged.jpg" },
        },
      ],
    });
    assert.equal(forged.status, 400);
    const first = await request("/admin/projects", "POST", project);
    assert.equal(first.status, 201);
    const p1 = first.data;
    const p2 = (
      await request("/admin/projects", "POST", {
        ...project,
        name: "Two",
        categories: [c2.id],
      })
    ).data;
    assert.equal(
      (await request(`/public/projects?category=${c1.id}`)).data.items.length,
      1,
    );
    assert.equal(
      (await request(`/admin/categories/${c1.id}`, "DELETE")).status,
      409,
    );
    assert.equal(
      (await request("/admin/projects/order", "PUT", { ids: [p2.id, p1.id] }))
        .status,
      200,
    );
    assert.equal(
      (await request("/admin/featured/order", "PUT", { ids: [p1.id, p2.id] }))
        .status,
      200,
    );
    assert.equal((await request("/public/projects")).data.items[0].id, p2.id);
    assert.equal(
      (await request("/public/portfolio")).data.featured[0].id,
      p1.id,
    );
    assert.equal(
      (await request("/admin/projects/order", "PUT", { ids: [p1.id, p1.id] }))
        .status,
      422,
    );
    assert.equal(
      (await request("/admin/projects/order", "PUT", { ids: [p1.id] })).status,
      409,
    );
    assert.equal(
      (
        await request(`/admin/projects/${p1.id}/design-order`, "PUT", {
          ids: p1.designs.map((d: any) => d.id).reverse(),
        })
      ).status,
      200,
    );
    assert.equal(
      (await request(`/public/projects/${p1.id}`)).data.designs[0].title,
      "Poster two",
    );
    assert.equal(
      (
        await request("/admin/experiences", "POST", {
          title: "Lead",
          company: "Studio",
          startDate: "2026-01-01",
          endDate: "2025-01-01",
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await request(
          `/admin/assets/${String((await Asset.findOne())!._id)}`,
          "DELETE",
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await request("/contact", "POST", {
          name: "Visitor",
          email: "visitor@example.com",
          phone: "",
          subject: "Project",
          message: "Interested in a design project.",
          website: "",
        })
      ).status,
      503,
    );
    await Project.insertMany(
      Array.from({ length: 13 }, (_, i) => ({
        ...project,
        name: `Additional ${i}`,
        designs: [],
        categories: [c2.id],
      })),
    );
    const secondPage = await request("/public/projects?page=2");
    assert.equal(secondPage.data.total, 15);
    assert.equal(secondPage.data.items.length, 3);
    assert.equal(secondPage.data.items[0].designs, undefined);
    const invalidForm = new FormData();
    invalidForm.append(
      "image",
      new Blob(["not an image"], { type: "image/svg+xml" }),
      "invalid.svg",
    );
    const rejectedUpload = await fetch(`${origin}/api/admin/upload`, {
      method: "POST",
      headers: { Cookie: cookie, "X-CSRF-Token": csrf },
      body: invalidForm,
    });
    assert.equal(rejectedUpload.status, 400);
    const token = crypto.randomBytes(32).toString("hex");
    await Admin.updateOne(
      { email: "admin@example.com" },
      {
        $set: {
          resetHash: crypto.createHash("sha256").update(token).digest("hex"),
          resetExpires: new Date(Date.now() + 100000),
        },
      },
    );
    assert.equal(
      (
        await request("/auth/reset", "POST", {
          token,
          password: "NewStrongPassword123",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request("/auth/reset", "POST", {
          token,
          password: "NewStrongPassword123",
        })
      ).status,
      400,
    );
    assert.equal((await request("/admin/projects")).status, 401);
    const again = await request("/auth/login", "POST", {
      email: "admin@example.com",
      password: "NewStrongPassword123",
    });
    csrf = again.data.csrf;
    assert.equal(again.status, 200);
    await Project.updateMany({}, { $set: { categories: [c2.id] } });
    assert.equal(
      (await request(`/admin/categories/${c1.id}`, "DELETE")).status,
      200,
    );
    assert.equal((await request("/auth/logout", "POST")).status, 200);
    assert.equal((await request("/admin/overview")).status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await sessionStore.close();
    await mongoose.disconnect();
    await db.stop();
  }
});
