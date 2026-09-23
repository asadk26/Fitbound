import { useCallback, useEffect, useRef, useState } from 'react';
import { ENEMIES } from './combat/enemies';
import { audio } from './game/audio';
import { bus } from './game/bus';
import { levelForXp, xpProgress } from './game/progression';
import { getSave, updateSave } from './game/store';
import { CHARACTERS, ENEMY_ART, spriteDataUrl } from './phaser/art';
import { createGame, refreshScale } from './phaser/game';
import { MAPS } from './phaser/maps';
import { Battle, type BattleOutcome } from './ui/Battle';
import { AbilitiesPanel, DIFFICULTY_INFO, MenuPanel, MessageDialog, NpcDialog } from './ui/Panels';
import { useSave } from './ui/useSave';
import type { Difficulty } from './exercise/types';

type Screen = 'title' | 'newgame' | 'world' | 'battle';
type Overlay = { kind: 'npc'; id: string } | { kind: 'message'; text: string } | { kind: 'abilities' } | { kind: 'menu' } | null;

export default function App() {
  const save = useSave();
  const host = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState<Screen>('title');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [enemyId, setEnemyId] = useState<string | null>(null);
  const [hint, setHint] = useState(true);
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;

  // Boot Phaser once.
  useEffect(() => {
    if (!host.current) return;
    const el = host.current;
    createGame(el);
    const ro = new ResizeObserver(() => refreshScale());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    audio.setSound(save.settings.sound);
    audio.voiceOn = save.settings.voice;
  }, [save.settings.sound, save.settings.voice]);

  // World events from Phaser.
  useEffect(() => {
    const offs = [
      // A (re)started world scene doesn't know whether UI is covering it.
      bus.on('world:ready', () => bus.emit('world:setPaused', { paused: screenRef.current !== 'world' || overlayRef.current !== null })),
      bus.on('world:encounter', ({ enemyId }) => {
        if (screenRef.current !== 'world') return;
        bus.emit('world:setPaused', { paused: true });
        setOverlay(null);
        setEnemyId(enemyId);
        setScreen('battle');
      }),
      bus.on('world:talk', ({ npcId }) => {
        if (screenRef.current !== 'world') return;
        bus.emit('world:setPaused', { paused: true });
        setOverlay({ kind: 'npc', id: npcId });
      }),
      bus.on('world:blocked', ({ text }) => {
        if (screenRef.current !== 'world') return;
        bus.emit('world:setPaused', { paused: true });
        setOverlay({ kind: 'message', text });
      }),
      bus.on('world:moved', ({ map, x, y, initial }) => {
        if (screenRef.current !== 'world' && !initial) return;
        if (!initial) setHint(false);
        updateSave((s) => void (s.location = { map, x, y }));
      }),
    ];
    return () => offs.forEach((f) => f());
  }, []);

  // Pause world input while anything is layered on top of it.
  useEffect(() => {
    bus.emit('world:setPaused', { paused: screen !== 'world' || overlay !== null });
  }, [screen, overlay]);

  const closeOverlay = () => setOverlay(null);

  const startGame = () => {
    audio.unlock();
    audio.select();
    const s = getSave();
    const loc = s.location ?? { map: 'village' as const, ...MAPS.village.spawn };
    bus.emit('world:goto', { map: loc.map, x: loc.x, y: loc.y });
    setScreen('world');
  };

  const onBattleExit = useCallback((outcome: BattleOutcome) => {
    setEnemyId(null);
    setScreen('world');
    if (outcome === 'defeat') {
      // Wake up at the inn, safe and sound.
      updateSave((s) => void (s.location = { map: 'village', x: 10, y: 14 }));
      bus.emit('world:goto', { map: 'village', x: 10, y: 14 });
    }
  }, []);

  const level = levelForXp(save.xp);
  const xp = xpProgress(save.xp);

  return (
    <div className={`app screen-${screen}`}>
      <div className="stage" ref={host} />

      {screen === 'title' && (
        <TitleScreen
          canContinue={save.created}
          onContinue={startGame}
          onNew={() => {
            audio.unlock();
            audio.select();
            setScreen('newgame');
          }}
        />
      )}

      {screen === 'newgame' && (
        <NewGame
          onBack={() => setScreen('title')}
          onStart={(name, difficulty) => {
            updateSave((s) => {
              const fresh = { ...s };
              fresh.created = true;
              fresh.heroName = name || 'Hero';
              fresh.settings.difficulty = difficulty;
              fresh.location = { map: 'village', ...MAPS.village.spawn };
              return fresh;
            });
            startGame();
            window.setTimeout(() => setOverlay({ kind: 'npc', id: 'elder' }), 700);
          }}
        />
      )}

      {screen === 'world' && (
        <>
          <div className="world-hud">
            <div className="hud-card">
              <img src={spriteDataUrl(CHARACTERS.hero, 2, 3)} alt="" className="hud-face" />
              <div>
                <b>
                  {save.heroName} <span className="lv">Lv {level}</span>
                </b>
                <div className="xpbar small">
                  <div style={{ width: `${(xp.into / xp.needed) * 100}%` }} />
                </div>
              </div>
              <span className="gold">◆ {save.gold}</span>
            </div>
            <div className="hud-buttons">
              <button className="btn btn-sm" onClick={() => setOverlay({ kind: 'abilities' })}>
                Abilities
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => setOverlay({ kind: 'menu' })}>
                Menu
              </button>
            </div>
          </div>
          {hint && <div className="hint">Tap anywhere to walk. Tap people to talk. The dungeon lies to the north.</div>}
        </>
      )}

      {screen === 'battle' && enemyId && ENEMIES[enemyId] && <Battle key={enemyId} enemyId={enemyId} onExit={onBattleExit} />}

      {overlay?.kind === 'npc' && (
        <NpcDialog
          npcId={overlay.id}
          onClose={closeOverlay}
          onOpenAbilities={() => setOverlay({ kind: 'abilities' })}
          onPractice={() => {
            setOverlay(null);
            setEnemyId('dummy');
            setScreen('battle');
          }}
        />
      )}
      {overlay?.kind === 'message' && <MessageDialog text={overlay.text} onClose={closeOverlay} />}
      {overlay?.kind === 'abilities' && <AbilitiesPanel onClose={closeOverlay} />}
      {overlay?.kind === 'menu' && (
        <MenuPanel
          onClose={closeOverlay}
          onQuitToTitle={() => {
            setOverlay(null);
            setScreen('title');
          }}
        />
      )}
    </div>
  );
}

function TitleScreen({ canContinue, onContinue, onNew }: { canContinue: boolean; onContinue: () => void; onNew: () => void }) {
  return (
    <div className="title-screen">
      <div className="title-card">
        <div className="logo">
          FIT<span>BOUND</span>
        </div>
        <p className="tagline">A fantasy adventure you play with your body.</p>
        <div className="title-sprites">
          <img src={spriteDataUrl(CHARACTERS.hero, 5, 0)} alt="" />
          <span className="vs">⚔</span>
          <img src={enemyArt('skeleton')} alt="" className="flip" />
        </div>
        <div className="title-buttons">
          {canContinue && (
            <button className="btn btn-big" onClick={onContinue}>
              Continue
            </button>
          )}
          <button className={`btn ${canContinue ? 'btn-ghost' : 'btn-big'}`} onClick={onNew}>
            {canContinue ? 'New adventure' : 'Begin adventure'}
          </button>
        </div>
        <p className="fine">
          Push-ups swing your sword. Squats raise your shield. Jumping jacks cast magic. Your phone’s camera counts every rep — processed on-device, never recorded or uploaded.
        </p>
      </div>
    </div>
  );
}

function enemyArt(id: string): string {
  return spriteDataUrl(ENEMY_ART[id], 5, 0);
}

function NewGame({ onBack, onStart }: { onBack: () => void; onStart: (name: string, d: Difficulty) => void }) {
  const save = getSave();
  const [name, setName] = useState(save.created ? save.heroName : '');
  const [difficulty, setDifficulty] = useState<Difficulty>(save.settings.difficulty);
  const overwriting = save.created;
  return (
    <div className="title-screen">
      <div className="title-card newgame">
        <h2>Create your hero</h2>
        <label className="field">
          <span>Name</span>
          <input value={name} maxLength={16} placeholder="Hero" onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="field">
          <span>Fitness level</span>
          <div className="diff-cards">
            {(Object.keys(DIFFICULTY_INFO) as Difficulty[]).map((d) => (
              <button key={d} className={`diff-card ${difficulty === d ? 'on' : ''}`} onClick={() => setDifficulty(d)}>
                <b>{DIFFICULTY_INFO[d].label}</b>
                <span>{DIFFICULTY_INFO[d].blurb}</span>
                <span className="diff-reps">{d === 'beginner' ? '3 push-ups · 5 squats · 6 jacks' : d === 'intermediate' ? '5 push-ups · 8 squats · 10 jacks' : '8 push-ups · 12 squats · 15 jacks'}</span>
              </button>
            ))}
          </div>
          <span className="muted small">You can change this any time from the Menu. Every level includes easier movement options.</span>
        </div>
        <p className="safety">
          FITBOUND counts movements for play — it doesn’t assess form or give medical advice. Warm up, clear some space, stop if anything hurts, and rest whenever you like.
        </p>
        {overwriting && <p className="warn-text">Starting a new adventure keeps your level and unlocks but restarts the story from the village.</p>}
        <div className="row">
          <button className="btn btn-ghost" onClick={onBack}>
            Back
          </button>
          <button className="btn btn-big" onClick={() => onStart(name.trim(), difficulty)}>
            Begin
          </button>
        </div>
      </div>
    </div>
  );
}
