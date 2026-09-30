import { cloudinary } from "./services.js";

export class UploadError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function checkUploadConfiguration() {
  const missing = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ].filter((name) => !process.env[name]?.trim());
  if (missing.length)
    throw new UploadError(
      503,
      `Cloudinary is not configured. Set ${missing.join(", ")} in the project-root .env and restart the backend.`,
    );
}

export function providerUploadError(error: unknown): UploadError {
  const e = error as {
    http_code?: number;
    code?: string;
    message?: string;
  } | null;
  // Log only codes: provider error objects can include request credentials.
  console.error("Cloudinary upload failed", {
    status: e?.http_code || "unknown",
    code: e?.code || "unknown",
  });
  if (
    e?.http_code === 401 ||
    e?.http_code === 403 ||
    /api.?key|signature|cloud.?name|unknown cloud/i.test(e?.message || "")
  )
    return new UploadError(
      503,
      "Cloudinary rejected the server credentials. Check the cloud name, API key and API secret belong to the same account, then restart the backend.",
    );
  if (e?.http_code === 400)
    return new UploadError(
      400,
      "Cloudinary could not accept this image. Try a still JPEG, PNG, WebP or AVIF file.",
    );
  if (e?.http_code === 420 || e?.http_code === 429)
    return new UploadError(
      503,
      "Cloudinary upload limits have been reached. Check your account usage or try again later.",
    );
  if (
    e?.http_code === 499 ||
    [
      "ETIMEDOUT",
      "ESOCKETTIMEDOUT",
      "ECONNRESET",
      "ENOTFOUND",
      "EAI_AGAIN",
    ].includes(e?.code || "")
  )
    return new UploadError(
      504,
      "The server could not reach Cloudinary. Check its internet connection and try again.",
    );
  return new UploadError(
    502,
    "Cloudinary image upload failed. Check the backend terminal for the provider status code and try again.",
  );
}

export async function uploadToCloudinary(buffer: Buffer) {
  checkUploadConfiguration();
  // Refresh values here so the validation and SDK always use the same settings.
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
    api_key: process.env.CLOUDINARY_API_KEY?.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
    secure: true,
  });
  try {
    const result = await new Promise<import("cloudinary").UploadApiResponse>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "alex-portfolio",
            resource_type: "image",
            allowed_formats: ["jpg", "png", "webp", "avif"],
            unique_filename: true,
            timeout: 60000,
          },
          (error, result) =>
            error
              ? reject(error)
              : result
                ? resolve(result)
                : reject(new Error("Empty upload response")),
        );
        stream.on("error", reject);
        stream.end(buffer);
      },
    );
    return result;
  } catch (error) {
    throw providerUploadError(error);
  }
}
