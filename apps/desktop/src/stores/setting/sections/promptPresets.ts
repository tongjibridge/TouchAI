// Copyright (c) 2026. 千诚. Licensed under GPL v3

import { z } from '@/utils/zod';

export const PROMPT_PRESETS_KEY = 'prompt_presets';
export const PROMPT_PRESETS_VERSION = 1;

export interface PromptPreset {
    id: string;
    label: string;
    text: string;
}

export interface PromptPresetsConfig {
    version: typeof PROMPT_PRESETS_VERSION;
    presets: PromptPreset[];
}

const presetSchema = z
    .object({
        id: z.string().optional(),
        label: z.string().optional(),
        text: z.string().optional(),
    })
    .passthrough();

const promptPresetsSchema = z
    .object({
        version: z.number().int().optional(),
        presets: z.array(presetSchema).optional(),
    })
    .passthrough();

/**
 * 生成一个稳定的预设 id。
 * 优先使用浏览器/Node 原生 crypto.randomUUID，缺失时回退到时间戳+随机数。
 */
function createPresetId(): string {
    const cryptoObj = globalThis.crypto as Crypto | undefined;
    if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
        return cryptoObj.randomUUID();
    }
    return `preset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

interface BuiltinPresetSeed {
    label: string;
    text: string;
}

const BUILTIN_PRESET_SEEDS: readonly BuiltinPresetSeed[] = [
    { label: '翻译成中文', text: '请将以下内容翻译成中文：' },
    { label: '翻译成英文', text: '请将以下内容翻译成英文：' },
    { label: '总结全文', text: '请总结以下内容的核心要点：' },
    { label: '改写润色', text: '请润色以下文字，使其更专业、更流畅：' },
    { label: '解释代码', text: '请逐行解释这段代码的作用：' },
];

function cloneDefaultPresets(): PromptPreset[] {
    return BUILTIN_PRESET_SEEDS.map((seed) => ({
        id: createPresetId(),
        label: seed.label,
        text: seed.text,
    }));
}

export const DEFAULT_PROMPT_PRESETS: PromptPresetsConfig = {
    version: PROMPT_PRESETS_VERSION,
    presets: cloneDefaultPresets(),
};

function cloneDefaultPromptPresetsConfig(): PromptPresetsConfig {
    return {
        version: PROMPT_PRESETS_VERSION,
        presets: cloneDefaultPresets(),
    };
}

/**
 * 规范化预设列表：去掉 label/text 为空的项、补齐缺失 id、对重复 id 重新分配。
 */
function normalizePresets(presets: Partial<PromptPreset>[] | undefined): PromptPreset[] {
    if (!Array.isArray(presets)) {
        return cloneDefaultPresets();
    }

    const seenIds = new Set<string>();
    const result: PromptPreset[] = [];

    for (const item of presets) {
        const label = (item?.label ?? '').trim();
        const text = (item?.text ?? '').trim();
        if (!label || !text) {
            continue;
        }

        let id = (item?.id ?? '').trim();
        if (!id || seenIds.has(id)) {
            id = createPresetId();
        }
        seenIds.add(id);

        result.push({ id, label, text });
    }

    return result;
}

export function parsePromptPresetsConfig(configJson: string | null): PromptPresetsConfig {
    if (!configJson) {
        return cloneDefaultPromptPresetsConfig();
    }

    try {
        const parsed = promptPresetsSchema.safeParse(JSON.parse(configJson));
        if (!parsed.success) {
            return cloneDefaultPromptPresetsConfig();
        }
        return {
            version: PROMPT_PRESETS_VERSION,
            presets: normalizePresets(parsed.data.presets),
        };
    } catch {
        return cloneDefaultPromptPresetsConfig();
    }
}

export function serializePromptPresetsConfig(config: PromptPresetsConfig): string {
    const normalized: PromptPresetsConfig = {
        version: PROMPT_PRESETS_VERSION,
        presets: normalizePresets(config.presets),
    };
    return JSON.stringify(normalized);
}

export function createPromptPresetId(): string {
    return createPresetId();
}
