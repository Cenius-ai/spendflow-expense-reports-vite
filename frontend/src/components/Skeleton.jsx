export function SkeletonLine({ width = "100%" }) {
  return <div className="skeleton" style={{ width }} />;
}

export function SkeletonRows({ rows = 4 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton skeleton--row" key={index} />
      ))}
    </div>
  );
}

export function SkeletonMetrics({ count = 4 }) {
  return (
    <div className="metric-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="metric" key={index}>
          <div className="skeleton" style={{ width: "48%" }} />
          <div className="skeleton" style={{ width: "72%", height: 26 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCharts({ count = 2 }) {
  return (
    <div className="chart-grid-2" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="panel" key={index}>
          <div className="panel__head">
            <div className="skeleton" style={{ width: 140 }} />
          </div>
          <div className="panel__body">
            <div className="skeleton skeleton--chart" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Skeleton({ variant = "line", width, height }) {
  const className =
    variant === "card" ? "skeleton skeleton--card" : variant === "row" ? "skeleton skeleton--row" : "skeleton";
  return <div className={className} style={{ width, height }} aria-hidden="true" />;
}
