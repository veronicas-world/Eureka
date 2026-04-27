-- ============================================================
-- Pigi v2 — signal type + source constraint expansion
-- Enables the signal deriver (pigi:derive) to emit signals.
-- ============================================================

-- Expand signal_type to include Pigi-derived signal categories.
alter table signals drop constraint if exists signals_signal_type_check;
alter table signals add constraint signals_signal_type_check
  check (signal_type in (
    'funding',
    'hiring_spike',
    'news',
    'founder_move',
    'product_launch',
    'team_growth',
    'web_traffic',
    'tag',
    'highlight',
    'team_change',
    'valuation'
  ));

-- Expand signal_source to include 'pigi_diff'.
alter table signals drop constraint if exists signals_signal_source_check;
alter table signals add constraint signals_signal_source_check
  check (signal_source in (
    'crunchbase', 'linkedin', 'techcrunch', 'manual', 'harmonic', 'pigi_diff'
  ));
