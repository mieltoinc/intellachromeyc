import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-blue-50 hover:bg-blue-700",
        destructive: "bg-red-600 text-red-50 hover:bg-red-700",
        outline: "border border-blue-200 bg-white hover:bg-blue-50 hover:text-blue-900",
        secondary: "bg-blue-100 text-blue-900 hover:bg-blue-200",
        ghost: "hover:bg-blue-100 hover:text-blue-900",
        link: "text-blue-600 underline-offset-4 hover:underline",
        gradient: "bg-gradient-to-b from-blue-500 to-blue-700 text-white hover:from-blue-600 hover:to-blue-800 border border-blue-600 shadow-[inset_0_2px_0_0_rgba(255,255,255,0.1)]",
        "gradient-dark": "bg-gradient-to-b from-gray-700 to-gray-900 text-white hover:from-gray-800 hover:to-black border border-gray-800 shadow-[inset_0_2px_0_0_rgba(255,255,255,0.1)]",
        "gradient-premium": "bg-gradient-to-b from-blue-600 to-blue-800 text-white hover:from-blue-700 hover:to-blue-900 border border-blue-700 shadow-[inset_0_2px_0_0_rgba(255,255,255,0.15)] shadow-lg",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10",
        full: "h-10 px-4 py-2 w-full rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }