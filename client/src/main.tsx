import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { Public } from "./public";
const AdminApp = lazy(() =>
  import("./admin").then((m) => ({ default: m.AdminApp })),
);
import "./style.css";
class Boundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>Something went wrong.</h1>
        <p>Please reload the page to continue.</p>
        <button onClick={() => location.reload()}>Reload</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Boundary>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <Routes>
            <Route
              path="/admin/*"
              element={
                <Suspense
                  fallback={
                    <div className="admin-loading">Opening dashboard…</div>
                  }
                >
                  <AdminApp />
                </Suspense>
              }
            />
            <Route path="/*" element={<Public />} />
          </Routes>
        </BrowserRouter>
      </MotionConfig>
    </Boundary>
  </React.StrictMode>,
);
