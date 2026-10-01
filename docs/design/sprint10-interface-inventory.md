# Sprint 10 Interface Inventory

Status reflects the first Foundation + Consumer Core pass.

| Surface | Route | Purpose | Primary user | State | Responsive target | Core dependencies |
| --- | --- | --- | --- | --- | --- | --- |
| Consumer home | `/home` | Decide what is worth doing tonight | Consumer | Implemented | Mobile-first, expanded desktop | `getHomeData`, venue/event discovery components |
| Explore | `/discover` | Search, filter, compare nightlife | Consumer | Implemented | Mobile-first, desktop two-column rhythm | `getExploreData`, discovery cards, filters |
| Map | `/map` | Spatial venue discovery | Consumer | Implemented | Mobile-first, tablet map utility | `getExploreData`, Leaflet map |
| Venue detail | `/venues/[id]` | Understand the venue and take the next action | Consumer | Implemented | Mobile-first, desktop sticky actions | venue/event/DJ data services |
| Event detail | `/events/[slug]` | Understand an event and enter or RSVP | Consumer | Implemented | Mobile-first, desktop sticky actions | event/venue data services |
| Hot Reels | `/live` | Browse nightlife media and live context | Consumer | Existing, visually aligned | Mobile-first media feed | live and consumer data services |
| Concierge | `/concierge` | Ask for a simple plan or recommendation | Consumer | Existing, visually aligned | Mobile-first conversation surface | Concierge service and discovery payloads |
| Consumer navigation | shared shell | Keep Home, Explore, Live, Concierge, Profile reachable | Consumer | Implemented | Touch-first mobile, compact desktop | `AppNavigation`, `AppHeader` |

## Canonical states

All Core surfaces use the shared route transition, loading files, empty states, and server error boundaries. Media-led surfaces preserve no-data, unavailable, and permission-safe states from their existing services. Offline and entitlement-specific states remain owned by the existing domain components and are not replaced by presentation logic.

## Visual QA checklist

- [x] Violet-led dark tokens with electric blue used as a secondary signal
- [x] Shared focus rings and reduced-motion behavior
- [x] Consumer bottom navigation uses five primary destinations
- [x] Core pages keep mobile-safe bottom padding and constrained content widths
- [x] Hero media remains the first-viewport emotional anchor
- [ ] Browser screenshot pass across mobile, tablet, and desktop
- [ ] Consumer Social pass
- [ ] DJ / Artist pass
- [ ] VenueOS pass
- [ ] Admin / Fleet pass
