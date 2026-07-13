import React from 'react'

export default function Section({ title, children }:{title:string, children:React.ReactNode}){
  return (
    <section className="max-w-7xl mx-auto py-12">
      <div className="px-4">
        <h2 className="text-2xl font-semibold text-white mb-6">{title}</h2>
      </div>
      {children}
    </section>
  )
}
