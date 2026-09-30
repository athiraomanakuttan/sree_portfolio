import { checkUploadConfiguration, uploadToCloudinary } from "./uploads.js";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import MongoStore from "connect-mongo";
import rateLimit from "express-rate-limit";
import multer from "multer";
import sharp from "sharp";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import path from "node:path";
import mongoose from "mongoose";
import { z } from "zod";
import {
  schemas,
  id,
  passwordSchema,
  contactSchema,
  LIMITS,
} from "../../shared/contracts.js";
import {
  Admin,
  Content,
  Category,
  Project,
  Experience,
  Order,
  Asset,
  models,
  ordered,
  isAssetReferenced,
} from "./models.js";
import {
  config,
  mail,
  cloudinary,
  cleanupAssets,
  assetIds,
} from "./services.js";
declare module "express-session" {
  interface SessionData {
    adminId: string;
    version: number;
    csrf: string;
  }
}
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
export const app = express();
app.set("trust proxy", Number(process.env.TRUST_PROXY || 0));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: config.production ? [] : null,
      },
    },
  }),
);
app.use(cors({ origin: config.appUrl, credentials: true }));
app.use(express.json({ limit: "1mb" }));
export const sessionStore = MongoStore.create({
  mongoUrl: process.env.MONGODB_URI!,
  ttl: 60 * 60 * 12,
});
app.use(
  session({
    name: "portfolio.sid",
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      secure: config.production,
      sameSite: "lax",
      maxAge: 12 * 60 * 60 * 1000,
    },
  }),
);
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (req.headers.origin && req.headers.origin !== config.appUrl)
      return next(new HttpError(403, "Request origin is not allowed"));
  }
  next();
});
const auth = wrap(async (req, res, next) => {
  const admin = req.session.adminId
    ? await Admin.findById(req.session.adminId)
    : null;
  if (!admin || admin.sessionVersion !== req.session.version)
    throw new HttpError(401, "Please sign in");
  if (
    !["GET", "HEAD"].includes(req.method) &&
    req.headers["x-csrf-token"] !== req.session.csrf
  )
    throw new HttpError(403, "Refresh the page and try again");
  next();
});
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many attempts. Try again in 15 minutes." },
});
app.get("/api/health", (_req, res) =>
  res.json({ ok: mongoose.connection.readyState === 1 }),
);
app.get(
  "/api/auth/me",
  auth,
  wrap(async (req, res) => {
    const a = await Admin.findById(req.session.adminId);
    res.json({ email: a!.email, csrf: req.session.csrf });
  }),
);
app.post(
  "/api/auth/login",
  authLimit,
  wrap(async (req, res) => {
    const data = z
      .object({
        email: z.string().trim().email(),
        password: z.string().min(1).max(128),
      })
      .parse(req.body);
    const a = await Admin.findOne({ email: data.email.toLowerCase() });
    if (!a || !(await bcrypt.compare(data.password, a.passwordHash!)))
      throw new HttpError(401, "Email or password is incorrect");
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((e) => (e ? reject(e) : resolve())),
    );
    req.session.adminId = String(a._id);
    req.session.version = a.sessionVersion;
    req.session.csrf = crypto.randomBytes(32).toString("hex");
    res.json({ email: a.email, csrf: req.session.csrf });
  }),
);
app.post(
  "/api/auth/logout",
  auth,
  wrap(async (req, res) => {
    await new Promise<void>((resolve, reject) =>
      req.session.destroy((e) => (e ? reject(e) : resolve())),
    );
    res.clearCookie("portfolio.sid");
    res.json({ message: "Signed out" });
  }),
);
app.post(
  "/api/auth/forgot",
  authLimit,
  wrap(async (req, res) => {
    const { email } = z
      .object({ email: z.string().trim().email() })
      .parse(req.body);
    const a = await Admin.findOne({ email: email.toLowerCase() });
    if (a) {
      const token = crypto.randomBytes(32).toString("hex");
      a.resetHash = crypto.createHash("sha256").update(token).digest("hex");
      a.resetExpires = new Date(Date.now() + 30 * 60 * 1000);
      await a.save();
      try {
        await mail(
          "Reset your portfolio password",
          `Use this link within 30 minutes: ${config.appUrl}/admin/reset?token=${token}`,
          undefined,
          a.email!,
        );
      } catch {
        console.error("Password reset email delivery failed");
      }
    }
    res.json({ message: "If the account exists, a reset link has been sent." });
  }),
);
app.post(
  "/api/auth/reset",
  authLimit,
  wrap(async (req, res) => {
    const { token, password } = z
      .object({
        token: z.string().regex(/^[a-f\d]{64}$/),
        password: passwordSchema,
      })
      .parse(req.body);
    const a = await Admin.findOneAndUpdate(
      {
        resetHash: crypto.createHash("sha256").update(token).digest("hex"),
        resetExpires: { $gt: new Date() },
      },
      {
        $set: { passwordHash: await bcrypt.hash(password, 12) },
        $unset: { resetHash: 1, resetExpires: 1 },
        $inc: { sessionVersion: 1 },
      },
      { new: true },
    );
    if (!a) throw new HttpError(400, "Reset link is invalid or expired");
    res.json({ message: "Password reset. Sign in with your new password." });
  }),
);
app.post(
  "/api/admin/password",
  auth,
  wrap(async (req, res) => {
    const { currentPassword, password } = z
      .object({
        currentPassword: z.string().max(128),
        password: passwordSchema,
      })
      .parse(req.body);
    const a = await Admin.findById(req.session.adminId);
    if (!(await bcrypt.compare(currentPassword, a!.passwordHash!)))
      throw new HttpError(400, "Current password is incorrect");
    a!.passwordHash = await bcrypt.hash(password, 12);
    a!.sessionVersion += 1;
    await a!.save();
    req.session.version = a!.sessionVersion;
    res.json({
      message: "Password updated. Other sessions have been signed out.",
    });
  }),
);
app.get(
  "/api/public/portfolio",
  wrap(async (_req, res) => {
    const contents = await Content.find().lean();
    const data = Object.fromEntries(contents.map((c) => [c.key, c.value]));
    res.json({
      ...data,
      categories: (await ordered("categories", await Category.find())).map(
        (x) => x.toJSON(),
      ),
      experiences: (await ordered("experiences", await Experience.find())).map(
        (x) => x.toJSON(),
      ),
      featured: (
        await ordered(
          "featured",
          await Project.find({ featured: true }).select("-designs"),
        )
      ).map((x) => x.toJSON()),
    });
  }),
);
app.get(
  "/api/public/projects",
  wrap(async (req, res) => {
    const params = z
      .object({
        page: z.coerce.number().int().min(1).max(100000).default(1),
        category: id.optional(),
      })
      .parse(req.query);
    const match = params.category
      ? { categories: new mongoose.Types.ObjectId(params.category) }
      : {};
    const total = await Project.countDocuments(match);
    const saved = await Order.findOne({ key: "projects" }).lean();
    const items = await Project.aggregate([
      { $match: match },
      { $project: { designs: 0 } },
      {
        $addFields: {
          _rank: { $indexOfArray: [saved?.ids || [], { $toString: "$_id" }] },
        },
      },
      {
        $addFields: {
          _rank: { $cond: [{ $lt: ["$_rank", 0] }, 1000000000, "$_rank"] },
        },
      },
      { $sort: { _rank: 1, createdAt: 1, _id: 1 } },
      { $skip: (params.page - 1) * LIMITS.pageSize },
      { $limit: LIMITS.pageSize },
      { $project: { _rank: 0 } },
    ]);
    res.json({
      items: items.map((x) => ({
        ...x,
        id: String(x._id),
        categories: x.categories.map(String),
        _id: undefined,
        __v: undefined,
      })),
      total,
      page: params.page,
      pages: Math.ceil(total / LIMITS.pageSize),
    });
  }),
);
app.get(
  "/api/public/projects/:id",
  wrap(async (req, res) => {
    const p = await Project.findById(id.parse(req.params.id));
    if (!p) throw new HttpError(404, "Project not found");
    res.json(p.toJSON());
  }),
);
app.post(
  "/api/contact",
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    message: { message: "Please try again in an hour." },
  }),
  wrap(async (req, res) => {
    const data = contactSchema.parse(req.body);
    if (data.website) return res.json({ message: "Message sent" });
    try {
      await mail(
        `Portfolio enquiry: ${data.subject}`,
        `Name: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone || "Not supplied"}\n\n${data.message}`,
        data.email,
      );
    } catch {
      throw new HttpError(
        503,
        "Email delivery is unavailable. Please use the displayed contact email.",
      );
    }
    res.json({ message: "Message sent. Thank you for getting in touch." });
  }),
);
app.use("/api/admin", auth);
app.get(
  "/api/admin/overview",
  wrap(async (_req, res) => {
    res.json({
      projects: await Project.countDocuments(),
      featured: await Project.countDocuments({ featured: true }),
      categories: await Category.countDocuments(),
      experiences: await Experience.countDocuments(),
      services: {
        database: mongoose.connection.readyState === 1,
        images: Boolean(process.env.CLOUDINARY_API_SECRET),
        email: Boolean(process.env.SMTP_HOST && process.env.CONTACT_EMAIL),
      },
    });
  }),
);
app.get(
  "/api/admin/content/:key",
  wrap(async (req, res) => {
    if (!["hero", "about", "contact"].includes(String(req.params.key)))
      throw new HttpError(404, "Content not found");
    res.json((await Content.findOne({ key: req.params.key }))?.value || null);
  }),
);
async function verifyAssets(data: any) {
  for (const supplied of findAssets(data)) {
    const a = await Asset.findOne({ publicId: supplied.publicId });
    if (!a)
      throw new HttpError(400, "Select an image uploaded to this portfolio");
    if (
      supplied?.url !== a.url ||
      supplied?.width !== a.width ||
      supplied?.height !== a.height
    )
      throw new HttpError(400, "Image metadata is invalid");
  }
}
function findAssets(v: any): any[] {
  if (!v || typeof v !== "object") return [];
  return [...(v.publicId ? [v] : []), ...Object.values(v).flatMap(findAssets)];
}
app.put(
  "/api/admin/content/:key",
  wrap(async (req, res) => {
    const key = String(req.params.key);
    if (!["hero", "about", "contact"].includes(key))
      throw new HttpError(404, "Content not found");
    const data = schemas[key as "hero" | "about" | "contact"].parse(req.body);
    await verifyAssets(data);
    const old = await Content.findOneAndUpdate(
      { key },
      { $set: { value: data } },
      { upsert: true },
    );
    await cleanupAssets(assetIds(old?.value));
    res.json(data);
  }),
);
for (const key of ["categories", "projects", "experiences"] as const) {
  const model: any = models[key];
  app.get(
    `/api/admin/${key}`,
    wrap(async (_req, res) => {
      res.json((await ordered(key, await model.find())).map((x) => x.toJSON()));
    }),
  );
  app.put(
    `/api/admin/${key}/order`,
    wrap(async (req, res) => {
      const { ids } = z
        .object({
          ids: z
            .array(id)
            .max(10000)
            .refine((a) => new Set(a).size === a.length, "Duplicate IDs"),
        })
        .parse(req.body);
      const actual = (await model.find().select("_id")).map((x: any) =>
        String(x._id),
      );
      if (ids.length !== actual.length || ids.some((x) => !actual.includes(x)))
        throw new HttpError(
          409,
          "Collection changed. Reload before saving order.",
        );
      await Order.findOneAndUpdate(
        { key },
        { $set: { ids } },
        { upsert: true },
      );
      res.json({ message: "Order saved" });
    }),
  );
  for (const method of ["post", "put"] as const) {
    app[method](
      `/api/admin/${key}${method === "put" ? "/:id" : ""}`,
      wrap(async (req, res) => {
        const data: any = schemas[key].parse(req.body);
        if (key === "categories") data.normalized = data.name.toLowerCase();
        if (key === "projects") {
          const count = await Category.countDocuments({
            _id: { $in: data.categories },
          });
          if (count !== data.categories.length)
            throw new HttpError(400, "One or more categories no longer exist");
          data.designs = data.designs.map((d: any) => ({
            ...d,
            id: d.id || String(new mongoose.Types.ObjectId()),
          }));
          if (
            new Set(data.designs.map((d: any) => d.id)).size !==
            data.designs.length
          )
            throw new HttpError(400, "Duplicate design IDs");
          await verifyAssets(data);
        }
        let old: any;
        let saved: any;
        if (method === "put") {
          const itemId = id.parse(req.params.id);
          old = await model.findById(itemId);
          if (!old) throw new HttpError(404, "Item not found");
          saved = await model.findByIdAndUpdate(
            itemId,
            { $set: data },
            { new: true },
          );
        } else saved = await model.create(data);
        if (old) await cleanupAssets(assetIds(old.toJSON()));
        res.status(method === "post" ? 201 : 200).json(saved.toJSON());
      }),
    );
  }
  app.delete(
    `/api/admin/${key}/:id`,
    wrap(async (req, res) => {
      const itemId = id.parse(req.params.id);
      if (
        key === "categories" &&
        (await Project.exists({ categories: itemId }))
      )
        throw new HttpError(
          409,
          "This category is assigned to projects. Reassign those projects before deleting it.",
        );
      const old = await model.findByIdAndDelete(itemId);
      if (!old) throw new HttpError(404, "Item not found");
      await Order.updateMany(
        { key: { $in: [key, "featured"] } },
        { $pull: { ids: itemId } },
      );
      await cleanupAssets(assetIds(old.toJSON()));
      res.json({ message: "Deleted" });
    }),
  );
}
app.get(
  "/api/admin/featured",
  wrap(async (_req, res) =>
    res.json(
      (await ordered("featured", await Project.find({ featured: true }))).map(
        (x) => x.toJSON(),
      ),
    ),
  ),
);
app.put(
  "/api/admin/featured/order",
  wrap(async (req, res) => {
    const { ids } = z
      .object({
        ids: z
          .array(id)
          .refine((a) => new Set(a).size === a.length, "Duplicate IDs"),
      })
      .parse(req.body);
    const actual = (await Project.find({ featured: true })).map((x) =>
      String(x._id),
    );
    if (ids.length !== actual.length || ids.some((x) => !actual.includes(x)))
      throw new HttpError(
        409,
        "Featured projects changed. Reload before saving.",
      );
    await Order.findOneAndUpdate(
      { key: "featured" },
      { $set: { ids } },
      { upsert: true },
    );
    res.json({ message: "Featured order saved" });
  }),
);
app.put(
  "/api/admin/projects/:id/design-order",
  wrap(async (req, res) => {
    const itemId = id.parse(req.params.id);
    const { ids } = z
      .object({ ids: z.array(id).refine((a) => new Set(a).size === a.length) })
      .parse(req.body);
    const p = await Project.findById(itemId);
    if (!p) throw new HttpError(404, "Project not found");
    if (
      ids.length !== p.designs.length ||
      ids.some((x) => !p.designs.some((d) => d.id === x))
    )
      throw new HttpError(409, "Designs changed. Reload before saving order.");
    const next = ids.map((x) => p.designs.find((d) => d.id === x)!.toObject());
    await Project.updateOne({ _id: itemId }, { $set: { designs: next } });
    res.json({ message: "Design order saved" });
  }),
);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS.imageBytes, files: 1 },
  fileFilter: (_req, file, cb) =>
    cb(
      null,
      ["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
        file.mimetype,
      ),
    ),
});
app.post(
  "/api/admin/upload",
  rateLimit({ windowMs: 60 * 1000, limit: 20 }),
  upload.single("image"),
  wrap(async (req, res) => {
    if (!req.file)
      throw new HttpError(400, "Select a JPEG, PNG, WebP or AVIF image");
    checkUploadConfiguration();
    let info;
    try {
      info = await sharp(req.file.buffer, {
        limitInputPixels: LIMITS.maxDimension ** 2,
      }).metadata();
    } catch {
      throw new HttpError(400, "File is not a valid image");
    }
    if (
      !["jpeg", "png", "webp", "heif", "avif"].includes(info.format || "") ||
      !info.width ||
      !info.height ||
      Math.min(info.width, info.height) < LIMITS.minDimension ||
      Math.max(info.width, info.height) > LIMITS.maxDimension ||
      (info.pages && info.pages > 1)
    )
      throw new HttpError(
        400,
        `Use a still image between ${LIMITS.minDimension} and ${LIMITS.maxDimension} pixels`,
      );
    const result = await uploadToCloudinary(req.file.buffer);
    const asset = await Asset.create({
      publicId: result.public_id,
      url: result.secure_url,
      width: result.width,
      height: result.height,
      alt: String(req.body.alt || req.file.originalname).slice(0, 300),
    });
    res.status(201).json({
      publicId: asset.publicId,
      url: asset.url,
      width: asset.width,
      height: asset.height,
      alt: asset.alt,
    });
  }),
);
app.get(
  "/api/admin/assets",
  wrap(async (_req, res) =>
    res.json(
      (await Asset.find().sort({ createdAt: -1 }).limit(200)).map((x) =>
        x.toJSON(),
      ),
    ),
  ),
);
app.delete(
  "/api/admin/assets/:id",
  wrap(async (req, res) => {
    const a = await Asset.findById(id.parse(req.params.id));
    if (!a) throw new HttpError(404, "Image not found");
    if (await isAssetReferenced(a.publicId!))
      throw new HttpError(
        409,
        "This image is currently used. Replace it before deleting.",
      );
    await cleanupAssets([a.publicId!]);
    res.json({ message: "Image removed" });
  }),
);
app.use("/api", (_req, _res, next) =>
  next(new HttpError(404, "API endpoint not found")),
);
app.use(express.static(path.resolve("dist")));
app.get("/{*splat}", (_req, res) =>
  res.sendFile(path.resolve("dist/index.html")),
);
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError)
    return res.status(422).json({
      message: "Check the highlighted fields",
      errors: Object.fromEntries(
        err.issues.map((v) => [v.path.join("."), v.message]),
      ),
    });
  if (err.code === 11000)
    return res.status(409).json({ message: "That name already exists" });
  if (err instanceof multer.MulterError)
    return res.status(400).json({
      message:
        err.code === "LIMIT_FILE_SIZE"
          ? "Image must be 10 MB or smaller"
          : "Upload failed",
    });
  const status = err.status || 500;
  if (status === 500) console.error(err.message);
  res.status(status).json({
    message:
      status === 500 ? "Something went wrong. Please try again." : err.message,
  });
});
