/** Jedna položka vodorovného i mobilního menu. */
export interface NavigationItem {
  /** Cílová URL položky. */
  href: string;
  /** Viditelný text položky. */
  label: string;
  /** Značí aktuální stránku; zobrazí se třída `active` a `aria-current="page"`. */
  current?: boolean;
}
