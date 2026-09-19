# REPORT Accessibility & Non-Verbal Emergency Interaction Design

## 1. Design Philosophy

In extreme emergencies, traditional interaction models fail:
- An intruder inside a home makes vocal speech lethal.
- A victim in physical shock may experience motor tremors or loss of speech.
- Deaf or hard-of-hearing citizens cannot use voice dispatchers or audio alerts.
- Visual impairments require high-contrast screens and tactile haptic confirmation.

The **REPORT Universal Emergency System** adheres to a non-verbal, multi-sensory accessibility paradigm ensuring **zero barriers to police intervention**.

---

## 2. No-Communication Mode (Silent Emergency)

When activated, **No-Communication Mode** enforces the following safeguards:
1. **Zero Audio Output**: All text-to-speech, chimes, and confirmation rings are strictly suppressed to avoid alerting nearby assailants.
2. **High-Contrast Dark Theme**: Deep black background (`#020617`) with vivid, high-visibility amber/red action targets.
3. **Single-Tap Binary Inputs**: Replaces keyboard typing with large, unambiguous touch targets ("YES", "NO", "UNSURE").
4. **Haptic Confirmation**: Every interaction responds with distinct tactile micro-pulses (`navigator.vibrate([100, 50, 100])`) so the victim knows their input was registered without looking directly at the screen.

---

## 3. Adaptive Emergency Interview

The Adaptive Interview asks **one question at a time** using progressive disclosure:
1. **Question 1 (Immediate Danger)**: "Are you in immediate physical danger right now?" (YES / NO / UNSURE)
2. **Question 2 (Weapons)**: "Do you see a weapon?" (KNIFE / FIREARM / BLUNT OBJECT / NONE / UNKNOWN)
3. **Question 3 (Aggressors)**: "How many aggressors or suspects are present?" (1 / 2 / 3+ / UNKNOWN)
4. **Question 4 (Shelter)**: "Are you in a locked or secure room/location?" (YES / NO / TRYING TO FLEE)

Each tap immediately updates the living incident in the Crisis Intelligence Engine. The citizen can dismiss or pause the interview at any point without invalidating the alert.

---

## 4. Indian Sign Language (ISL) Emergency Vocabulary (Experimental)

REPORT includes an experimental, rule-based geometric gesture classifier for non-verbal reporting. Under the Universal Emergency upgrade, the vocabulary formally supports:

| Gesture Code | Label | Tamil Label | Heuristic Geometry | Safety Gate |
|---|---|---|---|---|
| `HELP` | Assistance Request | உதவி | All 5 fingers extended and spread upright | Explicit confirmation required |
| `ATTACK` | Physical Attack / Threat | தாக்குதல் | Crossed forearms / defensive cross | Explicit confirmation required |
| `HOSTAGE` | Hostage / Confinement | பிணைக்கைதி | One hand grasping opposite wrist | Explicit confirmation required |
| `FIRE` | Fire / Smoke Emergency | தீ விபத்து | Upward fluttering fingers signaling flames | Explicit confirmation required |
| `MEDICAL` | Medical Emergency | மருத்துவ அவசரநிலை | Hand clutching chest / heart area | Explicit confirmation required |
| `STOP` | Stop / Halt | நிறுத்து | Vertical flat palm with tight cohesion | Explicit confirmation required |
| `ACCIDENT` | Vehicular Collision | விபத்து | Two closed fists head-on horizontal collision | Explicit confirmation required |

### Safety & Anti-Fabrication Safeguards
- **Heuristic Threshold**: Geometric fit score $\ge 0.90$ required before generating a candidate token.
- **Explicit Citizen Confirmation**: All emergency gestures require an interactive confirmation step before inclusion.
- **Draft Status Only**: Gesture inputs only populate draft descriptive fields and never assign penal sections or criminal labels.
