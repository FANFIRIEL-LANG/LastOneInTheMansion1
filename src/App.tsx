import { useEffect, useState } from "react";
import { ArrowLeft, AudioLines, Check, ChevronRight, DoorOpen, Eye, EyeOff, Ghost, Moon, Shield, Skull, Sparkles, Volume2, VolumeX } from "lucide-react";
import {
  activeDayPlayer,
  activeNightPlayer,
  activeNightResultPlayer,
  completeNightResultReveal,
  completeEventPrivateReveal,
  getEligibleVoters,
  startMansionSession,
  submitDayAction,
  submitEventVotes,
  submitNightAction,
  submitTrialVotes,
  type MansionSession
} from "./game/gameSession";
import { MANSION_ROLES, type MansionPlayer, type NightAction } from "./game/mafiaEngine";
import { type MansionEventChoiceId } from "./game/events";
import type { EvidenceCard, MansionRoom, PublicAction } from "./game/dayActions";
import { shouldConcealSecretRole } from "./game/privacyLifecycle";
import { playNarratorClip, playNarratorSequence, stopNarrator, type NarratorClipId } from "./game/narratorAudio";

type Screen = "home" | "setup" | "roles" | "intro" | "game";
type PrivateStep = "handoff" | "ready" | "secret";
type DayActionType = "search-room" | "interrogate" | "share-evidence" | "study-ritual" | "guard-player" | "treat-player" | "accuse";

const CLUES: EvidenceCard[] = [
  { id: "r1", title: "Пепельный знак", description: "На камне выжжен символ, похожий на раскрытый глаз.", room: "library", kind: "ritual", isFalseLead: false },
  { id: "r2", title: "Чёрная свеча", description: "Воск пахнет сырой землёй. На фитиле засохла тёмная кровь.", room: "chapel", kind: "ritual", isFalseLead: false },
  { id: "r3", title: "Схема подвала", description: "На обороте плана дома нарисован круг из пяти отметок.", room: "basement", kind: "ritual", isFalseLead: false },
  { id: "t1", title: "Разорванная записка", description: "«Не впускай его после полуночи». Подпись отсутствует.", room: "kitchen", kind: "testimony", isFalseLead: false },
  { id: "t2", title: "Список гостей", description: "Одно имя вписано чернилами поверх выскобленного текста.", room: "observatory", kind: "testimony", isFalseLead: false },
  { id: "f1", title: "Чужая перчатка", description: "Перчатка найдена у окна, но на ней нет отпечатков.", room: "library", kind: "trace", isFalseLead: true },
  { id: "f2", title: "Сломанные часы", description: "Стрелки остановились на 00:13. Механизм исправен.", room: "kitchen", kind: "trace", isFalseLead: true },
  { id: "f3", title: "Пятно на ковре", description: "Пятно похоже на кровь, но это всего лишь старое вино.", room: "chapel", kind: "trace", isFalseLead: true },
  { id: "r4", title: "Костяная печать", description: "Под слоем пыли обнаружена печать с тем же символом.", room: "observatory", kind: "ritual", isFalseLead: false },
  { id: "t3", title: "Дневник смотрителя", description: "Последняя запись сделана рукой, которой не было в доме сорок лет.", room: "basement", kind: "testimony", isFalseLead: false },
  { id: "f4", title: "Мокрые следы", description: "Следы ведут к двери, но заканчиваются посреди комнаты.", room: "observatory", kind: "trace", isFalseLead: true },
  { id: "r5", title: "Обугленный свиток", description: "Осталась фраза: «Пять голосов откроют врата».", room: "chapel", kind: "ritual", isFalseLead: false },
  { id: "r6", title: "Карта созвездий", description: "Пять звёзд соединены линиями вокруг отметки на старом поместье.", room: "observatory", kind: "ritual", isFalseLead: false },
  { id: "r7", title: "Ключ с костяной рукоятью", description: "На металле выгравированы слова: «Врата помнят кровь».", room: "basement", kind: "ritual", isFalseLead: false },
  { id: "r8", title: "Пепел под алтарём", description: "В пепле сохранился фрагмент круга с тем же знаком, что и в библиотеке.", room: "chapel", kind: "ritual", isFalseLead: false },
  { id: "t4", title: "Письмо без адресата", description: "Автор пишет, что один из гостей уже бывал в особняке, хотя все отрицают знакомство.", room: "library", kind: "testimony", isFalseLead: false },
  { id: "t5", title: "Запись смотрителя", description: "В журнале отмечено, что каждую ночь кто-то спускается в подвал после второго удара часов.", room: "kitchen", kind: "testimony", isFalseLead: false },
  { id: "t6", title: "Семейная фотография", description: "На обороте перечислены имена, одно из которых совпадает с именем нынешнего гостя.", room: "observatory", kind: "testimony", isFalseLead: false },
  { id: "f5", title: "Порванная лента", description: "Лента выглядит свежей, но её цвет выцвел много десятилетий назад.", room: "basement", kind: "trace", isFalseLead: true },
  { id: "f6", title: "Следы золы", description: "Следы ведут к часовне, хотя в камине давно никто не разводил огонь.", room: "kitchen", kind: "trace", isFalseLead: true }
];

const ROOMS: { id: MansionRoom; label: string }[] = [
  { id: "library", label: "Библиотека" }, { id: "chapel", label: "Часовня" },
  { id: "kitchen", label: "Кухня" }, { id: "observatory", label: "Обсерватория" },
  { id: "basement", label: "Подвал" }
];

function eventClipId(eventId: string): NarratorClipId {
  if (eventId === "blood-moon") return "narrator_event_blood_moon";
  if (eventId === "locked-basement") return "narrator_event_basement";
  return "narrator_event_portrait";
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [names, setNames] = useState(["Игрок 1", "Игрок 2", "Игрок 3", "Игрок 4", "Игрок 5"]);
  const [session, setSession] = useState<MansionSession | null>(null);
  const [roleIndex, setRoleIndex] = useState(0);
  const [privateStep, setPrivateStep] = useState<PrivateStep>("handoff");
  const [privateVisible, setPrivateVisible] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [error, setError] = useState("");
  const [eventVotes, setEventVotes] = useState<Record<string, MansionEventChoiceId>>({});
  const [eventVoterIndex, setEventVoterIndex] = useState(0);
  const [trialVotes, setTrialVotes] = useState<Record<string, string>>({});
  const [trialVoterIndex, setTrialVoterIndex] = useState(0);
  const [dayActionType, setDayActionType] = useState<DayActionType>("search-room");
  const [room, setRoom] = useState<MansionRoom>("library");
  const [targetId, setTargetId] = useState("");
  const [question, setQuestion] = useState("Что ты делал ночью?");
  const [evidenceId, setEvidenceId] = useState("");
  const [ritualEvidenceA, setRitualEvidenceA] = useState("");
  const [ritualEvidenceB, setRitualEvidenceB] = useState("");
  const [nightTargetId, setNightTargetId] = useState("");
  const [pendingClue, setPendingClue] = useState<{ playerId: string; clue: EvidenceCard } | null>(null);

  const players = session?.players ?? [];
  const currentRolePlayer = players[roleIndex];
  const living = players.filter((player) => player.alive);
  const eventVoters = session ? living : [];
  const trialVoters = session ? getEligibleVoters(players).map((id) => players.find((player) => player.id === id)!).filter(Boolean) : [];
  const dayActor = session ? activeDayPlayer(session) : null;
  const nightActor = session ? activeNightPlayer(session) : null;
  const resultActor = session ? activeNightResultPlayer(session) : null;
  const event = session?.currentEvent ?? null;
  const privateCultMates = currentRolePlayer ? players.filter((player) => player.id !== currentRolePlayer.id && (player.roleId === "cultist" || player.roleId === "acolyte")) : [];
  const roleColor = currentRolePlayer && MANSION_ROLES[currentRolePlayer.roleId].faction === "cult" ? "danger" : "warm";



  useEffect(() => {
    const conceal = (eventName: "visibilitychange" | "blur" | "pagehide") => {
      if (!shouldConcealSecretRole(screen === "roles" || screen === "game" ? (privateVisible ? "secret" : "ready") : screen, eventName, document.visibilityState)) return;
      setPrivateVisible(false);
      if (screen === "roles") setPrivateStep("ready");
      stopNarrator();
    };
    const visibility = () => conceal("visibilitychange");
    const blur = () => conceal("blur");
    const pagehide = () => conceal("pagehide");
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    window.addEventListener("pagehide", pagehide);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
      window.removeEventListener("pagehide", pagehide);
    };
  }, [screen, privateVisible]);

  function beginSetup() {
    setNames(["Игрок 1", "Игрок 2", "Игрок 3", "Игрок 4", "Игрок 5"]);
    setError("");
    setScreen("setup");
  }

  function startGame() {
    try {
      const next = startMansionSession(names.map((name, index) => name.trim() || `Игрок ${index + 1}`), CLUES);
      setSession(next);
      setRoleIndex(0);
      setPrivateStep("handoff");
      setPrivateVisible(false);
      setError("");
      setScreen("roles");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось начать игру.");
    }
  }

  function receivePrivatePhone() {
    setPrivateVisible(false);
    setPrivateStep("ready");
  }

  function revealRole() {
    setPrivateVisible(true);
    setPrivateStep("secret");
  }

  function confirmRole() {
    setPrivateVisible(false);
    if (roleIndex + 1 < players.length) {
      setRoleIndex((index) => index + 1);
      setPrivateStep("handoff");
      return;
    }
    setScreen("intro");
    playNarratorSequence(["narrator_welcome", "narrator_house", "narrator_rules_public"], speechEnabled);
  }

  function beginDay() {
    setScreen("game");
    setPrivateStep("handoff");
    setPrivateVisible(false);
    playNarratorSequence(["narrator_day_start", "narrator_day_actions"], speechEnabled);
  }

  function submitAction(action: PublicAction) {
    if (!session || !dayActor) return;
    try {
      const next = submitDayAction(session, dayActor.id, action);
      setSession(next);
      setPrivateStep("handoff");
      setPrivateVisible(false);
      if (action.type === "search-room") {
        const clue = next.dayState.privateEvidence[dayActor.id]?.slice(-1)[0];
        if (clue) setPendingClue({ playerId: dayActor.id, clue });
      }
      setTargetId("");
      setEvidenceId("");
      setError("");
      if (next.phase === "event" && next.currentEvent) playNarratorSequence([eventClipId(next.currentEvent.id), "narrator_event_vote"], speechEnabled);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Действие не принято.");
    }
  }

  function castEventVote(choiceId: MansionEventChoiceId) {
    if (!session || !eventVoters[eventVoterIndex]) return;
    const voter = eventVoters[eventVoterIndex];
    const nextVotes = { ...eventVotes, [voter.id]: choiceId };
    setEventVotes(nextVotes);
    if (eventVoterIndex + 1 < eventVoters.length) {
      setEventVoterIndex((index) => index + 1);
      setPrivateStep("handoff");
      setPrivateVisible(false);
      return;
    }
    try {
      const next = submitEventVotes(session, nextVotes);
      setSession(next);
      setEventVotes({});
      setEventVoterIndex(0);
      setPrivateStep("handoff");
      setError("");
      if (next.phase === "trial") playNarratorClip("narrator_trial", speechEnabled);
      else if (next.phase === "ending") playNarratorClip(next.winner === "guests" ? "narrator_guests_win" : "narrator_cult_win", speechEnabled);
      else if (next.phase === "day-actions") playNarratorSequence(["narrator_day_start", "narrator_day_actions"], speechEnabled);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Голоса события не приняты.");
    }
  }

  function castTrialVote(suspectId: string) {
    if (!session || !trialVoters[trialVoterIndex]) return;
    const voter = trialVoters[trialVoterIndex];
    const nextVotes = { ...trialVotes, [voter.id]: suspectId };
    setTrialVotes(nextVotes);
    if (trialVoterIndex + 1 < trialVoters.length) {
      setTrialVoterIndex((index) => index + 1);
      setPrivateStep("handoff");
      setPrivateVisible(false);
      return;
    }
    try {
      const next = submitTrialVotes(session, nextVotes);
      setSession(next);
      setTrialVotes({});
      setTrialVoterIndex(0);
      setPrivateStep("handoff");
      setError("");
      if (next.phase === "night") playNarratorSequence(["narrator_night", "narrator_cult_whisper"], speechEnabled);
      else if (next.phase === "ending") playNarratorClip(next.winner === "guests" ? "narrator_guests_win" : "narrator_cult_win", speechEnabled);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Голосование не принято.");
    }
  }

  function makeNightMove(kind: NightAction["kind"], target?: string) {
    if (!session || !nightActor) return;
    try {
      const action: NightAction = { actorId: nightActor.id, kind, ...(target ? { targetId: target } : {}) };
      const next = submitNightAction(session, action);
      setSession(next);
      setPrivateStep("handoff");
      setPrivateVisible(false);
      setNightTargetId("");
      setError("");
      if (next.phase === "ending") playNarratorClip(next.winner === "guests" ? "narrator_guests_win" : "narrator_cult_win", speechEnabled);
      else if (next.phase === "night-results" || next.phase === "day-actions") {
        const dawnClip: NarratorClipId = !next.lastNight?.attackedPlayerId ? "narrator_no_attack" : next.lastNight.attackBlocked ? "narrator_attack_blocked" : "narrator_dawn";
        if (next.phase === "day-actions") playNarratorSequence([dawnClip, "narrator_day_start", "narrator_day_actions"], speechEnabled);
        else playNarratorClip(dawnClip, speechEnabled);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ночное действие не принято.");
    }
  }

  function revealNightResult() {
    if (!session || !resultActor) return;
    setPrivateVisible(true);
  }

  function acknowledgeEventPrivateReveal() {
    if (!session || !session.eventPrivatePlayerId) return;
    try {
      const next = completeEventPrivateReveal(session, session.eventPrivatePlayerId);
      setSession(next);
      setPrivateVisible(false);
      setPrivateStep("handoff");
      setError("");
      playNarratorClip("narrator_trial", speechEnabled);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось закрыть личную подсказку.");
    }
  }

  function acknowledgeNightResult() {
    if (!session || !resultActor) return;
    try {
      const next = completeNightResultReveal(session, resultActor.id);
      setSession(next);
      setPrivateVisible(false);
      setPrivateStep("handoff");
      setError("");
      if (next.phase === "day-actions") playNarratorSequence(["narrator_day_start", "narrator_day_actions"], speechEnabled);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось закрыть личную подсказку.");
    }
  }

  function reset() {
    stopNarrator();
    setSession(null);
    setScreen("home");
    setError("");
  }

  function renderHandoff(player: MansionPlayer, label: string, onReady: () => void) {
    return <section className="handoff screen-enter">
      <div className="seal"><Eye size={36}/></div>
      <p className="eyebrow">{label}</p>
      <h2>Передайте<br/><em>телефон</em></h2>
      <p className="handoff-name">{player.name}</p>
      <p className="muted">Пусть только этот игрок возьмёт телефон. Остальные не должны смотреть на экран.</p>
      <button className="primary-button full" onClick={onReady}>Телефон у меня <ChevronRight size={18}/></button>
    </section>;
  }

  function renderPrivateReady(player: MansionPlayer, label: string, onReveal: () => void) {
    return <section className="handoff screen-enter">
      <div className="seal"><Eye size={36}/></div><p className="eyebrow">{label}</p>
      <h2>Экран видите<br/><em>только вы?</em></h2>
      <p className="muted">Убедитесь, что рядом никто не видит экран. Нажмите, когда будете готовы.</p>
      <button className="primary-button full" onClick={onReveal}>Показать информацию <Eye size={17}/></button>
      <p className="microcopy">Игрок: {player.name}</p>
    </section>;
  }

  const dayActionButtons: { id: DayActionType; label: string }[] = [
    { id: "search-room", label: "Обыскать комнату" },
    { id: "interrogate", label: "Допросить игрока" },
    { id: "share-evidence", label: "Раскрыть свою улику" },
    { id: "study-ritual", label: "Изучить ритуал" },
    { id: "guard-player", label: "Публично защитить" },
    { id: "treat-player", label: "Оказать первую помощь" },
    { id: "accuse", label: "Выдвинуть на суд" }
  ];

  const currentPrivateResult = resultActor && session?.lastNight ? session.lastNight.privateResults[resultActor.id] : "";

  return <main className="app-shell">
    <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
    <header className="topbar">
      <button className="brand" onClick={() => screen === "home" ? undefined : reset()} aria-label="На главную">
        <span className="brand-mark"><Moon size={17}/></span><span>THE MANOR <small>HALLOWEEN GAME</small></span>
      </button>
      <button className="icon-button" onClick={() => setSpeechEnabled((value) => { if (value) stopNarrator(); return !value; })} aria-label={speechEnabled ? "Выключить озвучку" : "Включить озвучку"}>
        {speechEnabled ? <Volume2 size={18}/> : <VolumeX size={18}/>}
      </button>
    </header>

    {screen === "home" && <section className="hero screen-enter">
      <div className="eyebrow"><span className="dot"/> HALLOWEEN EDITION · 2026</div>
      <div className="hero-art"><div className="moon-disc"/><div className="silhouette-house"><span/><i/><b/></div><div className="fog fog-a"/><div className="fog fog-b"/></div>
      <p className="kicker">ОДНА НОЧЬ. ОДИН ОСОБНЯК. НЕ ВСЕ ДОЖИВУТ ДО РАССВЕТА.</p>
      <h1>Последний<br/><em>в особняке</em></h1>
      <p className="intro-copy">Среди гостей прячется тайный культ. Доверяй интуиции. Не доверяй соседу.</p>
      <button className="primary-button" onClick={beginSetup}>Открыть двери <ChevronRight size={18}/></button>
      <div className="hero-meta"><span>♟ 4–7 ИГРОКОВ</span><span><Moon size={14}/> 25–45 МИНУТ</span><span><Shield size={14}/> 1 ТЕЛЕФОН</span></div>
    </section>}

    {screen === "setup" && <section className="panel screen-enter">
      <button className="back-link" onClick={() => setScreen("home")}><ArrowLeft size={16}/> Назад</button>
      <div className="section-mark"><Ghost size={22}/></div>
      <p className="eyebrow">ПОДГОТОВКА К РИТУАЛУ</p><h2>Кто рискнёт<br/><em>войти внутрь?</em></h2>
      <p className="muted">Добавьте имена. Телефон будет передаваться по кругу.</p>
      <div className="player-count">
        <button className="stepper" onClick={() => setNames((all) => all.length > 4 ? all.slice(0, -1) : all)} aria-label="Уменьшить количество">−</button>
        <div><strong>{names.length}</strong><small>ИГРОКОВ</small></div>
        <button className="stepper" onClick={() => setNames((all) => all.length < 7 ? [...all, `Игрок ${all.length + 1}`] : all)} aria-label="Увеличить количество">+</button>
      </div>
      <div className="name-list">{names.map((name, index) => <label className="name-field" key={index}><span>{String(index + 1).padStart(2, "0")}</span><input value={name} maxLength={20} onChange={(event) => setNames((all) => all.map((item, i) => i === index ? event.target.value : item))} aria-label={`Имя игрока ${index + 1}`}/></label>)}</div>
      {error && <p className="error-text">{error}</p>}
      <div className="privacy-note"><Shield size={17}/><span>Каждый увидит только собственную роль. Личные сведения не озвучиваются.</span></div>
      <button className="primary-button full" onClick={startGame}>Начать историю <ChevronRight size={18}/></button>
    </section>}

    {screen === "roles" && currentRolePlayer && <>
      {privateStep === "handoff" && renderHandoff(currentRolePlayer, `СЕКРЕТНЫЙ КОНВЕРТ · ${roleIndex + 1}/${players.length}`, receivePrivatePhone)}
      {privateStep === "ready" && renderPrivateReady(currentRolePlayer, "ТОЛЬКО ДЛЯ ВАШИХ ГЛАЗ", revealRole)}
      {privateStep === "secret" && <section className={`secret-card screen-enter ${roleColor}`}>
        <div className="secret-top"><span className="eyebrow">ЛИЧНОЕ ДЕЛО · НЕ ПОКАЗЫВАТЬ</span><span className="classified">CLASSIFIED</span></div>
        <div className="role-icon">{MANSION_ROLES[currentRolePlayer.roleId].faction === "cult" ? <Skull size={35}/> : <Shield size={35}/>}</div>
        <p className="eyebrow">{currentRolePlayer.name.toUpperCase()}, ЭТО ВАША РОЛЬ</p>
        <h2>{MANSION_ROLES[currentRolePlayer.roleId].name}</h2>
        <p className="role-description">{MANSION_ROLES[currentRolePlayer.roleId].description}</p>
        <div className="objective"><span>ВАША ЦЕЛЬ</span><p>{MANSION_ROLES[currentRolePlayer.roleId].objective}</p></div>
        {MANSION_ROLES[currentRolePlayer.roleId].faction === "cult" && <div className="objective"><span>СОЮЗНИКИ ПО КУЛЬТУ</span><p>{privateCultMates.length ? privateCultMates.map((player) => player.name).join(", ") : "Ты единственный участник культа."}</p><p className="microcopy">Во время ночи культисты могут тихо согласовать общую цель вслух. Каждый выбирает её на телефоне отдельно.</p></div>}
        <button className="primary-button full" onClick={confirmRole}><Check size={18}/> Я запомнил роль</button>
        <p className="microcopy">После нажатия секрет исчезнет. Вернуться к нему нельзя.</p>
      </section>}
    </>}

    {screen === "intro" && <section className="panel narrative screen-enter">
      <div className="section-mark"><DoorOpen size={23}/></div><p className="eyebrow">ГЛАВА ПЕРВАЯ · ПОЛНОЧЬ</p><h2>Особняк<br/><em>просыпается</em></h2>
      <article className="story-beat"><span>Последний звонок</span><p>Ветер захлопывает тяжёлую дверь. Телефоны теряют сеть. В глубине дома загорается лампа, хотя электричество отключили сорок лет назад.</p></article>
      <article className="story-beat"><span>Хозяин дома</span><p>Из громкоговорителя раздаётся спокойный голос: «Добро пожаловать. Один из вас служит культу. Если ритуал завершится, никто не покинет этот дом».</p></article>
      <article className="story-beat"><span>Правила ночи</span><p>Днём говорите открыто, спорьте и делитесь уликами. Ночью передавайте телефон по кругу: личные действия и результаты видит только тот, кому они предназначены.</p></article>
      <div className="host-line"><AudioLines size={17}/><span>Обсуждайте вслух. Приложение не передаёт сообщения между игроками.</span></div>
      <button className="primary-button full" onClick={beginDay}>Начать первый день <ChevronRight size={18}/></button>
    </section>}

    {screen === "game" && session && <>
      <section className="panel narrative screen-enter">
        <div className="round-counter">ДЕНЬ {session.day} <span>·</span> {session.phase === "day-actions" ? "ПУБЛИЧНЫЕ ДЕЙСТВИЯ" : session.phase === "event" ? "СОБЫТИЕ" : session.phase === "trial" ? "ТАЙНОЕ ГОЛОСОВАНИЕ" : session.phase === "night" ? "НОЧЬ" : session.phase === "night-results" ? "ЛИЧНЫЕ РЕЗУЛЬТАТЫ" : session.phase === "event-private" ? "ЛИЧНАЯ ПОДСКАЗКА" : "ИТОГ"}</div>
        <div className="section-mark"><Sparkles size={23}/></div>
        <p className="eyebrow">ОСОБНЯК · РИТУАЛ {session.ritualProgress}/7</p>
        <div className="player-status">{players.map((player) => <span className={player.alive ? "status-alive" : "status-ghost"} key={player.id}>{player.name}{player.alive ? (player.wounds > 0 ? ` · рана ${player.wounds}/2` : "") : " · призрак"}</span>)}</div>
        {session.lastPublicMessage && <p className="round-prompt">{session.lastPublicMessage}</p>}
      </section>

      {pendingClue && <>
        {!privateVisible ? renderHandoff(players.find((player) => player.id === pendingClue.playerId)!, "ЛИЧНАЯ УЛИКА · НЕ ПОКАЗЫВАТЬ", () => setPrivateVisible(true)) : <section className="secret-card screen-enter warm">
          <div className="secret-top"><span className="eyebrow">ТОЛЬКО ДЛЯ ВАШИХ ГЛАЗ</span><span className="classified">PRIVATE</span></div>
          <p className="eyebrow">УЛИКА НАЙДЕНА</p><h2>{pendingClue.clue.title}</h2><p className="role-description">{pendingClue.clue.description}</p>
          <p className="microcopy">Комната: {ROOMS.find((item) => item.id === pendingClue.clue.room)?.label}</p>
          <button className="primary-button full" onClick={() => { setPendingClue(null); setPrivateVisible(false); }}>Скрыть улику и передать телефон <ChevronRight size={18}/></button>
        </section>}
      </>}
      {session.phase === "day-actions" && dayActor && !pendingClue && <>
        {privateStep === "handoff" ? renderHandoff(dayActor, `ПУБЛИЧНЫЙ ХОД · ${session.dayState.actionsUsed.length + 1}/${living.length * 2}`, () => setPrivateStep("ready")) : <section className="panel narrative screen-enter">
          <p className="eyebrow">ХОД ИГРОКА</p><h2>{dayActor.name}</h2>
          <p className="muted">У тебя два действия за день. Можно искать улики, допрашивать, защищать и выдвигать подозреваемых. После каждого хода телефон передаётся дальше.</p>
          <div className="choice-list">{dayActionButtons.map((item) => <button className={`choice ${dayActionType === item.id ? "choice-selected" : ""}`} key={item.id} onClick={() => setDayActionType(item.id)}><span>›</span>{item.label}</button>)}</div>
          {dayActionType === "search-room" && <><label className="muted">Комната</label><select value={room} onChange={(e) => setRoom(e.target.value as MansionRoom)}>{ROOMS.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select><button className="primary-button full" onClick={() => submitAction({ type: "search-room", room })}>Обыскать комнату</button></>}
          {dayActionType === "interrogate" && <><select value={targetId} onChange={(e) => setTargetId(e.target.value)}><option value="">Кого допросить?</option>{living.filter((p) => p.id !== dayActor.id).map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select><input value={question} maxLength={180} onChange={(e) => setQuestion(e.target.value)} aria-label="Вопрос игроку"/><button className="primary-button full" disabled={!targetId} onClick={() => submitAction({ type: "interrogate", targetId, question })}>Задать вопрос</button></>}
          {dayActionType === "share-evidence" && <><p className="muted">Твои личные улики: {(session.dayState.privateEvidence[dayActor.id] ?? []).length}</p><select value={evidenceId} onChange={(e) => setEvidenceId(e.target.value)}><option value="">Выбери улику</option>{(session.dayState.privateEvidence[dayActor.id] ?? []).map((card) => <option value={card.id} key={card.id}>{card.title}</option>)}</select><button className="primary-button full" disabled={!evidenceId} onClick={() => submitAction({ type: "share-evidence", evidenceId })}>Показать улику всем</button></>}
          {dayActionType === "study-ritual" && <><p className="muted">Нужны две публичные ритуальные улики. Снижение прогресса на 1.</p><select value={ritualEvidenceA} onChange={(e) => setRitualEvidenceA(e.target.value)}><option value="">Первая улика</option>{session.dayState.publicEvidence.filter((card) => card.kind === "ritual").map((card) => <option key={card.id} value={card.id}>{card.title}</option>)}</select><select value={ritualEvidenceB} onChange={(e) => setRitualEvidenceB(e.target.value)}><option value="">Вторая улика</option>{session.dayState.publicEvidence.filter((card) => card.kind === "ritual" && card.id !== ritualEvidenceA).map((card) => <option key={card.id} value={card.id}>{card.title}</option>)}</select><button className="primary-button full" disabled={!ritualEvidenceA || !ritualEvidenceB} onClick={() => submitAction({ type: "study-ritual", evidenceIds: [ritualEvidenceA, ritualEvidenceB] })}>Замедлить ритуал</button></>}
          {(dayActionType === "guard-player" || dayActionType === "accuse") && <><select value={targetId} onChange={(e) => setTargetId(e.target.value)}><option value="">Выбери игрока</option>{living.filter((p) => p.id !== dayActor.id).map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select><button className="primary-button full" disabled={!targetId} onClick={() => submitAction(dayActionType === "guard-player" ? { type: "guard-player", targetId } : { type: "accuse", targetId })}>{dayActionType === "guard-player" ? "Публично защитить" : "Выдвинуть на суд"}</button></>}
          {dayActionType === "treat-player" && <><p className="muted">Первая помощь доступна один раз за день. Можно восстановить одно здоровье живому раненому.</p><select value={targetId} onChange={(e) => setTargetId(e.target.value)}><option value="">Кого перевязать?</option>{living.filter((p) => p.wounds > 0).map((p) => <option value={p.id} key={p.id}>{p.name} · рана {p.wounds}/2</option>)}</select><button className="primary-button full" disabled={!targetId || Boolean(session.dayState.publicTreatedPlayerId)} onClick={() => submitAction({ type: "treat-player", targetId })}>Оказать первую помощь</button></>}
          {error && <p className="error-text">{error}</p>}
          <div className="host-line"><AudioLines size={17}/><span>Публичное обсуждение происходит голосом игроков, не через приложение.</span></div>
          <p className="microcopy">Публичные улики: {session.dayState.publicEvidence.map((card) => card.title).join(" · ") || "пока нет"}</p>
        </section>}
      </>}

      {session.phase === "event" && event && !pendingClue && <>
        {privateStep === "handoff" ? renderHandoff(eventVoters[eventVoterIndex], `ОБЩЕЕ РЕШЕНИЕ · ГОЛОС ${eventVoterIndex + 1}/${eventVoters.length}`, () => { setPrivateStep("ready"); setPrivateVisible(true); }) : !privateVisible ? renderPrivateReady(eventVoters[eventVoterIndex], "ТАЙНЫЙ ВЫБОР СОБЫТИЯ", () => setPrivateVisible(true)) : <section className="panel narrative screen-enter">
          <div className="section-mark"><Sparkles size={23}/></div><p className="eyebrow">СОБЫТИЕ ОСОБНЯКА · {eventVoters[eventVoterIndex]?.name}</p><h2>{event.title}</h2><p className="round-prompt">{event.description}</p>
          {event.choices.map((choice) => <button className="choice" key={choice.id} onClick={() => castEventVote(choice.id)}><span>›</span>{choice.label}</button>)}
          <p className="microcopy">Голос тайный. Решение требует строгого большинства; иначе сработает исход по умолчанию.</p>
        </section>}
      </>}

      {session.phase === "event-private" && session.eventPrivatePlayerId && !pendingClue && (() => {
        const privatePlayer = players.find((player) => player.id === session.eventPrivatePlayerId);
        if (!privatePlayer) return null;
        const privateMessage = session.lastEventPrivateResults[privatePlayer.id] || "Особняк оставил вам личную подсказку. Сохраните её в тайне.";
        return <>
          {privateStep === "handoff"
            ? renderHandoff(privatePlayer, "ЛИЧНАЯ ПОДСКАЗКА · НЕ ПОКАЗЫВАТЬ", () => { setPrivateStep("ready"); setPrivateVisible(false); })
            : !privateVisible
              ? renderPrivateReady(privatePlayer, "ТОЛЬКО ДЛЯ ВАШИХ ГЛАЗ", () => setPrivateVisible(true))
              : <section className="secret-card screen-enter warm">
                  <div className="secret-top"><span className="eyebrow">СОБЫТИЕ ОСОБНЯКА · ЛИЧНОЕ</span><span className="classified">PRIVATE</span></div>
                  <p className="eyebrow">{privatePlayer.name.toUpperCase()}</p>
                  <h2>Тайна особняка</h2>
                  <p className="role-description">{privateMessage}</p>
                  <button className="primary-button full" onClick={acknowledgeEventPrivateReveal}>Скрыть и перейти к суду <ChevronRight size={18}/></button>
                </section>}
        </>;
      })()}

      {session.phase === "trial" && !pendingClue && <>
        {privateStep === "handoff" ? renderHandoff(trialVoters[trialVoterIndex], `ТАЙНОЕ ГОЛОСОВАНИЕ · ${trialVoterIndex + 1}/${trialVoters.length}`, () => { setPrivateStep("ready"); setPrivateVisible(true); }) : !privateVisible ? renderPrivateReady(trialVoters[trialVoterIndex], "ТАЙНЫЙ ГОЛОС", () => setPrivateVisible(true)) : <section className="panel narrative screen-enter">
          <div className="section-mark"><EyeOff size={23}/></div><p className="eyebrow">ЛИЧНЫЙ ГОЛОС · {trialVoters[trialVoterIndex]?.name}</p><h2>Кого<br/><em>изгнать?</em></h2>
          <p className="muted">Выбор видит только голосующий. Призрак может отдать свой последний голос.</p>
          {living.filter((p) => p.id !== trialVoters[trialVoterIndex]?.id).map((candidate) => <button className="choice" key={candidate.id} onClick={() => castTrialVote(candidate.id)}><span>›</span>{candidate.name}</button>)}
          <p className="microcopy">Голоса: {Object.keys(trialVotes).length}/{trialVoters.length}. Для изгнания нужно строгое большинство.</p>
        </section>}
      </>}

      {session.phase === "night" && nightActor && !pendingClue && <>
        {privateStep === "handoff" ? renderHandoff(nightActor, `НОЧНОЙ ХОД · ${session.nightActionIndex + 1}/${session.nightTurnOrder.length}`, () => { setPrivateStep("ready"); setPrivateVisible(false); }) : !privateVisible ? renderPrivateReady(nightActor, "ЛИЧНОЕ НОЧНОЕ ДЕЙСТВИЕ", () => setPrivateVisible(true)) : <section className={`secret-card screen-enter ${MANSION_ROLES[nightActor.roleId].faction === "cult" ? "danger" : "warm"}`}>
          <div className="secret-top"><span className="eyebrow">НОЧЬ · ЛИЧНОЕ ДЕЙСТВИЕ</span><span className="classified">SECRET</span></div>
          <p className="eyebrow">{nightActor.name.toUpperCase()}</p><h2>{MANSION_ROLES[nightActor.roleId].name}</h2>
          {nightActor.alive && nightActor.roleId === "resident" && <><p className="role-description">Сегодня у тебя нет ночной способности. Передай телефон дальше.</p><button className="primary-button full" onClick={() => makeNightMove("pass")}>Продолжить ночь</button></>}
          {nightActor.alive && (nightActor.roleId === "cultist" || nightActor.roleId === "acolyte") && <><p className="role-description">Культисты могут тихо договориться между собой, пока остальные закрывают глаза. Каждый выбирает цель отдельно.</p><select value={nightTargetId} onChange={(e) => setNightTargetId(e.target.value)}><option value="">Выбрать жертву</option>{living.filter((p) => MANSION_ROLES[p.roleId].faction !== "cult").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><button className="primary-button full" disabled={!nightTargetId} onClick={() => makeNightMove("cult-select", nightTargetId)}>Подтвердить выбор</button></>}
          {nightActor.alive && nightActor.roleId === "detective" && <><p className="role-description">Выбери игрока для осторожного расследования. Результат будет неоднозначным и останется только у тебя.</p><select value={nightTargetId} onChange={(e) => setNightTargetId(e.target.value)}><option value="">Кого проверить?</option>{living.filter((p) => p.id !== nightActor.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><button className="primary-button full" disabled={!nightTargetId} onClick={() => makeNightMove("investigate", nightTargetId)}>Провести расследование</button></>}
          {nightActor.alive && (nightActor.roleId === "doctor" || nightActor.roleId === "guardian") && <><p className="role-description">Выбери игрока, которого хочешь защитить этой ночью.</p><select value={nightTargetId} onChange={(e) => setNightTargetId(e.target.value)}><option value="">Кого защитить?</option>{living.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><button className="primary-button full" disabled={!nightTargetId} onClick={() => makeNightMove(nightActor.roleId === "doctor" ? "protect" : "ward", nightTargetId)}>Установить защиту</button></>}
          {!nightActor.alive && <><p className="role-description">Ты призрак. Ночью больше нельзя применять способности.</p><button className="primary-button full" onClick={() => makeNightMove("pass")}>Передать телефон дальше</button></>}
          {error && <p className="error-text">{error}</p>}
        </section>}
      </>}

      {session.phase === "night-results" && resultActor && !pendingClue && <>
        {!privateVisible ? renderHandoff(resultActor, "ЛИЧНАЯ НОЧНАЯ ПОДСКАЗКА", revealNightResult) : <section className="secret-card screen-enter warm">
          <div className="secret-top"><span className="eyebrow">ТОЛЬКО ДЛЯ ВАШИХ ГЛАЗ</span><span className="classified">PRIVATE</span></div>
          <p className="eyebrow">{resultActor.name.toUpperCase()}</p><h2>Результат ночи</h2>
          <p className="role-description">{currentPrivateResult}</p>
          <button className="primary-button full" onClick={acknowledgeNightResult}>Скрыть и передать дальше <ChevronRight size={18}/></button>
        </section>}
      </>}
      {session.phase === "ending" && !pendingClue && <section className="panel narrative screen-enter">
        <div className="section-mark"><Skull size={24}/></div><p className="eyebrow">РАССВЕТ · ИГРА ЗАВЕРШЕНА</p><h2>{session.winner === "guests" ? "Гости спасены" : "Культ победил"}</h2>
        <p className="ending-copy">{session.winner === "guests" ? "Последний культист разоблачён. С первыми лучами солнца двери особняка распахиваются." : "Ритуал завершён или культ получил численный перевес. Особняк забирает всех."}</p>
        <div className="results">{players.map((player) => <div className="result-row" key={player.id}><span>{player.name}{player.alive ? "" : " · выбыл"}</span><strong>{MANSION_ROLES[player.roleId].name}</strong><small>{MANSION_ROLES[player.roleId].faction === "cult" ? "Культ" : "Гости"}</small></div>)}</div>
        <button className="primary-button full" onClick={reset}>Сыграть снова <ChevronRight size={18}/></button>
      </section>}
    </>}
    {error && screen !== "setup" && <p className="error-text">{error}</p>}
    <footer className="footer"><span>✦</span> НЕКОТОРЫЕ ДВЕРИ ЛУЧШЕ НЕ ОТКРЫВАТЬ <span>✦</span></footer>
  </main>;
}
