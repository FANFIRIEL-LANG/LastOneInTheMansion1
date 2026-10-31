# Last One in the Mansion — Mafia Halloween Edition

## Product direction

Keep the existing React + TypeScript + Vite + Capacitor application, the one-iPhone pass-and-play format, the mansion setting, existing visual identity, character names where useful, and the tested secret-role handoff. Replace the short linear three-event story loop with a replayable social-deduction game inspired by the broad Mafia genre. Do not copy another game's text, characters, art, or proprietary content.

Target: 4–7 players, one shared iPhone, 25–45 minutes, offline-first.

## Design pillars

1. **Secrets stay silent.** The narrator never speaks roles, objectives, faction names, private choices, or investigative results. Private content is text-only and appears only after an explicit handoff confirmation.
2. **Everyone gets a turn.** During each night, the app privately visits every player in the same order and with the same neutral transition. Players without an ability receive a harmless "wait / keep your eyes closed" screen. Timing and screen shape must not reveal who has an active role.
3. **Public and private agency.** Every living player gets one public day action and one private night turn. Role powers and personal objectives create additional asymmetric choices.
4. **No early spectator problem.** A player who becomes a ghost remains part of discussion and can use one final ghost vote. Their active ability stops.
5. **Replayability over scripted linearity.** Use shuffled event, clue, room, and personal-objective decks. Choices must change game state and can affect the ending.
6. **Readable first, deep second.** A beginner rules explanation and guided first game are mandatory. Advanced role/event options can be added later.

## Fiction

A storm traps the guests in a Victorian mansion. A secret cult is preparing a ritual beneath the house. The guests must investigate, protect one another, and identify the cult before the ritual is completed. Cult members may bluff, plant false evidence, and manipulate the public story.

## Factions and win conditions

- **Guests:** win when every living cult member has been banished.
- **Cult:** wins when cult members equal or outnumber living guests, or when the ritual track reaches its final mark.
- Do not include a third solo faction in the first playable version. Add neutral roles only after the two-faction game is balanced.

## Role roster and player-count balance

| Players | Cult | Special guest roles | Ordinary residents |
|---:|---|---|---:|
| 4 | 1 Cultist | Detective | 2 |
| 5 | 1 Cultist | Detective, Doctor | 2 |
| 6 | Cultist, Acolyte | Detective, Doctor | 2 |
| 7 | Cultist, Acolyte | Detective, Doctor, Guardian | 2 |

The five-player setup is the primary balance target: one hidden cultist against four guests, with only two special guest roles. The Medium is removed from the base game because repeated private supernatural clues give one player too much reliable information and narrow the deduction too quickly.

Role abilities:
- **Cultist:** secretly chooses a night target; must bluff and manipulate the public discussion.
- **Acolyte:** joins the cult target choice. Its optional once-per-game false-evidence power is disabled in the first balance pass until playtests show it is needed.
- **Detective:** investigates one player at night but receives an uncertain clue, not a definitive faction label. Suggested results: “suspicious traces” / “no clear traces”; neither result is proof.
- **Doctor:** protects one player from one night attack. The Doctor cannot protect the same target on consecutive nights and cannot know the cult's choice.
- **Guardian:** appears only with seven players; provides one limited room/player protection choice.
- **Resident:** has no special night power. They still receive the same neutral private phone handoff, then pass the phone on. Their influence comes from public actions, discussion, evidence, and voting.

Do not add another special role to the five-player setup until several full playtests show that the game needs it. Use role metadata and a role registry rather than hard-coding role assumptions into UI components.

## Core round structure

A full game normally lasts 3–5 cycles, with early endings possible.

### 0. Setup and secret role dealing
- Choose 4–7 players and enter names.
- Explain the basic objective before the first secret is shown.
- Deal roles one at a time using the existing handoff safety flow.
- Cult players privately learn their fellow cult members during their own role reveal.
- Never use speech synthesis or prerecorded public narration for private role text.

### 1. Dawn / public report
- Narrator gives a short atmospheric public recap.
- Reveal only public consequences: a player became a ghost, a room was damaged, a ritual clue surfaced.
- Do not reveal the cause, actor, target selection, or private information unless a public effect explicitly says so.

### 2. Public day action — one action per living player
Players take turns choosing one action, and the result is public:
- **Search a room:** draw a clue or item from the room deck.
- **Interrogate:** ask a named player a question; the target must answer aloud, but may lie.
- **Share evidence:** reveal or transfer one clue/item.
- **Secure a room:** protect a room from one sabotage effect.
- **Study the ritual:** spend a matching evidence set to reduce ritual progress.
- **Accuse:** nominate a player for the public trial.

The app should show the active player and their available actions, then show the public outcome after confirmation. Do not silently consume a turn on invalid input.

### 3. Mansion event
- Draw one event from a shuffled deck.
- Event may impose a public group choice, alter a room, add a deadline, or offer a private temptation.
- Event options must have actual state effects, not just decorative text.
- Keep an event history visible so players can reason about earlier decisions.

### 4. Trial and vote
- Allow nominations and brief defense statements.
- Each living player votes privately using the phone handoff.
- A player who is a ghost may cast one final ghost vote for the entire game.
- Require a strict majority of eligible votes to banish; ties or insufficient votes cause no banishment.
- Reveal the banished player's role after the vote resolves.

### 5. Night — private action for every player
- The phone is passed in the same player order every night.
- Every player gets the same neutral handoff and confirmation pattern.
- Active roles select a target or action privately.
- Every living player receives a private phone turn, but ordinary Residents have no night power and simply see a neutral pass screen. Ghosts also receive the same neutral pass screen, so the handoff order does not reveal roles.
- Cult members privately choose a single target. If cult choices tie, the cult attack fails.
- Doctor/Guardian protection is resolved before the attack.
- Detective gets a private faction clue.
- No Medium role or Medium-only omen exists in the base game.
- Narrator may say only "The mansion falls silent" / "Dawn approaches"; no role names are spoken.

### 6. Resolution
- Apply protection, attack, wounds, ghost transitions, ritual progress, and clue results deterministically.
- A player becomes a ghost after receiving two wounds. Ghosts can still discuss and use one final vote, but cannot use role powers or public day actions.
- Check both faction and ritual win conditions.
- If no winner, begin the next cycle.

## Public vs private information contract

Public:
- player names and living/ghost status;
- public day actions and their visible outcomes;
- public event and public decisions;
- public clues explicitly revealed;
- vote totals and banishment results;
- ritual track only if the selected scenario says it is public.

Private:
- role, faction, objective, cult allies;
- night target selection;
- investigative results and medium omens;
- unshared clues and hidden inventory;
- private event offers and secret missions.

**Never send private content to the narrator/audio queue.** The narration API must accept a branded/public-only text type, not arbitrary strings.

## Audio direction

- Remove system TTS as the default narrator.
- Use human-recorded or high-quality neural speech clips for public lines, with consistent speaker, Russian pronunciation, natural pacing, pauses, and emotional variation.
- All audio is public-only and bundled/cached for offline use.
- Keep text captions and a mute control.
- Speech must be cancellable on app backgrounding, route changes, or user mute.
- If premium natural voice requires a cloud service, do not make it mandatory for offline play; pre-render core lines and use optional downloadable packs.

## Narrator voice implementation decision

The browser/iOS system speech synthesis is not an acceptable final narrator. It is disabled by default during the redesign, and the role-reveal call has been removed so role names, descriptions, objectives, and faction data are never spoken.

Preferred production workflow:
- Generate the fixed public narrator lines with ElevenLabs Eleven v3 for expressive dramatic delivery, or Multilingual v2 for stable longer narration. Russian is supported; paid plans are required for commercial use of generated output.
- Audition at least three distinct narrator voices before choosing one: low, restrained male storyteller; warm but ominous female storyteller; and neutral cinematic narrator.
- Render each line once to MP3, edit breaths/pauses, normalize loudness, and bundle the clips in the app. No runtime TTS API call and no API key in the client.
- Use short reusable public lines for variable game events. Never interpolate player names, role names, secret objectives, targets, private clues, or investigative results into narration.
- Keep captions available and allow all narration to be muted.
- Google Cloud Chirp 3 HD is a secondary option: it has Russian voices and an EU endpoint; published pricing currently includes 1 million characters free, then $30 per million characters. Compare actual Russian voice samples before committing.

References checked on 2026-10-31:
- ElevenLabs documents expressive Eleven v3, stable Multilingual v2, Russian support, and commercial-use terms: https://elevenlabs.io/docs/overview/capabilities/text-to-speech
- Google lists Russian Chirp 3 HD voices: https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types
- Google TTS pricing: https://cloud.google.com/text-to-speech/pricing

## UX direction

- Home: title, player count range, play, rules, audio settings.
- Setup: player list, simple/advanced mode, estimated duration.
- Handoff: large recipient name, neutral privacy reminder, explicit "phone is with me".
- Private screen: role/action/objective in readable cards, no audio, no back navigation to previously seen secrets.
- Public action screen: one clear action at a time, current player indicator, undo only before confirmation.
- Day dashboard: current day, ritual progress, public evidence, room status, living/ghost players.
- Trial: nominations, defense timer, private voting sequence, transparent tally.
- Night dashboard: neutral atmosphere and equalized private turn flow.
- Ending: reveal all roles, event timeline, decisive clues, public actions, and reason for victory.
- Add a short tutorial and a glossary; don't make players learn rules from long blocks of prose.

## Technical migration plan

1. Keep current main untouched. Create a feature branch from the current IPA/secret-lifecycle work so the tested build and privacy changes are retained.
2. Add a pure TypeScript game engine with explicit state transitions and unit tests before changing App.tsx.
3. Model role definitions, public actions, private night actions, events, clues, wounds/ghost state, votes, and victory checks as data.
4. Implement the new round state machine and test the full 4/5/6/7-player flows.
5. Replace the current three-event UI with phase-driven screens, retaining the current visual style and role handoff.
6. Add audio asset interface and public/private content guard. Do not enable role speech.
7. Run web tests/build and iOS simulator/device IPA CI.
8. Physical iPhone test: privacy on handoff, background/lock, voice, full round, edge cases.

## Acceptance criteria for the first playable Mafia edition

- Supports 4, 5, 6, and 7 players with balanced role sets.
- No private role, faction, objective, ally, target, or result is spoken aloud.
- Every player receives an indistinguishable private night turn.
- Every living player has one meaningful public day action.
- All active roles have a meaningful private night action.
- Cult target resolution, protection, wounds, ghost state, vote, ritual track, and win checks are covered by unit tests.
- Players who become ghosts can still participate and cast their one final vote.
- Public events and player choices affect the state and the ending.
- Existing app lifecycle concealment and iOS packaging remain intact.
- Main is not modified or merged without explicit approval.
