import { useEffect } from "react";
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { StoreProvider, useStore } from "@/lib/store";
import { SupabaseSync } from "@/lib/sync";
import { ToastHost } from "@/components/ui";
import Home from "@/pages/Home";
import { SignIn, SignUp, Join, ResetPassword } from "@/pages/Auth";
import { TeamSelect, TeamCreate } from "@/pages/Teams";
import WorkspaceLayout, { InviteModal } from "@/pages/workspace/Layout";
import Chat from "@/pages/workspace/Chat";
import Dm from "@/pages/workspace/Dm";
import Files from "@/pages/workspace/Files";
import Roadmap from "@/pages/workspace/Roadmap";
import Tasks from "@/pages/workspace/Tasks";
import Mentor from "@/pages/workspace/Mentor";
import Timer, { FloatingTimer } from "@/pages/workspace/Timer";
import Settings from "@/pages/workspace/Settings";
import NotFound from "@/pages/NotFound";

/* auth guard — waits for Supabase session restore before redirecting */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { state } = useStore();
  if (!state.authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" aria-label="Loading session" />
      </div>
    );
  }
  if (!state.user) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}

/* already signed in? skip the auth pages entirely — go straight to teams
   (returning users on the same device are recognized automatically) */
function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { state } = useStore();
  const [params] = useSearchParams();
  const invite = state.pendingInvite ?? params.get("invite");
  if (!state.authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" aria-label="Loading session" />
      </div>
    );
  }
  if (state.user) return <Navigate to={invite ? `/join/${invite}` : "/teams"} replace />;
  return <>{children}</>;
}

/* homepage: returning signed-in users land on their teams, not marketing */
function HomeGate() {
  const { state } = useStore();
  if (state.authReady && state.user) return <Navigate to="/teams" replace />;
  return <Home />;
}

/* invite as a full page inside the workspace */
function InvitePage() {
  const navigate = useNavigate();
  const { teamId } = useParams();
  return (
    <div className="h-full flex items-center justify-center p-4">
      <InviteModal open onClose={() => navigate(`/team/${teamId}/chat`)} />
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function Shell() {
  const location = useLocation();
  return (
    <>
      <SupabaseSync />
      <ScrollToTop />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname.split("/").slice(0, 2).join("/")}>
          <Route path="/" element={<HomeGate />} />
          <Route path="/signin" element={<RedirectIfAuthed><SignIn /></RedirectIfAuthed>} />
          <Route path="/signup" element={<RedirectIfAuthed><SignUp /></RedirectIfAuthed>} />
          <Route path="/join" element={<Join />} />
          <Route path="/join/:code" element={<Join />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/timer/floating" element={<FloatingTimer />} />
          <Route path="/teams" element={<RequireAuth><TeamSelect /></RequireAuth>} />
          <Route path="/teams/new" element={<RequireAuth><TeamCreate /></RequireAuth>} />
          <Route path="/team/:teamId" element={<WorkspaceLayout />}>
            <Route index element={<Navigate to="chat" replace />} />
            <Route path="chat" element={<Chat />} />
            <Route path="dm/:memberId" element={<Dm />} />
            <Route path="files" element={<Files />} />
            <Route path="roadmap" element={<Roadmap />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="mentor" element={<Mentor />} />
            <Route path="timer" element={<Timer />} />
            <Route path="invite" element={<InvitePage />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AnimatePresence>
      <ToastHost />
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </StoreProvider>
  );
}
