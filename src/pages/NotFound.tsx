import { Link } from "react-router-dom";
import { Home, Compass } from "lucide-react";
import { Particles, Page } from "@/components/fx";
import { Button } from "@/components/ui";
import { Logo } from "./Home";
import { useStore } from "@/lib/store";

export default function NotFound() {
  const { state } = useStore();
  return (
    <Page className="min-h-screen flex flex-col items-center justify-center relative px-4 text-center">
      <Particles density={45} />
      <div className="relative">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <p className="text-[110px] sm:text-[150px] font-extrabold leading-none text-gradient select-none">404</p>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-white mt-2">This route didn't make the demo</h1>
        <p className="text-ink-400 mt-3 max-w-sm mx-auto leading-relaxed">
          The page you're looking for was cut from scope — or never existed. Either way, the deadline waits for no one.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <Link to="/"><Button><Home className="w-4 h-4" /> Back to homepage</Button></Link>
          {state.user && <Link to="/teams"><Button variant="secondary"><Compass className="w-4 h-4" /> My teams</Button></Link>}
        </div>
        <p className="text-[11px] text-ink-400 mt-12">Vadanam · Created by Sai Karthik</p>
      </div>
    </Page>
  );
}
