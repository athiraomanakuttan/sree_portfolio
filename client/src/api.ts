export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors: Record<string, string> = {},
  ) {
    super(message);
  }
}
let csrf = "";
export function setCsrf(v: string) {
  csrf = v;
}
export async function api<T = any>(
  url: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const res = await fetch(`/api${url}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await res
    .json()
    .catch(() => ({ message: "The server is unavailable" }));
  if (!res.ok)
    throw new ApiError(
      result.message || "Request failed",
      res.status,
      result.errors,
    );
  return result;
}
export function uploadImage(
  file: File,
  alt: string,
  onProgress: (n: number) => void,
) {
  return new Promise<any>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/upload");
    xhr.withCredentials = true;
    xhr.setRequestHeader("X-CSRF-Token", csrf);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        return reject(new Error("Upload failed"));
      }
      xhr.status < 300
        ? resolve(data)
        : reject(new Error(data.message || "Upload failed"));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    const form = new FormData();
    form.append("image", file);
    form.append("alt", alt);
    xhr.send(form);
  });
}
