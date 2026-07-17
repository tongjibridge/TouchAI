import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PromptPresetsConfig } from '@/stores/setting/sections/promptPresets';
import PromptPresetsView from '@/views/SettingsView/components/PromptPresets/index.vue';

const updatePromptPresetsMock = vi.hoisted(() =>
    vi.fn(async (config: PromptPresetsConfig) => {
        void config;
        return undefined;
    })
);
const confirmMock = vi.hoisted(() => vi.fn(async () => true));

vi.mock('@/stores/settings', async () => {
    const { DEFAULT_PROMPT_PRESETS } = await import('@/stores/setting/sections/promptPresets');
    const { ref } = await import('vue');
    const settingsRef = ref({
        promptPresets: {
            ...DEFAULT_PROMPT_PRESETS,
            presets: [
                { id: 'p1', label: '翻译', text: '请翻译：' },
                { id: 'p2', label: '总结', text: '请总结：' },
            ],
        },
    });

    return {
        useSettingsStore: () => ({
            settings: settingsRef,
            updatePromptPresets: updatePromptPresetsMock,
        }),
    };
});

vi.mock('@composables/useConfirm', () => ({
    useConfirm: () => ({ confirm: confirmMock }),
}));

vi.mock('@components/DialogShell.vue', () => ({
    default: {
        name: 'DialogShell',
        emits: ['close'],
        template: '<div data-testid="dialog-shell"><slot /></div>',
    },
}));

describe('Prompt presets settings section', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.useFakeTimers();
        updatePromptPresetsMock.mockClear();
        confirmMock.mockClear();
        confirmMock.mockResolvedValue(true);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders the existing presets as rows', () => {
        const wrapper = mount(PromptPresetsView);
        expect(wrapper.find('[data-testid="prompt-presets-settings-title"]').text()).toBe(
            '提示词预设'
        );
        expect(wrapper.find('[data-testid="prompt-presets-row-p1"]').exists()).toBe(true);
        expect(wrapper.find('[data-testid="prompt-presets-row-p2"]').exists()).toBe(true);
        expect(wrapper.findAll('[data-testid^="prompt-presets-row-"]')).toHaveLength(2);
    });

    it('opens the create dialog and adds a preset on save, auto-saving afterwards', async () => {
        const wrapper = mount(PromptPresetsView);
        await Promise.resolve();

        await wrapper.find('[data-testid="prompt-presets-add-button"]').trigger('click');
        await vi.advanceTimersByTimeAsync(0);
        expect(wrapper.find('[data-testid="prompt-presets-edit-label"]').exists()).toBe(true);

        await wrapper.find('[data-testid="prompt-presets-edit-label"]').setValue('新预设');
        await wrapper.find('[data-testid="prompt-presets-edit-text"]').setValue('新提示词');
        await wrapper.find('[data-testid="prompt-presets-edit-save"]').trigger('click');

        expect(wrapper.find('[data-testid="prompt-presets-edit-label"]').exists()).toBe(false);
        // 新增后草稿长度应为 3
        expect(wrapper.findAll('[data-testid^="prompt-presets-row-"]')).toHaveLength(3);
        expect(wrapper.find('[data-testid="prompt-presets-edit-error"]').exists()).toBe(false);

        // 触发 250ms 自动保存
        await vi.advanceTimersByTimeAsync(300);
        expect(updatePromptPresetsMock).toHaveBeenCalledTimes(1);
        const savedPayload = updatePromptPresetsMock.mock.calls[0]![0];
        expect(savedPayload.presets).toHaveLength(3);
        expect(savedPayload.presets[2]).toMatchObject({
            label: '新预设',
            text: '新提示词',
        });
    });

    it('rejects an empty label when saving an edit', async () => {
        const wrapper = mount(PromptPresetsView);
        await Promise.resolve();

        await wrapper.find('[data-testid="prompt-presets-add-button"]').trigger('click');
        await vi.advanceTimersByTimeAsync(0);
        await wrapper.find('[data-testid="prompt-presets-edit-text"]').setValue('只有内容');
        await wrapper.find('[data-testid="prompt-presets-edit-save"]').trigger('click');

        expect(wrapper.find('[data-testid="prompt-presets-edit-error"]').exists()).toBe(true);
        expect(wrapper.find('[data-testid="prompt-presets-edit-label"]').exists()).toBe(true);
    });

    it('deletes a preset after confirmation and auto-saves', async () => {
        const wrapper = mount(PromptPresetsView);
        await Promise.resolve();

        await wrapper.find('[data-testid="prompt-presets-delete-p1"]').trigger('click');
        await vi.advanceTimersByTimeAsync(0);

        expect(confirmMock).toHaveBeenCalledTimes(1);
        expect(wrapper.findAll('[data-testid^="prompt-presets-row-"]')).toHaveLength(1);

        await vi.advanceTimersByTimeAsync(300);
        expect(updatePromptPresetsMock).toHaveBeenCalledTimes(1);
        expect(updatePromptPresetsMock.mock.calls[0]![0].presets).toHaveLength(1);
    });

    it('keeps the preset when the delete confirmation is cancelled', async () => {
        confirmMock.mockResolvedValue(false);
        const wrapper = mount(PromptPresetsView);
        await Promise.resolve();

        await wrapper.find('[data-testid="prompt-presets-delete-p1"]').trigger('click');
        await vi.advanceTimersByTimeAsync(0);

        expect(wrapper.findAll('[data-testid^="prompt-presets-row-"]')).toHaveLength(2);
        await vi.advanceTimersByTimeAsync(300);
        expect(updatePromptPresetsMock).not.toHaveBeenCalled();
    });

    it('reorders presets with move up / move down buttons', async () => {
        const wrapper = mount(PromptPresetsView);
        await Promise.resolve();

        // 把第二项往上移
        await wrapper.find('[data-testid="prompt-presets-move-up-p2"]').trigger('click');
        await vi.advanceTimersByTimeAsync(300);

        const saved = updatePromptPresetsMock.mock.calls[0]![0].presets;
        expect(saved[0]!.id).toBe('p2');
        expect(saved[1]!.id).toBe('p1');
    });
});
