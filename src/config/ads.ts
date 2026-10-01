/**
 * Umístění reklamního slotu v rozvržení stránky.
 *
 * `top` znamená banner nad hlavním obsahem, `left` a `right` boční sloty
 * kolem obsahu. Hodnoty odpovídají třídám `.ad-top`, `.ad-left` a `.ad-right`.
 */
export type AdPosition = "top" | "left" | "right";

/**
 * Definice jedné reklamní jednotky. Pole `provider` určuje poskytovatele
 * a tím i tvar zbývajících částí objektu:
 * `placeholder` je neutrální slot bez externího skriptu, `google` a `seznam`
 * nesou parametry konkrétní sítě.
 */
export type AdUnit =
  | { provider: "placeholder" }
  | { provider: "google"; client: string; slot: string }
  | { provider: "seznam"; zoneId: number; width: number; height: number };

/**
 * Reklamní jednotky pro jednotlivé pozice; klíč odpovídá {@link AdPosition}.
 *
 * Obsahuje výhradně veřejná publisher ID. Slot zůstává pasivní, dokud se
 * hodnota `placeholder` nenahradí konkrétní definicí poskytovatele.
 */
export const ads: Record<AdPosition, AdUnit> = {
  top: { provider: "placeholder" },
  left: { provider: "placeholder" },
  right: { provider: "placeholder" },
};
