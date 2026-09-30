import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { passwordSchema } from "../../shared/contracts.js";
import { Admin } from "./models.js";
if (
  !process.env.MONGODB_URI ||
  !process.env.SESSION_SECRET ||
  process.env.SESSION_SECRET.length < 32
)
  throw new Error(
    "Configure MONGODB_URI and a SESSION_SECRET of at least 32 characters in .env",
  );
await mongoose.connect(process.env.MONGODB_URI);
if (!(await Admin.exists({}))) {
  if (!process.env.ADMIN_EMAIL)
    throw new Error("ADMIN_EMAIL is required for initial setup");
  const password = passwordSchema.parse(process.env.ADMIN_PASSWORD);
  await Admin.create({
    email: process.env.ADMIN_EMAIL.toLowerCase(),
    passwordHash: await bcrypt.hash(password, 12),
  });
}
const { app } = await import("./app.js");
const port = Number(process.env.PORT || 4000);
const server = app.listen(port, () =>
  console.log(`Portfolio server listening on ${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  });
