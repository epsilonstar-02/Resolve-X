# RESOLVEX — MACHINE-READABLE SPEC
# doc_id: RX-SPEC-2026 | version: 2.0 | status: APPROVED
# refs: PRD-RX-2026-001 + IMPL-RX-2026-001
# encoding: utf-8 | query_lang: structured-markdown
# changelog: v2.0 adds DEMO_MODE, TRUST_ARCHITECTURE, MULTI_ISSUE_DETECTION,
#             OPEN_DEMO_SYSTEM, BOOTH_OPERATIONS, PRODUCTION_CREDIBILITY_PLAN
# -----------------------------------------------------------

## META

```yaml
product: ResolveX
tagline: "Smart Public Service CRM — citizen complaints → urban intelligence"
team: Bugs
event: "India Innovates 2026 | FiSTA / HN | Finals: Bharat Mandapam, 28 Mar 2026"
prd_id: PRD-RX-2026-001
impl_id: IMPL-RX-2026-001
spec_version: 2.0
mvp_deadline: "24 March 2026 (feature freeze)"
finals_date: "28 March 2026 — exhibition booth, Bharat Mandapam, New Delhi"
total_phases: 4  # Phase 0,1,2,3
tracks: [AI_ML, BE_FE_UI]
priority_levels: [P0, P1, P2]
effort_units: days
new_in_v2:
  - DEMO_MODE: sandbox environment with honest data provenance
  - TRUST_ARCHITECTURE: 3-layer credibility system for production
  - MULTI_ISSUE_DETECTION: contextual secondary issue surfacing from images
  - OPEN_DEMO_SYSTEM: architecture for visitor-filed complaints at booth
  - BOOTH_OPERATIONS: reset, marker distinction, geo-fence
  - COMPLAINT_CATEGORIES: expanded to 10 top-level categories
```

---

## CONFLICT_RESOLUTION

```
CONFLICT_TRIGGERS:
  C1: Two tasks with no declared dependency share the same output artifact
  C2: A P0 requirement references an unbuilt dependency from another service
  C3: A Phase gate is reached but exit criteria are unmet (partial completion)
  C4: AI/ML track handoff artifact is not ready when BE/FE/UI track needs it
  C5: A requirement has ambiguous acceptance criteria (no measurable threshold)
  C6: Risk likelihood=High AND impact=High AND no mitigation is active

CONFLICT_BLOCK_FORMAT:
  CONFLICT: <trigger_code>
  TASK_IDS: [affected task ids]
  QUESTION: <single yes/no or choice question for human>
  OPTIONS: [A: ..., B: ..., C: ...]
  DEFAULT_IF_NO_RESPONSE: HALT
```

---

## PRIORITY_MATRIX

### PROTOTYPE_CORE (P0 — build in order)

```
RX-001 | DB schema + PostGIS migrations              | PH0 | BE       | P0 | 3  | none
RX-002 | Docker Compose dev env                      | PH0 | BE/DevOps| P0 | 2  | none
RX-003 | CI/CD GitHub Actions pipeline               | PH0 | DevOps   | P0 | 2  | RX-002
RX-004 | JWT auth service + RBAC                     | PH1 | BE       | P0 | 6  | RX-001
RX-004D| Demo citizen one-tap login (booth mode)     | PH1 | BE/FE    | P0 | 2  | RX-004
RX-005 | Complaint Service CRUD + geo-validation     | PH1 | BE       | P0 | 8  | RX-001,RX-004
RX-006 | Media upload service (S3/local)             | PH1 | BE       | P0 | 5  | RX-004
RX-007 | Keyword rule-based classifier (fallback)    | PH1 | AI_ML    | P0 | 5  | RX-001
RX-007M| Multi-issue detection engine (rule-based)   | PH1 | AI_ML    | P0 | 4  | RX-007
RX-008 | Duplicate detection (PostGIS 50m/48h)       | PH1 | AI_ML    | P0 | 4  | RX-001
RX-009 | RabbitMQ routing engine                     | PH1 | BE       | P0 | 7  | RX-005,RX-007
RX-010 | SLA timer + escalation cron                 | PH1 | BE       | P0 | 5  | RX-009
RX-011 | Notification service (WebSocket+email)      | PH1 | BE       | P0 | 6  | RX-009
RX-012 | PWA complaint filing flow (5 screens)       | PH1 | FE       | P0 | 10 | RX-005,RX-006
RX-012S| Sandbox mode banner + demo citizen login    | PH1 | FE       | P0 | 2  | RX-012,RX-004D
RX-013 | PWA complaint status tracking page          | PH1 | FE       | P0 | 5  | RX-005,RX-011
RX-014 | GIS service (ward boundaries PostGIS)       | PH1 | BE       | P0 | 6  | RX-001
RX-014G| Geo-fence to demo ward (Bharat Mandapam)    | PH1 | BE       | P0 | 1  | RX-014
RX-015 | Leaflet.js GIS map (admin)                  | PH1 | FE       | P0 | 6  | RX-014
RX-015M| Dual marker system (solid/hollow)           | PH1 | FE       | P0 | 2  | RX-015
RX-015R| Demo reset endpoint + Ctrl+Shift+R          | PH1 | BE/FE    | P0 | 1  | RX-015M
RX-016 | Admin dashboard — task list + update        | PH1 | FE       | P0 | 8  | RX-009,RX-011
RX-017 | Admin dashboard — dept workload charts      | PH1 | FE       | P1 | 5  | RX-016
RX-018 | Role-based dashboard views (3 roles)        | PH1 | FE/BE    | P0 | 4  | RX-004,RX-016
```

### HIGH_VALUE (P1 — after all P0)

```
RX-019 | ML SVM classifier (replaces RX-007)         | PH2 | AI_ML    | P1 | 8  | RX-007,labeled_data
RX-020 | Active learning feedback loop               | PH2 | AI_ML    | P1 | 5  | RX-019
RX-021 | DBSCAN spatial clustering pipeline          | PH2 | AI_ML    | P1 | 10 | RX-001,RX-019
RX-022 | Zone risk scoring model                     | PH2 | AI_ML    | P1 | 8  | RX-021
RX-022C| CV multi-issue detection (replaces RX-007M) | PH2 | AI_ML    | P1 | 12 | RX-019
RX-023 | Early warning alert engine                  | PH2 | AI_ML    | P1 | 5  | RX-022
RX-024 | Risk heatmap layer (admin map)              | PH2 | FE       | P1 | 6  | RX-022,RX-015
RX-025 | Early warning panel (admin sidebar)         | PH2 | FE       | P1 | 5  | RX-023,RX-011
RX-026 | SLA compliance dashboard                    | PH2 | FE       | P1 | 6  | RX-010
RX-027 | CSAT dashboard                              | PH2 | FE       | P1 | 5  | RX-030
RX-028 | Citizen reputation + gamification           | PH2 | AI_ML+FE | P1 | 9  | RX-005,RX-012
RX-029 | City/ward leaderboard                       | PH2 | FE       | P1 | 4  | RX-028
RX-030 | Post-resolution feedback flow               | PH2 | FE       | P1 | 4  | RX-013,RX-011
RX-031 | Analytics export PDF+CSV                    | PH2 | BE/FE    | P1 | 5  | RX-026,RX-027
RX-032 | Complaint re-routing workflow               | PH2 | BE       | P1 | 4  | RX-009
RX-033 | WhatsApp Business bot integration           | PH2 | BE       | P1 | 10 | RX-009,RX-007
RX-034 | Field officer mobile app (GPS resolve)      | PH2 | FE       | P1 | 8  | RX-016,RX-018
```

### OPTIONAL (P2 — defer unless time/capacity allows)

```
RX-035 | Full CV defect detection model (YOLO)       | PH3 | AI_ML    | P2 | 20 | RX-022C
RX-036 | IoT sensor data ingestion                   | PH3 | AI_ML    | P2 | 15 | none
RX-037 | Multilingual PWA (Hindi + regional)         | PH3 | FE       | P2 | 8  | RX-012
RX-038 | Open REST API + developer portal            | PH3 | BE       | P2 | 10 | all_PH1
RX-039 | Multi-city data architecture                | PH3 | BE       | P2 | 10 | all_PH1
RX-040 | ERP integration adapter                     | PH3 | BE       | P2 | 12 | RX-039
RX-041 | Seasonal risk model (IMD integration)       | PH3 | AI_ML    | P2 | 10 | RX-022
RX-042 | Historical complaint replay map             | PH3 | FE       | P2 | 3  | RX-015
RX-043 | Ward councillor dashboard                   | PH3 | FE       | P2 | 6  | RX-018
```

---

## PHASE_SEQUENCE

```
PHASES:
  PH0: Foundation       (Mar 19–20)  | gate: all_PH0_tasks=DONE
  PH1: MVP              (Mar 20–24)  | gate: MVP_ACCEPTANCE_CRITERIA=PASS + FEATURE_FREEZE
  PH2: Intelligence     (M7–M12)     | gate: ML_ACC>85% AND CSAT>3.5
  PH3: Scale            (M13–M24)    | gate: 3+cities AND 2+contracts
```

---

## DEMO_MODE SYSTEM (NEW IN v2.0)

### PROBLEM_STATEMENT

```
CONTEXT: Bharat Mandapam booth — no real municipal infrastructure exists on-site.
VISITORS: Will file any complaint about any topic in any location.
RISK: Map fills with junk data. Credibility questioned. Demo collapses.
SOLUTION: Explicit sandbox architecture that is honest about demo data
          while demonstrating production-grade trust mechanisms.
```

### SANDBOX_MODE

```
TRIGGER: ENV=demo OR ?mode=sandbox in URL
VISUAL_INDICATOR: Amber banner on all screens — "SANDBOX MODE — Demo environment · Complaints are illustrative"
DB_TAG: Every complaint filed in sandbox tagged source=demo_sandbox, environment=sandbox
MAP_DISPLAY: sandbox complaints → hollow markers; pre-seeded verified data → solid markers
RESET: DELETE /admin/demo/reset wipes source=demo_sandbox complaints, restores base seed
KEYBOARD_SHORTCUT: Ctrl+Shift+R on admin dashboard triggers reset (admin role only)
PRODUCTION_MODE: ENV=production → banner hidden, all markers solid after officer verification
```

### DEMO_CITIZEN_LOGIN (RX-004D)

```
PURPOSE: Eliminate OTP friction for booth visitors (ministers/judges will not type 6-digit codes)
IMPLEMENTATION:
  - "Try as Demo Citizen" button on role-picker screen (visible only in DEMO_MODE)
  - Creates/reuses pre-seeded sandbox citizen account: demo@resolvex.in
  - Issues JWT with role=citizen, ward_id=DEMO_WARD, source=demo_sandbox
  - No OTP required, no phone number required
PRODUCTION: This button is hidden. Full OTP flow is shown separately when judges ask about auth.
SECURITY_NOTE: Demo account has no access to real complaint data or admin functions.
```

### GEO_FENCE (RX-014G)

```
DEMO_WARD_BOUNDARY: Bounding box around Bharat Mandapam, New Delhi
  lat_min: 28.595  lat_max: 28.625
  lng_min: 77.195  lng_max: 77.225
ENFORCEMENT: PostGIS ST_Within check on complaint coordinates
BEHAVIOR: Pin auto-starts at Bharat Mandapam centroid (28.6100, 77.2090)
          Visitor can drag within bounding box only
          Outside boundary → pin snaps back → error: "Location must be within demo ward"
PRE_SEEDED_WARDS: Ward 14, Ward 22 (Delhi) loaded as GeoJSON for production-authentic display
```

### DUAL_MARKER_SYSTEM (RX-015M)

```
MARKER TYPES:
  verified:    solid filled circle, full opacity, category color
               condition: source=production OR officer_verified=true
  sandbox:     hollow circle, dashed border, 60% opacity, category color
               condition: source=demo_sandbox AND officer_verified=false
  officer_confirmed: hollow → solid transition when officer marks "Verified on ground"
  resolved:    solid green circle
  risk_cluster: solid red circle, larger radius

LEAFLET_IMPLEMENTATION:
  L.circleMarker(latlng, { fillOpacity: verified ? 1.0 : 0, dashArray: verified ? null : "4 4" })

LEGEND: Always visible on map — explains marker types to every judge without prompting
```

### DEMO_RESET (RX-015R)

```
ENDPOINT: DELETE /api/admin/demo/reset (admin JWT required)
ACTION:
  1. DELETE FROM complaints WHERE source='demo_sandbox'
  2. DELETE FROM tasks WHERE complaint_id IN (sandbox complaints)
  3. Restore base seed data (60 pre-seeded verified complaints + monsoon scenario)
  4. Broadcast WebSocket event → map refreshes on all connected clients
KEYBOARD: Ctrl+Shift+R on admin dashboard → confirm modal → calls endpoint
USE_CASE: Between judge/VIP visits. Every VIP sees fresh, curated map.
TIMING: Use every ~10 visitors or immediately before a VIP approach.
```

---

## TRUST_ARCHITECTURE (NEW IN v2.0 — Production Design)

### LAYER_1_GEO_VALIDATION

```
MECHANISM: PostGIS ST_Within(complaint.location, city.boundary_polygon)
FAILURE: Complaint rejected → citizen shown "Location outside service area"
EXISTING_CODE: RX-005 geo-validation — already in spec, highlight this in demos
PREVENTS: Fictitious locations, out-of-jurisdiction reports
```

### LAYER_2_REPUTATION_SCORING

```
MECHANISM: Each citizen has trust_score (0–100), starts at 50 for new users
RULES:
  - Complaint resolved without rejection → +5 score
  - Complaint rejected by officer → -10 score
  - Complaint confirmed duplicate → -3 score
  - Score > 80 → "Trusted Reporter" badge → complaints get priority routing
  - Score < 20 → complaints auto-routed to manual review queue
MAP_WEIGHT: High-reputation complaints shown with slightly stronger marker opacity
DBSCAN_INPUT: Only verified OR reputation>60 complaints feed the clustering model
PREVENTS: Spam, malicious filing, gaming the system
SPEC_REF: RX-028 (Citizen reputation) — already in spec
```

### LAYER_3_OFFICER_VERIFICATION

```
MECHANISM: Officer field-confirms complaint after on-ground inspection
ACTION: Officer taps "Verified on ground" → complaint.officer_verified=true → marker becomes solid
MAP_EFFECT: hollow marker → solid marker transition (visible in real time at booth)
SLA_EFFECT: Verified complaints enter full SLA tracking; unverified are in "pending confirmation" state
PREVENTS: False reports from achieving full system trust
DEMO_USE: At booth, team member acts as officer and verifies visitor complaint → marker turns solid live
```

### JUDGE_ANSWER_SCRIPT

```
QUESTION: "Are these complaints real?"
ANSWER: "The solid markers are pre-seeded from real ward complaint patterns. The hollow markers
         were filed by visitors like yourself. In production, credibility works through three layers:
         GPS boundary validation, citizen reputation scoring, and officer field verification.
         The map is always visually honest about its confidence — solid vs hollow tells you exactly
         what's been confirmed vs what's pending. Want me to verify that complaint you just filed
         and watch it change?"

QUESTION: "What stops someone from filing fake complaints?"
ANSWER: "Three mechanisms: GPS validation rejects out-of-zone reports, reputation scoring routes
         low-trust filers to manual review, and DBSCAN risk alerts only trigger on clusters of
         verified or high-reputation complaints — not a single anonymous report."
```

---

## MULTI_ISSUE_DETECTION (NEW IN v2.0)

### CONCEPT

```
INSIGHT: Citizens report only what they immediately notice.
         ResolveX surfaces hidden infrastructure issues from the same image or context.
PITCH_LINE: "One complaint becomes three actionable work orders."
POSITIONING: "ResolveX doesn't just record what citizens report — it analyzes visual evidence
              to uncover hidden infrastructure issues the citizen didn't notice."
```

### MVP_IMPLEMENTATION (Rule-Based — builds in 4 hours)

```
TRIGGER: Photo uploaded OR category selected
MECHANISM: Lookup table maps primary category → secondary detections
CONFIDENCE_DISPLAY: Show as percentage bars in UI (pre-configured, not real ML output)
ROUTING: Each detected secondary issue creates its own task → routed to relevant department
DB_FIELD: complaints.secondary_issues JSONB array
```

### DETECTION_LOOKUP_TABLE

```
PRIMARY_CATEGORY    | SECONDARY_DETECTIONS
--------------------|-----------------------------------------------------
Roads/Pothole       | Waste accumulation nearby (71%) · Waterlogging risk (58%)
Drainage/Block      | Flooding risk (74%) · Foul odour/sanitation (63%)
Streetlight/Out     | Safety/crime risk (69%) · Electrical infrastructure age (52%)
Waste/Garbage       | Health hazard (81%) · Groundwater contamination risk (55%)
Water/Leakage       | Pipeline burst prediction (77%) · Road damage risk (49%)
Footpath/Broken     | Accessibility barrier (72%) · Rainwater pooling risk (61%)
Encroachment        | Traffic flow risk (66%) · Pedestrian safety (58%)
Noise/Pollution     | Health hazard (60%) · Regulatory violation (55%)
Stray Animals       | Public safety risk (73%) · Accident potential (61%)
Parks/Damaged       | Safety risk (68%) · Accessibility barrier (54%)
```

### UI_SPECIFICATION

```
DISPLAY_LOCATION: After photo upload, before submit button
COMPONENT_NAME: <IssueAnalysisCard />
ELEMENTS:
  - Section header: "AI Detected Issues"
  - Primary issue row: purple background, "Primary · Routed → [Dept]", confidence bar
  - Secondary rows: amber background, "AI Detected · Also routed → [Dept]", confidence bar
  - Summary footer: "X departments notified · 1 complaint filed · SLA timers started"
ANIMATION: Secondary rows slide in 300ms after primary, staggered 150ms each
PRODUCTION_NOTE: "For MVP we use rule-assisted detection. In production this integrates
                  with YOLO or multi-label CV models trained on civic datasets."
```

### HONEST_DISCLOSURE

```
DO_SAY:   "Rule-assisted contextual detection — designed for CV model integration in Phase 2"
DO_SAY:   "The architecture supports YOLO or multi-label CV models trained on civic datasets"
DONT_SAY: "We built a full computer vision model"
DONT_SAY: "Our AI detects issues from images" (without qualification)
JUDGE_FOLLOW_UP: "How accurate is this detection?"
ANSWER:   "For MVP we demonstrate rule-assisted detection. In production, accuracy depends on
           the CV model — YOLO v8 on civic datasets typically achieves 75–85% mAP. We structured
           the pipeline to swap the rule engine for a trained model with no API changes."
```

---

## OPEN_DEMO_SYSTEM (NEW IN v2.0)

### COMPLAINT_CATEGORIES (Expanded to 10)

```
CAT-01 | Roads & Footpaths    | Pothole, crack, encroachment, speed breaker, broken footpath
CAT-02 | Drainage & Sewage    | Blocked drain, overflow, open manhole, sewage on road
CAT-03 | Streetlighting       | Light out, flickering, broken pole, cable exposed
CAT-04 | Waste & Sanitation   | Garbage dump, uncollected waste, bin overflow, dead animal
CAT-05 | Water Supply         | No water, low pressure, contamination, leakage, pipe burst
CAT-06 | Parks & Public Space | Broken bench, overgrown, damaged equipment, encroachment
CAT-07 | Encroachment/Illegal | Illegal structure, vendor blocking road, parking violation
CAT-08 | Noise & Pollution    | Noise, air quality, construction dust, industrial smoke
CAT-09 | Stray Animals        | Stray dogs, cattle on road, injured animal
CAT-10 | Other/Miscellaneous  | Catch-all → routes to General dept → manual review queue
```

### CATEGORY_FIRST_FILING

```
RULE: Visitor MUST select a category BEFORE seeing the description text field
REASON: Category primes the classifier; prevents pure free-text junk from misfiring
SAFETY_NET: CAT-10 catches everything off-topic gracefully — still appears on map as grey marker
UX: 10 large category tiles with icons on one screen, tap to proceed
```

### VISITOR_JOURNEY

```
STEP_1: QR scan → role-picker screen
STEP_2: Tap "Try as Demo Citizen" → one-tap login, no OTP
STEP_3: Complaint filing opens → category-first screen (10 tiles)
STEP_4: Select category → GPS map opens, pin at Bharat Mandapam, drag within geo-fence
STEP_5: Optional photo upload → multi-issue detection card appears
STEP_6: Optional 1-line description → Submit
STEP_7: Confirmation screen shows complaint ID + SLA deadline
STEP_8: Admin map (on team's laptop) shows new hollow marker in real time
TARGET_TIME: Under 45 seconds from QR scan to complaint on map
```

### BOOTH_OPERATIONS

```
SETUP:
  SCREEN_1: Laptop — admin/commissioner dashboard with live map always visible
  SCREEN_2: Tablet or spare phone — citizen PWA for visitor demos
  PRINT: 50 QR cards (business card size) — link to live app
  PRINT: 2× A3 poster — product overview + architecture diagram
  PRINT: 10× one-page financial summary (for investors/ministry)
  NETWORK: Personal hotspot, NOT venue WiFi. Test on 4G before leaving.

ROTATION:
  2 team members at booth always
  1 gives demo, 1 answers technical questions
  Rotate every 90 minutes
  Every team member can deliver the full demo independently

RESET_CADENCE:
  Every ~10 visitors: Ctrl+Shift+R → restore base state
  Before any VIP/judge approach: reset immediately
  Pre-seeded monsoon scenario always preserved through reset

OPENING_LINE: "This map shows every civic complaint in this area updated in real time —
               and our AI already knows which zones will flood before the monsoon hits.
               Want to file a complaint and watch it appear on the map?"
```

---

## PRODUCTION_CREDIBILITY_PLAN (NEW IN v2.0)

```
PHASE_1_PRODUCTION:
  - All three trust layers active (geo-validation + reputation + officer verification)
  - Demo mode disabled (ENV=production)
  - All citizen complaints start as unverified (hollow) in officer view
  - Officer field verification promotes to verified (solid)
  - DBSCAN runs only on verified + high-reputation data

PHASE_2_PRODUCTION:
  - ML SVM classifier replaces rule-based (RX-019)
  - CV multi-issue detection replaces rule-based lookup table (RX-022C)
  - Reputation system live with gamification (RX-028)
  - WhatsApp Business bot for frictionless filing (RX-033)

PHASE_3_PRODUCTION:
  - Full YOLO/CV defect detection from images (RX-035)
  - Field officer app with GPS-stamped resolution photos (RX-034)
  - Ward councillor dashboard for elected representatives (RX-043)
  - Open API for third-party credibility data providers
```

---

## PHASE_0 — FOUNDATION (Mar 19–20)

```
P0-A01 | AI_ML  | Dataset acquisition + audit          | 3d | complaint_dataset.csv (500+ records)
P0-A02 | AI_ML  | Exploratory data analysis            | 2d | EDA notebook
P0-A03 | AI_ML  | Label schema design (10 categories)  | 2d | labeling_schema.json
P0-A04 | AI_ML  | Text preprocessing pipeline          | 3d | preprocessing.py + tests
P0-B01 | DevOps | Monorepo + git workflow               | 1d | GitHub repo
P0-B02 | DevOps | Docker Compose dev env               | 2d | docker-compose.yml
P0-B03 | DevOps | CI/CD GitHub Actions                 | 2d | .github/workflows/
P0-B04 | BE     | DB schema + PostGIS migrations        | 3d | db/migrations/ (10 files incl. sandbox fields)
P0-B05 | BE     | Seed data script                     | 2d | db/seed.sql (60 complaints, monsoon scenario)
```

### SEED_DATA_SPECIFICATION

```
WARD_COUNT: 3 (Ward 14, Ward 22, Demo Ward / Bharat Mandapam area)
COMPLAINT_COUNT: 60 total
  - 18 drainage complaints in Ward 7 (monsoon scenario cluster)
  - 15 road complaints distributed across wards
  - 12 streetlight complaints
  - 10 water supply complaints
  - 5 waste/sanitation complaints
  - All 60 marked source=production, officer_verified=true → solid markers
RISK_ZONES:
  - Ward 7 drainage cluster → DBSCAN flags as HIGH risk (flood prediction)
  - Ward 14 road cluster → MEDIUM risk (infrastructure age)
DEPARTMENTS: Roads, Drainage, Electrical, Water, Sanitation, General
OFFICERS: 2 per department (12 total) for workload demo
```

---

## AUTH_SYSTEM (Updated v2.0)

### DEMO_MODE_AUTH

```
DEMO_CITIZEN_BUTTON:
  visible: ENV=demo only
  label: "Try as Demo Citizen"
  action: POST /auth/demo/login → issues JWT(role=citizen, source=demo_sandbox)
  account: pre-seeded demo@resolvex.in, no real PII

PRODUCTION_AUTH (shown separately when judges ask):
  Citizen: Phone OTP via Twilio/MSG91 (hardcoded 123456 in staging)
  Officer: Employee ID + password + TOTP 2FA
  Dept Head: Same as officer
  Commissioner: SAML/OIDC SSO (deferred to Phase 2) or email+TOTP fallback
```

---

## 6-DAY BUILD SEQUENCE (Mar 19–24)

```
DAY_1 (Mar 19): Foundation
  - Docker Compose + PostGIS + CI/CD (P0-B01/02/03/04)
  - Next.js scaffold + Tailwind + Leaflet + 4 dummy routes
  - Dataset acquired, label schema finalized
  EXIT: docker-compose up works for everyone. Map renders.

DAY_2 (Mar 20): Auth + Filing + Multi-Issue Detection
  - JWT auth + RBAC + Demo citizen button (RX-004, RX-004D)
  - Complaint CRUD + geo-validation + geo-fence (RX-005, RX-014G)
  - Media upload local volume (RX-006)
  - Complaint filing 5-screen PWA (RX-012, RX-012S)
  - Multi-issue detection UI + lookup table (RX-007M)
  EXIT: File a complaint on mobile. See it in DB with GPS.

DAY_3 (Mar 21): AI Routing + Live Map (THE WOW MOMENT)
  - Keyword classifier + duplicate detection (RX-007, RX-008)
  - RabbitMQ routing engine (RX-009)
  - Leaflet map with dual markers (RX-015, RX-015M)
  - Demo reset endpoint (RX-015R)
  - Admin complaint list (RX-016)
  EXIT: File complaint on phone → hollow pin on map in <3 seconds.

DAY_4 (Mar 22): SLA + Notifications + Officer View
  - SLA cron + escalation (RX-010)
  - WebSocket notifications (RX-011)
  - Citizen tracking page (RX-013)
  - Officer task queue (RX-018)
  - DBSCAN clustering starts (RX-021)
  EXIT: Full loop — citizen files → officer resolves → citizen notified.

DAY_5 (Mar 23): Risk Intelligence + Seed Data + Rehearsal
  - Zone risk scoring + early warnings (RX-022, RX-023)
  - Risk heatmap overlay (RX-024)
  - SLA compliance + workload charts (RX-026, RX-017)
  - Seed 60 realistic complaints (monsoon scenario)
  - End-to-end demo rehearsal x3
  EXIT: Monsoon scenario runs flawlessly. Every team member can demo.

DAY_6 (Mar 24): FREEZE + DEPLOY
  09:00 FEATURE FREEZE — no new code, bug fixes only
  - Deploy to Railway/Render/Fly.io (public HTTPS URL)
  - Test on 4G mobile (not WiFi)
  - Record 90-second backup screen capture
  - Print 50 QR cards, 2× A3 posters
  - Pitch deck finalized
  - Rehearse booth pitch x3
  EXIT: Public URL live. Demo works on 4G. Travel prep complete.
```

---

## RISKS (Updated v2.0)

```
RISK-DEMO-1: Venue WiFi unreliable → MITIGATION: Personal hotspot, 4G tested, offline fallback video
RISK-DEMO-2: Backend crashes during live demo → MITIGATION: Reset button, backup video, screenshots printed
RISK-DEMO-3: Visitor files abusive content → MITIGATION: Category-first forces structured input; Other catches remainder
RISK-DEMO-4: Map cluttered after many visitors → MITIGATION: Ctrl+Shift+R reset every 10 visitors
RISK-DEMO-5: Judge asks "is this real?" → MITIGATION: Sandbox banner + trust architecture answer script
RISK-DEMO-6: CV model claim challenged → MITIGATION: Honest disclosure script; "rule-assisted, designed for CV integration"
RISK-TECH-1: NLP cold start → MITIGATION: Keyword classifier ships as P0 fallback (RX-007)
RISK-TECH-2: PostGIS geo-data quality → MITIGATION: OpenStreetMap Delhi ward boundaries as fallback
RISK-TECH-3: RabbitMQ overflow → MITIGATION: Persistent messages + pre-fetch limits
```

---

*RX-SPEC-2026 v2.0 | India Innovates 2026 | Team Bugs*
*Query: PRIORITY_MATRIX first → CONFLICT_RESOLUTION on ambiguity → PHASE_SEQUENCE for ordering*
*New in v2.0: DEMO_MODE + TRUST_ARCHITECTURE + MULTI_ISSUE_DETECTION + OPEN_DEMO_SYSTEM*
