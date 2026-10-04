import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('ORCA intro video asset is located in public/videos/orca-intro.mp4 or aurexo-intro.mp4', () => {
  const orcaVideoPath = path.resolve(process.cwd(), 'public/videos/orca-intro.mp4');
  const aurexoVideoPath = path.resolve(process.cwd(), 'public/videos/aurexo-intro.mp4');
  assert.ok(fs.existsSync(orcaVideoPath) || fs.existsSync(aurexoVideoPath), 'Intro video must exist');
  const validPath = fs.existsSync(orcaVideoPath) ? orcaVideoPath : aurexoVideoPath;
  const stats = fs.statSync(validPath);
  assert.ok(stats.size > 100000, `Video file must be valid non-empty MP4 (size: ${stats.size} bytes)`);
});

test('OrcaIntro component satisfies all cinematic overlay requirements', () => {
  const componentPath = path.resolve(process.cwd(), 'src/components/intro/OrcaIntro.tsx');
  assert.ok(fs.existsSync(componentPath), 'OrcaIntro.tsx must exist');

  const content = fs.readFileSync(componentPath, 'utf-8');

  // 1. Overlay styling
  assert.ok(content.includes('fixed inset-0'), 'Must use fixed inset-0 full-screen positioning');
  assert.ok(content.includes('z-[99999]'), 'Must have maximum z-index overlaying all components');
  assert.ok(content.includes('object-cover'), 'Video must use object-cover');

  // 2. Video element properties
  assert.ok(content.includes('autoPlay'), 'Video must have autoPlay attribute');
  assert.ok(content.includes('muted'), 'Video must be muted');
  assert.ok(content.includes('playsInline'), 'Video must have playsInline for mobile compatibility');
  assert.ok(content.includes('preload="auto"'), 'Video must have preload="auto"');
  assert.ok(content.includes('orca-intro.mp4') || content.includes('aurexo-intro.mp4'), 'Video must point to intro video');

  // 3. Spacebar dismissal
  assert.ok(content.includes("e.code === 'Space'"), 'Must intercept Space key');
  assert.ok(content.includes('e.preventDefault()'), 'Must call preventDefault on Space to avoid scrolling');
  assert.ok(content.includes('e.stopPropagation()'), 'Must stop propagation on Space');

  // 4. Session Storage & Reduced Motion
  assert.ok(content.includes('orca_intro_seen') || content.includes('aurexo_intro_seen'), 'Must use intro seen sessionStorage key');
  assert.ok(content.includes('prefers-reduced-motion: reduce'), 'Must respect prefers-reduced-motion');

  // 5. Failure & auto-dismiss handling
  assert.ok(content.includes('onError'), 'Must handle video loading errors gracefully');
  assert.ok(content.includes('onEnded'), 'Must handle video natural playback completion');
  assert.ok(content.includes('.catch('), 'Must catch autoplay rejection without crashing');

  // 6. Mobile & UI Skip Affordance
  assert.ok(content.includes('Skip Intro'), 'Must provide mobile skip affordance');
});

test('layout.tsx and SiteBackground mount global background video safely', () => {
  const layoutPath = path.resolve(process.cwd(), 'src/app/layout.tsx');
  const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
  assert.ok(layoutContent.includes('SiteBackground'), 'layout.tsx must import SiteBackground');
  assert.ok(layoutContent.includes('<SiteBackground />'), 'layout.tsx must render <SiteBackground />');

  const bgPath = path.resolve(process.cwd(), 'src/components/layout/SiteBackground.tsx');
  const bgContent = fs.readFileSync(bgPath, 'utf-8');
  assert.ok(bgContent.includes('orca-intro.mp4') || bgContent.includes('aurexo-intro.mp4'), 'SiteBackground must use intro video');
  assert.ok(bgContent.includes('autoPlay'), 'SiteBackground video must have autoPlay');
  assert.ok(bgContent.includes('muted'), 'SiteBackground video must be muted');
  assert.ok(bgContent.includes('loop'), 'SiteBackground video must loop');

  const dashboardPath = path.resolve(process.cwd(), 'src/app/dashboard/page.tsx');
  const dashboardContent = fs.readFileSync(dashboardPath, 'utf-8');
  assert.ok(dashboardContent.includes('MarineMap'), 'dashboard must render MarineMap');
  assert.ok(dashboardContent.includes('MarineHUD'), 'dashboard must render MarineHUD');
  assert.ok(dashboardContent.includes('ChatDrawer'), 'dashboard must render ChatDrawer');
});
