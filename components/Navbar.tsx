"use client"
import { useState } from 'react'
import Link from 'next/link'

export default function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="w-full bg-black/60 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-2xl font-semibold tracking-tight text-white">
              Nightly
            </Link>
            <nav className="hidden md:flex items-center gap-4 text-sm text-gray-300">
              <Link href="#">Home</Link>
              <Link href="#events">Events</Link>
              <Link href="#clubs">Clubs</Link>
              <Link href="#djs">DJs</Link>
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link href="#login" className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm">Login</Link>
          </div>

          <div className="md:hidden">
            <button onClick={() => setOpen(!open)} className="p-2 rounded-md text-gray-200 hover:text-white">
              {open ? 'Close' : 'Menu'}
            </button>
          </div>
        </div>
        {open && (
          <div className="md:hidden py-4 flex flex-col gap-3 text-gray-300">
            <Link href="#">Home</Link>
            <Link href="#events">Events</Link>
            <Link href="#clubs">Clubs</Link>
            <Link href="#djs">DJs</Link>
            <Link href="#login" className="mt-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm w-max">Login</Link>
          </div>
        )}
      </div>
    </header>
  )
}
