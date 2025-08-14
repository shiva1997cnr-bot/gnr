import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/profile.css"; // reuse your theme tokens if you want

import {
  isAdminUserDoc,
  fetchAllUsersBasic,
  buildQuizMetaMap,
  REGION_MAP,
} from "../utils/firestoreUtils";

const sortBy = (arr, getKey, dir = "asc") => {
  const mult = dir === "desc" ? -1 : 1;
  return [...arr].sort((a, b) => {
    const ka = getKey(a) ?? "";
    const kb = getKey(b) ?? "";
    return ka > kb ? 1 * mult : ka < kb ? -1 * mult : 0;
  });
};

const toLocal = (ts) => {
  if (!ts) return "—";
  try {
    if (typeof ts?.toDate === "function") return ts.toDate().toLocaleString();
    if (typeof ts?.toMillis === "function") return new Date(ts.toMillis()).toLocaleString();
    if (typeof ts === "number") return new Date(ts).toLocaleString();
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d.toLocaleString();
  } catch {}
  return String(ts);
};

const Drawer = ({ open, onClose, title, children }) => (
  <>
    <div
      className="allscores-drawer-backdrop"
      style={{ display: open ? "block" : "none" }}
      onClick={onClose}
      aria-hidden
    />
    <aside
      className={`allscores-drawer ${open ? "open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={title || "Details"}
    >
      <div className="allscores-drawer-header">
        <h3>{title}</h3>
        <button className="allscores-close" onClick={onClose} aria-label="Close details">
          ✕
        </button>
      </div>
      <div className="allscores-drawer-body">{children}</div>
    </aside>
  </>
);

const AllScores = () => {
  const navigate = useNavigate();

  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [users, setUsers] = useState([]); // [{id, fullName, scores, ...rest}]
  const [quizMeta, setQuizMeta] = useState({}); // quizId -> {id,title,region,launchAt,status}

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeUser, setActiveUser] = useState(null);
  const [activeUserRows, setActiveUserRows] = useState([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Admin gate
  useEffect(() => {
    (async () => {
      try {
        const cu = JSON.parse(localStorage.getItem("currentUser") || "{}");
        const ok = await isAdminUserDoc(cu?.username || cu?.email || cu?.uid, cu);
        setIsAdmin(!!ok);
      } catch (e) {
        console.error(e);
        setIsAdmin(false);
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  // Load users + quiz meta
  useEffect(() => {
    if (!isAdmin || !authChecked) return;
    (async () => {
      try {
        setLoading(true);
        const [uRows, qMeta] = await Promise.all([
          fetchAllUsersBasic(),     // [{ id, fullName, ...data }]
          buildQuizMetaMap(),       // { quizId: { id,title,region,launchAt,status } }
        ]);
        setUsers(uRows);
        setQuizMeta(qMeta);
      } catch (e) {
        console.error(e);
        setErr("Failed to load users or quizzes.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin, authChecked]);

  // Filter + sort
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? users.filter((u) => {
          const name = (u.fullName || "").toLowerCase();
          const id = (u.id || "").toLowerCase();
          return name.includes(q) || id.includes(q);
        })
      : users;

    const sorters = {
      name: (u) => (u.fullName || u.id || "").toLowerCase(),
      username: (u) => (u.id || "").toLowerCase(),
      quizzes: (u) => (u.scores ? Object.keys(u.scores).length : 0),
      last: (u) => {
        const dates = Object.values(u.scores || {}).map((s) => s?.date || "");
        return dates.sort().slice(-1)[0] || "";
      },
    };
    const getKey = sorters[sortCol] || sorters.name;
    return sortBy(base, getKey, sortDir);
  }, [users, search, sortCol, sortDir]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  // Open drawer for user
  const openUser = useCallback(
    async (userRow) => {
      setActiveUser(userRow);
      setDrawerOpen(true);
      setDrawerLoading(true);

      try {
        const scores = userRow?.scores || {};
        const rows = Object.entries(scores).map(([quizId, s]) => {
          const meta = quizMeta[quizId] || {};
          const regionName = s.regionName || s.region || REGION_MAP[s.regionCode] || meta.region || "";
          return {
            quizId,
            title: meta.title || s.title || "Untitled",
            region: regionName,
            launchAt: meta.launchAt || null,
            score: s.score ?? "",
            timeSpent: s.timeSpent ?? "",
            dateOfAttempt: s.dateOfAttempt || "",
            timeOfAttempt: s.timeOfAttempt || "",
          };
        });

        const sorted = [...rows].sort((a, b) => {
          const aSec =
            (a.launchAt?.seconds ?? (typeof a.launchAt?.toMillis === "function" ? a.launchAt.toMillis() / 1000 : 0)) || 0;
          const bSec =
            (b.launchAt?.seconds ?? (typeof b.launchAt?.toMillis === "function" ? b.launchAt.toMillis() / 1000 : 0)) || 0;
          return bSec - aSec;
        });

        setActiveUserRows(sorted);
      } catch (e) {
        console.error(e);
        setActiveUserRows([]);
      } finally {
        setDrawerLoading(false);
      }
    },
    [quizMeta]
  );

  const closeDrawer = () => {
    setDrawerOpen(false);
    setActiveUser(null);
    setActiveUserRows([]);
  };

  // Export CSV (filtered)
  const exportCSV = () => {
    const header = ["Name", "Username", "QuizzesTaken"].join(",");
    const lines = filteredUsers.map((u) => {
      const qcount = u.scores ? Object.keys(u.scores).length : 0;
      return [
        `"${(u.fullName || "").replace(/"/g, '""')}"`,
        `"${(u.id || "").replace(/"/g, '""')}"`,
        qcount,
      ].join(",");
    });
    const blob = new Blob([header + "\n" + lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "all-users.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Guards
  if (!authChecked) {
    return (
      <div className="allscores-page">
        <div className="allscores-topbanner">
          <div className="allscores-topbar-inner">
            <button className="allscores-btn" onClick={() => navigate("/region")}>← Back</button>
            <h1>All Scores</h1>
            <div style={{ width: 1 }} />
          </div>
        </div>
        <div className="allscores-wrap"><p>Checking admin access…</p></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="allscores-page">
        <div className="allscores-topbanner">
          <div className="allscores-topbar-inner">
            <button className="allscores-btn" onClick={() => navigate("/region")}>← Back</button>
            <h1>All Scores</h1>
            <div style={{ width: 1 }} />
          </div>
        </div>
        <div className="allscores-wrap">
          <p style={{ color: "#fff" }}>You don’t have permission to view this page.</p>
          <button className="allscores-btn" onClick={() => navigate("/region")}>Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="allscores-page">
      {/* Top banner with search */}
      <div className="allscores-topbanner">
        <div className="allscores-topbar-inner">
          <button className="allscores-btn" onClick={() => navigate("/region")}>← Back</button>
          <h1>All Scores (Admin)</h1>
          <div className="allscores-search">
            <input
              type="text"
              placeholder="Search user name or username…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="allscores-btn ghost" onClick={() => setSearch("")}>Clear</button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="allscores-wrap">
        {err && <div className="allscores-error">{err}</div>}
        {loading ? (
          <div className="allscores-loading">
            <div className="spinner" />
            <p>Loading users…</p>
          </div>
        ) : (
          <>
            <div className="allscores-toolbar">
              <div className="meta">
                <span>Total users: <strong>{users.length}</strong></span>
                <span>Showing: <strong>{filteredUsers.length}</strong></span>
              </div>
              <div className="actions">
                <button className="allscores-btn" onClick={exportCSV}>Export CSV</button>
              </div>
            </div>

            <div className="allscores-tablewrap">
              <table className="allscores-table">
                <thead>
                  <tr>
                    <th>
                      <button className="th-btn" onClick={() => toggleSort("name")}>
                        Name {sortCol === "name" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th>
                      <button className="th-btn" onClick={() => toggleSort("username")}>
                        Username {sortCol === "username" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th>
                      <button className="th-btn" onClick={() => toggleSort("quizzes")}>
                        Quizzes Taken {sortCol === "quizzes" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th>
                      <button className="th-btn" onClick={() => toggleSort("last")}>
                        Last Attempt {sortCol === "last" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const qcount = u.scores ? Object.keys(u.scores).length : 0;
                    const lastDate = (() => {
                      const dates = Object.values(u.scores || {}).map((s) => s?.date || "");
                      return dates.sort().slice(-1)[0] || "";
                    })();

                    const displayName = u.fullName || u.id;

                    return (
                      <tr key={u.id}>
                        <td>
                          <button className="linklike" onClick={() => openUser(u)} title="View details">
                            {displayName}
                          </button>
                        </td>
                        <td>{u.id}</td>
                        <td>{qcount}</td>
                        <td>{lastDate || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Bottom banner / footer */}
      <div className="allscores-bottombar">
        <p>© {new Date().getFullYear()} Generalist App — All rights reserved.</p>
      </div>

      {/* Slide-over drawer for user details */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={activeUser ? (activeUser.fullName || activeUser.id) : "Details"}
      >
        {drawerLoading ? (
          <div className="allscores-loading">
            <div className="spinner" />
            <p>Loading user performance…</p>
          </div>
        ) : activeUserRows.length === 0 ? (
          <p>No quiz data found for this user.</p>
        ) : (
          <div className="allscores-user-scores">
            <table className="allscores-subtable">
              <thead>
                <tr>
                  <th>Quiz</th>
                  <th>Region</th>
                  <th>Launch</th>
                  <th>Score</th>
                  <th>Time (s)</th>
                  <th>Attempted</th>
                </tr>
              </thead>
              <tbody>
                {activeUserRows.map((r) => (
                  <tr key={`${activeUser?.id}_${r.quizId}`}>
                    <td>{r.title || r.quizId}</td>
                    <td>{r.region || "—"}</td>
                    <td>{toLocal(r.launchAt)}</td>
                    <td>{r.score}</td>
                    <td>{r.timeSpent || "—"}</td>
                    <td>
                      {[
                        r.dateOfAttempt || "",
                        r.timeOfAttempt ? `@ ${r.timeOfAttempt}` : "",
                      ].filter(Boolean).join(" ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default AllScores;
