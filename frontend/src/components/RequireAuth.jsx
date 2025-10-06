// src/components/RequireAuth.jsx
import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../useDB/useAuth";

export default function RequireAuth() {
  const { user, fetchMe } = useAuth();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchMe();
      if (!cancelled) setChecked(true);
    })();
    return () => { cancelled = true; };
  }, [fetchMe]);

  console.log({ user });

  if (!checked) return <div className="p-8">Checking session…</div>;
  return user? <Outlet/> : <Navigate to="/" replace />;
}
