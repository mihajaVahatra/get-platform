import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combine et fusionne intelligemment des classes Tailwind CSS.
 *
 * Enchaîne `clsx` (gestion des classes conditionnelles/tableaux/objets) puis
 * `twMerge` (résolution des conflits de classes Tailwind, ex. `p-2 p-4` → `p-4`).
 * Utilitaire utilisé dans tout le frontend, notamment par les composants UI.
 *
 * @param inputs - Classes CSS, conditions ou tableaux de classes à combiner.
 * @returns La chaîne de classes finale, dédupliquée et sans conflit.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
