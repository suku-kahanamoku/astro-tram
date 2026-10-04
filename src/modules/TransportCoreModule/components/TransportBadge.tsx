import type { ComponentProps, ElementType } from "react";
import Icon from "../../UIModule/components/TransitIcon";
import { NavLink } from "../../UIModule/hooks/useUrlNavigation";
import { transportModes } from "../config/transportModes";
import {
  transportMode,
  transportStyle,
  modeLabel,
} from "../providers/transportPresentation";
import type { Dictionary } from "../providers/translations";

type Props = Omit<ComponentProps<"button">, "children"> & {
  mode: string;
  line?: string;
  t: Dictionary;
  variant?: "badge" | "icon";
  as?: "span" | "button" | typeof NavLink;
  href?: string;
};

export default function TransportBadge({
  mode,
  line,
  t,
  variant = "badge",
  as = "span",
  className = "",
  style,
  ...props
}: Props) {
  const kind = transportMode(mode);
  const label = modeLabel(kind, t);
  const Component: ElementType = as;
  return (
    <Component
      {...props}
      className={`${variant === "icon" ? "transport-mode-symbol" : "route-badge"} ${className}`.trim()}
      data-mode={kind}
      style={{ ...transportStyle(kind), ...style }}
      title={props.title ?? label}
      role={variant === "icon" ? "img" : props.role}
      aria-label={
        props["aria-label"] ?? (variant === "icon" ? label : undefined)
      }
    >
      <Icon
        name={transportModes[kind].icon}
        size={variant === "icon" ? 22 : 19}
      />
      {variant === "badge" && (
        <>
          <span>{kind === "walk" ? label : line || label}</span>
          {line && kind !== "walk" && <span className="sr-only"> {label}</span>}
        </>
      )}
    </Component>
  );
}
