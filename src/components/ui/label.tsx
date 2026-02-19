/* eslint-disable jsx-a11y/label-has-associated-control -- association enforced at call sites */
"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Label({ className, htmlFor, ...props }: React.ComponentProps<"label">) {
  const sharedProps = {
    "data-slot": "label",
    className: cn(
      "gap-2 text-sm leading-none font-medium group-data-[disabled=true]:opacity-50 peer-disabled:opacity-50 flex items-center select-none group-data-[disabled=true]:pointer-events-none peer-disabled:cursor-not-allowed",
      className
    ),
  }

  if (htmlFor) {
    return (
      <label
        {...sharedProps}
        htmlFor={htmlFor}
        {...props}
      />
    )
  }

  return (
    <span
      {...sharedProps}
      {...props}
    />
  )
}

export { Label }
