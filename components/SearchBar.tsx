"use client"
import { useState } from 'react'

export default function SearchBar({ placeholder = 'Search clubs, DJs, events...' }:{placeholder?:string}){
  const [q, setQ] = useState('')

  return (
    <div className="w-full max-w-3xl mx-auto px-4">
      <div className="flex items-center gap-3 bg-zinc-900/60 border border-zinc-800 rounded-full px-4 py-3 shadow-sm">
        <input
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          className="flex-1 bg-transparent outline-none text-gray-200 placeholder-gray-400"
          placeholder={placeholder}
        />
        <button className="ml-2 px-4 py-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm">Search</button>
      </div>
    </div>
  )
}
