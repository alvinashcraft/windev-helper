export type DesignerEditDecision = 'invalid' | 'conflict' | 'noop' | 'apply';

export interface DesignerEditEnvelope {
    text?: unknown;
    baseText?: unknown;
}

/**
 * Determines whether a full-document designer edit can safely replace the
 * source revision that the designer used to produce it.
 */
export function decideDesignerEdit(
    currentText: string,
    message: DesignerEditEnvelope
): DesignerEditDecision {
    if (typeof message.text !== 'string' || typeof message.baseText !== 'string') {
        return 'invalid';
    }
    if (message.text === currentText) {
        return 'noop';
    }
    if (message.baseText !== currentText) {
        return 'conflict';
    }
    return 'apply';
}