import { useState } from 'react';
import { EXERCISES, isPlayable, isUnlocked, MAX_LOADOUT, targetFor } from '../exercise/registry';
import type { Difficulty } from '../exercise/types';
import { audio } from '../game/audio';
import { levelForXp, MAX_UPGRADE, SHOP_ITEMS, statsFor, upgradeCost, xpProgress } from '../game/progression';
import { resetSave } from '../game/save';
import { replaceSave, updateSave } from '../game/store';
import { GUARDIANS } from '../phaser/maps';
import { CHARACTERS, iconDataUrl, spriteDataUrl } from '../phaser/art';
import { useSave } from './useSave';

export const DIFFICULTY_INFO: Record<Difficulty, { label: string; blurb: string }> = {
  beginner: { label: 'Beginner', blurb: 'Short sets and easier movement standards. A great place to start.' },
  intermediate: { label: 'Intermediate', blurb: 'Moderate sets for people who exercise regularly.' },
  advanced: { label: 'Advanced', blurb: 'Longer sets and deeper movement standards.' },
};

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ── Ability loadout ──────────────────────────────────────────────────────

export function AbilitiesPanel({ onClose }: { onClose: () => void }) {
  const save = useSave();
  const level = levelForXp(save.xp);
  const d = save.settings.difficulty;

  const toggle = (id: string) => {
    audio.select();
    updateSave((s) => {
      if (s.loadout.includes(id)) {
        if (s.loadout.length > 1) s.loadout = s.loadout.filter((x) => x !== id);
      } else if (s.loadout.length < MAX_LOADOUT) s.loadout.push(id);
    });
  };

  return (
    <Modal title="Abilities" onClose={onClose} wide>
      <p className="muted">
        Equip up to {MAX_LOADOUT} exercise abilities ({save.loadout.length}/{MAX_LOADOUT} equipped). Pick the workout you want today — you never need every ability in every battle.
      </p>
      <div className="ex-list">
        {EXERCISES.map((ex) => {
          const unlocked = isUnlocked(ex, level);
          const playable = isPlayable(ex);
          const equipped = save.loadout.includes(ex.id);
          const t = targetFor(ex, d, save.settings.targetAdjust);
          return (
            <div key={ex.id} className={`ex-card ${equipped ? 'ex-on' : ''} ${!unlocked || !playable ? 'ex-off' : ''}`} style={{ ['--ability' as string]: ex.ability.color }}>
              <img src={iconDataUrl(unlocked ? ex.ability.icon : 'lock')} alt="" className="pix-icon" />
              <div className="ex-text">
                <b>{unlocked ? ex.ability.name : '???'}</b>
                <span className="ex-sub">
                  {ex.name} · {ex.kind === 'hold' ? `${t}s hold` : `${t} reps`} · {ex.camera.view === 'side' ? 'side view' : 'front view'}
                </span>
                {unlocked && <span className="ex-desc">{ex.ability.description}</span>}
                {unlocked && playable && <span className="ex-alt">Easier option: {ex.alternative}</span>}
                <span className="ex-tags">
                  {!unlocked && <span className="tag tag-dim">Unlocks at Lv {ex.unlock.level}</span>}
                  {unlocked && !playable && <span className="tag tag-dim">Camera detector in development</span>}
                  {unlocked && playable && <span className="tag tag-ok">Camera-verified</span>}
                </span>
              </div>
              {unlocked && playable && (
                <button className={`btn ${equipped ? '' : 'btn-ghost'}`} onClick={() => toggle(ex.id)} disabled={!equipped && save.loadout.length >= MAX_LOADOUT}>
                  {equipped ? 'Equipped' : 'Equip'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ── Menu: stats + settings ───────────────────────────────────────────────

export function MenuPanel({ onClose, onQuitToTitle }: { onClose: () => void; onQuitToTitle: () => void }) {
  const save = useSave();
  const level = levelForXp(save.xp);
  const stats = statsFor(level, save.upgrades);
  const xp = xpProgress(save.xp);
  const [confirmReset, setConfirmReset] = useState(false);
  const set = (fn: (s: typeof save.settings) => void) =>
    updateSave((s) => {
      fn(s.settings);
      audio.setSound(s.settings.sound);
      audio.voiceOn = s.settings.voice;
    });

  return (
    <Modal title="Menu" onClose={onClose} wide>
      <section className="stat-block">
        <h3>
          {save.heroName} · Lv {level}
        </h3>
        <div className="xpbar">
          <div style={{ width: `${(xp.into / xp.needed) * 100}%` }} />
        </div>
        <div className="stat-grid">
          <span>HP {stats.maxHp}</span>
          <span>ATK {stats.atk}</span>
          <span>DEF {stats.def}</span>
          <span>MAG {stats.mag}</span>
          <span>Gold {save.gold}</span>
          <span>XP {save.xp}</span>
        </div>
        <p className="muted small">
          Lifetime: {save.totals.cameraReps} camera-verified reps · {save.totals.manualReps} manual reps · {save.totals.holdSeconds}s of planks · {save.totals.battlesWon} battles won · dungeon cleared {save.clears}×
        </p>
      </section>

      <section>
        <h3>Fitness level</h3>
        <div className="seg">
          {(Object.keys(DIFFICULTY_INFO) as Difficulty[]).map((d) => (
            <button key={d} className={`btn ${save.settings.difficulty === d ? '' : 'btn-ghost'}`} onClick={() => set((s) => void (s.difficulty = d))}>
              {DIFFICULTY_INFO[d].label}
            </button>
          ))}
        </div>
        <p className="muted small">{DIFFICULTY_INFO[save.settings.difficulty].blurb} Damage per set is the same at every level.</p>
        <details>
          <summary>Adjust set sizes</summary>
          {EXERCISES.filter(isPlayable).map((ex) => {
            const adj = save.settings.targetAdjust[ex.id] ?? 0;
            const t = targetFor(ex, save.settings.difficulty, save.settings.targetAdjust);
            const step = ex.kind === 'hold' ? 5 : 1;
            return (
              <div className="adj-row" key={ex.id}>
                <span>{ex.name}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => set((s) => void (s.targetAdjust = { ...s.targetAdjust, [ex.id]: adj - step }))}>
                  −
                </button>
                <b>{ex.kind === 'hold' ? `${t}s` : t}</b>
                <button className="btn btn-ghost btn-sm" onClick={() => set((s) => void (s.targetAdjust = { ...s.targetAdjust, [ex.id]: adj + step }))}>
                  +
                </button>
              </div>
            );
          })}
        </details>
      </section>

      <section>
        <h3>Settings</h3>
        <Toggle label="Sound effects & music" on={save.settings.sound} onChange={(v) => set((s) => void (s.sound = v))} />
        <Toggle label="Spoken cues (rep counts, guidance)" on={save.settings.voice} onChange={(v) => set((s) => void (s.voice = v))} />
        <Toggle label="Show body tracking overlay" on={save.settings.showSkeleton} onChange={(v) => set((s) => void (s.showSkeleton = v))} />
        <div className="toggle-row">
          <span>Tracking model</span>
          <div className="seg">
            <button className={`btn btn-sm ${save.settings.model === 'full' ? '' : 'btn-ghost'}`} onClick={() => set((s) => void (s.model = 'full'))}>
              Accurate
            </button>
            <button className={`btn btn-sm ${save.settings.model === 'lite' ? '' : 'btn-ghost'}`} onClick={() => set((s) => void (s.model = 'lite'))}>
              Fast
            </button>
          </div>
        </div>
      </section>

      <section>
        <h3>Privacy & safety</h3>
        <p className="muted small">
          Camera frames are analysed on this device by MediaPipe and immediately discarded. Nothing is recorded, saved or uploaded, and the camera is only on during battles. FITBOUND counts movements for gameplay only — it
          does not judge exercise form or give medical advice. Stop if anything hurts, and rest whenever you like: there are no streaks or penalties for days off.
        </p>
      </section>

      <section className="row">
        <button className="btn btn-ghost" onClick={onQuitToTitle}>
          Title screen
        </button>
        {confirmReset ? (
          <button
            className="btn btn-warn"
            onClick={() => {
              replaceSave(resetSave());
              setConfirmReset(false);
              onQuitToTitle();
            }}
          >
            Really erase all progress?
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={() => setConfirmReset(true)}>
            Reset save…
          </button>
        )}
      </section>
    </Modal>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <i className="switch" />
    </label>
  );
}

// ── NPC dialogs ──────────────────────────────────────────────────────────

export function NpcDialog({ npcId, onClose, onOpenAbilities, onPractice }: { npcId: string; onClose: () => void; onOpenAbilities: () => void; onPractice: () => void }) {
  const save = useSave();
  const guardiansDown = GUARDIANS.filter((g) => save.defeated.includes(g)).length;
  const cleared = save.defeated.includes('warden') || save.clears > 0;
  const [page, setPage] = useState(0);

  if (npcId === 'elder') {
    const lines = cleared
      ? [
          `${save.heroName}! The Warden has fallen and colour returns to Maplebrook. You did that — one push-up at a time.`,
          'Still, shadows gather where a gate once stood. If you want to keep your strength up, the Hollow Deep will always test you again.',
        ]
      : [
          `Welcome, ${save.heroName}. A corruption seeps from the Hollow Deep, the dungeon north of the village. Monsters guard it, and the Dungeon Warden keeps the deep gate.`,
          'Our heroes do not fight with steel alone. Every push-up swings your sword, every squat raises your shield, every jumping jack gathers arcane power.',
          guardiansDown > 0 ? `You have already bested ${guardiansDown} of the 3 guardians. Defeat them all and the Warden's gate will open.` : 'Defeat the three guardians inside and the Warden’s gate will open. Coach Ilse by the training pen can help you practise first.',
        ];
    const last = page >= lines.length - 1;
    return (
      <Dialog name="Elder Maren" portrait="elder" onClose={onClose}>
        <p>{lines[Math.min(page, lines.length - 1)]}</p>
        <div className="row">
          {cleared && last && (
            <button
              className="btn"
              onClick={() => {
                updateSave((s) => void (s.defeated = []));
                onClose();
              }}
            >
              Patrol the dungeon again
            </button>
          )}
          {!last ? (
            <button className="btn" onClick={() => setPage(page + 1)}>
              Next ▸
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={onClose}>
              Farewell
            </button>
          )}
        </div>
      </Dialog>
    );
  }

  if (npcId === 'smith') {
    const buy = (stat: keyof typeof save.upgrades) => {
      const tier = save.upgrades[stat];
      const cost = upgradeCost(tier);
      if (tier >= MAX_UPGRADE || save.gold < cost) {
        audio.error();
        return;
      }
      audio.levelUp();
      updateSave((s) => {
        s.gold -= cost;
        s.upgrades[stat] += 1;
      });
    };
    return (
      <Dialog name="Bruna the Smith" portrait="smith" onClose={onClose}>
        <p>Gold from the dungeon buys better gear. I don’t sell shortcuts — just a sharper edge on the work you already do. You have {save.gold} gold.</p>
        <div className="shop">
          {SHOP_ITEMS.map((it) => {
            const tier = save.upgrades[it.stat];
            const maxed = tier >= MAX_UPGRADE;
            const cost = upgradeCost(tier);
            return (
              <button key={it.stat} className="shop-item" disabled={maxed || save.gold < cost} onClick={() => buy(it.stat)}>
                <b>
                  {it.name} {tier > 0 && `(${tier}/${MAX_UPGRADE})`}
                </b>
                <span>{it.blurb}</span>
                <span className="price">{maxed ? 'Maxed' : `${cost} gold`}</span>
              </button>
            );
          })}
        </div>
      </Dialog>
    );
  }

  if (npcId === 'innkeeper') {
    return (
      <Dialog name="Tomas the Innkeeper" portrait="innkeeper" onClose={onClose}>
        <p>
          {page === 0
            ? 'Welcome to the Sleeping Stag! Heroes here always leave battle with full health — no one limps out of my inn.'
            : 'And listen: rest days are part of training. The dungeon will be exactly where you left it. Come back tomorrow, or next week. Your progress is saved.'}
        </p>
        <div className="row">
          {page === 0 ? (
            <button className="btn" onClick={() => setPage(1)}>
              Any advice? ▸
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={onClose}>
              Thanks, Tomas
            </button>
          )}
        </div>
      </Dialog>
    );
  }

  // Coach Ilse: training and camera tips.
  return (
    <Dialog name="Coach Ilse" portrait="trainer" onClose={onClose}>
      {page === 0 && <p>New to camera training? Spar with my dummy — it never hits back. It’s the best place to find a good phone position for each exercise.</p>}
      {page === 1 && (
        <ul className="tips">
          <li>
            <b>Push-ups & plank:</b> phone on the floor ~2 m to your side, landscape works best. The camera should see your profile from head to feet.
          </li>
          <li>
            <b>Squats & jumping jacks:</b> phone at waist height 2–3 m away, facing you. Head to feet (and raised hands) in view.
          </li>
          <li>Good light helps a lot. Avoid a bright window behind you.</li>
          <li>The skeleton overlay turns blue when tracking is solid.</li>
        </ul>
      )}
      <div className="row">
        <button
          className="btn"
          onClick={() => {
            onClose();
            onPractice();
          }}
        >
          Spar with the dummy
        </button>
        {page === 0 ? (
          <button className="btn btn-ghost" onClick={() => setPage(1)}>
            Camera tips ▸
          </button>
        ) : (
          <button
            className="btn btn-ghost"
            onClick={() => {
              onClose();
              onOpenAbilities();
            }}
          >
            Manage abilities
          </button>
        )}
      </div>
    </Dialog>
  );
}

function Dialog({ name, portrait, onClose, children }: { name: string; portrait: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="dialog-wrap" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog">
        <div className="dialog-name">
          <img className="portrait" src={spriteDataUrl(CHARACTERS[portrait], 3, 3)} alt="" />
          {name}
          <button className="btn btn-ghost btn-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function MessageDialog({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div className="dialog-wrap" onPointerDown={onClose}>
      <div className="dialog">
        <p>{text}</p>
        <div className="row">
          <button className="btn btn-ghost">OK</button>
        </div>
      </div>
    </div>
  );
}
