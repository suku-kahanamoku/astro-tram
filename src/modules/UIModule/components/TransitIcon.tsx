import { transitPaths } from "../providers/transitIcons";
const aliases: Record<string, string> = {
  coach: "bus",
  trolleybus: "bus",
  cable_car: "gondola",
  funicular: "train",
  monorail: "train",
};
export default function TransitIcon({
  name,
  size = 19,
  className = "transport-icon",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const mode =
    Object.hasOwn(transitPaths, name) || Object.hasOwn(aliases, name)
      ? name
      : "transport";
  return (
    <svg
      className={className}
      data-mode={mode}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={transitPaths[aliases[name] ?? name] ?? transitPaths.transport} />
    </svg>
  );
}
