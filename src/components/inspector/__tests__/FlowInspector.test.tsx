/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Position, ReactFlowProvider } from '@xyflow/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react');
  return {
    ...actual,
    // EdgeLabelRenderer portals into .react-flow__edgelabel-renderer; render inline in tests.
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="edge-label-renderer">{children}</div>
    ),
  };
});

import { FlowEdge } from '@/components/canvas/FlowEdge';
import { FlowInspector } from '../FlowInspector';
import { buildStepsForFlow } from '../StepBreakdown';
import { resolveScenarioGraph } from '@/core/engine';
import {
  collectAlerts,
  resolveLegalNotesForFlow,
} from '@/core/legal/legalNotes';
import { SASU_HOLDING_PRESET } from '@/core/presets';
import type { FlowEdgeData } from '@/core/types';

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => {};
  }

  if (!window.matchMedia) {
    window.matchMedia = ((query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as typeof window.matchMedia;
  }

  // SVG getBBox / getScreenCTM stubs for BaseEdge in jsdom
  const svgProto = SVGElement.prototype as SVGElement & {
    getBBox?: () => DOMRect;
  };
  if (!svgProto.getBBox) {
    svgProto.getBBox = () =>
      ({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        toJSON: () => ({}),
      }) as DOMRect;
  }
});

afterEach(() => {
  cleanup();
});

const MOTHER_DAUGHTER_FLOW: FlowEdgeData = {
  id: 'flow-dividend-sasu-holding',
  sourceId: 'sasu-1',
  targetId: 'holding-1',
  category: 'dividend',
  label: 'Dividendes mère-fille',
  amount: 50_000,
  periodicity: 'annual',
  layer: 'tax',
  legalNoteId: 'mere-fille-art-145',
};

describe('FlowInspector — mère-fille', () => {
  it('shows Art. 145 CGI and Art. 216 CGI for mother-daughter dividends', () => {
    const resolved = resolveScenarioGraph(SASU_HOLDING_PRESET);
    const flow = resolved.flows.find((f) => f.id === MOTHER_DAUGHTER_FLOW.id);
    expect(flow).toBeDefined();

    render(
      <FlowInspector
        flow={flow!}
        taxResult={flow!.taxResult}
        onClose={() => {}}
      />,
    );

    expect(screen.getByTestId('flow-inspector')).toBeInTheDocument();
    expect(screen.getByText(/Dividendes mère-fille/i)).toBeInTheDocument();

    const art145 = screen.getAllByText(/Art\. 145 CGI/i);
    const art216 = screen.getAllByText(/Art\. 216 CGI/i);
    expect(art145.length).toBeGreaterThanOrEqual(1);
    expect(art216.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('heading', { name: /Art\. 145 CGI/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Art\. 216 CGI/i })).toBeInTheDocument();
    expect(screen.getByTestId('legal-reference')).toBeInTheDocument();
    expect(screen.getByTestId('step-breakdown')).toBeInTheDocument();
  });

  it('exposes calculator steps (QPFC / IS holding / net)', () => {
    const resolved = resolveScenarioGraph(SASU_HOLDING_PRESET);
    const flow = resolved.flows.find((f) => f.id === MOTHER_DAUGHTER_FLOW.id)!;
    const steps = buildStepsForFlow(flow, flow.taxResult);

    expect(steps.some((s) => /QPFC/i.test(s.label))).toBe(true);
    expect(steps.some((s) => /IS holding|Net après|Cash net/i.test(s.label))).toBe(
      true,
    );
  });
});

describe('LegalReference alerts', () => {
  it('surfaces CCA débiteur and acte anormal de gestion badges', () => {
    const ccaFlow: FlowEdgeData = {
      id: 'flow-cca',
      sourceId: 'sasu-1',
      targetId: 'person-1',
      category: 'cca_advance',
      label: 'Avance CCA',
      amount: 5_000,
      periodicity: 'one_off',
      layer: 'legal',
      legalNoteId: 'cca-debiteur',
    };
    const mgmtFlow: FlowEdgeData = {
      id: 'flow-mgmt',
      sourceId: 'sasu-1',
      targetId: 'holding-1',
      category: 'management_fees',
      label: 'Management fees',
      amount: 12_000,
      periodicity: 'annual',
      layer: 'treasury',
    };

    const ccaNotes = resolveLegalNotesForFlow(ccaFlow);
    const ccaAlerts = collectAlerts(ccaNotes);
    expect(ccaAlerts.some((a) => a.code === 'cca_debiteur')).toBe(true);
    expect(ccaAlerts.some((a) => /CCA débiteur/i.test(a.label))).toBe(true);

    const mgmtNotes = resolveLegalNotesForFlow(mgmtFlow);
    const mgmtAlerts = collectAlerts(mgmtNotes);
    expect(mgmtAlerts.some((a) => a.code === 'acte_anormal_gestion')).toBe(true);
    expect(
      mgmtAlerts.some((a) => /acte anormal de gestion/i.test(a.label)),
    ).toBe(true);

    render(<FlowInspector flow={ccaFlow} onClose={() => {}} />);
    expect(screen.getByTestId('alert-badge-cca_debiteur')).toBeInTheDocument();

    cleanup();
    render(<FlowInspector flow={mgmtFlow} onClose={() => {}} />);
    expect(
      screen.getByTestId('alert-badge-acte_anormal_gestion'),
    ).toBeInTheDocument();
  });
});

describe('FlowEdge label → selection', () => {
  it('fires onSelect when the edge amount label is clicked', () => {
    const onSelect = vi.fn();

    render(
      <ReactFlowProvider>
        <svg>
          <FlowEdge
            id={MOTHER_DAUGHTER_FLOW.id}
            source="sasu-1"
            target="holding-1"
            sourceX={0}
            sourceY={0}
            targetX={100}
            targetY={100}
            sourcePosition={Position.Right}
            targetPosition={Position.Left}
            data={{
              ...MOTHER_DAUGHTER_FLOW,
              onSelect,
            }}
            markerEnd={undefined}
            style={{}}
            selected={false}
            selectable
            deletable
            pathOptions={undefined}
          />
        </svg>
      </ReactFlowProvider>,
    );

    const label = screen.getByTestId(
      `flow-edge-label-${MOTHER_DAUGHTER_FLOW.id}`,
    );
    fireEvent.click(label);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({
      id: MOTHER_DAUGHTER_FLOW.id,
      category: 'dividend',
      legalNoteId: 'mere-fille-art-145',
    });
    // Callback field must not leak into the selected FlowEdgeData payload
    expect(onSelect.mock.calls[0]?.[0]).not.toHaveProperty('onSelect');
  });
});
