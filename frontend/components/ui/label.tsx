"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/** Libellé de champ de formulaire, stylé pour refléter l'état désactivé du champ associé (via `peer-disabled`). */
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
