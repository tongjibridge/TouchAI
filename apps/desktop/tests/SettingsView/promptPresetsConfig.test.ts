import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const settingsValues = new Map<string, string | null>();
const setSettingMock = vi.hoisted(() =>
    vi.fn(async ({ key, value }: { key: string; value: string }) => {
        settingsValues.set(key, value);
        return { id: 1, key, value, created_at: '', updated_at: '' };
    })
);
const getSettingValueMock = vi.hoisted(() =>
    vi.fn(async ({ key }: { key: string }) => settingsValues.get(key) ?? null)
);

vi.mock('@database/queries', () => ({
    getSettingValue: getSettingValueMock,
    setSetting: setSettingMock,
}));

vi.mock('@services/EventService', () => ({
    AppEvent: { SETTINGS_GENERAL_UPDATED: 'settings-general-updated' },
    eventService: {
        emit: vi.fn(async () => undefined),
        on: vi.fn(async () => undefined),
    },
}));

vi.mock('@tauri-apps/api/window', () => ({
    getCurrentWindow: () => ({ label: 'settings' }),
}));

describe('prompt presets config', () => {
    beforeEach(() => {
        settingsValues.clear();
        setSettingMock.mockClear();
        getSettingValueMock.mockClear();
        setActivePinia(createPinia());
    });

    it('ships five built-in presets by default', async () => {
        const { DEFAULT_PROMPT_PRESETS } = await import('@/stores/setting/sections/promptPresets');

        expect(DEFAULT_PROMPT_PRESETS.version).toBe(1);
        expect(DEFAULT_PROMPT_PRESETS.presets).toHaveLength(5);
        const labels = DEFAULT_PROMPT_PRESETS.presets.map((preset) => preset.label);
        expect(labels).toEqual(['翻译成中文', '翻译成英文', '总结全文', '改写润色', '解释代码']);
        for (const preset of DEFAULT_PROMPT_PRESETS.presets) {
            expect(typeof preset.id).toBe('string');
            expect(preset.id.length).toBeGreaterThan(0);
            expect(preset.text.length).toBeGreaterThan(0);
        }
        const ids = DEFAULT_PROMPT_PRESETS.presets.map((preset) => preset.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('falls back to defaults on null / invalid json', async () => {
        const { parsePromptPresetsConfig } =
            await import('@/stores/setting/sections/promptPresets');

        expect(parsePromptPresetsConfig(null).presets).toHaveLength(5);
        expect(parsePromptPresetsConfig('{bad json').presets).toHaveLength(5);
        expect(parsePromptPresetsConfig('{}').version).toBe(1);
        // 默认预设每次生成新 id，因此只比较 label/text 内容而非完整字符串
        const fallbackLabels = parsePromptPresetsConfig(null).presets.map((p) => p.label);
        const fallbackTexts = parsePromptPresetsConfig('{bad').presets.map((p) => p.text);
        const expectedLabels = ['翻译成中文', '翻译成英文', '总结全文', '改写润色', '解释代码'];
        expect(fallbackLabels).toEqual(expectedLabels);
        expect(fallbackTexts[0]).toBe('请将以下内容翻译成中文：');
        expect(fallbackTexts[4]).toBe('请逐行解释这段代码的作用：');
    });

    it('drops presets with empty label or text and trims whitespace', async () => {
        const { parsePromptPresetsConfig } =
            await import('@/stores/setting/sections/promptPresets');

        const parsed = parsePromptPresetsConfig(
            JSON.stringify({
                presets: [
                    { id: 'a', label: '  有效  ', text: '  内容  ' },
                    { id: 'b', label: '', text: '有内容但没标签' },
                    { id: 'c', label: '有标签没内容', text: '   ' },
                    { id: 'd', label: '另一个', text: '内容' },
                ],
            })
        );

        expect(parsed.presets).toEqual([
            { id: 'a', label: '有效', text: '内容' },
            { id: 'd', label: '另一个', text: '内容' },
        ]);
    });

    it('regenerates ids when duplicates are present', async () => {
        const { parsePromptPresetsConfig } =
            await import('@/stores/setting/sections/promptPresets');

        const parsed = parsePromptPresetsConfig(
            JSON.stringify({
                presets: [
                    { id: 'dup', label: '一', text: '一内容' },
                    { id: 'dup', label: '二', text: '二内容' },
                ],
            })
        );

        expect(parsed.presets).toHaveLength(2);
        const ids = parsed.presets.map((preset) => preset.id);
        expect(new Set(ids).size).toBe(2);
    });

    it('round-trips presets through serialize then parse', async () => {
        const { parsePromptPresetsConfig, serializePromptPresetsConfig } =
            await import('@/stores/setting/sections/promptPresets');

        const original = parsePromptPresetsConfig(
            JSON.stringify({
                presets: [
                    { id: 'x1', label: '甲', text: '甲内容' },
                    { id: 'x2', label: '乙', text: '乙内容' },
                ],
            })
        );
        const roundTripped = parsePromptPresetsConfig(serializePromptPresetsConfig(original));
        expect(roundTripped).toEqual(original);
    });

    it('loads and saves prompt presets through the settings store', async () => {
        const { useSettingsStore } = await import('@/stores/settings');
        settingsValues.set(
            'prompt_presets',
            JSON.stringify({
                presets: [{ id: 'store-1', label: '我的预设', text: '我的文本' }],
            })
        );

        const store = useSettingsStore();
        await store.initialize();

        expect(store.settings.promptPresets.presets).toEqual([
            { id: 'store-1', label: '我的预设', text: '我的文本' },
        ]);

        await store.updatePromptPresets({
            version: 1,
            presets: [
                { id: 'store-1', label: '改过的', text: '改文本' },
                { id: 'store-2', label: '新增', text: '新文本' },
            ],
        });

        expect(setSettingMock).toHaveBeenLastCalledWith({
            key: 'prompt_presets',
            value: expect.stringContaining('"label":"改过的"'),
        });
        expect(store.settings.promptPresets.presets).toHaveLength(2);
    });
});
