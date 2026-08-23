# SAHAY — Architecture

> System design, core modules, and data flow for the SAHAY platform. This document assumes familiarity with the product goals described in `vision.md`.

---

## Data Architecture & Intelligence Model

SAHAY should be designed around a canonical internal data model rather than separate product silos for each source.

### Source model

```
News ───────────────┐
Government ─────────┤
Traffic / Maps ─────┤
Weather ────────────┤
Social signals ─────┤──→ Normalization ─→ Event Intelligence
Citizen Issues ─────┤                         │
Polls ──────────────┘                         ▼
                                          Real-world Event
                                                │
                                                ▼
                                         User Relevance
                                                │
                                                ▼
                                         User Experience
```

**Note on the diagram above:** these six source boxes look architecturally equivalent, but they are not equally accessible in practice. News (RSS) and Weather (IMD) are free and self-serve. Government/Municipal sources are mostly scraper-built adapters rather than APIs. Traffic is a paid, per-query API scoped to known corridors rather than a live feed. Social signals from external platforms (Reddit, Facebook, Instagram) are not viable at MVP budget and should be treated as citizen-submitted reports instead. See the roadmap's per-phase feasibility notes for the reasoning behind each — the canonical model below should absorb these differences so the rest of the system never needs to know or care which kind of adapter fed it.

In storage, a **publisher** is a `Source` (name, homepage, type, trust). A publisher can expose many pollable endpoints as `SourceFeed` rows (PIB by ministry/region, a daily’s section feeds). Fetch scheduling, HTTP cache headers, and feed health live on `SourceFeed`, not on `Source`.

Ingestion is two layers: `RawArticle.payload` is the original feed/API item (append-only after insert, for debug and replay). `Article` is the normalized row the product queries. Do not present AI Interpretation as a `Source`.

### Canonical content concept

A common internal `ContentItem` / event representation should capture concepts such as:

- Source and publisher.
- Source type.
- URL/reference.
- Title and summary.
- **Language and language confidence** — a first-class field, not an afterthought. SAHAY targets Hindi and English from the first ingestion phase (see roadmap Phase 1B), and several Delhi outlets already publish Hindi RSS feeds, so this is populated at ingestion time rather than inferred later. Storing it from day one avoids a schema migration once cross-language event matching (embeddings-based, see Event Intelligence below) becomes necessary.
- Published/fetched time.
- Location.
- Category.
- Entities.
- Urgency.
- Confidence.
- Raw source metadata.

The exact schema will be defined during technical design.

### Source trust model

SAHAY must distinguish between:

- **Official** — government or authoritative source.
- **Verified News** — trusted publisher.
- **News** — general publisher source.
- **Social** — community/social signal.
- **Citizen Report** — user-generated report.
- **AI Interpretation** — SAHAY-generated explanation.

`Source.trustTier` is the numeric encoding used in the backend today: **1** = official/government, **2** = established outlet (verified news / general publisher), **3** = aggregator or blog. Social and citizen reports are later source types, not extra numeric tiers yet. AI Interpretation remains display-only and is never stored as a `Source` row.

AI-generated explanations must never be presented as the original source.

---

## Event Intelligence

A major long-term differentiator is to treat multiple pieces of content as signals about the same real-world event.

Example:

```
Government notice: Road closure announced
News article: Traffic diversion reported
Community posts: Residents discussing congestion
Map signal: Traffic speed significantly reduced

                    ↓

          EVENT: Road closure
          Location: Dwarka Sector 10
          Severity: High
          Confidence: High

                    ↓

      “This may affect your morning commute.”
```

### Event intelligence capabilities

- Entity extraction.
- Location extraction and geocoding.
- Time-window reasoning.
- Semantic similarity.
- Deduplication.
- Event clustering.
- Source corroboration.
- Confidence scoring.
- Urgency classification.
- Geographic impact estimation.
- **Cross-language matching** — a Hindi report and an English article about the same event should cluster into one event. This depends on embeddings rather than keyword matching, and depends on `language` being populated at ingestion (see Canonical content concept above).

This allows SAHAY to avoid showing ten articles about the same event as ten separate pieces of information.

---

## Personalized News Experience

### Product principle

A normal news app answers:

> “What is happening?”
> 

SAHAY answers:

> **“What is happening that matters to you?”**
> 

### User relevance signals

Potential signals include:

- Current/home location.
- Work location.
- Additional saved locations.
- Age or age group.
- Occupation.
- Constituency.
- Followed topics/interests.
- Previous interactions.
- Issues reported by the user.
- Poll participation/interests.
- Event proximity.
- Expected impact.
- Urgency.
- Recency.

### Ranking model

The eventual relevance engine should consider factors such as:

**Relevance + Proximity + Impact + Urgency + Confidence + Recency + User Interest**

The exact scoring and ranking algorithm should be defined during technical design and validated through user behavior and feedback.

---

## “How Does This Affect Me?”

This should become a core SAHAY capability.

For a relevant news item or event, the user can request a practical explanation.

Example:

> **How this affects you**
> 

> 
> 

> You live near the affected route.
> 

> 
> 

> **Impact: High**
> 

> 
> 

> - The road is expected to be closed between 7–11 AM.
> 

> - Your saved home location is within the affected area.
> 

> - Consider leaving earlier or using an alternate route.
> 

> 
> 

> **What you can do**
> 

> - View affected area.
> 

> - Find an alternate route.
> 

> - Set an alert for updates.
> 

The explanation should be grounded in available source data and clearly distinguish facts from AI-generated interpretation.

---

## “Why Am I Seeing This?”

This should be separate from impact explanation and improve recommendation transparency.

Example:

> **Why you are seeing this**
> 

> 
> 

> - It affects your locality.
> 

> - It is near your saved work location.
> 

> - You follow public transport updates.
> 

Personalization should never feel like an unexplained black box.

---

## Area Alerts & Proactive Notifications

### News vs Area Alert

**News:** Something happened that may be relevant.

**Area Alert:** Something is happening now or soon that the user may need to prepare for.

### Priority levels

| Priority | Example | Suggested treatment |
| --- | --- | --- |
| Critical | Immediate road closure, emergency | Distinct urgent tone + prominent notification |
| High | Major traffic disruption, large rally | Prominent notification |
| Important | Planned disruption tomorrow | Normal notification |
| Informational | Local development/news | Feed or optional notification |

**Data source note:** road-closure and congestion alerts should be sourced from a bounded list of known Delhi corridors polled via a paid per-query traffic API, plus IMD's free Highway Nowcast Warning feed — not a live city-wide congestion feed, which isn't available self-serve from any major provider. See the roadmap's Phase 5 feasibility note for the reasoning; this constrains Area Alerts to specific, named corridors rather than an undifferentiated heatmap, which fits the "prepare for something specific" framing better anyway.

### Proactive preparation

SAHAY should eventually be able to say:

> **Tomorrow's Area Alerts**
> 

> 
> 

> Road closure expected near your home from 7–10 AM.
> 

> 
> 

> **Prepare in advance:**
> 

> - Leave earlier.
> 

> - View alternate route.
> 

> - Set a reminder.
> 

The user should control notification preferences. Stronger defaults for critical civic alerts should be considered only where the reliability and urgency of the alert justify it.

---

## Search, Voice & Regional Languages

The experience should be designed for India's linguistic and digital diversity.

### Input modes

1. Text.
2. Voice.
3. Category browsing.

### Language capabilities

- Major Indian languages.
- Regional-language UI.
- Regional-language voice input.
- Code-mixed speech.
- Natural conversational phrasing.

**Near-term scope:** launch with Hindi and English, since content ingestion is bilingual from Phase 1B and the `ContentItem` model carries language as a first-class field from the start. Code-mixed voice input (Hindi-English in a single sentence) and additional regional languages are real capabilities but belong later, once text-based bilingual search and content are working reliably — treat them as Phase 14 work, not a launch blocker.

Example:

> “Hamare mohalle mein teen din se paani nahi aa raha hai.”
> 

SAHAY should be able to infer:

- Category: Water Supply.
- Problem: No water supply.
- Likely intent: Report or understand a civic issue.
- Relevant location: Current/selected user location.

---

## My Constituency

My Constituency is the user's personalized civic hierarchy.

Potential structure:

**User location → Ward → Local Body → Assembly Constituency → MLA → Parliamentary Constituency → MP → State → Chief Minister**

For relevant regions, the hierarchy should also account for municipalities, municipal wards, and Panchayati Raj institutions.

The feature should answer:

- Who represents me?
- Which authority handles my problem?
- How can I contact them?
- What area do they represent?
- What recent announcements affect my constituency?

---

## My Issues & Civic Accountability

Registered users should be able to:

- Report a civic issue.
- View submitted issues.
- Track status.
- View authority responses.
- Add supporting information/photos where supported.
- Receive updates.
- View issue history.
- Support an existing issue instead of creating a duplicate.

**Feasibility note:** displaying and tracking an issue within SAHAY is straightforward. *Submitting* it to the responsible authority is the part to design carefully — most Delhi civic portals (MCD, PWD) have no public submit-API. Realistic options are guiding the user to the official portal/webform with pre-filled details, or automating submission against the portal's own form (fragile, breaks on portal changes). Don't build the UI to promise automatic filing until one of these is validated against the actual target portal.

### Long-term issue lifecycle

```
Citizen reports issue
        ↓
SAHAY identifies category + location
        ↓
Responsible authority identified
        ↓
Nearby citizens can confirm/support
        ↓
Issue becomes a community signal
        ↓
Authority response / action
        ↓
Progress updates
        ↓
Resolution
```

### Long-term differentiator: Civic Accountability Loop

SAHAY should eventually connect:

**Problem → Community → Authority → Action → Outcome**

For example, a government road-repair announcement could be connected to citizen-reported road issues in the same area when evidence supports the relationship.

---

## Polls & Community Participation

Polls should primarily live inside the Feed rather than requiring a separate top-level destination.

Examples:

- “How frequently do you face water shortages?”
- “How would you rate road conditions in your area?”

Polls can provide contextual community signals that complement official data and citizen reports.

---

## Neighbourhood Pulse

A potential high-value feature built on top of the event and community data layer.

> **Your Area Pulse**
> 

> 
> 

> 2 urgent alerts
> 

> 4 road issues
> 

> 3 water complaints
> 

> 8 sanitation complaints
> 

> 2 government announcements
> 

> 3 active polls
> 

The long-term goal is to give users a quick view of the civic state of their neighbourhood without forcing them to browse multiple sources.

---

## Ask SAHAY

A conversational interface that sits above the underlying data and event intelligence layer.

Examples:

> “Kal office jaate waqt koi protest hai kya?”
> 

> “Mere area mein paani kyun nahi aa raha?”
> 

> “Mere area ke liye koi nayi government scheme hai?”
> 

SAHAY should answer using available structured events, source information, location context, and user context rather than treating the assistant as a generic chatbot.

---

## Feed Composition

The eventual Feed should combine:

1. **Area Alerts** — urgent and time-sensitive.
2. **Personalized News** — ranked by relevance.
3. **Citizen Issues** — problems reported by people in relevant areas.
4. **Polls** — community participation.
5. **Neighbourhood Pulse** — summarized local civic signals where useful.

This should produce a civic picture rather than a stream of disconnected articles.

---

## Information Architecture

### Search

- Search bar.
- Voice search.
- Category cards.
- Search results.
- Civic services.
- Authorities.
- Relevant news/events.
- Relevant citizen issues.

### Feed

- Area Alerts.
- What Matters to Me Today.
- Personalized News.
- Citizen Issues.
- Polls.
- Neighbourhood Pulse.

### Personalized Corner

- My Constituency.
- My Issues.
- My Polls.
- My Locations.
- Saved items.
- Notifications.
- Profile / Settings.

Possible persistent navigation:

**Search | Feed | Personalized Corner**

---

## Core Screen Inventory

### Entry & onboarding

- Splash / Welcome.
- Language selection.
- Guest home.
- Location permission.
- Location confirmation.
- Optional profile setup.

### Search & discovery

- Text search.
- Voice search.
- Category list.
- Search results.
- Civic service/information detail.

### Feed

- Personalized Feed.
- What Matters to Me Today.
- Area Alert card.
- Area Alert detail.
- News card.
- News detail.
- “How does this affect me?”
- “Why am I seeing this?”
- Poll card / poll detail.
- Citizen issue card / issue detail.
- Neighbourhood Pulse.

### Personalized Corner

- Login / Registration.
- OTP verification.
- Profile setup.
- My Constituency.
- My Issues.
- My Polls.
- My Locations.
- Saved items.
- Notifications.
- Settings.

### Issue reporting

- Report new issue.
- Issue category.
- Issue location.
- Issue details and photo upload.
- Responsible authority.
- Submission confirmation.
- Issue tracking.

---

## Trust, Safety & Content Model

SAHAY will combine multiple information types. Every important piece of information should preserve source context.

The system should distinguish:

- Official information.
- News publisher information.
- Social/community signals.
- Citizen-generated issues.
- AI-generated interpretation.

Social posts should not automatically become official alerts. High-impact alerts should require appropriate confidence/corroboration before being promoted to critical notification status.

Users should be able to access the underlying source wherever possible.