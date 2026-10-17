// In-memory Ruri routing audit for explicit developer diagnostics export.
// No transcript, baby name, or spoken English is retained in this audit.
export const ROUTING_AUDIT_LIMIT = 20;
import {TOPIC_RESCUE_PROBABILITY, TOPIC_RESCUE_MARGIN} from './ruri-routing.js';

export function describeRuriTurn({prediction = null, response, interactionEnabled = true, at = new Date().toISOString()}) {
  const rawTopic = prediction?.topic?.rawId ?? prediction?.topic?.id ?? prediction?.topic?.topic ?? null;
  const rawInteraction = prediction?.interaction?.id ?? prediction?.interaction?.interaction ?? null;
  const topicProbability = prediction?.topic?.probability ?? null;
  const topicMargin = prediction?.topic?.margin ?? null;
  const interactionProbability = prediction?.interaction?.probability ?? prediction?.interaction?.interactionProbability ?? null;
  const interactionMargin = prediction?.interaction?.margin ?? prediction?.interaction?.interactionMargin ?? null;
  const rescued = response?.topic === rawTopic && rawTopic != null
    && (topicProbability < 0.50 || prediction?.topic?.id === 'generic')
    && topicProbability >= TOPIC_RESCUE_PROBABILITY && topicMargin >= TOPIC_RESCUE_MARGIN;
  const topicStatus = rescued ? 'rescued' : rawTopic == null ? 'unavailable'
    : rawTopic === 'generic' ? 'generic'
    : topicProbability == null || topicProbability < 0.50 ? 'low_probability'
    : topicMargin == null || topicMargin < 0.05 ? 'low_margin' : 'accepted';
  const interactionStatus = !interactionEnabled ? 'disabled'
    : rawInteraction == null ? 'unavailable'
    : rawInteraction === 'none' ? 'none'
    : interactionProbability == null || interactionProbability < 0.50 ? 'low_probability' : 'accepted';
  const pairMissing = Boolean(response?.topic && response?.interaction && !response?.combined);
  const reason = rescued ? 'topic_rescued_both_generic' : response?.selectionReason ?? (response?.combined ? 'combined'
    : pairMissing ? 'pair_missing'
    : response?.topic ? 'topic_only'
    : response?.interaction ? 'interaction_only' : 'generic');
  return {
    at, topicRaw: rawTopic, topicProbability, topicMargin, topicStatus,
    interactionRaw: rawInteraction, interactionProbability, interactionMargin,
    interactionStatus, interactionEnabled: Boolean(interactionEnabled),
    acceptedTopic: response?.topic ?? null, acceptedInteraction: response?.interaction ?? null,
    route: response?.scene ?? 'generic', reason,
  };
}

export function appendRuriTurn(history, detail, limit = ROUTING_AUDIT_LIMIT) {
  return [...history, detail].slice(-limit);
}
