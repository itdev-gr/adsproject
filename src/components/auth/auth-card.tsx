import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/shared/logo'

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6">
      <Logo className="mb-8" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      {footer && <div className="text-muted-foreground mt-6 text-sm">{footer}</div>}
    </div>
  )
}
