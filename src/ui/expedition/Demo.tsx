import type { DemoKind } from '../../exercise/recovery';

/**
 * A looping demonstration figure for guided movements (the Awakening, Haven
 * yoga): a simple, clearly readable stick figure animated with CSS. It only
 * shows what to do; nothing here watches or scores the player.
 */
export function Demo({ kind, paused }: { kind: DemoKind; paused?: boolean }) {
  const floor = kind === 'catCow' || kind === 'child';
  return (
    <svg className={`demo demo-${kind} ${paused ? 'demo-paused' : ''}`} viewBox="0 0 120 160" role="img" aria-label={`Demonstration: ${kind}`}>
      <ellipse cx="60" cy="152" rx="40" ry="5" className="demo-shadow" />
      {floor ? <FloorFigure kind={kind} /> : <StandingFigure />}
    </svg>
  );
}

function StandingFigure() {
  return (
    <g className="demo-body">
      <g className="demo-legs">
        <g className="demo-leg demo-leg-l">
          <line x1="60" y1="92" x2="52" y2="148" />
        </g>
        <g className="demo-leg demo-leg-r">
          <line x1="60" y1="92" x2="68" y2="148" />
        </g>
      </g>
      <g className="demo-torso">
        <line x1="60" y1="46" x2="60" y2="94" />
        <g className="demo-arm demo-arm-l">
          <line x1="60" y1="54" x2="40" y2="86" />
        </g>
        <g className="demo-arm demo-arm-r">
          <line x1="60" y1="54" x2="80" y2="86" />
        </g>
        <circle cx="60" cy="32" r="13" className="demo-head" />
      </g>
    </g>
  );
}

function FloorFigure({ kind }: { kind: DemoKind }) {
  if (kind === 'child')
    return (
      <g className="demo-body demo-breathe">
        <path d="M34 146 L52 128 L84 138 L100 146" />
        <line x1="52" y1="128" x2="20" y2="146" />
        <circle cx="26" cy="138" r="10" className="demo-head" />
      </g>
    );
  return (
    <g className="demo-body">
      <path className="demo-spine" d="M30 110 Q60 104 90 110" />
      <line x1="30" y1="110" x2="30" y2="148" />
      <line x1="90" y1="110" x2="90" y2="148" />
      <line x1="90" y1="148" x2="104" y2="148" />
      <circle cx="18" cy="104" r="11" className="demo-head" />
    </g>
  );
}
