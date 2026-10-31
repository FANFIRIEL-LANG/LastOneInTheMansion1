import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, AudioLines, Check, ChevronRight, DoorOpen, Eye, EyeOff, Ghost, Moon, Shield, Skull, Sparkles, Volume2, VolumeX } from "lucide-react";
import { assignRoles } from "./game/roles";
import { INTRO, ROUNDS } from "./game/story";
import type { Player } from "./game/types";
import { getWinningTeam } from "./game/outcome";
import { concealRole, confirmPhoneReceived, hideAndPass, revealRole, startRoleFlow, type TransferState } from "./game/transfer";
import { shouldConcealSecretRole } from "./game/privacyLifecycle";

type Screen = "home" | "setup" | "handoff" | "ready" | "secret" | "intro" | "round" | "vote" | "ending";
function speak(text: string, enabled: boolean) {
  if (!enabled || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ru-RU";
  utterance.rate = 0.92;
  utterance.pitch = 0.86;
  window.speechSynthesis.speak(utterance);
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [names, setNames] = useState(["Игрок 1", "Игрок 2", "Игрок 3", "Игрок 4", "Игрок 5"]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [transfer, setTransfer] = useState<TransferState>(startRoleFlow());
  const [roundIndex, setRoundIndex] = useState(0);
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [voterIndex, setVoterIndex] = useState(0);
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [showRoleDetails, setShowRoleDetails] = useState(true);
  const [error, setError] = useState("");

  const currentPlayer = players[transfer.playerIndex];
  const round = ROUNDS[roundIndex % ROUNDS.length];
  const voteCounts = useMemo(() => Object.values(votes).reduce<Record<string, number>>((acc, id) => {
    acc[id] = (acc[id] || 0) + 1; return acc;
  }, {}), [votes]);

  // Conceal private roles on every browser/iOS lifecycle transition that can expose the screen.
  useEffect(() => {
    const hideSecret = (event: "visibilitychange" | "blur" | "pagehide") => {
      if (!shouldConcealSecretRole(screen, event, document.visibilityState)) return;
      window.speechSynthesis?.cancel();
      setShowRoleDetails(false);
      setScreen("ready");
      setTransfer((state) => concealRole(state));
    };
    const onVisibilityChange = () => hideSecret("visibilitychange");
    const onBlur = () => hideSecret("blur");
    const onPageHide = () => hideSecret("pagehide");

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [screen]);

  function beginSetup() {
    setNames(["Игрок 1", "Игрок 2", "Игрок 3", "Игрок 4", "Игрок 5"]);
    setError("");
    setScreen("setup");
  }

  function startGame() {
    const normalized = names.map((name, index) => name.trim() || `Игрок ${index + 1}`);
    if (normalized.length < 4 || normalized.length > 7) { setError("Нужно от 4 до 7 игроков."); return; }
    const roles = assignRoles(normalized, true);
    const nextPlayers = normalized.map((name, index) => ({ id: `p${index}`, name, role: roles[index], revealed: false }));
    setPlayers(nextPlayers);
    setTransfer(startRoleFlow());
    setRoundIndex(0);
    setVotes({});
    setVoterIndex(0);
    setScreen("handoff");
  }

  function receivePhone() {
    if (transfer.stage !== "handoff") return;
    setTransfer((state) => confirmPhoneReceived(state));
    setScreen("ready");
    speak(`${currentPlayer?.name}, когда будете готовы, получите свою роль.`, speechEnabled);
  }

  function revealCurrentRole() {
    if (transfer.stage !== "ready") return;
    setTransfer((state) => revealRole(state));
    setShowRoleDetails(true);
    setScreen("secret");
    // Private role, faction, description and objective must never enter the public narration queue.
  }

  function confirmRoleAndPass() {
    if (!currentPlayer || transfer.stage !== "secret") return;
    setPlayers((all) => all.map((player, index) => index === transfer.playerIndex ? { ...player, revealed: true } : player));
    setShowRoleDetails(false);
    window.speechSynthesis?.cancel();
    const next = hideAndPass(transfer, players.length);
    setTransfer(next);
    if (next.stage === "next") {
      setScreen("intro");
      speak(INTRO.map((beat) => beat.title + ". " + beat.text).join(" "), speechEnabled);
    } else setScreen("handoff");
  }

  function beginRound() {
    setScreen("round");
    speak(round.title + ". " + round.prompt, speechEnabled);
  }

  function completeRound() {
    if (roundIndex + 1 < ROUNDS.length) {
      const nextIndex = roundIndex + 1;
      setRoundIndex(nextIndex);
      setScreen("round");
      speak(ROUNDS[nextIndex].title + ". " + ROUNDS[nextIndex].prompt, speechEnabled);
      return;
    }
    setVotes({});
    setVoterIndex(0);
    setScreen("vote");
    speak("Три события позади. Время тайного голосования. Передавайте телефон по кругу.", speechEnabled);
  }

  function submitVote(voterId: string, suspectId: string) {
    if (!suspectId || votes[voterId] || !players.some((player) => player.id === suspectId)) return;
    const next = { ...votes, [voterId]: suspectId };
    setVotes(next);
    if (Object.keys(next).length >= players.length) setScreen("ending");
    else setVoterIndex((index) => index + 1);
  }

  function reset() {
    window.speechSynthesis?.cancel();
    setPlayers([]);
    setVotes({});
    setScreen("home");
  }

  const roleColor = currentPlayer?.role.team === "entity" ? "danger" : "warm";
  const possessed = players.find((player) => player.role.team === "entity");
  const guestsWon = possessed ? getWinningTeam(possessed.id, votes, players.length) === "guests" : false;

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar">
        <button className="brand" onClick={() => screen === "home" ? undefined : reset()} aria-label="На главную">
          <span className="brand-mark"><Moon size={17} /></span><span>THE MANOR <small>HALLOWEEN GAME</small></span>
        </button>
        <button className="icon-button" onClick={() => setSpeechEnabled((value) => {
          if (value) window.speechSynthesis?.cancel();
          return !value;
        })} aria-label={speechEnabled ? "Выключить озвучку" : "Включить озвучку"}>
          {speechEnabled ? <Volume2 size={18}/> : <VolumeX size={18}/>}
        </button>
      </header>

      {screen === "home" && <section className="hero screen-enter">
        <div className="eyebrow"><span className="dot"/> HALLOWEEN EDITION · 2026</div>
        <div className="hero-art"><div className="moon-disc"/><div className="silhouette-house"><span/><i/><b/></div><div className="fog fog-a"/><div className="fog fog-b"/></div>
        <p className="kicker">ОДНА НОЧЬ. ОДИН ОСОБНЯК. НЕ ВСЕ ДОЖИВУТ ДО РАССВЕТА.</p>
        <h1>Последний<br/><em>в особняке</em></h1>
        <p className="intro-copy">Среди гостей прячется нечто нечеловеческое. Доверяй интуиции. Не доверяй соседу.</p>
        <button className="primary-button" onClick={beginSetup}>Открыть двери <ChevronRight size={18}/></button>
        <div className="hero-meta"><span><UsersIcon/> 4–7 ИГРОКОВ</span><span><Moon size={14}/> 20–30 МИНУТ</span><span><Shield size={14}/> 1 ТЕЛЕФОН</span></div>
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
        <div className="privacy-note"><Shield size={17}/><span>Роли будут показаны по одной. Следующая роль не появится, пока новый игрок сам не нажмёт кнопку.</span></div>
        <button className="primary-button full" onClick={startGame}>Начать историю <ChevronRight size={18}/></button>
      </section>}

      {screen === "handoff" && <section className="handoff screen-enter">
        <div className="seal"><span>✦</span><Ghost size={40}/></div>
        <p className="eyebrow">СЕКРЕТНЫЙ КОНВЕРТ · {transfer.playerIndex + 1}/{players.length}</p>
        <h2>Передайте<br/><em>телефон</em></h2>
        <p className="handoff-name">{players[transfer.playerIndex]?.name}</p>
        <p className="muted">Пусть только этот игрок возьмёт телефон. Убедитесь, что остальные не смотрят на экран.</p>
        <button className="primary-button full" onClick={receivePhone}>Телефон у меня <ChevronRight size={18}/></button>
        <p className="microcopy">Роль скрыта до отдельного подтверждения.</p>
      </section>}

      {screen === "ready" && <section className="handoff screen-enter">
        <div className="seal"><Eye size={36}/></div><p className="eyebrow">ТОЛЬКО ДЛЯ ВАШИХ ГЛАЗ</p>
        <h2>Готовы узнать<br/><em>свою тайну?</em></h2>
        <p className="muted">Убедитесь, что экран видите только вы. После открытия запомните роль и передайте телефон дальше.</p>
        <button className="primary-button full" onClick={revealCurrentRole}>Получить роль <Eye size={17}/></button>
      </section>}

      {screen === "secret" && currentPlayer && <section className={`secret-card screen-enter ${roleColor}`} >
        <div className="secret-top"><span className="eyebrow">ЛИЧНОЕ ДЕЛО · НЕ ПОКАЗЫВАТЬ</span><span className="classified">CLASSIFIED</span></div>
        <div className="role-icon">{currentPlayer.role.team === "entity" ? <Skull size={35}/> : <Shield size={35}/>}</div>
        <p className="eyebrow">{currentPlayer.name.toUpperCase()}, ЭТО ВАША РОЛЬ</p>
        <h2>{showRoleDetails ? currentPlayer.role.name : "Роль скрыта"}</h2>
        {showRoleDetails && <><p className="role-description">{currentPlayer.role.description}</p><div className="objective"><span>ВАША ЦЕЛЬ</span><p>{currentPlayer.role.objective}</p></div></>}
        <button className="primary-button full" onClick={confirmRoleAndPass}><Check size={18}/> Я запомнил роль</button>
        <p className="microcopy">После нажатия секрет исчезнет. Вернуться к нему нельзя.</p>
      </section>}

      {screen === "intro" && <section className="panel narrative screen-enter">
        <div className="section-mark"><DoorOpen size={23}/></div><p className="eyebrow">ГЛАВА ПЕРВАЯ · ПОЛНОЧЬ</p><h2>Особняк<br/><em>просыпается</em></h2>
        {INTRO.map((beat) => <article className="story-beat" key={beat.title}><span>{beat.title}</span><p>{beat.text}</p></article>)}
        <div className="host-line"><AudioLines size={17}/><span>Ведущий ждёт, пока все прочитают историю.</span></div>
        <button className="primary-button full" onClick={beginRound}>Начать первый раунд <ChevronRight size={18}/></button>
      </section>}

      {screen === "round" && <section className="panel narrative screen-enter">
        <div className="round-counter">СОБЫТИЕ {roundIndex + 1} ИЗ {ROUNDS.length} <span>·</span> НОЧЬ НЕ КОНЧАЕТСЯ</div>
        <div className="section-mark"><Sparkles size={23}/></div><p className="eyebrow">СОБЫТИЕ ОСОБНЯКА</p><h2>{round.title}</h2>
        <p className="round-prompt">{round.prompt}</p>
        <div className="choice-list">{round.choices.map((choice, index) => <div className="choice" key={choice}><span>{index + 1}</span>{choice}</div>)}</div>
        <div className="host-line"><AudioLines size={17}/><span>Ведущий озвучит событие. Обсудите решение вслух.</span></div>
        <button className="primary-button full" onClick={completeRound}>{roundIndex + 1 < ROUNDS.length ? "Следующее событие" : "Начать голосование"} <ChevronRight size={18}/></button>
      </section>}

      {screen === "vote" && <section className="panel narrative screen-enter">
        <div className="section-mark"><EyeOff size={23}/></div><p className="eyebrow">ОБСУЖДЕНИЕ · ТАЙНОЕ ГОЛОСОВАНИЕ</p><h2>Кому ты<br/><em>не доверяешь?</em></h2>
        <p className="muted">Передавайте телефон по кругу. Каждый выбирает подозреваемого, не показывая свой выбор остальным.</p>
        {players[voterIndex] && <div className="vote-row"><strong>{players[voterIndex].name}</strong><select key={players[voterIndex].id} defaultValue="" onChange={(event) => submitVote(players[voterIndex].id, event.target.value)} aria-label={`Голос игрока ${players[voterIndex].name}`}><option value="" disabled>Выбрать подозреваемого</option>{players.filter((candidate) => candidate.id !== players[voterIndex].id).map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.name}</option>)}</select></div>}
        <p className="microcopy">Голоса приняты: {Object.keys(votes).length}/{players.length}. Передайте телефон следующему игроку.</p>
      </section>}

      {screen === "ending" && <section className="panel narrative screen-enter">
        <div className="section-mark"><Skull size={24}/></div><p className="eyebrow">РАССВЕТ БЛИЗКО</p><h2>Кто пережил<br/><em>эту ночь?</em></h2>
        <div className="results">{players.map((player) => <div className="result-row" key={player.id}><span>{player.name}</span><strong>{player.role.name}</strong><small>{voteCounts[player.id] || 0} голосов</small></div>)}</div>
        <p className="ending-copy">{guestsWon ? "Гости вычислили одержимого! С первыми лучами солнца двери особняка распахиваются." : "Одержимый пережил голосование. Особняк снова ждёт новых гостей…"}</p>
        <button className="primary-button full" onClick={reset}>Сыграть снова <ChevronRight size={18}/></button>
      </section>}

      <footer className="footer"><span>✦</span> НЕКОТОРЫЕ ДВЕРИ ЛУЧШЕ НЕ ОТКРЫВАТЬ <span>✦</span></footer>
    </main>
  );
}

function UsersIcon() {
  return <span className="users-icon">♟</span>;
}
