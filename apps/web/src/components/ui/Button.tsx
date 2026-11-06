import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 font-medium transition-[transform,background-color,border-color,box-shadow] duration-150 disabled:opacity-50 disabled:pointer-events-none active:translate-y-[1px]',
  {
    variants: {
      variant: {
        primary: 'bg-pine text-paper hover:bg-pine-deep shadow-[0_1px_0_rgba(0,0,0,0.08)]',
        accent: 'bg-ember text-[#FFFDF8] hover:brightness-[0.96]',
        outline: 'border border-line bg-surface text-ink hover:border-pine hover:text-pine',
        quiet: 'text-muted hover:text-ink hover:bg-[color-mix(in_srgb,var(--line)_35%,transparent)]',
        danger: 'border border-[color-mix(in_srgb,var(--bad)_45%,transparent)] text-bad hover:bg-[color-mix(in_srgb,var(--bad)_10%,transparent)]',
      },
      size: {
        sm: 'h-9 px-3 text-[13px] rounded-[8px]',
        md: 'h-11 px-4 text-[14px] rounded-[10px]',
        lg: 'h-12 px-5 text-[15px] rounded-[12px]',
        icon: 'h-10 w-10 rounded-full',
      },
      full: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', full: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, full, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonStyles({ variant, size, full }), className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
