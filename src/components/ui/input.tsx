import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-blue-200 dark:border-darkBg-secondary bg-white dark:bg-darkBg-secondary px-3 py-2 text-sm text-gray-900 dark:text-darkText-primary ring-offset-white dark:ring-offset-darkBg-primary file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-blue-500 dark:placeholder:text-darkText-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }