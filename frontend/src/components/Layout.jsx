/**
 * components/Layout.jsx
 *
 * Shell layout for all authenticated pages.
 * Renders <Navbar> at the top and the page content below.
 */

import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#0f1117]">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
