import Icon from "./TransitIcon";
import "../styles/transportMotif.css";

export default function TransportMotif({ label }: { label?: string }) {
  return (
    <span
      className="transport-motif"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className="transport-motif-vehicle">
        <Icon name="tram" />
      </span>
      <Icon name="arrow" className="transport-motif-arrow" />
      <span className="transport-motif-vehicle">
        <Icon name="bus" />
      </span>
    </span>
  );
}
