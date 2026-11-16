/** The product's signature detail: a 1px leader line up to an uppercase label chip. */
export default function Flag({ children, tone }) {
  return (
    <span className={tone === "accent" ? "flag flag--accent" : "flag"}>
      <span className="flag__leader" aria-hidden="true" />
      <span className="flag__chip">{children}</span>
    </span>
  );
}
