export default function EventCard({ title, date, location }:{title:string,date:string,location:string}){
  return (
    <article className="bg-gradient-to-br from-zinc-900/60 to-zinc-800 border border-zinc-700 rounded-xl p-6 shadow-lg hover:scale-[1.02] transition-transform">
      <div className="h-40 rounded-md bg-gradient-to-r from-blue-900 to-purple-800 mb-4 flex items-end p-4 text-white">
        <div className="text-sm opacity-80">{date} · {location}</div>
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-gray-300">Exclusive VIP access and bottle service available.</p>
      <div className="mt-4">
        <button className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm">View Event</button>
      </div>
    </article>
  )
}
