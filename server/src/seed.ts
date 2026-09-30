import "dotenv/config";
import mongoose from "mongoose";
import { Content } from "./models.js";
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
await mongoose.connect(process.env.MONGODB_URI);
const content = {
  hero: {
    wordmark: "ALEX",
    greeting: "Hi, I’m Alex.",
    title: "Turning ideas into identities.",
    intro:
      "Independent graphic designer shaping thoughtful brands and visual stories.",
    portrait: null,
    primaryLabel: "View my work",
    primaryDestination: "/work",
    secondaryLabel: "Let’s talk",
    secondaryDestination: "/contact",
  },
  about: {
    heading: "Designing with purpose.",
    intro: "A curious mind. A considered approach.",
    description:
      "I connect strategy and craft to create clear, memorable visual identities. My work moves between branding, packaging and digital design, always guided by the story behind the project.",
    portrait: null,
    skills: ["Art direction", "Brand identity", "Typography"],
    tools: ["Illustrator", "Photoshop", "InDesign", "Figma"],
    specialties: ["Branding", "Packaging", "Digital design"],
    stats: [],
    socials: [],
  },
  contact: {
    heading: "Good things start with a conversation.",
    description: "Have a project in mind? Tell me a little about it.",
    email: process.env.CONTACT_EMAIL || "designer@example.com",
    location: "Available for collaborations worldwide",
    socials: [],
  },
};
for (const [key, value] of Object.entries(content))
  await Content.updateOne(
    { key },
    { $setOnInsert: { key, value } },
    { upsert: true },
  );
console.log(
  "Editable starter copy created. Add your portrait and real projects in the dashboard. Existing content was preserved.",
);
await mongoose.disconnect();
