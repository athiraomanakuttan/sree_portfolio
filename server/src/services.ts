import "dotenv/config";
import nodemailer from "nodemailer";
import { v2 as cloudinary } from "cloudinary";
import { Asset, isAssetReferenced } from "./models.js";
export const config = {
  production: process.env.NODE_ENV === "production",
  appUrl: process.env.APP_URL || "http://localhost:5173",
  port: Number(process.env.PORT || 4000),
};
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
export { cloudinary };
export async function mail(
  subject: string,
  text: string,
  replyTo?: string,
  to = process.env.CONTACT_EMAIL,
) {
  if (!to || !process.env.SMTP_HOST || !process.env.MAIL_FROM)
    throw new Error("Email delivery is not configured");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  await transport.sendMail({
    from: process.env.MAIL_FROM,
    to,
    replyTo,
    subject,
    text,
  });
}
export async function cleanupAssets(ids: string[]) {
  for (const publicId of new Set(ids)) {
    if (!publicId || (await isAssetReferenced(publicId))) continue;
    try {
      await cloudinary.uploader.destroy(publicId, { invalidate: true });
      await Asset.deleteOne({ publicId });
    } catch {
      console.error("Asset cleanup deferred");
    }
  }
}
export function assetIds(value: any): string[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(assetIds);
  return [
    ...(typeof value.publicId === "string" ? [value.publicId] : []),
    ...Object.values(value).flatMap(assetIds),
  ];
}
