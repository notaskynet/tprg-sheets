// Loads one character, provides its system + dice context, renders the sheet,
// and hosts the creation wizard overlay (only for a just-created character).
// Cloud: one-shot remote load on open (cross-device freshness), write-only sync
// (on exit, or every ~5s while live-sharing) — no live subscription here.
import { useEffect, useState } from 'react';
import { SystemProvider } from '@/domain/SystemContext';
import { useCharacter } from '@/domain/useCharacter';
import { DiceProvider } from '@/components/Dice';
import { Sheet } from '@/components/Sheet';
import { Wizard } from '@/components/Wizard';
import {
  setCurrentId, createCharacter, markOpenWizard, consumeOpenWizard, loadCharacter, markSynced,
} from '@/store/characters';
import { useAuth } from '@/cloud/AuthContext';
import { useCloudSync } from '@/cloud/useCloudSync';
import { goDashboard, goSheet } from '@/routing';

export function SheetScreen({ charId }: { charId: string }) {
  const editor = useCharacter(charId);
  const { configured, user } = useAuth();
  const [wizard, setWizard] = useState(() => consumeOpenWizard(charId));

  // One-shot: pull the latest from the cloud when opening (another device may
  // have a newer version). Read on open / reload only — no live subscription.
  useEffect(() => {
    if (!configured || !user) return;
    let cancelled = false;
    import('@/cloud/firebase').then(({ loadRemote }) =>
      loadRemote(user.uid, charId).then((remote) => {
        if (cancelled || !remote) return;
        // Compare against the freshest persisted local copy (autosave may have
        // advanced it while the fetch was in flight) so we never clobber a newer
        // local edit. setCh persists via the autosave debounce.
        const local = loadCharacter(charId);
        if ((remote.updatedAt ?? 0) > (local?.updatedAt ?? 0)) {
          editor.setCh(remote);
        }
      }),
    ).catch(() => {});
    return () => { cancelled = true; };
    // run once per character/identity; editor intentionally excluded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, user, charId]);

  // Remember the last-opened character (effect, not render-phase).
  useEffect(() => { setCurrentId(charId); }, [charId]);

  useCloudSync(user?.uid, editor.ch);

  if (!editor.ch) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-4 text-text-mute">
        <p>Character not found.</p>
        <button onClick={goDashboard} className="border border-line2 rounded px-4 py-2 hover:border-text-mute">← Dashboard</button>
      </div>
    );
  }

  function newCharacter() {
    if (configured && !user) return goDashboard(); // creation requires sign-in
    const ch = createCharacter();
    markOpenWizard(ch.id);
    if (user) import('@/cloud/firebase').then((m) => m.saveRemote(user.uid, ch)).then(() => markSynced(ch.id)).catch(() => {});
    goSheet(ch.id);
  }

  // Render the wizard INSTEAD of the sheet (not as an overlay on top). On iOS
  // Safari `position: fixed` degrades to `static` when the keyboard opens, so an
  // overlay scrolls and reveals the sheet behind it. With the sheet unmounted
  // there's nothing to bleed through.
  return (
    <SystemProvider systemId={editor.ch.systemId}>
      {wizard ? (
        <Wizard ch={editor.ch} setPath={editor.setPath} onClose={() => setWizard(false)} onExit={goDashboard} />
      ) : (
        <DiceProvider>
          <Sheet
            ch={editor.ch}
            setPath={editor.setPath}
            setCh={editor.setCh}
            saveState={editor.saveState}
            onNewCharacter={newCharacter}
            onBack={goDashboard}
          />
        </DiceProvider>
      )}
    </SystemProvider>
  );
}
