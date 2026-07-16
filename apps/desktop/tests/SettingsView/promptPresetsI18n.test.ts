import { describe, expect, it } from 'vitest';

import { messages } from '@/i18n/messages';

const zhCN = messages['zh-CN'] as Record<string, string>;
const enUS = messages['en-US'] as Record<string, string>;

describe('prompt presets i18n', () => {
    it('exposes the same preset keys in both locales', () => {
        const keys = [
            'settings.nav.promptPresets.label',
            'settings.nav.promptPresets.description',
            'settings.loading.promptPresets',
            'settings.promptPresets.title',
            'settings.promptPresets.description',
            'settings.promptPresets.addButton',
            'settings.promptPresets.section.presets',
            'settings.promptPresets.emptyHint',
            'settings.promptPresets.editDialog.titleCreate',
            'settings.promptPresets.editDialog.titleEdit',
            'settings.promptPresets.editDialog.label',
            'settings.promptPresets.editDialog.text',
            'settings.promptPresets.editDialog.errorLabelRequired',
            'settings.promptPresets.editDialog.errorTextRequired',
            'settings.promptPresets.deleteConfirm.title',
            'settings.promptPresets.deleteConfirm.message',
            'settings.promptPresets.saveState.saving',
            'settings.promptPresets.saveState.saved',
            'settings.promptPresets.saveState.error',
        ];

        for (const key of keys) {
            expect(zhCN[key], `zh-CN missing ${key}`).toBeTruthy();
            expect(enUS[key], `en-US missing ${key}`).toBeTruthy();
        }
    });

    it('labels the section consistently with the navigation entry', () => {
        expect(zhCN['settings.nav.promptPresets.label']).toBe('提示词预设');
        expect(zhCN['settings.promptPresets.title']).toBe('提示词预设');
        expect(enUS['settings.nav.promptPresets.label']).toBe('Prompt Presets');
        expect(enUS['settings.promptPresets.title']).toBe('Prompt Presets');
    });
});
