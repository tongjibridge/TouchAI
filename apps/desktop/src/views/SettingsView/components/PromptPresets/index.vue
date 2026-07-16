<!-- Copyright (c) 2026. 千诚. Licensed under GPL v3 -->

<script setup lang="ts">
    import AppIcon from '@components/AppIcon.vue';
    import DialogShell from '@components/DialogShell.vue';
    import { Button } from '@components/ui/button';
    import { Input } from '@components/ui/input';
    import { useConfirm } from '@composables/useConfirm';
    import { storeToRefs } from 'pinia';
    import { computed, onBeforeUnmount, ref, watch } from 'vue';

    import { type MessageKey, t } from '@/i18n';
    import {
        createPromptPresetId,
        parsePromptPresetsConfig,
        type PromptPreset,
        type PromptPresetsConfig,
        serializePromptPresetsConfig,
    } from '@/stores/setting/sections/promptPresets';
    import { useSettingsStore } from '@/stores/settings';

    defineOptions({ name: 'SettingsPromptPresetsSection' });

    const settingsStore = useSettingsStore();
    const { settings } = storeToRefs(settingsStore);
    const { confirm } = useConfirm();

    const draft = ref<PromptPresetsConfig>(cloneConfig(settings.value.promptPresets));
    const saveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle');
    let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
    let isSyncingFromStore = false;

    interface EditState {
        mode: 'create' | 'edit';
        id: string | null;
        label: string;
        text: string;
    }

    const editState = ref<EditState | null>(null);
    const editError = ref<string | null>(null);

    const canSave = computed(() => saveState.value !== 'saving');
    const hasPresets = computed(() => draft.value.presets.length > 0);

    watch(
        () => settings.value.promptPresets,
        (config) => {
            isSyncingFromStore = true;
            draft.value = cloneConfig(config);
            queueMicrotask(() => {
                isSyncingFromStore = false;
            });
        },
        { deep: true }
    );

    watch(draft, scheduleAutoSave, { deep: true });

    onBeforeUnmount(() => {
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
            autoSaveTimer = null;
        }
    });

    function cloneConfig(config: PromptPresetsConfig): PromptPresetsConfig {
        return parsePromptPresetsConfig(serializePromptPresetsConfig(config));
    }

    function scheduleAutoSave() {
        if (isSyncingFromStore || !canSave.value) return;
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
        }
        autoSaveTimer = setTimeout(() => {
            autoSaveTimer = null;
            void saveSettings();
        }, 250);
    }

    async function saveSettings() {
        if (!canSave.value) return;
        saveState.value = 'saving';
        try {
            await settingsStore.updatePromptPresets({
                ...draft.value,
                presets: draft.value.presets.map((preset) => ({ ...preset })),
            });
            saveState.value = 'saved';
            isSyncingFromStore = true;
            queueMicrotask(() => {
                isSyncingFromStore = false;
            });
        } catch (error) {
            console.error('[PromptPresets] Failed to save prompt presets:', error);
            saveState.value = 'error';
        }
    }

    function openCreateDialog() {
        editState.value = {
            mode: 'create',
            id: null,
            label: '',
            text: '',
        };
        editError.value = null;
    }

    function openEditDialog(preset: PromptPreset) {
        editState.value = {
            mode: 'edit',
            id: preset.id,
            label: preset.label,
            text: preset.text,
        };
        editError.value = null;
    }

    function closeEditDialog() {
        editState.value = null;
        editError.value = null;
    }

    function submitEditDialog() {
        if (!editState.value) return;
        const label = editState.value.label.trim();
        const text = editState.value.text.trim();
        if (!label) {
            editError.value = t('settings.promptPresets.editDialog.errorLabelRequired');
            return;
        }
        if (!text) {
            editError.value = t('settings.promptPresets.editDialog.errorTextRequired');
            return;
        }

        if (editState.value.mode === 'create') {
            draft.value.presets.push({
                id: createPromptPresetId(),
                label,
                text,
            });
        } else if (editState.value.id) {
            const targetId = editState.value.id;
            const target = draft.value.presets.find((preset) => preset.id === targetId);
            if (target) {
                target.label = label;
                target.text = text;
            }
        }

        closeEditDialog();
    }

    async function deletePreset(preset: PromptPreset) {
        const confirmed = await confirm({
            title: t('settings.promptPresets.deleteConfirm.title'),
            message: t('settings.promptPresets.deleteConfirm.message', {
                label: preset.label,
            }),
            type: 'danger',
            confirmText: t('common.delete'),
            cancelText: t('common.cancel'),
        });
        if (!confirmed) return;
        draft.value.presets = draft.value.presets.filter((item) => item.id !== preset.id);
    }

    function movePreset(index: number, direction: -1 | 1) {
        const presets = draft.value.presets;
        const target = index + direction;
        if (target < 0 || target >= presets.length) return;
        const next = [...presets];
        const removed = next.splice(index, 1);
        if (removed.length > 0) {
            next.splice(target, 0, removed[0]!);
        }
        draft.value.presets = next;
    }

    const saveStateKey = computed<MessageKey | null>(() => {
        switch (saveState.value) {
            case 'saving':
                return 'settings.promptPresets.saveState.saving';
            case 'saved':
                return 'settings.promptPresets.saveState.saved';
            case 'error':
                return 'settings.promptPresets.saveState.error';
            default:
                return null;
        }
    });
</script>

<template>
    <div class="settings-page" data-testid="settings-prompt-presets-section">
        <div class="settings-section-stack">
            <header class="settings-page-header flex items-start gap-4">
                <div class="max-w-2xl min-w-0">
                    <h1 class="settings-page-title" data-testid="prompt-presets-settings-title">
                        {{ t('settings.promptPresets.title') }}
                    </h1>
                    <p class="settings-section-description">
                        {{ t('settings.promptPresets.description') }}
                    </p>
                </div>
                <Button
                    data-testid="prompt-presets-add-button"
                    class="bg-primary-700 hover:bg-primary-600 ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors"
                    @click="openCreateDialog"
                >
                    <AppIcon name="plus" class="h-3.5 w-3.5" />
                    {{ t('settings.promptPresets.addButton') }}
                </Button>
            </header>

            <p
                v-if="saveStateKey"
                class="text-xs text-neutral-500"
                :data-testid="`prompt-presets-save-state-${saveState}`"
            >
                {{ t(saveStateKey) }}
            </p>

            <section class="space-y-4">
                <h2 class="settings-section-title">
                    {{ t('settings.promptPresets.section.presets') }}
                </h2>

                <div
                    v-if="!hasPresets"
                    data-testid="prompt-presets-empty"
                    class="settings-row-group rounded-lg px-5 py-10 text-center text-sm text-neutral-500"
                >
                    {{ t('settings.promptPresets.emptyHint') }}
                </div>

                <div v-else class="settings-row-group divide-y divide-neutral-200/70">
                    <div
                        v-for="(preset, index) in draft.presets"
                        :key="preset.id"
                        :data-testid="`prompt-presets-row-${preset.id}`"
                        class="grid min-w-0 gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    >
                        <div class="min-w-0">
                            <div
                                class="truncate text-[13px] leading-6 font-normal text-neutral-900"
                            >
                                {{ preset.label }}
                            </div>
                            <div
                                class="mt-1 line-clamp-2 text-xs break-all whitespace-pre-wrap text-neutral-500"
                            >
                                {{ preset.text }}
                            </div>
                        </div>
                        <div class="flex shrink-0 items-center gap-1">
                            <button
                                type="button"
                                :data-testid="`prompt-presets-move-up-${preset.id}`"
                                class="rounded p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-30"
                                :disabled="index === 0"
                                :aria-label="t('settings.promptPresets.moveUp')"
                                @click="movePreset(index, -1)"
                            >
                                <AppIcon name="chevron-up" class="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                :data-testid="`prompt-presets-move-down-${preset.id}`"
                                class="rounded p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-30"
                                :disabled="index === draft.presets.length - 1"
                                :aria-label="t('settings.promptPresets.moveDown')"
                                @click="movePreset(index, 1)"
                            >
                                <AppIcon name="chevron-down" class="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                :data-testid="`prompt-presets-edit-${preset.id}`"
                                class="rounded p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                                :aria-label="t('settings.promptPresets.editLabel')"
                                @click="openEditDialog(preset)"
                            >
                                <AppIcon name="edit" class="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                :data-testid="`prompt-presets-delete-${preset.id}`"
                                class="rounded p-1.5 text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600"
                                :aria-label="t('settings.promptPresets.deleteLabel')"
                                @click="deletePreset(preset)"
                            >
                                <AppIcon name="delete" class="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>

        <DialogShell v-if="editState" @close="closeEditDialog">
            <h2 class="mb-5 text-[15px] font-medium text-neutral-950">
                {{
                    editState.mode === 'create'
                        ? t('settings.promptPresets.editDialog.titleCreate')
                        : t('settings.promptPresets.editDialog.titleEdit')
                }}
            </h2>

            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-neutral-700">
                        {{ t('settings.promptPresets.editDialog.label') }}
                    </label>
                    <Input
                        v-model="editState.label"
                        data-testid="prompt-presets-edit-label"
                        class="mt-1.5"
                        :placeholder="t('settings.promptPresets.editDialog.labelPlaceholder')"
                        maxlength="32"
                    />
                    <p class="mt-1 text-xs text-neutral-400">
                        {{ t('settings.promptPresets.editDialog.labelHelp') }}
                    </p>
                </div>

                <div>
                    <label class="block text-sm font-medium text-neutral-700">
                        {{ t('settings.promptPresets.editDialog.text') }}
                    </label>
                    <textarea
                        v-model="editState.text"
                        data-testid="prompt-presets-edit-text"
                        rows="4"
                        class="settings-input mt-1.5 w-full resize-y"
                        :placeholder="t('settings.promptPresets.editDialog.textPlaceholder')"
                    />
                    <p class="mt-1 text-xs text-neutral-400">
                        {{ t('settings.promptPresets.editDialog.textHelp') }}
                    </p>
                </div>

                <p
                    v-if="editError"
                    data-testid="prompt-presets-edit-error"
                    class="text-xs text-red-600"
                >
                    {{ editError }}
                </p>
            </div>

            <div class="mt-6 flex gap-3">
                <Button
                    data-testid="prompt-presets-edit-save"
                    class="bg-primary-700 hover:bg-primary-600 flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
                    @click="submitEditDialog"
                >
                    {{ t('common.save') }}
                </Button>
                <Button
                    variant="outline"
                    data-testid="prompt-presets-edit-cancel"
                    class="flex-1 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:border-neutral-300"
                    @click="closeEditDialog"
                >
                    {{ t('common.cancel') }}
                </Button>
            </div>
        </DialogShell>
    </div>
</template>
