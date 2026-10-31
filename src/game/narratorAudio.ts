export type NarratorClipId =
  | "narrator_welcome"
  | "narrator_house"
  | "narrator_rules_public"
  | "narrator_day_start"
  | "narrator_day_actions"
  | "narrator_event_blood_moon"
  | "narrator_event_basement"
  | "narrator_event_portrait"
  | "narrator_event_vote"
  | "narrator_trial"
  | "narrator_night"
  | "narrator_cult_whisper"
  | "narrator_dawn"
  | "narrator_attack_blocked"
  | "narrator_no_attack"
  | "narrator_guests_win"
  | "narrator_cult_win"
  | "narrator_restart";

export const NARRATOR_TEXT: Record<NarratorClipId, string> = {
  narrator_welcome: "Добро пожаловать в особняк. Сегодня двери откроются только один раз. Среди вас есть те, кто пришёл сюда не случайно. Слушайте друг друга. И не спешите доверять даже самым убедительным словам.",
  narrator_house: "Ветер захлопывает тяжёлую дверь. Телефоны теряют сеть. Где-то наверху загорается лампа — хотя электричество в этом доме отключили сорок лет назад. Кажется, особняк ждал именно вас.",
  narrator_rules_public: "Днём говорите открыто: спорьте, задавайте вопросы, делитесь уликами и обвиняйте. Ночью телефон будет переходить из рук в руки. Личные действия и результаты увидит только тот, кому они предназначены. Приложение не подслушивает ваши разговоры и не передаёт сообщения между игроками.",
  narrator_day_start: "Наступает день. Осмотрите особняк, сопоставьте найденное и решите, кому можно верить. У каждого живого гостя будет одно публичное действие.",
  narrator_day_actions: "Выберите действие и объявите группе, что вы собираетесь сделать. Помните: допрос не заставляет человека говорить правду. А найденная улика сначала принадлежит только тому, кто её обнаружил.",
  narrator_event_blood_moon: "За окнами поднимается кровавая луна. Красный свет медленно ползёт по стенам. В глубине дома что-то отвечает на её появление. Особняк требует продолжения ритуала.",
  narrator_event_basement: "Из запертого подвала доносится три коротких удара. Затем голос произносит ваше имя — хотя никто не называл его вслух. Дверь начинает дрожать.",
  narrator_event_portrait: "Старый портрет покрывается трещинами. Краска осыпается, и под ней проступает другое лицо. Оно смотрит прямо на вас. Кажется, оно пытается что-то сказать.",
  narrator_event_vote: "Решение за вами. Обсудите варианты и проголосуйте тайно. Особняк примет только тот выбор, за которым стоит большинство.",
  narrator_trial: "Настало время суда. Назначьте подозреваемого тайным голосованием. Для изгнания потребуется строгое большинство. Если согласия не будет, никто не покинет зал.",
  narrator_night: "Свет гаснет. Закройте глаза. Не подсказывайте друг другу и не называйте свои роли. Телефон пройдёт по кругу — каждый получит только своё ночное действие.",
  narrator_cult_whisper: "Культ просыпается. Остальные не должны ничего услышать. У вас есть несколько мгновений, чтобы тихо согласовать цель. Затем каждый участник культа подтвердит свой выбор на телефоне.",
  narrator_dawn: "Ночь отступает. Первые серые полосы рассвета проступают в окнах. Но в особняке стало на одно спокойное сердце меньше.",
  narrator_attack_blocked: "Кто-то пытался добраться до жертвы. Но этой ночью защита оказалась сильнее. До рассвета никто не исчез.",
  narrator_no_attack: "Ночь прошла в тревожной тишине. Никто не знает, было ли это затишье милостью — или частью чужого плана.",
  narrator_guests_win: "Ритуал сорван. Последний участник культа разоблачён. Двери особняка медленно открываются. На этот раз рассвет принадлежит вам.",
  narrator_cult_win: "Последняя свеча вспыхивает сама собой. Ритуал завершён. Особняк больше не отпустит своих гостей. Культ победил.",
  narrator_restart: "Особняк снова затих. Но если вы вернётесь, он узнает вас."
};

let activeAudio: HTMLAudioElement | null = null;

export function stopNarrator(): void {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

/** Plays a bundled offline MP3. Until recordings are added, uses the browser voice as a temporary fallback. */
export function playNarratorClip(id: NarratorClipId, enabled: boolean): void {
  if (!enabled || typeof window === "undefined") return;
  stopNarrator();
  const fallback = () => {
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(NARRATOR_TEXT[id]);
    utterance.lang = "ru-RU";
    utterance.rate = 0.92;
    utterance.pitch = 0.86;
    window.speechSynthesis.speak(utterance);
  };
  const audio = new Audio(`/audio/narrator/${id}.mp3`);
  activeAudio = audio;
  audio.preload = "auto";
  audio.onended = () => { if (activeAudio === audio) activeAudio = null; };
  audio.onerror = fallback;
  void audio.play().catch(fallback);
}
