import Link from 'next/link'
import { cn } from '@/lib/utils'

export function Logo({ className, href = '/' }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'text-foreground inline-flex items-center text-lg font-bold tracking-tight select-none',
        className,
      )}
    >
      <span className="text-primary">auto</span>ads
    </Link>
  )
}
