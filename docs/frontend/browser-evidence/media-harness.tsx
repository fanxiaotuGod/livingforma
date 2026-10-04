import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { readingDefinition, exampleRecords, type Snapshot } from '../../../packages/contracts/src/index';
import { OwnerOrb } from '../../../apps/web/src/components/OwnerOrb';
import { CameraScene } from '../../../apps/web/src/components/media/CameraScene';
import { BookResults } from '../../../apps/web/src/components/ToolResults';
import { stopLocalDevices } from '../../../apps/web/src/lib/media-events';
import { request } from '../../../apps/web/src/lib/client';
import '../../../apps/web/src/styles.css';
function Harness() {
  const [owner, setOwner] = useState(true), [show, setShow] = useState(true), [slug, setSlug] = useState('media-fixture'), [version, setVersion] = useState(1);
  const snapshot: Snapshot = { space: { id: slug, slug, title: 'Media fixture', timezone: 'America/Vancouver', visibility: 'public', participation: 'authenticated' }, phase: 'ready', definition: { ...readingDefinition(), definitionVersion: version }, records: exampleRecords('reading'), stateVersion: 1, eventCursor: version, role: owner ? 'owner' : 'visitor', permissions: { canEdit: owner, canWrite: owner, canUseTools: owner, actionIds: ['add', 'edit', 'remove'] }, loginRequiredForWrite: !owner };
  return <MotionConfig reducedMotion="user"><main className="app-shell"><header className="site-header"><span>MEDIA FIXTURE · No real providers</span></header><div style={{ padding: '30px 0', display: 'flex', gap: 16, flexWrap: 'wrap' }}><button onClick={() => setVersion(v => v + 1)}>Simulate incoming definition</button><button onClick={() => setShow(v => !v)}>Toggle camera component</button><button onClick={() => { stopLocalDevices('Space changed.'); setSlug(s => `${s}-next`); }}>Switch space</button><button onClick={() => { stopLocalDevices('Signed out.'); setOwner(false); }}>Sign out fixture</button><button onClick={() => setOwner(false)}>Lose ownership</button><button onClick={() => setOwner(true)}>Restore fixture owner</button></div>
    {owner && <OwnerOrb key={slug} snapshot={snapshot} csrf="fixture" onNotice={() => {}} onPropose={prompt => request(`/api/spaces/${slug}/proposals`, { method: 'POST', body: JSON.stringify({ prompt }) }, 'fixture')}/>}
    {show && <CameraScene slug={slug} csrf="fixture" isOwner={owner}/>}
    <div style={{ padding: '30px 0' }}><BookResults value={{ books: [{ title: 'A useful result', authors: ['A. Reader'], firstPublished: 2026, url: 'https://openlibrary.org/works/OL123W' }, { title: '<script>never executed</script>', authors: ['Safe text'], url: 'javascript:alert(1)' }], total: 2, source: 'Open Library' }}/></div>
  </main></MotionConfig>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Harness/></React.StrictMode>);
