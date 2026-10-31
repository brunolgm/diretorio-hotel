import test from 'node:test';
import assert from 'node:assert/strict';
import {guideChannelResultSummary} from '../../lib/room-guide-counts.ts';

const expected = {
  pt: {channels: ['0 canais encontrados', '1 canal encontrado', '2 canais encontrados'], apps: ['', '1 aplicativo', '2 aplicativos']},
  en: {channels: ['0 channels found', '1 channel found', '2 channels found'], apps: ['', '1 application', '2 applications']},
  es: {channels: ['0 canales encontrados', '1 canal encontrado', '2 canales encontrados'], apps: ['', '1 aplicación', '2 aplicaciones']},
};

for (const language of ['pt', 'en', 'es'] as const) {
  for (const channels of [0, 1, 2]) for (const apps of [0, 1, 2]) {
    test(`${language}: ${channels} channels and ${apps} applications have independent number agreement`, () => {
      const copy = expected[language];
      assert.equal(guideChannelResultSummary(language, channels, apps), copy.channels[channels] + (apps ? ` · ${copy.apps[apps]}` : ''));
    });
  }
}

test('Spanish Bugan inventory uses the singular application label', () => {
  assert.equal(guideChannelResultSummary('es', 221, 1), '221 canales encontrados · 1 aplicación');
});
