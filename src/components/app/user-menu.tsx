'use client'

import { LogOut, User } from 'lucide-react'
import Link from 'next/link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { logOut } from '@/lib/actions/auth'

export function UserMenu({
  email,
  displayName,
  avatarUrl,
}: {
  email: string
  displayName: string | null
  avatarUrl: string | null
}) {
  const initial = (displayName || email).charAt(0).toUpperCase()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="focus:ring-primary/40 rounded-full focus:ring-2 focus:outline-none"
            aria-label="Open user menu"
          >
            <Avatar className="h-8 w-8">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{displayName || email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/app/settings/profile" />}>
          <User className="mr-2 h-4 w-4" /> Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logOut}>
          <DropdownMenuItem render={<button type="submit" className="w-full text-left" />}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
