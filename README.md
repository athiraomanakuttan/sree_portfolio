# Alex — graphic designer portfolio

React + TypeScript, Express + TypeScript, MongoDB, Cloudinary, SMTP, Framer Motion and keyboard-accessible drag-and-drop. All public portfolio content comes from the database and is editable through the admin dashboard. The interface follows the approved editorial direction: oversized serif typography, cream and dark identities, orange accents, asymmetry, layered portrait placement and artwork-first layouts.

## Run locally

Requirements: Node.js 22.12+ (24 recommended), npm, MongoDB 7+ or Atlas, Cloudinary and an SMTP provider.

```bash
npm ci
cp .env.example .env
# Configure .env before continuing
npm run seed
npm run dev
```

Portfolio: http://localhost:5173
Admin: http://localhost:5173/admin
API: http://localhost:4000/api

Vite proxies `/api` to Express, keeping cookie authentication same-origin. The first server startup creates one admin from `ADMIN_EMAIL` and `ADMIN_PASSWORD`, hashing the password. There is no registration endpoint. Changing these variables later does not overwrite that account; use Change Password or Forgot Password.

The optional seed creates editable starter copy, never fake projects, client statistics or artwork. Existing copy is preserved. Upload your portrait and real work through the dashboard. Empty galleries remain honest empty states. You may skip seeding and enter Hero, About and Contact through the admin; the public site shows a preparation notice until these are filled.

## Configuration

| Variable                                                           | Purpose                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| MONGODB_URI                                                        | MongoDB connection for content, orders, credentials and sessions               |
| SESSION_SECRET                                                     | At least 32 random characters                                                  |
| ADMIN_EMAIL                                                        | Initial single admin email                                                     |
| ADMIN_PASSWORD                                                     | Initial password, 12+ characters with uppercase, lowercase and a number        |
| APP_URL                                                            | Exact public origin, no trailing slash; local default is http://localhost:5173 |
| CONTACT_EMAIL                                                      | Server-only receiving email for enquiries                                      |
| SMTP_HOST / SMTP_PORT / SMTP_SECURE                                | Use 587/false for STARTTLS or 465/true for implicit TLS                        |
| SMTP_USER / SMTP_PASSWORD                                          | Provider credentials                                                           |
| MAIL_FROM                                                          | Verified sender accepted by your email provider                                |
| CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET | Server-side Cloudinary upload configuration                                    |
| NODE_ENV                                                           | production for deployment                                                      |
| PORT                                                               | Server port; defaults to 4000                                                  |
| TRUST_PROXY                                                        | Trusted proxy hop count; use 1 only behind exactly one trusted reverse proxy   |

Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. For Atlas, use a least-privilege database user and allow your server IP; encode special characters in connection credentials. Never commit `.env`.

Cloudinary uploads are authenticated server operations. Public images use responsive `f_auto,q_auto:good,c_limit` transformations and retain the original uploaded asset. Only still JPEG, PNG, WebP and AVIF files up to 10 MB and 200–12,000 pixels are accepted. Sharp checks decoded image dimensions and format; MIME labels alone are not trusted. Upload progress, replacement, previews and alternative text are supported. Use the uploaded-image picker to reuse images or delete abandoned uploads. Images still referenced by saved content cannot be deleted. Replaced/deleted assets are cleaned up after content changes; failed provider cleanup leaves assets available for later retry through the picker.

Contact messages go directly to `CONTACT_EMAIL`, with the visitor email as Reply-To. The dashboard's displayed contact address does not change the receiving email. There is no enquiry inbox. Missing email configuration produces a clear contact error rather than a false success. Password reset links go to the stored admin email, expire after 30 minutes, are single use and invalidate all existing sessions. Forgot-password requests always show the same response to prevent revealing whether an account exists.

## Content and ordering

- Hero: greeting, title, portrait, introduction and two editable CTA labels/destinations.
- About: profile, biography, skills, tools, specialties, statistics and social links.
- Works: project/client collections with a required cover, year, categories and individually editable designs. Search includes design titles.
- Categories: All is fixed; other categories can be created, edited and reordered. Reassign projects before deleting a category used by them.
- Experience: entries with validated dates, descriptions and achievements; a blank end date means Present.
- Featured works: mark projects in Works, then arrange the homepage separately.
- Contact: public copy, displayed email, location and social links.
- Admin account: password change and logout.

Drag handles support mouse, touch and keyboard: Space to lift, arrows to move, Space to drop. Save Order is always explicit. Searching temporarily disables sorting. Project, featured, category, experience and design orders remain independent.

Inside a project editor, Save Design Order confirms the draft arrangement; Save Project persists it together with your edits. This prevents creating invalid partial projects while ordering newly added designs. A dedicated protected design-order API also supports independent updates for existing projects.

Public routes: `/`, `/about`, `/work`, `/work/:id`, `/experience`, `/contact`.
Admin routes: `/admin`, `/admin/hero`, `/admin/about`, `/admin/projects`, `/admin/categories`, `/admin/experiences`, `/admin/featured`, `/admin/contact`, `/admin/account`.
Recovery routes: `/admin/forgot`, `/admin/reset?token=…`.

The public menu is a hamburger at every breakpoint, traps keyboard focus and closes on Escape. Manual theme choice persists locally without OS theme detection. Page transitions, scroll reveals, image masks, pointer-responsive portrait motion and hover effects respect reduced-motion preferences. Forms use labels, field-level errors and visible focus indicators. Galleries adapt to touch and mobile layouts.

## Verify and deploy

```bash
npm run typecheck
npm test
npm run build
NODE_ENV=production npm start
```

The build creates `dist/` and `build/`. Express serves the API and client from the same origin; run the process from this project root. Deploy to a Node hosting service or VPS, configure HTTPS, environment variables and your trusted reverse proxy. Use a process manager to run `npm start`. Keep MongoDB private and back up the database.

A static-only host or Cloudflare Workers cannot run this complete stack. The app requires Node/Express, MongoDB connectivity and Sharp. No live deployment is bundled; database and provider credentials must be configured on your host.

Tests use isolated temporary MongoDB. The harness may download a MongoDB binary on first run. It verifies authentication, CSRF, validation, CRUD, filtering, independent orders, design ordering, in-use image/category protections, password reset single use, session invalidation, and the missing-email error path. Real Cloudinary uploads and real SMTP deliveries require configured accounts and must be checked after setup. Browser visual QA was not performed in this environment.

## Architecture

```text
client/src/           Public routes, admin editors, API client, responsive styles
server/src/           Express API, MongoDB models, upload/mail services, seed, tests
shared/contracts.ts  Shared typed Zod schemas and centralized limits
.env.example         Environment template
```

Admin mutation routes require a MongoDB-backed HttpOnly session, CSRF token and permitted origin. Passwords use bcrypt hashing; resets store only hashed tokens. Auth and contact endpoints are rate limited. Input lengths, dates, category references, duplicate associations and uploads are validated server-side and client-side. Public project lists are paginated and omit design galleries; detail pages fetch the full project. Secrets never enter the frontend bundle. Dashboard code is lazy-loaded separately from public pages.

## Troubleshooting image uploads

If `/api/admin/upload` fails, read the response and the Express terminal output. The upload handler validates all three Cloudinary variables and returns actionable errors for configuration, credentials, unsupported images, account limits and network failures. Place `.env` next to `package.json` and restart the backend after changing it. The cloud name, API key and API secret must belong to the same Cloudinary account. Never put these credentials in `client/` or prefix the secret with `VITE_`.

For a source update, replace `server/src/app.ts` and add `server/src/uploads.ts` from the updated package, then restart `npm run dev`. Keep your existing `.env`. Production deployments must run `npm run build` again before restarting the server. Provider status codes are logged without credentials; a successful real upload still requires your Cloudinary configuration.
