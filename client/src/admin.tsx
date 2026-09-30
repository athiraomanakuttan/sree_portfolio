import { useEffect, useState } from "react";
import {
  Link,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  LayoutDashboard,
  Image,
  User,
  Layers,
  Tags,
  Briefcase,
  Star,
  Mail,
  KeyRound,
  LogOut,
  Plus,
  Trash2,
  Search,
  Check,
  Menu,
} from "lucide-react";
import { api, ApiError, setCsrf, uploadImage } from "./api";
import {
  schemas,
  passwordSchema,
  LIMITS,
  type ImageAsset,
  type Category,
} from "../../shared/contracts";
import { optimized } from "./public";
const nav = [
  ["", "Overview", LayoutDashboard],
  ["hero", "Hero", Image],
  ["about", "About", User],
  ["projects", "Works", Layers],
  ["categories", "Categories", Tags],
  ["experiences", "Experience", Briefcase],
  ["featured", "Featured works", Star],
  ["contact", "Contact", Mail],
  ["account", "Admin account", KeyRound],
] as const;
type Field = {
  key: string;
  label: string;
  type?:
    | "textarea"
    | "image"
    | "list"
    | "socials"
    | "stats"
    | "number"
    | "date"
    | "checkbox"
    | "categories";
};
const fields: Record<string, Field[]> = {
  hero: [
    { key: "wordmark", label: "Wordmark" },
    { key: "greeting", label: "Greeting" },
    { key: "title", label: "Main title" },
    { key: "intro", label: "Introduction", type: "textarea" },
    { key: "portrait", label: "Portrait", type: "image" },
    { key: "primaryLabel", label: "Primary button label" },
    { key: "primaryDestination", label: "Primary destination" },
    { key: "secondaryLabel", label: "Secondary button label" },
    { key: "secondaryDestination", label: "Secondary destination" },
  ],
  about: [
    { key: "heading", label: "Heading" },
    { key: "intro", label: "Short introduction" },
    { key: "description", label: "About description", type: "textarea" },
    { key: "portrait", label: "Profile image", type: "image" },
    { key: "skills", label: "Skills", type: "list" },
    { key: "tools", label: "Tools / software", type: "list" },
    { key: "specialties", label: "Design specialties", type: "list" },
    { key: "stats", label: "Highlights", type: "stats" },
    { key: "socials", label: "Social links", type: "socials" },
  ],
  contact: [
    { key: "heading", label: "Heading" },
    { key: "description", label: "Introduction", type: "textarea" },
    { key: "email", label: "Public contact email" },
    { key: "location", label: "Location / availability" },
    { key: "socials", label: "Social links", type: "socials" },
  ],
  categories: [{ key: "name", label: "Category name" }],
  projects: [
    { key: "name", label: "Project / client name" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "year", label: "Year", type: "number" },
    { key: "categories", label: "Categories", type: "categories" },
    { key: "cover", label: "Cover image", type: "image" },
    { key: "featured", label: "Featured on homepage", type: "checkbox" },
  ],
  experiences: [
    { key: "title", label: "Job title / position" },
    { key: "company", label: "Company" },
    { key: "startDate", label: "Start date", type: "date" },
    {
      key: "endDate",
      label: "End date (leave blank for current position)",
      type: "date",
    },
    { key: "location", label: "Location" },
    { key: "description", label: "Description", type: "textarea" },
    {
      key: "achievements",
      label: "Responsibilities / achievements",
      type: "list",
    },
  ],
};
const defaults: Record<string, any> = {
  hero: {
    wordmark: "",
    greeting: "",
    title: "",
    intro: "",
    portrait: null,
    primaryLabel: "View my work",
    primaryDestination: "/work",
    secondaryLabel: "Let’s talk",
    secondaryDestination: "/contact",
  },
  about: {
    heading: "",
    intro: "",
    description: "",
    portrait: null,
    skills: [],
    tools: [],
    specialties: [],
    stats: [],
    socials: [],
  },
  contact: {
    heading: "",
    description: "",
    email: "",
    location: "",
    socials: [],
  },
  categories: { name: "" },
  projects: {
    name: "",
    description: "",
    year: new Date().getFullYear(),
    categories: [],
    cover: null,
    designs: [],
    featured: false,
  },
  experiences: {
    title: "",
    company: "",
    startDate: "",
    endDate: "",
    location: "",
    description: "",
    achievements: [],
  },
};
function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    setData(null);
    api<T>(path)
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [path, version]);
  return { data, error, reload: () => setVersion((v) => v + 1) };
}
export function AdminApp() {
  const [auth, setAuth] = useState<{ email: string } | null | undefined>(
    undefined,
  );
  const [sidebar, setSidebar] = useState(false);
  const location = useLocation();
  useEffect(() => {
    api("/auth/me")
      .then((v) => {
        setCsrf(v.csrf);
        setAuth(v);
      })
      .catch(() => setAuth(null));
  }, []);
  useEffect(() => setSidebar(false), [location.pathname]);
  if (auth === undefined)
    return <div className="admin-loading">Opening dashboard…</div>;
  if (!auth)
    return (
      <Auth
        onLogin={(v) => {
          setCsrf(v.csrf);
          setAuth(v);
        }}
      />
    );
  return (
    <div className="admin-shell">
      <aside className={sidebar ? "open" : ""}>
        <Link className="admin-brand" to="/admin">
          <span>A</span>Portfolio studio
        </Link>
        <p className="nav-label">CONTENT MANAGEMENT</p>
        <nav>
          {nav.map(([path, label, Icon]) => (
            <Link
              key={path}
              to={`/admin/${path}`}
              className={
                location.pathname === `/admin/${path}` ||
                (!path && location.pathname === "/admin")
                  ? "selected"
                  : ""
              }
            >
              <Icon size={19} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link to="/" target="_blank">
            View portfolio
          </Link>
          <button
            onClick={async () => {
              await api("/auth/logout", "POST");
              setCsrf("");
              setAuth(null);
            }}
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-header">
          <button
            className="sidebar-toggle"
            aria-label="Toggle dashboard navigation"
            onClick={() => setSidebar(!sidebar)}
          >
            <Menu />
          </button>
          <span>
            Portfolio /{" "}
            <strong>
              {nav.find((n) => location.pathname.endsWith("/" + n[0]))?.[1] ||
                "Overview"}
            </strong>
          </span>
          <span className="admin-user">
            <span className="avatar">A</span>
            {auth.email}
          </span>
        </header>
        <main>
          <Routes>
            <Route index element={<Overview />} />
            {["hero", "about", "contact"].map((k) => (
              <Route
                key={k}
                path={k}
                element={<ContentEditor key={k} kind={k} />}
              />
            ))}
            {["projects", "categories", "experiences", "featured"].map((k) => (
              <Route
                key={k}
                path={k}
                element={<Collection key={k} kind={k} />}
              />
            ))}
            <Route path="account" element={<Account email={auth.email} />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
function Auth({ onLogin }: { onLogin: (v: any) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const reset = location.pathname === "/admin/reset";
  const forgot = location.pathname === "/admin/forgot";
  const [values, setValues] = useState({ email: "", password: "" });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      if (reset) {
        const parsed = passwordSchema.safeParse(values.password);
        if (!parsed.success) throw new Error(parsed.error.issues[0].message);
        const token = new URLSearchParams(location.search).get("token");
        const r = await api("/auth/reset", "POST", {
          token,
          password: values.password,
        });
        setStatus(r.message);
      } else if (forgot) {
        const r = await api("/auth/forgot", "POST", { email: values.email });
        setStatus(r.message);
      } else {
        const r = await api("/auth/login", "POST", values);
        onLogin(r);
        navigate("/admin");
      }
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <Link to="/" className="auth-brand">
        PORTFOLIO / STUDIO
      </Link>
      <form onSubmit={submit}>
        <span className="eyebrow">PRIVATE WORKSPACE</span>
        <h1>
          {reset
            ? "Choose a new password"
            : forgot
              ? "Forgot your password?"
              : "Welcome back."}
        </h1>
        <p>
          {reset
            ? "Your link is valid for 30 minutes."
            : forgot
              ? "Enter your admin email to request a reset link."
              : "Sign in to manage your creative portfolio."}
        </p>
        {!reset && (
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={values.email}
              onChange={(e) => setValues({ ...values, email: e.target.value })}
            />
          </label>
        )}
        {!forgot && (
          <label>
            {reset ? "New password" : "Password"}
            <input
              type="password"
              autoComplete={reset ? "new-password" : "current-password"}
              required
              minLength={reset ? 12 : 1}
              maxLength={128}
              value={values.password}
              onChange={(e) =>
                setValues({ ...values, password: e.target.value })
              }
            />
          </label>
        )}
        {reset && (
          <small>
            At least 12 characters, including uppercase, lowercase and a number.
          </small>
        )}
        <button className="primary" disabled={busy}>
          {busy
            ? "Please wait…"
            : reset
              ? "Reset password"
              : forgot
                ? "Send reset link"
                : "Sign in"}
        </button>
        <p role="status" className="form-status">
          {status}
        </p>
        <Link to={forgot || reset ? "/admin" : "/admin/forgot"}>
          {forgot || reset ? "Back to sign in" : "Forgot password?"}
        </Link>
      </form>
      <p className="auth-footer">Your work. Your story. One place.</p>
    </div>
  );
}
function Overview() {
  const { data, error } = useLoad<any>("/admin/overview");
  return (
    <>
      <PageHeading
        title="Your creative space."
        subtitle="A quick look at your portfolio and the content behind it."
        action={
          <Link className="primary" to="/admin/projects">
            Manage works
          </Link>
        }
      />
      {error && <Notice text={error} />}
      <div className="overview-stats">
        {[
          ["Projects", data?.projects, Layers, "projects"],
          ["Featured works", data?.featured, Star, "featured"],
          ["Categories", data?.categories, Tags, "categories"],
          ["Experience entries", data?.experiences, Briefcase, "experiences"],
        ].map(([label, count, Icon, path]: any) => (
          <Link className="stat-card" key={label} to={`/admin/${path}`}>
            <Icon size={22} />
            <span>{label}</span>
            <strong>{count ?? "—"}</strong>
            <small>Manage content</small>
          </Link>
        ))}
      </div>
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Make it yours</h2>
            <span>QUICK EDITS</span>
          </div>
          <div className="quick-edits">
            {[
              [
                "hero",
                "Your first impression",
                "Edit greeting, portrait and hero buttons",
              ],
              [
                "about",
                "The story behind the work",
                "Update your bio, skills and tools",
              ],
              [
                "contact",
                "Keep the conversation open",
                "Edit contact copy and public links",
              ],
            ].map(([path, title, description]) => (
              <Link key={path} to={`/admin/${path}`}>
                <span className="quick-icon">
                  {path === "hero" ? (
                    <Image />
                  ) : path === "about" ? (
                    <User />
                  ) : (
                    <Mail />
                  )}
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                <span>Edit</span>
              </Link>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>Portfolio checklist</h2>
          <p className="muted">Keep your best work ready for the world.</p>
          {[
            ["Projects added", (data?.projects || 0) > 0],
            ["Featured collection selected", (data?.featured || 0) > 0],
            ["Database connected", data?.services.database],
            ["Image uploads configured", data?.services.images],
            ["Email delivery configured", data?.services.email],
          ].map(([label, ok]) => (
            <div className="checklist" key={String(label)}>
              <span className={ok ? "check-ok" : "check-pending"}>
                {ok ? <Check size={14} /> : ""}
              </span>
              {label}
            </div>
          ))}
          <Link className="secondary" to="/" target="_blank">
            Preview portfolio
          </Link>
        </section>
      </div>
      <section className="dashboard-tip">
        <span>STUDIO NOTE</span>
        <p>
          Rearranging content creates a draft order. Click{" "}
          <strong>Save Order</strong> to publish it to your portfolio.
        </p>
      </section>
    </>
  );
}
function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="admin-page-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
function Notice({ text }: { text: string }) {
  return (
    <div className="notice" role="status">
      {text}
    </div>
  );
}
function ContentEditor({ kind }: { kind: string }) {
  const { data, error, reload } = useLoad<any>(`/admin/content/${kind}`);
  const [draft, setDraft] = useState<any>(null);
  const [status, setStatus] = useState("");
  useEffect(() => {
    setDraft(data || defaults[kind]);
  }, [data, kind]);
  return (
    <>
      <PageHeading
        title={`${kind[0].toUpperCase() + kind.slice(1)} content`}
        subtitle={
          kind === "contact"
            ? "The receiving email is configured securely on the server. This email is shown publicly."
            : "Changes appear on your public portfolio after saving."
        }
      />
      {error && <Notice text={error} />}
      <div className="panel editor-panel">
        {draft && (
          <Editor
            kind={kind}
            initial={draft}
            onSave={async (v) => {
              await api(`/admin/content/${kind}`, "PUT", v);
              setStatus("Content saved");
              reload();
            }}
          />
        )}
      </div>
      {status && <Notice text={status} />}
    </>
  );
}
function SortableRow({
  item,
  children,
}: {
  item: any;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      className={`sortable-row ${isDragging ? "dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type="button"
        className="drag-handle"
        aria-label={`Reorder ${item.name || item.title || "design"}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={20} />
      </button>
      {children}
    </div>
  );
}
function SortList({
  items,
  onChange,
  render,
}: {
  items: any[];
  onChange: (v: any[]) => void;
  render: (v: any, i: number) => React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  function end(e: DragEndEvent) {
    if (e.over && e.active.id !== e.over.id) {
      onChange(
        arrayMove(
          items,
          items.findIndex((v) => v.id === e.active.id),
          items.findIndex((v) => v.id === e.over!.id),
        ),
      );
    }
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={end}
    >
      <SortableContext
        items={items.map((v) => v.id)}
        strategy={verticalListSortingStrategy}
      >
        {items.map((v, i) => (
          <SortableRow key={v.id} item={v}>
            {render(v, i)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  );
}
function Collection({ kind }: { kind: string }) {
  const { data, error, reload } = useLoad<any[]>(`/admin/${kind}`);
  const [items, setItems] = useState<any[]>([]);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setItems(data || []);
    setDirty(false);
  }, [data]);
  const name =
    kind === "projects"
      ? "Works"
      : kind === "featured"
        ? "Featured works"
        : kind === "experiences"
          ? "Experience"
          : "Categories";
  async function saveOrder() {
    setBusy(true);
    try {
      const r = await api(`/admin/${kind}/order`, "PUT", {
        ids: items.map((v) => v.id),
      });
      setStatus(r.message);
      setDirty(false);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(v: any) {
    if (
      !window.confirm(`Delete “${v.name || v.title}”? This cannot be undone.`)
    )
      return;
    try {
      await api(`/admin/${kind}/${v.id}`, "DELETE");
      reload();
      setStatus("Deleted");
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  return (
    <>
      <PageHeading
        title={name}
        subtitle={
          kind === "featured"
            ? "Homepage selection. This order is independent from the Work listing."
            : "Drag using the handle, then save your order. Keyboard: Space to lift, arrows to move, Space to drop."
        }
        action={
          <div className="toolbar">
            <button
              className="secondary"
              disabled={!dirty || busy || Boolean(search)}
              onClick={saveOrder}
            >
              {busy ? "Saving…" : "Save Order"}
            </button>
            {kind !== "featured" && (
              <button
                className="primary"
                onClick={() => setEditing(structuredClone(defaults[kind]))}
              >
                <Plus size={17} /> Add{" "}
                {kind === "projects"
                  ? "project"
                  : kind === "experiences"
                    ? "experience"
                    : "category"}
              </button>
            )}
          </div>
        }
      />
      {error && <Notice text={error} />}
      <div className="panel collection-panel">
        <div className="collection-top">
          <h2>
            {items.length} {name.toLowerCase()}
          </h2>
          <label className="search">
            <Search size={17} />
            <input
              placeholder="Search content"
              aria-label="Search content"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {dirty && (
          <Notice text="Order changed. Click Save Order to publish your arrangement." />
        )}
        {search ? (
          <div>
            {items
              .filter((v) =>
                `${v.name || v.title} ${(v.designs || []).map((d: any) => d.title).join(" ")}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((v) => (
                <div className="sortable-row" key={v.id}>
                  {row(v)}
                </div>
              ))}
          </div>
        ) : (
          <SortList
            items={items}
            onChange={(v) => {
              setItems(v);
              setDirty(true);
            }}
            render={row}
          />
        )}{" "}
        {!items.length && (
          <div className="admin-empty">
            <Layers size={35} />
            <h3>{data ? "Nothing here yet." : "Loading…"}</h3>
            <p>
              {kind === "featured"
                ? "Mark a project as Featured in Works to add it here."
                : "Add your first item to get started."}
            </p>
            {kind === "featured" && (
              <Link to="/admin/projects">Manage works</Link>
            )}
          </div>
        )}
      </div>
      {status && <Notice text={status} />}{" "}
      {editing && (
        <div className="editor-screen">
          <div className="editor-dialog">
            <PageHeading
              title={editing.id ? "Edit content" : "Add content"}
              subtitle="All required fields are validated before saving."
              action={
                <button
                  className="secondary"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Close this editor and discard unsaved changes?",
                      )
                    )
                      setEditing(null);
                  }}
                >
                  Close editor
                </button>
              }
            />
            <Editor
              kind={kind}
              initial={editing}
              onSave={async (v) => {
                await api(
                  `/admin/${kind}${editing.id ? "/" + editing.id : ""}`,
                  editing.id ? "PUT" : "POST",
                  v,
                );
                setEditing(null);
                reload();
                setStatus("Saved");
              }}
            />
          </div>
        </div>
      )}
    </>
  );
  function row(v: any) {
    return (
      <>
        <div className="row-main">
          {v.cover && <img src={optimized(v.cover, 200)} alt="" />}
          <div>
            <h3>{v.name || v.title}</h3>
            <p>
              {kind === "projects" || kind === "featured"
                ? `${v.year} · ${v.designs?.length || 0} designs${v.featured ? " · Featured" : ""}`
                : kind === "experiences"
                  ? v.company
                  : "Portfolio filter"}
            </p>
          </div>
        </div>
        <div className="row-actions">
          {kind === "featured" ? (
            <Link to="/admin/projects">Edit in Works</Link>
          ) : (
            <>
              <button
                className="secondary"
                onClick={() => setEditing(structuredClone(v))}
              >
                Edit
              </button>
              <button
                className="danger icon-button"
                aria-label={`Delete ${v.name || v.title}`}
                onClick={() => remove(v)}
              >
                <Trash2 size={18} />
              </button>
            </>
          )}
        </div>
      </>
    );
  }
}
function Editor({
  kind,
  initial,
  onSave,
}: {
  kind: string;
  initial: any;
  onSave: (v: any) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [designDirty, setDesignDirty] = useState(false);
  const [savedDesignIds, setSavedDesignIds] = useState<string[] | null>(null);
  const { data: categories } = useLoad<Category[]>("/admin/categories");
  useEffect(() => {
    setV(initial);
    setErrors({});
  }, [initial]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (designDirty) {
      setStatus("Click Save Design Order before saving the project.");
      return;
    }
    const parsed = schemas[kind as keyof typeof schemas].safeParse(v);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((i) => [i.path.join("."), i.message]),
        ),
      );
      setStatus("Check the highlighted fields");
      return;
    }
    setErrors({});
    setBusy(true);
    setStatus("");
    try {
      await onSave(parsed.data);
    } catch (e) {
      setStatus((e as Error).message);
      if (e instanceof ApiError) setErrors(e.errors);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} noValidate className="admin-form">
      <div className="field-grid">
        {fields[kind].map((f) => (
          <FieldInput
            key={f.key}
            field={f}
            value={v[f.key]}
            error={errors[f.key]}
            onChange={(val) => setV({ ...v, [f.key]: val })}
            categories={categories || []}
            errors={errors}
          />
        ))}
      </div>
      {kind === "projects" && (
        <section className="design-editor">
          <div className="panel-heading">
            <div>
              <h2>Project designs</h2>
              <p>Each project holds its own collection of artwork.</p>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                setV({
                  ...v,
                  designs: [
                    ...v.designs,
                    {
                      id: newObjectId(),
                      title: "",
                      description: "",
                      image: null,
                    },
                  ],
                })
              }
            >
              <Plus size={17} />
              Add design
            </button>
          </div>
          <SortList
            items={v.designs}
            onChange={(items) => {
              setV({ ...v, designs: items });
              setDesignDirty(true);
              setSavedDesignIds(null);
            }}
            render={(d, i) => (
              <div className="design-fields">
                <div className="panel-heading">
                  <h3>Design {i + 1}</h3>
                  <button
                    className="danger icon-button"
                    type="button"
                    aria-label="Delete design"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Remove this design? Changes take effect when you save the project.",
                        )
                      )
                        setV({
                          ...v,
                          designs: v.designs.filter((x: any) => x.id !== d.id),
                        });
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                {[
                  { key: "title", label: "Title" },
                  {
                    key: "description",
                    label: "Description",
                    type: "textarea",
                  },
                  { key: "image", label: "Design image", type: "image" },
                ].map((f) => (
                  <FieldInput
                    key={f.key}
                    field={f as Field}
                    value={d[f.key]}
                    error={errors[`designs.${i}.${f.key}`]}
                    onChange={(val) =>
                      setV({
                        ...v,
                        designs: v.designs.map((x: any) =>
                          x.id === d.id ? { ...x, [f.key]: val } : x,
                        ),
                      })
                    }
                  />
                ))}
              </div>
            )}
          />
          {v.designs.length > 0 && (
            <div className="design-order-save">
              <button
                type="button"
                className="secondary"
                disabled={!designDirty}
                onClick={() => {
                  setSavedDesignIds(v.designs.map((d: any) => d.id));
                  setDesignDirty(false);
                  setStatus(
                    "Design order confirmed. Save project to persist it with your edits.",
                  );
                }}
              >
                Save Design Order
              </button>
              <span>
                {designDirty
                  ? "Unsaved design order"
                  : savedDesignIds
                    ? "Order confirmed; save the project to apply."
                    : ""}
              </span>
            </div>
          )}
        </section>
      )}
      <div className="form-actions">
        <button className="primary" disabled={busy}>
          {busy
            ? "Saving…"
            : kind === "projects"
              ? "Save project"
              : "Save changes"}
        </button>
        <p role="status">{status}</p>
      </div>
    </form>
  );
}
function newObjectId() {
  return [...crypto.getRandomValues(new Uint8Array(12))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
function FieldInput({
  field: f,
  value,
  onChange,
  error,
  categories = [],
  errors = {},
}: {
  field: Field;
  value: any;
  onChange: (v: any) => void;
  error?: string;
  categories?: Category[];
  errors?: Record<string, string>;
}) {
  const controlId = `field-${f.key}`;
  if (f.type === "image")
    return (
      <div className="field full">
        <span className="field-label">{f.label}</span>
        <ImageInput value={value} onChange={onChange} />
        <span className="field-error">
          {error ||
            (Object.keys(errors).some((k) => k.startsWith(f.key + "."))
              ? "Check the image and its alt text"
              : "")}
        </span>
      </div>
    );
  if (f.type === "list" || f.type === "socials" || f.type === "stats") {
    const object = f.type !== "list";
    const keys = f.type === "socials" ? ["label", "url"] : ["value", "label"];
    return (
      <fieldset className="field full repeat-fields">
        <legend>{f.label}</legend>
        {(value || []).map((item: any, i: number) => (
          <div className="repeat-row" key={i}>
            {object ? (
              keys.map((k) => (
                <label key={k}>
                  <span className="sr-only">{k}</span>
                  <input
                    placeholder={
                      k === "url"
                        ? "https://…"
                        : k[0].toUpperCase() + k.slice(1)
                    }
                    value={item[k]}
                    maxLength={k === "url" ? 2000 : 160}
                    aria-label={`${f.label} ${i + 1} ${k}`}
                    onChange={(e) =>
                      onChange(
                        value.map((x: any, n: number) =>
                          n === i ? { ...x, [k]: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <span className="field-error">
                    {errors[`${f.key}.${i}.${k}`]}
                  </span>
                </label>
              ))
            ) : (
              <label>
                <span className="sr-only">
                  {f.label} {i + 1}
                </span>
                <input
                  value={item}
                  maxLength={500}
                  onChange={(e) =>
                    onChange(
                      value.map((x: any, n: number) =>
                        n === i ? e.target.value : x,
                      ),
                    )
                  }
                />
                <span className="field-error">{errors[`${f.key}.${i}`]}</span>
              </label>
            )}
            <button
              type="button"
              className="danger icon-button"
              aria-label="Remove item"
              onClick={() =>
                onChange(value.filter((_: any, n: number) => n !== i))
              }
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          onClick={() =>
            onChange([
              ...(value || []),
              object ? Object.fromEntries(keys.map((k) => [k, ""])) : "",
            ])
          }
        >
          <Plus size={16} />
          Add item
        </button>
        <span className="field-error">{error}</span>
      </fieldset>
    );
  }
  if (f.type === "categories")
    return (
      <fieldset className="field full">
        <legend>{f.label} *</legend>
        <div className="category-options">
          {categories.map((c) => (
            <label key={c.id}>
              <input
                type="checkbox"
                checked={(value || []).includes(c.id)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...value, c.id]
                      : value.filter((v: string) => v !== c.id),
                  )
                }
              />
              {c.name}
            </label>
          ))}
        </div>
        {!categories.length && <p>Create a category before adding projects.</p>}
        <span className="field-error">{error}</span>
      </fieldset>
    );
  return (
    <label
      className={`field ${f.type === "textarea" ? "full" : ""} ${f.type === "checkbox" ? "checkbox-field" : ""}`}
      htmlFor={controlId}
    >
      {f.type === "checkbox" ? (
        <>
          <input
            id={controlId}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          {f.label}
        </>
      ) : (
        <>
          <span>{f.label}</span>
          {f.type === "textarea" ? (
            <textarea
              id={controlId}
              rows={4}
              maxLength={LIMITS.longText}
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              aria-invalid={Boolean(error)}
            />
          ) : (
            <input
              id={controlId}
              type={f.type || "text"}
              maxLength={2000}
              value={value ?? ""}
              onChange={(e) =>
                onChange(
                  f.type === "number" ? Number(e.target.value) : e.target.value,
                )
              }
              aria-invalid={Boolean(error)}
            />
          )}
        </>
      )}
      <span className="field-error">{error}</span>
    </label>
  );
}
function ImageInput({
  value,
  onChange,
}: {
  value: ImageAsset | null;
  onChange: (v: ImageAsset | null) => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [library, setLibrary] = useState<any[] | null>(null);
  async function upload(file?: File) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
        file.type,
      ) ||
      file.size > LIMITS.imageBytes
    ) {
      setError("Choose a JPEG, PNG, WebP or AVIF up to 10 MB.");
      return;
    }
    setProgress(0);
    setError("");
    try {
      const bitmap = await createImageBitmap(file);
      const valid =
        Math.min(bitmap.width, bitmap.height) >= LIMITS.minDimension &&
        Math.max(bitmap.width, bitmap.height) <= LIMITS.maxDimension;
      bitmap.close();
      if (!valid)
        throw new Error(
          "Image dimensions must be between 200 and 12,000 pixels.",
        );
      const img = await uploadImage(file, value?.alt || file.name, setProgress);
      onChange(img);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  }
  return (
    <div className="image-input">
      {value && <img src={optimized(value, 400)} alt={value.alt} />}
      <div className="image-controls">
        <label className="secondary upload-button">
          {progress !== null
            ? `Uploading ${progress}%`
            : "Upload / replace image"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            disabled={progress !== null}
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </label>
        <button
          type="button"
          className="secondary"
          onClick={async () => {
            try {
              setLibrary(await api("/admin/assets"));
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Choose uploaded image
        </button>
        {value && (
          <>
            <label>
              Alternative text
              <input
                value={value.alt}
                maxLength={300}
                onChange={(e) => onChange({ ...value, alt: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="text-button"
              onClick={() => onChange(null)}
            >
              Remove from this field
            </button>
          </>
        )}
        <small>JPEG, PNG, WebP, AVIF · Max 10 MB · 200–12,000 px</small>
        {progress !== null && <progress value={progress} max={100} />}
        <span className="field-error">{error}</span>
      </div>
      {library && (
        <div className="asset-library">
          <div className="panel-heading">
            <h3>Uploaded images</h3>
            <button type="button" onClick={() => setLibrary(null)}>
              Close
            </button>
          </div>
          <p>
            Unused uploads can be deleted here. Images currently used in content
            are protected.
          </p>
          <div className="asset-grid">
            {library.map((a) => (
              <div key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange({
                      url: a.url,
                      publicId: a.publicId,
                      width: a.width,
                      height: a.height,
                      alt: a.alt,
                    });
                    setLibrary(null);
                  }}
                >
                  <img src={optimized(a, 200)} alt={a.alt} />
                  <span>Choose</span>
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={async () => {
                    if (
                      !window.confirm("Delete this uploaded image permanently?")
                    )
                      return;
                    try {
                      await api(`/admin/assets/${a.id}`, "DELETE");
                      setLibrary(library.filter((x) => x.id !== a.id));
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Delete image
                </button>
              </div>
            ))}
          </div>
          {!library.length && <p>No uploaded images yet.</p>}
        </div>
      )}
    </div>
  );
}
function Account({ email }: { email: string }) {
  const [v, setV] = useState({
    currentPassword: "",
    password: "",
    confirm: "",
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");
    const parsed = passwordSchema.safeParse(v.password);
    if (!parsed.success) {
      setStatus(parsed.error.issues[0].message);
      return;
    }
    if (v.password !== v.confirm) {
      setStatus("New passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const r = await api("/admin/password", "POST", {
        currentPassword: v.currentPassword,
        password: v.password,
      });
      setStatus(r.message);
      setV({ currentPassword: "", password: "", confirm: "" });
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Admin account"
        subtitle="Keep your portfolio workspace secure."
      />
      <section className="panel account-panel">
        <h2>Change password</h2>
        <p>Signed in as {email}</p>
        <form className="admin-form" onSubmit={submit}>
          {[
            ["currentPassword", "Current password"],
            ["password", "New password"],
            ["confirm", "Confirm new password"],
          ].map(([k, label]) => (
            <label key={k}>
              {label}
              <input
                type="password"
                autoComplete={
                  k === "currentPassword" ? "current-password" : "new-password"
                }
                required
                maxLength={128}
                value={v[k as keyof typeof v]}
                onChange={(e) => setV({ ...v, [k]: e.target.value })}
              />
            </label>
          ))}
          <p className="muted">
            Use at least 12 characters, including uppercase, lowercase and a
            number.
          </p>
          <button className="primary" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </button>
          <p role="status">{status}</p>
        </form>
      </section>
    </>
  );
}
