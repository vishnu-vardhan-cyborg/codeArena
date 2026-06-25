import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  ChevronRight,
  Crosshair,
  Flame,
  Swords,
} from "lucide-react";
import "../../../styles/features/SeasonIntro.css";

const seasonScenes = [
  {
    kicker: "Season 01 // Bhagavad Gita",
    title: "The battlefield is your focus.",
    body:
      "Every challenge starts with hesitation. This season turns that moment into disciplined action.",
  },
  {
    kicker: "Arena principle",
    title: "Solve without chasing the scoreboard.",
    body:
      "XP, ranks, clans, and streaks matter here, but the first rule is cleaner action: read, reason, submit, reflect.",
  },
  {
    kicker: "Core verse",
    title: "Action before reward.",
    body:
      "The season is built around a simple rule from the Gita: your right is to action, not to the result alone.",
  },
  {
    kicker: "Your path",
    title: "Enter with a task, leave with momentum.",
    body:
      "Practice problems, defend your streak, compete with clans, and turn each solved bug into progress.",
  },
];

const seasonRules = [
  {
    icon: Crosshair,
    label: "Daily aim",
    text: "Choose one focused challenge and finish the loop.",
  },
  {
    icon: Flame,
    label: "Streak dharma",
    text: "Progress is counted when a problem is solved.",
  },
  {
    icon: Swords,
    label: "Clan field",
    text: "Compete together without losing your own discipline.",
  },
];

const verse = {
  source: "Bhagavad Gita 2.47",
  sanskrit: "karmany evadhikaras te",
  meaning: "You have a right to action, not to its fruits.",
};

export default function SeasonIntro() {
  const navigate = useNavigate();
  const [sceneIndex, setSceneIndex] = useState(0);
  const [typedVerse, setTypedVerse] = useState("");
  const [typedMeaning, setTypedMeaning] = useState("");
  const currentScene = seasonScenes[sceneIndex];
  const isVerseScene = sceneIndex === 2;
  const isFinalScene = sceneIndex === seasonScenes.length - 1;

  const progress = useMemo(
    () => Math.round(((sceneIndex + 1) / seasonScenes.length) * 100),
    [sceneIndex]
  );

  useEffect(() => {
    if (!isVerseScene) {
      setTypedVerse("");
      setTypedMeaning("");
      return undefined;
    }

    setTypedVerse("");
    setTypedMeaning("");

    let verseIndex = 0;
    let meaningIndex = 0;
    let meaningTimer;

    const verseTimer = window.setInterval(() => {
      verseIndex += 1;
      setTypedVerse(verse.sanskrit.slice(0, verseIndex));

      if (verseIndex >= verse.sanskrit.length) {
        window.clearInterval(verseTimer);

        meaningTimer = window.setInterval(() => {
          meaningIndex += 1;
          setTypedMeaning(verse.meaning.slice(0, meaningIndex));

          if (meaningIndex >= verse.meaning.length) {
            window.clearInterval(meaningTimer);
          }
        }, 26);
      }
    }, 42);

    return () => {
      window.clearInterval(verseTimer);
      if (meaningTimer) {
        window.clearInterval(meaningTimer);
      }
    };
  }, [isVerseScene]);

  const handleNext = () => {
    if (isFinalScene) {
      localStorage.setItem("codeArenaSeasonIntroSeen", "true");
      navigate("/home");
      return;
    }

    setSceneIndex((current) => current + 1);
  };

  return (
    <main className="season-intro-page">
      <div className="season-intro-grid" aria-hidden="true" />
      <div className="season-intro-orbit" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <section className="season-intro-shell">
        <aside className="season-intro-console">
          <span className="season-intro-console-kicker">CodeArena season</span>
          <pre aria-label="Season 01 ASCII title">{`  ____  _____    _    ____   ___  _   _
 / ___|| ____|  / \\  / ___| / _ \\| \\ | |
 \\___ \\|  _|   / _ \\ \\___ \\| | | |  \\| |
  ___) | |___ / ___ \\ ___) | |_| | |\\  |
 |____/|_____/_/   \\_\\____/ \\___/|_| \\_|

                 01`}</pre>

          <div className="season-intro-meter">
            <span>Intro progress</span>
            <strong>{progress}%</strong>
            <div>
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>
        </aside>

        <section className="season-intro-story" aria-live="polite">
          <div className="season-intro-story-card" key={currentScene.title}>
            <span className="season-intro-kicker">{currentScene.kicker}</span>
            <h1>{currentScene.title}</h1>
            <p>{currentScene.body}</p>

            {isVerseScene ? (
              <div className="season-intro-verse">
                <span>{verse.source}</span>
                <strong>
                  {typedVerse}
                  {typedVerse.length < verse.sanskrit.length ? <i /> : null}
                </strong>
                <p>
                  {typedMeaning}
                  {typedMeaning.length > 0 &&
                  typedMeaning.length < verse.meaning.length ? (
                    <i />
                  ) : null}
                </p>
              </div>
            ) : (
              <div className="season-intro-rule-grid">
                {seasonRules.map((rule) => {
                  const Icon = rule.icon;
                  return (
                    <article key={rule.label}>
                      <Icon size={18} />
                      <strong>{rule.label}</strong>
                      <span>{rule.text}</span>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="season-intro-actions">
            <button
              className="season-intro-secondary"
              type="button"
              onClick={() => navigate("/season-one")}
            >
              <BookOpen size={18} />
              Season details
            </button>
            <button
              className="season-intro-primary"
              type="button"
              onClick={handleNext}
            >
              {isFinalScene ? "Enter arena" : "Continue"}
              <ChevronRight size={18} />
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
