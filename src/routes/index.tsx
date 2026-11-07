import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const Workspace = lazy(() => import("@/features/learning/Workspace"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AlgoBoard — Visualize LeetCode code, flowcharts & dry runs" },
      { name: "description", content: "Paste LeetCode code, a problem statement or number and get a flowchart, an animated dry run and pattern insights." },
      { property: "og:title", content: "AlgoBoard — Visualize LeetCode solutions" },
      { property: "og:description", content: "Flowcharts, animated dry runs and pattern insights for any LeetCode problem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Loading() {
  return <div className="ab-loading">Loading AlgoBoard…</div>;
}

function Index() {
  return (
    <ClientOnly fallback={<Loading />}>
      <Suspense fallback={<Loading />}>
        <Workspace />
      </Suspense>
    </ClientOnly>
  );
}
