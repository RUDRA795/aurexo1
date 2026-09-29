import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('AurexoIntro video asset is located in public/videos/aurexo-intro.mp4', () => {
  const videoPath = path.resolve(process.cwd(), 'public/videos/aurexo-intro.mp4');
  assert.ok(fs.existsSync(videoPath), 'public/videos/aurexo-intro.mp4 must exist');
  const stats = fs.statSync(videoPath);
  assert.ok(stats.size > 100000, `Video file must be valid non-empty MP4 (size: ${stats.size} bytes)`);
});

test('AurexoIntro component satisfies all cinematic overlay requirements', () => {
  const componentPath = path.resolve(process.cwd(), 'src/components/intro/AurexoIntro.tsx');
  assert.ok(fs.existsSync(componentPath), 'AurexoIntro.tsx must exist');

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
  assert.ok(content.includes('src="/videos/aurexo-intro.mp4"'), 'Video must point to /videos/aurexo-intro.mp4');

  // 3. Spacebar dismissal
  assert.ok(content.includes("e.code === 'Space'"), 'Must intercept Space key');
  assert.ok(content.includes('e.preventDefault()'), 'Must call preventDefault on Space to avoid scrolling');
  assert.ok(content.includes('e.stopPropagation()'), 'Must stop propagation on Space');

  // 4. Session Storage & Reduced Motion
  assert.ok(content.includes('aurexo_intro_seen'), 'Must use aurexo_intro_seen sessionStorage key');
  assert.ok(content.includes('prefers-reduced-motion: reduce'), 'Must respect prefers-reduced-motion');

  // 5. Failure & auto-dismiss handling
  assert.ok(content.includes('onError'), 'Must handle video loading errors gracefully');
  assert.ok(content.includes('onEnded'), 'Must handle video natural playback completion');
  assert.ok(content.includes('.catch('), 'Must catch autoplay rejection without crashing');

  // 6. Mobile & UI Skip Affordance
  assert.ok(content.includes('Skip Intro'), 'Must provide mobile skip affordance');
});

test('page.tsx mounts AurexoIntro safely as non-blocking overlay over existing app', () => {
  const pagePath = path.resolve(process.cwd(), 'src/app/page.tsx');
  const content = fs.readFileSync(pagePath, 'utf-8');

  assert.ok(content.includes('AurexoIntro'), 'page.tsx must import AurexoIntro');
  assert.ok(content.includes('<AurexoIntro />'), 'page.tsx must render <AurexoIntro />');
  assert.ok(content.includes('MarineMap'), 'page.tsx must retain MarineMap');
  assert.ok(content.includes('MarineHUD'), 'page.tsx must retain MarineHUD');
  assert.ok(content.includes('ChatDrawer'), 'page.tsx must retain ChatDrawer');
});
