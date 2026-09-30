import { useEffect, useRef, useState, createContext, useContext } from "react";
import { Link, Routes, Route, useLocation, useParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, X, Sun, Moon } from "lucide-react";
import { api, ApiError } from "./api";
import {
  contactSchema,
  type Portfolio,
  type Project,
  type ImageAsset,
} from "../../shared/contracts";
const Context = createContext<Portfolio | null>(null);
const usePortfolio = () => useContext(Context)!;
export function optimized(asset: ImageAsset, width = 1200) {
  return asset.url.includes("/image/upload/")
    ? asset.url.replace(
        "/image/upload/",
        `/image/upload/f_auto,q_auto:good,w_${width},c_limit/`,
      )
    : asset.url;
}
function Art({
  asset,
  className = "",
  priority = false,
}: {
  asset: ImageAsset | null;
  className?: string;
  priority?: boolean;
}) {
  return asset ? (
    <img
      className={className}
      src={optimized(asset, 1600)}
      srcSet={[400, 800, 1200, 1600]
        .map((w) => `${optimized(asset, w)} ${w}w`)
        .join(",")}
      sizes="(max-width: 700px) 100vw, 70vw"
      width={asset.width}
      height={asset.height}
      alt={asset.alt}
      loading={priority ? "eager" : "lazy"}
    />
  ) : (
    <div className={`art-empty ${className}`}>
      <span>Portrait coming soon</span>
    </div>
  );
}
function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 35 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.7 }}
    >
      {children}
    </motion.div>
  );
}
function Action({ to, children }: { to: string; children: React.ReactNode }) {
  return to.startsWith("/") ? (
    <Link className="action" to={to}>
      {children}
    </Link>
  ) : (
    <a className="action" href={to} rel="noopener noreferrer">
      {children}
    </a>
  );
}
export function Public() {
  const [data, setData] = useState<Portfolio | null>(null);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("portfolio-theme") || "dark";
    } catch {
      return "dark";
    }
  });
  const location = useLocation();
  const dialog = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (data?.hero) document.title = `${data.hero.wordmark} — Design portfolio`;
  }, [data, location.pathname]);
  useEffect(() => {
    api<Portfolio>("/public/portfolio")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("portfolio-theme", theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);
  useEffect(() => {
    if (!menu) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLElement>("a,button")?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        trigger.current?.focus();
      }
      if (e.key === "Tab") {
        const els = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>("a,button") || [],
        );
        const first = els[0],
          last = els.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", handle);
    };
  }, [menu]);
  if (error)
    return (
      <main className="public-state">
        <h1>The studio is temporarily offline.</h1>
        <p>{error}</p>
        <button onClick={() => locationReload()}>Try again</button>
      </main>
    );
  if (!data)
    return (
      <main className="public-state">
        <div className="loading-line" />
        <p>Opening the studio…</p>
      </main>
    );
  if (!data.hero || !data.about || !data.contact)
    return (
      <main className="public-state">
        <h1>A new creative chapter.</h1>
        <p>The portfolio is being prepared.</p>
        <Link to="/admin">Open dashboard</Link>
      </main>
    );
  return (
    <Context.Provider value={data}>
      <div className="portfolio">
        <a className="skip" href="#main">
          Skip to content
        </a>
        <header className="public-header">
          <Link to="/" className="wordmark">
            {data.hero.wordmark}
            <span>®</span>
          </Link>
          <span className="header-note">
            Independent design & art direction
          </span>
          <button
            ref={trigger}
            className="menu-trigger"
            aria-label="Open navigation"
            aria-expanded={menu}
            aria-controls="portfolio-menu"
            onClick={() => setMenu(true)}
          >
            Menu <Menu size={24} />
          </button>
        </header>
        <AnimatePresence>
          {menu && (
            <motion.div
              ref={dialog}
              id="portfolio-menu"
              className="menu-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              initial={{ opacity: 0, y: "-100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "-100%" }}
              transition={{ duration: 0.45 }}
            >
              <div className="menu-top">
                <span>{data.hero.wordmark} / DIRECTORY</span>
                <button
                  aria-label="Close navigation"
                  onClick={() => {
                    setMenu(false);
                    trigger.current?.focus();
                  }}
                >
                  <X />
                </button>
              </div>
              <nav>
                {[
                  ["Home", "/"],
                  ["About", "/about"],
                  ["Work", "/work"],
                  ["Experience", "/experience"],
                  ["Let’s talk", "/contact"],
                ].map(([label, path], i) => (
                  <Link to={path} key={path}>
                    <small>0{i + 1}</small>
                    {label}
                  </Link>
                ))}
              </nav>
              <button
                className="theme-button"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun /> : <Moon />} Switch to{" "}
                {theme === "dark" ? "light" : "dark"} mode
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <main id="main" tabIndex={-1}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <Routes location={location}>
                <Route index element={<Home />} />
                <Route path="about" element={<About />} />
                <Route path="work" element={<Work />} />
                <Route path="work/:id" element={<Detail />} />
                <Route path="experience" element={<Experience />} />
                <Route path="contact" element={<Contact />} />
                <Route
                  path="*"
                  element={
                    <div className="public-state">
                      <h1>Page not found.</h1>
                      <Link to="/">Return home</Link>
                    </div>
                  }
                />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
        <footer>
          <Link to="/" className="wordmark">
            {data.hero.wordmark}
          </Link>
          <span>© {new Date().getFullYear()} · Crafted with purpose</span>
          <div>
            {data.contact.socials.map((s) => (
              <a
                key={s.label}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {s.label}
              </a>
            ))}
            <Link to="/admin">Admin</Link>
          </div>
        </footer>
      </div>
    </Context.Provider>
  );
}
function locationReload() {
  window.location.reload();
}
function Home() {
  const { hero, about, featured, experiences } = usePortfolio();
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const reduced = useReducedMotion();
  return (
    <>
      <section
        className="hero"
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" && !reduced) {
            const r = e.currentTarget.getBoundingClientRect();
            setPointer({
              x: (e.clientX - r.left - r.width / 2) / 40,
              y: (e.clientY - r.top - r.height / 2) / 40,
            });
          }
        }}
        onPointerLeave={() => setPointer({ x: 0, y: 0 })}
      >
        <div className="hero-kicker">ART / BRANDS / PEOPLE / IDEAS</div>
        <div className="hero-copy">
          <Reveal>
            <h1>
              {hero.greeting.split(" ").slice(0, -1).join(" ")}{" "}
              <em>{hero.greeting.split(" ").at(-1)}</em>
            </h1>
            <p className="hero-title">{hero.title}</p>
            <p className="hero-intro">{hero.intro}</p>
            <div className="actions">
              <Action to={hero.primaryDestination}>{hero.primaryLabel}</Action>
              <Action to={hero.secondaryDestination}>
                {hero.secondaryLabel}
              </Action>
            </div>
          </Reveal>
        </div>
        <motion.div
          className="hero-portrait"
          animate={{ x: pointer.x, y: pointer.y }}
          transition={{ type: "spring", stiffness: 90, damping: 20 }}
        >
          <Art asset={hero.portrait} priority />
          <span className="portrait-caption">
            A curious mind.
            <br />A creative practice.
          </span>
        </motion.div>
        <div className="hero-bottom">
          <span>Selected practice / {new Date().getFullYear()}</span>
          <span>Scroll to explore</span>
        </div>
      </section>
      <section className="section work-preview">
        <div className="section-heading">
          <span className="eyebrow">01 / SELECTED WORK</span>
          <h2>
            Ideas made
            <br />
            <em>tangible.</em>
          </h2>
          <Link to="/work" className="text-link">
            Explore all projects
          </Link>
        </div>
        {featured.length ? (
          <div className="editorial-grid">
            {featured.map((p, i) => (
              <ProjectCard key={p.id} project={p} index={i} />
            ))}
          </div>
        ) : (
          <div className="empty-public">
            Selected work will appear here soon.
          </div>
        )}
      </section>
      <section className="about-preview section">
        <Reveal className="about-image">
          <Art asset={about.portrait} />
          <span className="handwritten">
            Creative mind,
            <br />
            always.
          </span>
        </Reveal>
        <Reveal className="about-copy">
          <span className="eyebrow">02 / ABOUT</span>
          <h2>{about.heading}</h2>
          <p>{about.intro}</p>
          <p className="muted">{about.description.slice(0, 350)}</p>
          <Action to="/about">A little about me</Action>
          <Stats />
        </Reveal>
      </section>
      <section className="section">
        <div className="section-heading">
          <span className="eyebrow">03 / THE JOURNEY</span>
          <h2>
            Experience
            <br />
            <em>shapes perspective.</em>
          </h2>
          <Link className="text-link" to="/experience">
            View my experience
          </Link>
        </div>
        <ExperienceList items={experiences.slice(0, 3)} />
      </section>
      <section className="tools-section section">
        <span className="eyebrow">THE EVERYDAY TOOLKIT</span>
        <h2>Craft meets curiosity.</h2>
        <div className="tool-list">
          {about.tools.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div className="skills-list">
          {about.skills.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
      </section>
      <TalkCTA />
    </>
  );
}
function Stats() {
  const { about } = usePortfolio();
  return (
    <div className="stats">
      {about.stats.map((s) => (
        <div key={s.label}>
          <strong>{s.value}</strong>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}
function ProjectCard({
  project: p,
  index,
}: {
  project: Project;
  index: number;
}) {
  const { categories } = usePortfolio();
  const reduced = useReducedMotion();
  return (
    <Reveal className={`project-card project-${index % 3}`}>
      <Link to={`/work/${p.id}`}>
        <motion.div
          className="project-art"
          initial={reduced ? false : { clipPath: "inset(15% 0 15% 0)" }}
          whileInView={{ clipPath: "inset(0% 0 0% 0)" }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <Art asset={p.cover} />
          <span className="project-open">View project</span>
        </motion.div>
        <div className="project-caption">
          <h3>{p.name}</h3>
          <span>
            {categories
              .filter((c) => p.categories.includes(c.id))
              .map((c) => c.name)
              .join(" / ")}{" "}
            · {p.year}
          </span>
        </div>
      </Link>
    </Reveal>
  );
}
function About() {
  const { about } = usePortfolio();
  return (
    <>
      <section className="section page-intro">
        <span className="eyebrow">ABOUT / THE PERSON BEHIND THE PIXELS</span>
        <h1>{about.heading}</h1>
        <p>{about.intro}</p>
      </section>
      <section className="section about-full">
        <Art asset={about.portrait} priority />
        <div>
          <Reveal>
            <p className="large-copy">{about.description}</p>
            <Stats />
            <h3>Design specialties</h3>
            <div className="skills-list">
              {about.specialties.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            <h3>Skills & tools</h3>
            <div className="tool-list">
              {[...about.skills, ...about.tools].map((s, i) => (
                <span key={i}>{s}</span>
              ))}
            </div>
            <div className="socials">
              {about.socials.map((s) => (
                <a
                  href={s.url}
                  key={s.label}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </Reveal>
        </div>
      </section>
      <TalkCTA />
    </>
  );
}
function Work() {
  const { categories } = usePortfolio();
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{
    items: Project[];
    pages: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setResult(null);
    setError("");
    api(
      `/public/projects?page=${page}${category ? `&category=${category}` : ""}`,
    )
      .then((v) => {
        if (active) setResult(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [category, page]);
  return (
    <section className="section">
      <div className="page-intro">
        <span className="eyebrow">SELECTED PROJECTS / VISUAL STORIES</span>
        <h1>
          Work with
          <br />
          <em>something to say.</em>
        </h1>
      </div>
      <div className="filters" aria-label="Filter projects">
        {[{ id: "", name: "All" }, ...categories].map((c) => (
          <button
            key={c.id}
            aria-pressed={category === c.id}
            className={category === c.id ? "active" : ""}
            onClick={() => {
              setCategory(c.id);
              setPage(1);
            }}
          >
            {c.name}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : !result ? (
        <div className="skeleton-art" aria-label="Loading projects" />
      ) : !result.items.length ? (
        <div className="empty-public">No projects in this collection yet.</div>
      ) : (
        <div className="editorial-grid">
          {result.items.map((p, i) => (
            <ProjectCard key={p.id} project={p} index={i} />
          ))}
        </div>
      )}
      {result && result.pages > 1 && (
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            {page} / {result.pages}
          </span>
          <button
            disabled={page === result.pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
function Detail() {
  const { id } = useParams();
  const { categories, hero } = usePortfolio();
  const [p, setP] = useState<Project | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setP(null);
    api<Project>(`/public/projects/${id}`)
      .then((v) => {
        if (active) setP(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(() => {
    if (p) document.title = `${p.name} — ${hero.wordmark}`;
    return () => {
      document.title = `${hero.wordmark} — Design portfolio`;
    };
  }, [p, hero.wordmark]);
  if (error)
    return (
      <div className="public-state">
        <h1>{error}</h1>
        <Link to="/work">Back to work</Link>
      </div>
    );
  if (!p) return <div className="public-state">Opening project…</div>;
  return (
    <>
      <section className="section detail-intro">
        <Link to="/work" className="text-link">
          All projects
        </Link>
        <h1>{p.name}</h1>
        <div className="detail-meta">
          <span>
            {categories
              .filter((c) => p.categories.includes(c.id))
              .map((c) => c.name)
              .join(" / ")}
          </span>
          <span>{p.year}</span>
        </div>
        <p>{p.description}</p>
      </section>
      <Reveal className="detail-cover">
        <Art asset={p.cover} priority />
      </Reveal>
      <section className="section design-gallery">
        {p.designs.map((d, i) => (
          <Reveal key={d.id} className={`design-item design-${i % 3}`}>
            <Art asset={d.image} />
            <div>
              <small>0{i + 1}</small>
              <h2>{d.title}</h2>
              <p>{d.description}</p>
            </div>
          </Reveal>
        ))}
      </section>
      <TalkCTA />
    </>
  );
}
function ExperienceList({ items }: { items: Portfolio["experiences"] }) {
  return items.length ? (
    <div className="experience-list">
      {items.map((e, i) => (
        <Reveal key={e.id} className="experience-row">
          <span className="experience-number">0{i + 1}</span>
          <div>
            <h3>{e.title}</h3>
            <p>
              {e.company}
              {e.location ? ` · ${e.location}` : ""}
            </p>
            <p className="muted">{e.description}</p>
            {e.achievements.length > 0 && (
              <ul>
                {e.achievements.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
          </div>
          <span className="date">
            {new Date(`${e.startDate}T00:00:00`).toLocaleDateString("en", {
              month: "short",
              year: "numeric",
            })}{" "}
            —{" "}
            {e.endDate
              ? new Date(`${e.endDate}T00:00:00`).toLocaleDateString("en", {
                  month: "short",
                  year: "numeric",
                })
              : "Present"}
          </span>
        </Reveal>
      ))}
    </div>
  ) : (
    <p className="empty-public">Experience details coming soon.</p>
  );
}
function Experience() {
  const { experiences } = usePortfolio();
  return (
    <>
      <section className="section">
        <div className="page-intro">
          <span className="eyebrow">EXPERIENCE / EVOLVING THROUGH DESIGN</span>
          <h1>
            The journey
            <br />
            <em>so far.</em>
          </h1>
        </div>
        <ExperienceList items={experiences} />
      </section>
      <TalkCTA />
    </>
  );
}
function TalkCTA() {
  const { contact } = usePortfolio();
  return (
    <Reveal className="talk-cta">
      <span className="eyebrow">HAVE SOMETHING IN MIND?</span>
      <Link to="/contact">
        <h2>
          Let’s make
          <br />
          <em>it happen.</em>
        </h2>
      </Link>
      <p>{contact.description}</p>
      <Action to="/contact">Let’s talk</Action>
    </Reveal>
  );
}
function Contact() {
  const { contact } = usePortfolio();
  const [values, setValues] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
    website: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");
    const parsed = contactSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((i) => [i.path.join("."), i.message]),
        ),
      );
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const r = await api("/contact", "POST", parsed.data);
      setStatus(r.message);
      setValues({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
        website: "",
      });
    } catch (e) {
      setStatus((e as Error).message);
      if (e instanceof ApiError) setErrors(e.errors);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="section contact-page">
      <div className="page-intro">
        <span className="eyebrow">LET’S TALK / YOUR NEXT CHAPTER</span>
        <h1>{contact.heading}</h1>
        <p>{contact.description}</p>
        <a className="contact-email" href={`mailto:${contact.email}`}>
          {contact.email}
        </a>
        <p className="muted">{contact.location}</p>
      </div>
      <form onSubmit={submit} noValidate className="contact-form">
        {(["name", "email", "phone", "subject", "message"] as const).map(
          (k) => (
            <label key={k}>
              {k === "phone"
                ? "Phone (optional)"
                : `${k[0].toUpperCase() + k.slice(1)} *`}
              {k === "message" ? (
                <textarea
                  rows={5}
                  maxLength={5000}
                  value={values[k]}
                  aria-invalid={Boolean(errors[k])}
                  aria-describedby={`${k}-error`}
                  onChange={(e) =>
                    setValues({ ...values, [k]: e.target.value })
                  }
                />
              ) : (
                <input
                  type={
                    k === "email" ? "email" : k === "phone" ? "tel" : "text"
                  }
                  autoComplete={
                    k === "name"
                      ? "name"
                      : k === "email"
                        ? "email"
                        : k === "phone"
                          ? "tel"
                          : "off"
                  }
                  maxLength={k === "phone" ? 40 : k === "subject" ? 200 : 254}
                  value={values[k]}
                  aria-invalid={Boolean(errors[k])}
                  aria-describedby={`${k}-error`}
                  onChange={(e) =>
                    setValues({ ...values, [k]: e.target.value })
                  }
                />
              )}
              <span id={`${k}-error`} className="field-error">
                {errors[k]}
              </span>
            </label>
          ),
        )}
        <label className="honeypot" aria-hidden="true">
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={values.website}
            onChange={(e) => setValues({ ...values, website: e.target.value })}
          />
        </label>
        <button className="action" disabled={busy}>
          {busy ? "Sending…" : "Send message"}
        </button>
        <p role="status">{status}</p>
      </form>
    </section>
  );
}
