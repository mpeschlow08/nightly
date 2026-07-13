import Image from "next/image";

import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Section from '../components/Section'
import EventCard from '../components/EventCard'
import ClubCard from '../components/ClubCard'
import DJCard from '../components/DJCard'

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-gray-100 antialiased">
      <Navbar />
      <main>
        <Hero />

        <Section title="Featured Events">
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 px-4">
            <EventCard title="Neon Nights" date="Sat, Jul 25" location="Velvet Room" />
            <EventCard title="Glow Rave" date="Fri, Aug 7" location="Pulse Hall" />
            <EventCard title="Moonlight Sessions" date="Sun, Aug 16" location="SkyDeck" />
          </div>
        </Section>

        <Section title="Trending Clubs">
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 px-4">
            <ClubCard name="Velvet Room" vibe="Upscale lounge" />
            <ClubCard name="Pulse Hall" vibe="Mainstage DJs" />
            <ClubCard name="SkyDeck" vibe="Rooftop terrace" />
          </div>
        </Section>

        <Section title="Popular DJs">
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 px-4 pb-20">
            <DJCard name="DJ Aurora" genre="House" />
            <DJCard name="MC Neon" genre="Techno" />
            <DJCard name="K-Beat" genre="Electro" />
          </div>
        </Section>
      </main>
    </div>
  )
}
