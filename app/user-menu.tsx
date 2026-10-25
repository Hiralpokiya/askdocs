"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";

export default function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!session?.user) return null;
  const user = session.user as typeof session.user & { username?: string };
  const name = user.name ?? user.username ?? "Account";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-slate-100"
      >
        {user.image ? (
          <Image src={user.image} alt="" width={32} height={32} className="rounded-full" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-slate-200" />
        )}
        <span className="text-sm font-medium text-slate-800">{name}</span>
        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-64 rounded-xl border bg-white p-2 shadow-lg"
        >
          <div className="flex items-center gap-3 px-2 py-2">
            {user.image && (
              <Image src={user.image} alt="" width={40} height={40} className="rounded-full" />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-900">{name}</div>
              {user.username && (
                <div className="truncate text-xs text-slate-500">@{user.username}</div>
              )}
            </div>
          </div>

          <div className="my-1 border-t" />

          {user.username && (
            <a
              role="menuitem"
              href={`https://github.com/${user.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              View GitHub profile
            </a>
          )}
          <button
            role="menuitem"
            onClick={() => signOut()}
            className="w-full rounded-lg px-2 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
