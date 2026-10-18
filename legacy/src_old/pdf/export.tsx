// Vector PDF export via @react-pdf/renderer. Data-driven: the document is built
// from the active system + character (no DOM capture), so the output is crisp,
// selectable, deterministic, and exactly one A4 page.
//
// This module is dynamically imported (see SheetActions) so the ~PDF library is
// only loaded when the user actually exports.
import {
  Document, Page, Text, View, StyleSheet, Font, pdf,
} from '@react-pdf/renderer';
import type { Character } from '@/domain/character';
import type { GameSystem } from '@/systems/types';
import { localize, tr, type Lang } from '@/i18n/lang';
// Bundled Roboto TTFs (full Cyrillic; parse cleanly with @react-pdf's fontkit,
// unlike IBM Plex's OpenType build). Same-origin assets → offline, no CDN.
import sansRegular from '@/assets/fonts/Roboto_400Regular.ttf?url';
import sansBold from '@/assets/fonts/Roboto_700Bold.ttf?url';
import monoRegular from '@/assets/fonts/RobotoMono_400Regular.ttf?url';

const F_SANS = 'Roboto';
const F_MONO = 'Roboto Mono';

let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  Font.register({
    family: F_SANS,
    fonts: [
      { src: sansRegular, fontWeight: 400 },
      { src: sansBold, fontWeight: 700 },
    ],
  });
  Font.register({ family: F_MONO, fonts: [{ src: monoRegular, fontWeight: 400 }] });
  Font.registerHyphenationCallback((w) => [w]); // don't hyphenate
  fontsReady = true;
}

const C = {
  text: '#141118',
  mute: '#4a464b',
  dim: '#8a8589',
  line: '#cfcbc6',
  blood: '#a01e2e',
  gold: '#7c6420',
};

const s = StyleSheet.create({
  page: { paddingVertical: 26, paddingHorizontal: 30, fontFamily: F_SANS, color: C.text, fontSize: 8 },
  ruleTop: { borderBottomWidth: 1.5, borderBottomColor: C.text, marginBottom: 6 },
  eyebrow: { fontFamily: F_MONO, fontSize: 6.5, letterSpacing: 2, color: C.mute },
  name: { fontFamily: F_SANS, fontWeight: 700, fontSize: 22, marginTop: 2, marginBottom: 6 },

  profileGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  profileCell: { width: '25%', paddingRight: 10, marginBottom: 6 },
  fieldLabel: { fontFamily: F_MONO, fontSize: 5.5, letterSpacing: 1.5, color: C.mute, textTransform: 'uppercase' },
  fieldValue: { fontSize: 10, marginTop: 2, borderBottomWidth: 0.5, borderBottomColor: C.line, paddingBottom: 2, minHeight: 12 },

  sectionTitle: { fontFamily: F_SANS, fontWeight: 700, fontSize: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 5 },
  sectionRule: { flex: 1, height: 0.5, backgroundColor: C.line, marginLeft: 8 },

  cols: { flexDirection: 'row' },
  col: { flex: 1, paddingRight: 14 },
  colSub: { fontFamily: F_MONO, fontSize: 5.5, letterSpacing: 1.5, color: C.mute, textTransform: 'uppercase', marginBottom: 3 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 1.8, borderBottomWidth: 0.5, borderBottomColor: '#e6e3df' },
  traitName: { fontSize: 8.5, flexShrink: 1 },
  dots: { flexDirection: 'row' },
  dot: { width: 5, height: 5, borderRadius: 2.5, borderWidth: 0.5, marginLeft: 2 },

  hRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 1.6, borderBottomWidth: 0.5, borderBottomColor: '#e6e3df' },
  hBox: { width: 9, height: 9, borderWidth: 0.6, borderColor: C.dim, borderRadius: 1, alignItems: 'center', justifyContent: 'center' },
  hGlyph: { fontFamily: F_MONO, fontSize: 6 },
  pen: { fontFamily: F_MONO, fontSize: 6.5, color: C.mute, width: 16, textAlign: 'right' },

  poolWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  poolBox: { width: 7, height: 7, borderWidth: 0.6, borderColor: C.dim, borderRadius: 1, marginRight: 2, marginBottom: 2 },

  hint: { fontFamily: F_MONO, fontSize: 5.5, color: C.dim, marginTop: 2 },
  notesBox: { borderWidth: 0.5, borderColor: C.line, borderRadius: 2, minHeight: 70, marginTop: 4 },
});

function Dots({ value, max = 5, color = C.text }: { value: number; max?: number; color?: string }) {
  return (
    <View style={s.dots}>
      {Array.from({ length: max }).map((_, i) => (
        <View
          key={i}
          style={[s.dot, { borderColor: i < value ? color : C.dim, backgroundColor: i < value ? color : 'transparent' }]}
        />
      ))}
    </View>
  );
}

function TraitRow({ label, value, max = 5 }: { label: string; value: number; max?: number }) {
  return (
    <View style={s.row}>
      <Text style={s.traitName}>{label}</Text>
      <Dots value={value} max={max} />
    </View>
  );
}

interface Props {
  system: GameSystem;
  ch: Character;
  lang: Lang;
}

function CharacterPdf({ system, ch, lang }: Props) {
  const name = (t: Parameters<typeof localize>[0]) => localize(t, lang);
  const label = (k: string) => tr(system.labels, lang, k);
  const { rules } = system;

  const humanity = rules.deriveHumanity(ch);
  const [bpMax, bpPerTurn] = rules.bloodPoolFor(ch.profile.generation || 13);
  const clan = system.clans.find((c) => c.id === ch.profile.clan);
  const aggravated = ch.health.aggravated;
  const lethal = ch.health.lethal;
  const bashing = ch.health.bashing;
  const boxState = (i: number) =>
    i < aggravated ? 'aggravated' : i < aggravated + lethal ? 'lethal' : i < aggravated + lethal + bashing ? 'bashing' : '';
  const glyph: Record<string, string> = { bashing: '/', lethal: 'X', aggravated: '*' };

  const profile: [string, string][] = [
    [label('player'), ch.profile.player],
    [label('chronicle'), ch.profile.chronicle],
    [label('concept'), ch.profile.concept],
    [label('clan'), clan ? name(clan.name) : ''],
    [label('generation'), String(ch.profile.generation)],
    [label('nature'), ch.profile.nature],
    [label('demeanor'), ch.profile.demeanor],
    [label('sire'), ch.profile.sire],
  ];

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Plate */}
        <View style={s.ruleTop} />
        <Text style={s.eyebrow}>VAMPIRE · THE MASQUERADE · V20</Text>
        <Text style={s.name}>{ch.profile.name || (lang === 'ru' ? 'Безымянный' : 'Unnamed')}</Text>
        <View style={s.profileGrid}>
          {profile.map(([l, v]) => (
            <View key={l} style={s.profileCell}>
              <Text style={s.fieldLabel}>{l}</Text>
              <Text style={s.fieldValue}>{v || ' '}</Text>
            </View>
          ))}
        </View>

        {/* Attributes */}
        <Section title={label('attributes')}>
          <View style={s.cols}>
            {system.attributeCategories.map((cat) => (
              <View key={cat} style={s.col}>
                <Text style={s.colSub}>{label(cat)}</Text>
                {system.attributes.filter((a) => a.cat === cat).map((a) => (
                  <TraitRow key={a.id} label={name(a.name)} value={ch.attributes[a.id] ?? 1} />
                ))}
              </View>
            ))}
          </View>
        </Section>

        {/* Abilities */}
        <Section title={label('abilities')}>
          <View style={s.cols}>
            {system.abilityCategories.map((cat) => (
              <View key={cat} style={s.col}>
                <Text style={s.colSub}>{label(cat)}</Text>
                {system.abilities.filter((a) => a.cat === cat).map((a) => (
                  <TraitRow key={a.id} label={name(a.name)} value={ch.abilities[a.id] ?? 0} />
                ))}
              </View>
            ))}
          </View>
        </Section>

        {/* Advantages */}
        <Section title={label('advantages')}>
          <View style={s.cols}>
            <View style={s.col}>
              <Text style={s.colSub}>{label('disciplines')}</Text>
              {ch.disciplines.length === 0 ? <Text style={s.traitName}>—</Text> : ch.disciplines.map((d) => (
                <TraitRow key={d.id} label={d.name} value={d.level} />
              ))}
            </View>
            <View style={s.col}>
              <Text style={s.colSub}>{label('backgrounds')}</Text>
              {ch.backgrounds.length === 0 ? <Text style={s.traitName}>—</Text> : ch.backgrounds.map((b) => (
                <TraitRow key={b.id} label={b.name} value={b.level} />
              ))}
            </View>
            <View style={s.col}>
              <Text style={s.colSub}>{label('virtues')}</Text>
              {system.virtues.map((v) => (
                <TraitRow key={v.id} label={name(v.name)} value={ch.virtues[v.id] ?? 1} />
              ))}
            </View>
          </View>
        </Section>

        {/* State */}
        <Section title={label('state') || 'State'}>
          <View style={s.cols}>
            {/* Health */}
            <View style={s.col}>
              <Text style={s.colSub}>{label('health')}</Text>
              {system.healthLevels.map((lv, i) => {
                const st = boxState(i);
                return (
                  <View key={lv.id} style={s.hRow}>
                    <Text style={{ fontSize: 7.5, flex: 1 }}>{label(lv.id)}</Text>
                    <Text style={s.pen}>{lv.penalty == null ? '—' : lv.penalty === 0 ? '' : lv.penalty}</Text>
                    <View style={[s.hBox, st === 'aggravated' ? { backgroundColor: C.blood, borderColor: C.blood } : st === 'lethal' ? { borderColor: C.blood } : {}]}>
                      <Text style={[s.hGlyph, { color: st === 'aggravated' ? '#fff' : st === '' ? 'transparent' : C.blood }]}>{glyph[st] || ' '}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Humanity + Willpower */}
            <View style={s.col}>
              <Text style={s.colSub}>{label('humanity')}</Text>
              <Dots value={humanity} max={10} />
              <Text style={s.hint}>{lang === 'ru' ? 'Совесть + Самоконтроль' : 'Conscience + Self-Control'}</Text>
              <Text style={[s.colSub, { marginTop: 8 }]}>{label('willpower')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                <Text style={[s.hint, { width: 52, marginTop: 0 }]}>{lang === 'ru' ? 'постоянная' : 'permanent'}</Text>
                <Dots value={ch.willpowerPermanent} max={10} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[s.hint, { width: 52, marginTop: 0 }]}>{lang === 'ru' ? 'текущая' : 'current'}</Text>
                <Dots value={ch.willpowerCurrent} max={Math.max(ch.willpowerPermanent, 1)} color={C.text} />
              </View>
            </View>

            {/* Blood + XP */}
            <View style={s.col}>
              <Text style={s.colSub}>{label('bloodPool')}</Text>
              {bpMax <= 20 ? (
                <View style={s.poolWrap}>
                  {Array.from({ length: bpMax }).map((_, i) => (
                    <View key={i} style={[s.poolBox, i < ch.blood ? { backgroundColor: C.blood, borderColor: C.blood } : {}]} />
                  ))}
                </View>
              ) : (
                <Text style={{ fontSize: 14 }}>{ch.blood} / {bpMax}</Text>
              )}
              <Text style={s.hint}>{lang === 'ru' ? 'за ход: ' : 'per turn: '}{bpPerTurn} · {lang === 'ru' ? 'поколение ' : 'gen. '}{ch.profile.generation}</Text>

              <Text style={[s.colSub, { marginTop: 8 }]}>{label('experience')}</Text>
              <Text style={{ fontSize: 8.5 }}>
                {lang === 'ru' ? 'Всего' : 'Total'}: {ch.experience.total}   {lang === 'ru' ? 'Потрач.' : 'Spent'}: {ch.experience.spent}
              </Text>
              {!!ch.weakness && <Text style={[s.hint, { marginTop: 4 }]}>{label('weakness')}: {ch.weakness}</Text>}
            </View>
          </View>
        </Section>

        {/* Notes */}
        <Section title={label('notes')}>
          <View style={s.notesBox}>
            <Text style={{ padding: 6, fontSize: 8.5, lineHeight: 1.4 }}>{ch.notes}</Text>
          </View>
        </Section>
      </Page>
    </Document>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View wrap={false}>
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>{title}</Text>
        <View style={s.sectionRule} />
      </View>
      {children}
    </View>
  );
}

export async function exportCharacterPdf(system: GameSystem, ch: Character, lang: Lang): Promise<void> {
  ensureFonts();
  const blob = await pdf(<CharacterPdf system={system} ch={ch} lang={lang} />).toBlob();
  const safe = (ch.profile.name || 'character').replace(/[^a-z0-9_\-Ѐ-ӿ ]+/gi, '').trim() || 'character';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vtm-${safe}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
