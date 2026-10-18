// Player dashboard — grid of character cards.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { AVAILABLE_LANGS } from '@/i18n/lang';
import { useAuth } from '@/cloud/AuthContext';
import { getSystem } from '@/systems';
import {
  listCharacters, loadCharacter, createCharacter, deleteCharacter, duplicateCharacter, markOpenWizard, markSynced,
} from '@/store/characters';
import { readJSON, writeJSON, key } from '@/store/storage';
import type { Character } from '@/domain/character';
import { goSheet } from '@/routing';

type SortBy = 'recent' | 'name' | 'chronicle';
const SORT_KEY = key('dashboard', 'sort');

function sortCharacters(list: Character[], by: SortBy): Character[] {
  const byName = (a: Character, b: Character) => (a.profile.name || '').localeCompare(b.profile.name || '');
  const copy = [...list];
  if (by === 'name') return copy.sort(byName);
  if (by === 'chronicle') {
    return copy.sort((a, b) => (a.profile.chronicle || '').localeCompare(b.profile.chronicle || '') || byName(a, b));
  }
  return copy.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)); // recent
}

export function Dashboard({ onCreate }: { onCreate: (id: string) => void }) {
  const { t, lang, setLang, name } = useI18n();
  const { configured, ready, user, signIn } = useAuth();
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const [sortBy, setSortBy] = useState<SortBy>(() => readJSON<SortBy>(SORT_KEY, 'recent'));

  function changeSort(by: SortBy) {
    setSortBy(by);
    writeJSON(SORT_KEY, by);
  }

  const characters = useMemo(() => {
    const list = listCharacters().map((s) => loadCharacter(s.id)).filter((c): c is Character => !!c);
    return sortCharacters(list, sortBy);
  }, [tick, sortBy]);

  function removeCharacter(id: string) {
    deleteCharacter(id);
    if (configured && user) {
      import('@/cloud/firebase').then((m) => m.deleteRemote(user.uid, id)).catch(() => {});
    }
    refresh();
  }

  // Reconcile the list with Firestore on sign-in and whenever the tab regains
  // focus, so two devices converge (new characters appear, deleted ones go).
  useEffect(() => {
    if (!configured || !user) return;
    const pull = () =>
      import('@/cloud/listSync')
        .then((m) => m.pullList(user.uid))
        .then((changed) => { if (changed) refresh(); })
        .catch(() => {});
    pull();
    const onFocus = () => { if (document.visibilityState === 'visible') pull(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [configured, user]);

  function handleNew() {
    const ch = createCharacter();
    markOpenWizard(ch.id); // new character → open the wizard once
    if (user) {
      // Push immediately so other devices discover it on their next pull.
      import('@/cloud/firebase').then((m) => m.saveRemote(user.uid, ch)).then(() => markSynced(ch.id)).catch(() => {});
    }
    onCreate(ch.id);
  }

  // When cloud is configured, an account is required to create/keep characters.
  // (Offline/local mode — no cloud config — stays open with no sign-in.)
  if (configured && !ready) {
    return <div className="flex min-h-full items-center justify-center text-text-mute">{lang === 'ru' ? 'Загрузка…' : 'Loading…'}</div>;
  }
  if (configured && !user) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="eyebrow">{t('appTitle')}</div>
        <h2 className="font-display text-3xl font-medium">{lang === 'ru' ? 'Войдите, чтобы начать' : 'Sign in to start'}</h2>
        <p className="text-text-mute max-w-sm text-sm">
          {lang === 'ru'
            ? 'Персонажи привязаны к аккаунту Google и синхронизируются между устройствами.'
            : 'Characters are tied to your Google account and sync across devices.'}
        </p>
        <button onClick={signIn} className="bg-blood border border-blood2 text-white px-6 py-3 rounded text-sm tracking-wide uppercase hover:bg-blood2 transition-colors">
          {lang === 'ru' ? 'Войти через Google' : 'Sign in with Google'}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 sm:px-9 py-3 sm:py-4 border-b border-line">
        <span className="eyebrow truncate min-w-0"><span className="hidden sm:inline">{t('appTitle')} · </span>{t('myCharacters')}</span>
        <div className="flex items-center gap-3 shrink-0">
          <AuthControl />
          <div className="inline-flex p-0.5 border border-line2 rounded font-mono text-[11px]">
            {AVAILABLE_LANGS.map((l) => (
              <button key={l.code} onClick={() => setLang(l.code)} className={`px-2 py-1 rounded-[3px] transition-colors ${l.code === lang ? 'bg-text text-bg' : 'text-text-mute hover:text-text'}`}>
                {l.code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-[1100px] mx-auto px-9 py-9">
        {characters.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24 gap-5">
            <h2 className="font-display text-3xl font-medium">{t('noCharacters')}</h2>
            <button onClick={handleNew} className="bg-blood border border-blood2 text-white px-6 py-3 rounded text-sm tracking-wide uppercase hover:bg-blood2 transition-colors">
              {t('createCharacter')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-end gap-2 mb-5">
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-text-dim">{t('sortBy')}</span>
              <select
                value={sortBy}
                onChange={(e) => changeSort(e.target.value as SortBy)}
                className="field-select bg-transparent border border-line2 rounded text-text text-xs px-2 py-1 outline-none cursor-pointer hover:border-text-mute"
              >
                <option value="recent" className="bg-surf">{t('sortRecent')}</option>
                <option value="name" className="bg-surf">{t('sortName')}</option>
                <option value="chronicle" className="bg-surf">{t('sortChronicle')}</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {characters.map((ch) => (
              <CharacterCard
                key={ch.id}
                ch={ch}
                onOpen={() => goSheet(ch.id)}
                onDelete={() => {
                  if (confirm(`${t('delete')}: ${ch.profile.name || '—'}?`)) removeCharacter(ch.id);
                }}
                onDuplicate={() => {
                  const dup = duplicateCharacter(ch.id);
                  if (dup && user) import('@/cloud/firebase').then((m) => m.saveRemote(user.uid, dup)).then(() => markSynced(dup.id)).catch(() => {});
                  refresh();
                }}
                nameFor={name}
              />
            ))}
            <button
              onClick={handleNew}
              className="border border-dashed border-line2 rounded-lg min-h-[200px] flex flex-col items-center justify-center gap-2 text-text-mute hover:text-text hover:border-text-mute transition-colors"
            >
              <span className="text-3xl font-light">+</span>
              <span className="text-sm">{t('newCharacter')}</span>
            </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CharacterCard({ ch, onOpen, onDelete, onDuplicate, nameFor }: {
  ch: Character;
  onOpen: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  nameFor: (t: import('@/i18n/lang').LocalizedText) => string;
}) {
  const { t, lang } = useI18n();
  const system = getSystem(ch.systemId);
  const humanity = system.rules.deriveHumanity(ch);
  const wp = system.rules.deriveWillpower(ch);
  const checklist = system.rules.validateCharacter(ch, lang);
  const valid = checklist.every((c) => c.ok);
  const clan = system.clans.find((c) => c.id === ch.profile.clan);
  const initial = (ch.profile.name || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="relative bg-bg border border-line rounded-lg p-5 hover:border-text-mute hover:-translate-y-0.5 transition-all group">
      {/* Full-card click layer (navigates). Sits under the content; the content
          is pointer-events-none so clicks fall through to here, except the menu
          which re-enables pointer events on top. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={ch.profile.name || 'character'}
        className="absolute inset-0 z-0 rounded-lg cursor-pointer"
      />
      <div className="relative z-10 pointer-events-none flex flex-col gap-3.5">
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-full bg-surf2 border border-line2 flex items-center justify-center font-display text-xl shrink-0">{initial}</div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[22px] font-medium leading-tight truncate">{ch.profile.name || (lang === 'ru' ? 'Безымянный' : 'Unnamed')}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-text-mute">{clan ? nameFor(clan.name) : '—'}</span>
            <span className="font-mono text-[10px] text-text-dim">· {ch.profile.generation}</span>
          </div>
          {ch.profile.chronicle && (
            <div className="font-mono text-[10px] tracking-[0.1em] text-gold/85 truncate mt-1">{ch.profile.chronicle}</div>
          )}
        </div>
        <div className="pointer-events-auto">
          <CardMenu onDelete={onDelete} onDuplicate={onDuplicate} deleteLabel={t('delete')} duplicateLabel={t('duplicate')} />
        </div>
      </div>

      {ch.profile.concept && <div className="text-text-mute text-[13px] italic leading-snug">{ch.profile.concept}</div>}

      <div className="grid grid-cols-3 gap-2.5 pt-3.5 border-t border-line">
        <Stat label={system.labels[lang]?.humanity ?? 'Humanity'} value={humanity} />
        <Stat label={system.labels[lang]?.willpower ?? 'Willpower'} value={wp} />
        <Stat label={system.labels[lang]?.bloodPool ?? 'Blood'} value={ch.blood} blood />
      </div>

      <div className="flex items-center gap-2.5 text-[11.5px] text-text-mute">
        <span className="font-mono text-[10px] text-text-dim">{t('lastVisit')}: {timeAgo(ch.updatedAt, lang)}</span>
        <span className={`ml-auto font-mono text-[10px] px-1.5 py-0.5 rounded-sm ${valid ? 'bg-good/15 text-good' : 'bg-blood/15 text-blood2'}`}>
          {valid ? t('valid') : t('invalid')}
        </span>
      </div>
      </div>
    </div>
  );
}

function Stat({ label, value, blood }: { label: string; value: number; blood?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-text-dim">{label}</div>
      <div className={`font-display text-[22px] leading-none ${blood ? 'text-blood2' : ''}`}>{value}</div>
    </div>
  );
}

function CardMenu({ onDelete, onDuplicate, deleteLabel, duplicateLabel }: {
  onDelete: () => void; onDuplicate: () => void; deleteLabel: string; duplicateLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  // Stop both mousedown and click so neither reaches the card's onClick (open).
  const guard = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  return (
    <div className="relative shrink-0" ref={ref} data-card-menu onClick={stop} onMouseDown={stop}>
      <button onClick={guard(() => setOpen(!open))} onMouseDown={stop} className="text-text-mute hover:text-text p-1 -mr-1" aria-label="menu">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="3" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="8" cy="13" r="1.4" /></svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full bg-surf border border-line2 rounded-md p-1 min-w-[140px] z-10 shadow-[0_12px_32px_rgba(0,0,0,.4)]">
          <button onMouseDown={stop} onClick={guard(() => { onDuplicate(); setOpen(false); })} className="block w-full text-left px-3 py-2 text-[13px] rounded hover:bg-surf2 transition-colors">{duplicateLabel}</button>
          <button onMouseDown={stop} onClick={guard(() => { onDelete(); setOpen(false); })} className="block w-full text-left px-3 py-2 text-[13px] text-blood2 rounded hover:bg-surf2 transition-colors">{deleteLabel}</button>
        </div>
      )}
    </div>
  );
}

function AuthControl() {
  const { configured, user, signIn, signOut } = useAuth();
  const { lang } = useI18n();
  if (!configured) return null;
  if (!user) {
    return (
      <button onClick={signIn} className="border border-line2 text-text-mute rounded px-3 py-1.5 text-xs hover:text-text hover:border-text-mute transition-colors">
        {lang === 'ru' ? 'Войти' : 'Sign in'}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2.5 text-xs">
      {user.photo
        ? <img src={user.photo} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
        : <span className="w-6 h-6 rounded-full bg-surf2 border border-line2 flex items-center justify-center">{(user.name || user.email || '?').charAt(0).toUpperCase()}</span>}
      <span className="hidden sm:block text-text-mute max-w-[140px] truncate">{user.name || user.email}</span>
      <button
        onClick={signOut}
        className="border border-line2 text-text-mute rounded px-3 py-1.5 hover:text-text hover:border-text-mute transition-colors"
      >
        {lang === 'ru' ? 'Выйти' : 'Sign out'}
      </button>
    </div>
  );
}

function timeAgo(ts: number, lang: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (mins < 1) return lang === 'ru' ? 'только что' : 'just now';
  if (mins < 60) return `${mins}${lang === 'ru' ? ' мин' : 'm'}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${lang === 'ru' ? ' ч' : 'h'}`;
  const days = Math.floor(hrs / 24);
  return `${days}${lang === 'ru' ? ' дн' : 'd'}`;
}
