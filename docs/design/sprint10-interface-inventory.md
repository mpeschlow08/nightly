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
| Consumer Social | `/crews` | Friends, groups, plans, Night Out, Friend Code, and privacy-aware meetup context | Consumer | Foundation pass underway | Mobile-first social home | Social dashboard data/actions and QR token |
| Friend Radar | `/crews/radar` | Privacy-aware friend presence and arrival context | Consumer | Implemented | Mobile-first | Existing presence/privacy rows |
| Plans | `/crews/plans` | Create and manage lightweight night-out plans | Consumer | Implemented | Mobile-first | Existing `night_out_plans` model |
| Plan detail | `/crews/plans/[id]` | Protected destination and attendee view | Consumer | Implemented | Mobile-first | Existing plan member/stop relations |
| Friend QR scanner | `/crews/scan` | Camera QR scan with signed-token validation and code fallback | Consumer | Implemented | Mobile-first | Native `BarcodeDetector`, existing social token path |
| Reservations | `/bookings`, `/bookings/[id]` | Request, track, review, and check in to reservations | Consumer | Existing, account entry points aligned | Mobile-first, desktop detail | Existing booking actions/data, canonical pricing |
| Premium | `/profile/premium` | Explain current Premium value and billing boundary | Consumer | Implemented | Mobile-first | Existing commercial entitlement API |
| Account settings | `/profile/settings` | Navigate privacy, notifications, Premium, and support | Consumer | Implemented | Mobile-first | Existing account/social services |
| Artist dashboard | `/dj/dashboard` | Tonight, profile health, and performer actions | DJ/Artist | Foundation pass underway | Mobile-first | Existing DJ profile and mix data |
| Artist sessions | `/dj/sessions` | Check in, start, perform, review, and end a Nightly Session | DJ/Artist | Existing, visually aligned | Mobile-first | Artist Session service and media rows |
| Artist moments | `/dj/reels` | Review captured moments and session context | DJ/Artist | Implemented | Mobile-first | Existing session media service |
| Artist analytics | `/dj/analytics` | Honest performance history state | DJ/Artist | Implemented | Responsive desktop | Existing session/media data boundary |
| VenueOS dashboard | `/owner` | Venue readiness, tonight, arrivals, media, and attention | Venue owner | Foundation pass underway | Tablet/desktop first | Existing owner data and feature gates |
| VenueOS operations | `/owner/operations` | Run of show, tasks, incidents, and operational queues | Owner/Tech Operator | Existing, visually aligned | Tablet/desktop first | Existing VenueOS module data/actions |
| Nightly Box | `/owner/devices` | Appliance readiness, commissioning, and health | Owner/Tech Operator | Existing, visually aligned | Tablet/desktop first | Fleet/device policy and scoped actions |
| Venue cameras | `/owner/cameras` | Camera source state and public playback controls | Owner | Existing, feature-gated | Tablet/desktop first | Existing camera actions and live feature gate |
| Venue publishing | `/owner/publishing` | Venue publication readiness and social publishing | Owner | Existing, visually aligned | Tablet/desktop first | Existing publish/social services |
| Admin Command Center | `/admin/overview` | Platform health, actionable metrics, and system state | Admin | Implemented | Desktop-first | Existing control-center data |
| Admin Fleet | `/admin/fleet` | Device fleet health, alerts, commissioning, and rollouts | Admin | Implemented | Desktop-first | Existing fleet policy/actions |
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
- [ ] Authenticated Consumer Social visual QA (requires a signed-in Development browser session)
- [ ] Authenticated Commerce/Account visual QA (requires a signed-in Development browser session)
- [ ] DJ / Artist pass
- [ ] VenueOS pass
- [ ] Admin / Fleet pass
