import mongoose, { Schema } from "mongoose";
const options = {
  timestamps: true,
  toJSON: {
    transform: (_doc: unknown, ret: any) => {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
};
const image = new Schema(
  { url: String, publicId: String, width: Number, height: Number, alt: String },
  { _id: false },
);
const design = new Schema(
  { id: String, title: String, description: String, image },
  { _id: false },
);
export const Admin = mongoose.model(
  "Admin",
  new Schema(
    {
      email: { type: String, unique: true },
      passwordHash: String,
      resetHash: String,
      resetExpires: Date,
      sessionVersion: { type: Number, default: 0 },
    },
    options,
  ),
);
export const Content = mongoose.model(
  "Content",
  new Schema(
    { key: { type: String, unique: true }, value: Schema.Types.Mixed },
    options,
  ),
);
export const Category = mongoose.model(
  "Category",
  new Schema(
    { name: String, normalized: { type: String, unique: true } },
    options,
  ),
);
export const Project = mongoose.model(
  "Project",
  new Schema(
    {
      name: String,
      description: String,
      year: Number,
      categories: [{ type: Schema.Types.ObjectId, ref: "Category" }],
      cover: image,
      designs: [design],
      featured: Boolean,
    },
    options,
  ),
);
export const Experience = mongoose.model(
  "Experience",
  new Schema(
    {
      title: String,
      company: String,
      startDate: String,
      endDate: String,
      location: String,
      description: String,
      achievements: [String],
    },
    options,
  ),
);
export const Order = mongoose.model(
  "Order",
  new Schema({ key: { type: String, unique: true }, ids: [String] }, options),
);
export const Asset = mongoose.model(
  "Asset",
  new Schema(
    {
      publicId: { type: String, unique: true },
      url: String,
      width: Number,
      height: Number,
      alt: String,
      createdAt: { type: Date, default: Date.now },
    },
    options,
  ),
);
export const models = {
  categories: Category,
  projects: Project,
  experiences: Experience,
};
export async function ordered(key: string, items: any[]) {
  const order = await Order.findOne({ key }).lean();
  const positions = new Map((order?.ids || []).map((v, i) => [v, i]));
  return items.sort(
    (a, b) =>
      (positions.get(String(a._id || a.id)) ?? 1e9) -
      (positions.get(String(b._id || b.id)) ?? 1e9),
  );
}
export async function isAssetReferenced(publicId: string) {
  const p = await Project.exists({
    $or: [
      { "cover.publicId": publicId },
      { "designs.image.publicId": publicId },
    ],
  });
  if (p) return true;
  return Boolean(
    await Content.exists({ $or: [{ "value.portrait.publicId": publicId }] }),
  );
}
