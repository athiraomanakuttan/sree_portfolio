import { z } from "zod";
export const LIMITS = {
  text: 160,
  longText: 8000,
  imageBytes: 10 * 1024 * 1024,
  minDimension: 200,
  maxDimension: 12000,
  pageSize: 12,
} as const;
const text = (max: number = LIMITS.text) => z.string().trim().max(max);
const required = (max: number = LIMITS.text) =>
  text(max).min(1, "This field is required");
export const id = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ID");
const safeUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => !v || /^https:\/\//.test(v), "Use an HTTPS URL");
export const destination = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (v) => /^\/(?!\/)/.test(v) || /^https:\/\//.test(v),
    "Use a local path or HTTPS URL",
  );
export const imageSchema = z.object({
  url: safeUrl.refine(Boolean, "Image is required"),
  publicId: required(300),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: required(300),
});
export const designSchema = z.object({
  id: id.optional(),
  title: required(),
  description: text(LIMITS.longText).default(""),
  image: imageSchema,
});
export const projectSchema = z.object({
  name: required(),
  description: text(LIMITS.longText).default(""),
  year: z.coerce
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 2),
  categories: z
    .array(id)
    .min(1, "Select at least one category")
    .max(30)
    .refine((a) => new Set(a).size === a.length, "Duplicate category"),
  cover: imageSchema,
  designs: z.array(designSchema).max(200).default([]),
  featured: z.boolean().default(false),
});
export const categorySchema = z.object({
  name: required(60).refine(
    (v) => v.toLowerCase() !== "all",
    "All is a reserved filter",
  ),
});
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date")
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Invalid date",
  );
export const experienceSchema = z
  .object({
    title: required(),
    company: required(),
    startDate: date,
    endDate: z.union([date, z.literal("")]).default(""),
    location: text(),
    description: text(LIMITS.longText).default(""),
    achievements: z.array(required(500)).max(30).default([]),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "End date must follow start date",
  });
const social = z.object({
  label: required(40),
  url: safeUrl.refine(Boolean, "URL is required"),
});
export const heroSchema = z.object({
  wordmark: required(30),
  greeting: required(),
  title: required(250),
  intro: required(1000),
  portrait: imageSchema.nullable(),
  primaryLabel: required(40),
  primaryDestination: destination,
  secondaryLabel: required(40),
  secondaryDestination: destination,
});
export const aboutSchema = z.object({
  heading: required(200),
  intro: required(500),
  description: required(LIMITS.longText),
  portrait: imageSchema.nullable(),
  skills: z.array(required(80)).max(40),
  tools: z.array(required(80)).max(40),
  specialties: z.array(required(80)).max(40),
  stats: z.array(z.object({ value: required(30), label: required(80) })).max(8),
  socials: z.array(social).max(12),
});
export const contactContentSchema = z.object({
  heading: required(200),
  description: text(1000),
  email: z.string().trim().email(),
  location: text(),
  socials: z.array(social).max(12),
});
export const contactSchema = z.object({
  name: required(100),
  email: z.string().trim().email().max(254),
  phone: text(40),
  subject: required(200),
  message: required(5000).min(10, "Please write at least 10 characters"),
  website: z.string().max(200).default(""),
});
export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(128)
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/\d/, "Include a number");
export const schemas = {
  hero: heroSchema,
  about: aboutSchema,
  contact: contactContentSchema,
  categories: categorySchema,
  projects: projectSchema,
  experiences: experienceSchema,
};
export type ImageAsset = z.infer<typeof imageSchema>;
export type Design = z.infer<typeof designSchema> & { id: string };
export type Project = z.infer<typeof projectSchema> & {
  id: string;
  designs: Design[];
};
export type Category = z.infer<typeof categorySchema> & { id: string };
export type Experience = z.infer<typeof experienceSchema> & { id: string };
export type Content = {
  hero: z.infer<typeof heroSchema>;
  about: z.infer<typeof aboutSchema>;
  contact: z.infer<typeof contactContentSchema>;
};
export type Portfolio = Content & {
  categories: Category[];
  experiences: Experience[];
  featured: Project[];
};
