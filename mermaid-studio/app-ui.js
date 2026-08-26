/* GENERATED FILE — do not edit by hand.
 * Compiled from the former <script type="text/babel"> block of index.html
 * with @babel/standalone (preset react) at authoring time, so the page ships
 * without any runtime Babel. Regenerate via tools/precompile.js.
 * Low-level API note: this is exactly React.createElement output. */
'use strict';

const {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useReducer
} = React;
const C = window.StudioCore;
const {
  PIE_COLORS,
  GANTT_STATUS_STYLE,
  polarPt,
  slicePath,
  pieBounds,
  fmtIso,
  fmtDur,
  resolveGantt,
  niceTicks,
  dayLabel,
  seqLayout
} = C;
const STORE_KEY = 'mermaid-studio-v2';
function loadSaved() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const j = JSON.parse(raw);
      if (j && j.v === 2 && j.docs) return j;
    }
    const legacy = localStorage.getItem('mermaid-studio-v1');
    if (legacy) {
      const j = JSON.parse(legacy);
      if (j && j.model && j.model.nodes) return {
        docs: {
          flowchart: {
            data: j.model
          }
        },
        prefs: j.prefs || {}
      };
    }
  } catch (e) {}
  return null;
}
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/&gt;/g, '&gt;');
}
const deepClone = o => JSON.parse(JSON.stringify(o));
function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const PAL_ICONS = {
  rect: '<rect x="3" y="4" width="24" height="14" rx="3"/>',
  round: '<rect x="3" y="4" width="24" height="14" rx="7"/>',
  stadium: '<rect x="3" y="5" width="24" height="12" rx="6"/>',
  sub: '<rect x="3" y="4" width="24" height="14" rx="2"/><line x1="8" y1="4" x2="8" y2="18"/><line x1="22" y1="4" x2="22" y2="18"/>',
  cyl: '<path d="M3 7 a12 3.4 0 0 1 24 0 v8 a12 3.4 0 0 1 -24 0 z"/><path d="M3 7 a12 3.4 0 0 0 24 0"/>',
  circle: '<ellipse cx="15" cy="11" rx="10" ry="8"/>',
  diamond: '<polygon points="15,2 27,11 15,20 3,11"/>',
  hex: '<polygon points="8,4 22,4 27,11 22,18 8,18 3,11"/>',
  para: '<polygon points="7,4 27,4 27,18 7,18 3,11"/>'
};
function PalIcon({
  shape
}) {
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 30 22",
    dangerouslySetInnerHTML: {
      __html: PAL_ICONS[shape] || PAL_ICONS.rect
    },
    style: {
      fill: 'none',
      stroke: '#8fa6c2',
      strokeWidth: 1.6
    }
  });
}
function UField({
  value,
  onLive,
  onCommitPre,
  mono,
  placeholder,
  style,
  autoFocus
}) {
  const u = useUndoablePre(onCommitPre);
  return /*#__PURE__*/React.createElement("input", {
    className: 'sin' + (mono ? ' mono' : ''),
    value: value == null ? '' : value,
    placeholder: placeholder || '',
    style: style,
    autoFocus: autoFocus,
    onFocus: u.grab,
    onChange: e => {
      u.grab();
      onLive(e.target.value);
      u.arm();
    },
    onBlur: u.flush,
    onKeyDown: e => {
      if (e.key === 'Enter') e.target.blur();
      e.stopPropagation();
    }
  });
}
function USelect({
  value,
  onLive,
  onCommitPre,
  options,
  style
}) {
  const u = useUndoablePre(onCommitPre);
  return /*#__PURE__*/React.createElement("select", {
    value: value,
    style: style,
    onFocus: u.grab,
    onChange: e => {
      u.grab();
      onLive(e.target.value);
      u.flush();
    },
    onKeyDown: e => e.stopPropagation()
  }, options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label)));
}
function UCheck({
  checked,
  onLive,
  onCommitPre,
  label,
  title
}) {
  const u = useUndoablePre(onCommitPre);
  return /*#__PURE__*/React.createElement("label", {
    title: title || '',
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 12,
      color: 'var(--muted)',
      cursor: 'pointer',
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!checked,
    onFocus: u.grab,
    onChange: e => {
      u.grab();
      onLive(e.target.checked);
      u.flush();
    },
    onKeyDown: e => e.stopPropagation(),
    style: {
      accentColor: '#22d3ee'
    }
  }), label);
}
function RowBtns({
  onUp,
  onDown,
  onDel,
  upDis,
  downDis
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      gap: 3,
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "mini-btn",
    title: "Move up",
    disabled: upDis,
    onClick: onUp
  }, "\u2191"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "mini-btn",
    title: "Move down",
    disabled: downDis,
    onClick: onDown
  }, "\u2193"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "mini-btn del",
    title: "Delete",
    onClick: onDel
  }, "\u2715"));
}

// Floating editing pill. Lives inside .viz-body which clears the selection on
// pointerdown — stop propagation here so clicks INSIDE the pill never kill it.
function FPill({
  style,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "fpill",
    style: style,
    onPointerDown: e => e.stopPropagation()
  }, children);
}

// Editable comma-separated id list (e.g. Note over A,B). Keeps the raw text as a
// local draft while focused so separators survive typing; the parsed array is what
// reaches the document. Re-syncs when the list changes externally (rename etc).
function JoinField({
  list,
  onLive,
  onCommitPre,
  placeholder,
  style
}) {
  const u = useUndoablePre(onCommitPre);
  const joined = (list || []).join(',');
  const [snap, setSnap] = useState({
    base: joined,
    draft: null
  });
  if (snap.base !== joined) setSnap({
    base: joined,
    draft: null
  });
  return /*#__PURE__*/React.createElement("input", {
    className: "sin",
    value: snap.draft != null ? snap.draft : joined,
    placeholder: placeholder || '',
    style: style,
    onFocus: u.grab,
    onChange: e => {
      u.grab();
      const v = e.target.value;
      setSnap({
        base: joined,
        draft: v
      });
      onLive(v.split(',').map(x => x.trim()).filter(Boolean));
      u.arm();
    },
    onBlur: () => {
      u.flush();
      setSnap(s => ({
        ...s,
        draft: null
      }));
    },
    onKeyDown: e => {
      if (e.key === 'Enter') e.target.blur();
      e.stopPropagation();
    }
  });
}
function useUndoablePre(onCommitPre) {
  const pre = useRef(null);
  const timer = useRef(null);
  const grab = () => {
    if (pre.current == null) pre.current = onCommitPre.snap();
  };
  const arm = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (pre.current != null) {
        onCommitPre.push(pre.current);
        pre.current = null;
      }
    }, 900);
  };
  const flush = () => {
    clearTimeout(timer.current);
    if (pre.current != null) {
      onCommitPre.push(pre.current);
      pre.current = null;
    }
  };
  useEffect(() => () => {
    clearTimeout(timer.current);
    if (pre.current != null) {
      onCommitPre.push(pre.current);
      pre.current = null;
    }
  }, []);
  return {
    grab,
    arm,
    flush
  };
}
function makeApi({
  data,
  commitData,
  snapOf,
  pushPre
}) {
  return {
    edit: (fn, structural) => {
      if (structural) pushPre(snapOf());
      const d2 = deepClone(data);
      fn(d2);
      commitData(d2);
    },
    snap: () => snapOf(),
    pushPre,
    commit: fn => {
      const d2 = deepClone(data);
      fn(d2);
      commitData(d2);
    },
    data
  };
}
function SeqSheet({
  data,
  api
}) {
  const participants = data.participants;
  const items = data.items || [];
  const renameParticipant = (oldId, newIdRaw) => {
    const newId = newIdRaw.trim().replace(/[^\w.\-]/g, '') || oldId;
    if (newId === oldId) return;
    if (participants.some(p => p.id === newId)) return;
    api.edit(d => {
      const p = d.participants.find(x => x.id === oldId);
      if (p) p.id = newId;
      for (const it of d.items) {
        if (it.kind === 'msg') {
          if (it.from === oldId) it.from = newId;
          if (it.to === oldId) it.to = newId;
        } else if (it.kind === 'note') {
          it.who = it.who.map(w => w === oldId ? newId : w);
        } else if (it.kind === 'act') {
          if (it.who === oldId) it.who = newId;
        }
      }
    });
  };
  const pOpts = participants.map(p => ({
    value: p.id,
    label: `${p.id}${p.label !== p.id ? ' · ' + p.label : ''}`
  }));
  const arrowOpts = ['->>', '-->>', '->', '-->', '-)', '--)', '-x', '--x'].map(a => ({
    value: a,
    label: `${a}  ${SEQ_ARROW_LABELS[a]}`
  }));
  const addItem = kind => {
    api.edit(d => {
      if (!d.participants.length) {
        d.participants.push({
          id: 'A',
          label: 'Alice',
          actor: false
        });
        d.participants.push({
          id: 'B',
          label: 'Bob',
          actor: false
        });
      }
      const first = d.participants[0].id;
      const second = d.participants[1] ? d.participants[1].id : first;
      if (kind === 'msg') d.items.push({
        kind: 'msg',
        from: first,
        arrow: '->>',
        to: second,
        text: 'message'
      });else if (kind === 'note') d.items.push({
        kind: 'note',
        pos: 'over',
        who: [first],
        text: 'note'
      });else if (kind === 'act-on') d.items.push({
        kind: 'act',
        on: true,
        who: first
      });else if (kind === 'act-off') d.items.push({
        kind: 'act',
        on: false,
        who: first
      });
    }, true);
  };
  const moveItem = (i, dir) => api.edit(d => {
    const j = i + dir;
    if (j < 0 || j >= d.items.length) return;
    const t = d.items[i];
    d.items[i] = d.items[j];
    d.items[j] = t;
  }, true);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "scard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scard-h"
  }, /*#__PURE__*/React.createElement("span", null, "Participants"), /*#__PURE__*/React.createElement("span", {
    className: "grow"
  }), /*#__PURE__*/React.createElement(UCheck, {
    label: "autonumber",
    checked: !!data.autonumber,
    title: "Number the messages automatically",
    onLive: v => api.edit(d => {
      d.autonumber = v;
    }),
    onCommitPre: {
      snap: api.snap,
      push: api.pushPre
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => api.edit(d => {
      let i = d.participants.length + 1;
      while (d.participants.some(p => p.id === 'P' + i)) i++;
      d.participants.push({
        id: 'P' + i,
        label: 'P' + i,
        actor: false
      });
    }, true)
  }, "+ Participant")), participants.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "sheet-empty"
  }, "No participants yet."), participants.map((p, i) => /*#__PURE__*/React.createElement("div", {
    className: "trow",
    key: i
  }, /*#__PURE__*/React.createElement(UField, {
    style: {
      width: 92
    },
    value: p.id,
    placeholder: "id",
    onLive: v => renameParticipant(p.id, v),
    onCommitPre: {
      snap: api.snap,
      push: api.pushPre
    }
  }), /*#__PURE__*/React.createElement(UField, {
    style: {
      flex: 1,
      minWidth: 110
    },
    value: p.label,
    placeholder: "display name",
    onLive: v => api.edit(d => {
      const q = d.participants[i];
      if (q) q.label = v;
    }),
    onCommitPre: {
      snap: api.snap,
      push: api.pushPre
    }
  }), /*#__PURE__*/React.createElement(UCheck, {
    label: "actor",
    checked: p.actor,
    title: "Render as an actor stick figure",
    onLive: v => api.edit(d => {
      const q = d.participants[i];
      if (q) q.actor = v;
    }),
    onCommitPre: {
      snap: api.snap,
      push: api.pushPre
    }
  }), /*#__PURE__*/React.createElement(RowBtns, {
    upDis: i === 0,
    downDis: i === participants.length - 1,
    onUp: () => api.edit(d => {
      const t = d.participants[i - 1];
      d.participants[i - 1] = d.participants[i];
      d.participants[i] = t;
    }, true),
    onDown: () => api.edit(d => {
      const t = d.participants[i + 1];
      d.participants[i + 1] = d.participants[i];
      d.participants[i] = t;
    }, true),
    onDel: () => api.edit(d => {
      // same semantics as the visual editor: remove the participant
      // and every item that references it, so no dangling ids remain
      const pid = d.participants[i] && d.participants[i].id;
      if (!pid) return;
      d.participants.splice(i, 1);
      d.items = (d.items || []).filter(it => {
        if (it.kind === 'msg') return it.from !== pid && it.to !== pid;
        if (it.kind === 'note') return !(it.who || []).includes(pid);
        if (it.kind === 'act') return it.who !== pid;
        return true;
      });
    }, true)
  })))), /*#__PURE__*/React.createElement("div", {
    className: "scard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scard-h"
  }, /*#__PURE__*/React.createElement("span", null, "Flow"), /*#__PURE__*/React.createElement("span", {
    className: "grow"
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => addItem('msg')
  }, "+ Message"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => addItem('note')
  }, "+ Note"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    title: "Activation bar",
    onClick: () => addItem('act-on')
  }, "+ Act"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    title: "Deactivation",
    onClick: () => addItem('act-off')
  }, "+ Deact")), items.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "sheet-empty"
  }, "Empty conversation \u2014 add a message above."), items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    className: "trow",
    key: i
  }, /*#__PURE__*/React.createElement(USelect, {
    style: {
      width: 96
    },
    value: it.kind,
    options: [{
      value: 'msg',
      label: 'Message'
    }, {
      value: 'note',
      label: 'Note'
    }, {
      value: 'act',
      label: it.kind === 'act' && !it.on ? 'Deactivate' : 'Activate'
    }],
    onLive: v => api.edit(d => {
      const cur = d.items[i];
      if (cur.kind === v) return;
      if (v === 'msg') d.items[i] = {
        kind: 'msg',
        from: cur.from || cur.who && cur.who[0] || 'A',
        arrow: '->>',
        to: cur.to || cur.who && cur.who[1] || cur.who && cur.who[0] || 'B',
        text: cur.text || ''
      };else if (v === 'note') d.items[i] = {
        kind: 'note',
        pos: 'over',
        who: [cur.from || cur.who && cur.who[0] || 'A'],
        text: cur.text || ''
      };else if (v === 'act') d.items[i] = {
        kind: 'act',
        on: true,
        who: cur.from || cur.who && cur.who[0] || 'A'
      };
    }, true),
    onCommitPre: {
      snap: api.snap,
      push: api.pushPre
    }
  }), it.kind === 'msg' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(USelect, {
    style: {
      width: 86
    },
    value: it.from,
    options: pOpts,
    onLive: v => api.edit(d => {
      d.items[i].from = v;
    }),
    onCommitPre: {
      snap: api.snap,
      push: api.pushPre
    }
  }), /*#__PURE__*/React.createElement(USelect, {
    style: {
      width: 118
    },
    value: it.arrow,
    options: arrowOpts,
    onLive: v => api.edit(d => {
      d.items[i].arrow = v;
    }),
    onCommitPre: {
      snap: api.snap,
      push: api.pushPre
    }
  }), /*#__PURE__*/React.createElement(USelect, {
    style: {
      width: 86
    },
    value: it.to,
    options: pOpts,
    onLive: v => api.edit(d => {
      d.items[i].to = v;
    }),
    onCommitPre: {
      snap: api.snap,
      push: api.pushPre
    }
  }), /*#__PURE__*/React.createElement(UField, {
    style: {
      flex: 1,
      minWidth: 120
    },
    value: it.text,
    placeholder: "what is said",
    onLive: v => api.edit(d => {
      d.items[i].text = v;
    }),
    onCommitPre: {
      snap: api.snap,
      push: api.pushPre
    }
  })), it.kind === 'note' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(USelect, {
    style: {
      width: 84
    },
    value: it.pos,
    options: [{
      value: 'over',
      label: 'over'
    }, {
      value: 'left',
      label: 'left of'
    }, {
      value: 'right',
      label: 'right of'
    }],
    onLive: v => api.edit(d => {
      d.items[i].pos = v;
    }),
    onCommitPre: {
      snap: api.snap,
      push: api.pushPre
    }
  }), /*#__PURE__*/React.createElement(JoinField, {
    style: {
      width: 120,
      fontFamily: 'ui-monospace, Menlo, monospace',
      fontSize: 11.5
    },
    list: it.who,
    placeholder: "A,B",
    onLive: arr => api.edit(d => {
      if (d.items[i]) d.items[i].who = arr;
    }),
    onCommitPre: {
      snap: api.snap,
      push: api.pushPre
    }
  }), /*#__PURE__*/React.createElement(UField, {
    style: {
      flex: 1,
      minWidth: 120
    },
    value: it.text,
    placeholder: "note text",
    onLive: v => api.edit(d => {
      d.items[i].text = v;
    }),
    onCommitPre: {
      snap: api.snap,
      push: api.pushPre
    }
  })), it.kind === 'act' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "sheet-note",
    style: {
      marginTop: 0
    }
  }, it.on ? 'activates' : 'deactivates'), /*#__PURE__*/React.createElement(USelect, {
    style: {
      width: 100
    },
    value: it.who,
    options: pOpts,
    onLive: v => api.edit(d => {
      d.items[i].who = v;
    }),
    onCommitPre: {
      snap: api.snap,
      push: api.pushPre
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "mini-btn",
    title: "Toggle activate/deactivate",
    onClick: () => api.edit(d => {
      d.items[i].on = !d.items[i].on;
    }, true)
  }, "\u21C4")), /*#__PURE__*/React.createElement(RowBtns, {
    upDis: i === 0,
    downDis: i === items.length - 1,
    onUp: () => moveItem(i, -1),
    onDown: () => moveItem(i, 1),
    onDel: () => api.edit(d => {
      d.items.splice(i, 1);
    }, true)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "sheet-note"
  }, "Tip \u2014 paste any sequenceDiagram source into the editor on the right and it becomes editable rows here. Loops/alt blocks and dividers are not supported by mermaid sequence diagrams and are ignored.")));
}
const SEQ_ARROW_LABELS = {
  '->': 'solid',
  '-->': 'dotted',
  '->>': 'solid arrowhead',
  '-->>': 'dotted arrowhead',
  '-)': 'open',
  '--)': 'open dashed',
  '-x': 'cross',
  '--x': 'cross dashed'
};
const GANTT_STATUS_OPTS = [{
  value: '',
  label: '—'
}, {
  value: 'done',
  label: '✓ done'
}, {
  value: 'active',
  label: '▶ active'
}, {
  value: 'crit',
  label: '‼ critical'
}, {
  value: 'milestone',
  label: '◆ milestone'
}];
const DUR_RE2 = /^\d+(\.\d+)?\s*[smhdwy]$/i;
const isIso = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
function GanttSheet({
  data,
  api
}) {
  const sections = data.sections || [];
  const allTasks = [];
  for (const s of sections) for (const t of s.tasks) allTasks.push(t);
  const tasksOf = d => {
    const arr = [];
    for (const s of d.sections) for (const t of s.tasks) arr.push(t);
    return arr;
  };
  const pickAfter = (d, task, chosen) => {
    if (!chosen) {
      task.start = null;
      return;
    }
    if (!chosen.startsWith('\u0000')) {
      task.start = {
        kind: 'after',
        value: [chosen]
      };
      return;
    }
    const flat = tasksOf(d);
    const target = flat[parseInt(chosen.slice(1), 10)];
    if (!target || target === task) {
      task.start = null;
      return;
    }
    if (!target.alias) {
      const taken = new Set(flat.map(t => t.alias).filter(Boolean));
      let i = Math.max(flat.indexOf(target) + 1, 1);
      let cand = 't' + i;
      while (taken.has(cand)) cand = 't' + ++i;
      target.alias = cand;
    }
    task.start = {
      kind: 'after',
      value: [target.alias]
    };
  };
  const depOptions = excludeTask => {
    const opts = [{
      value: '',
      label: '(pick task)'
    }];
    allTasks.forEach((t, idx) => {
      if (t === excludeTask) return;
      if (!t.alias && !t.start && !t.dur && !t.end) return;
      const label = `${t.label || t.alias || '(untitled)'}${t.alias ? '' : ' #' + (idx + 1)}`;
      opts.push({
        value: t.alias || '\u0000' + idx,
        label
      });
    });
    return opts;
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "scard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scard-h"
  }, /*#__PURE__*/React.createElement("span", null, "Chart settings")), /*#__PURE__*/React.createElement("div", {
    className: "trow"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--muted)',
      width: 74
    }
  }, "Title"), /*#__PURE__*/React.createElement(UField, {
    style: {
      flex: 1,
      minWidth: 160
    },
    value: data.title,
    placeholder: "untitled plan",
    onLive: v => api.edit(d => {
      d.title = v;
    }),
    onCommitPre: {
      snap: api.snap,
      push: api.pushPre
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "trow"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--muted)',
      width: 74
    }
  }, "dateFormat"), /*#__PURE__*/React.createElement(UField, {
    mono: true,
    style: {
      width: 150
    },
    value: data.dateFormat,
    onLive: v => api.edit(d => {
      d.dateFormat = v;
    }),
    onCommitPre: {
      snap: api.snap,
      push: api.pushPre
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--muted)',
      width: 70,
      textAlign: 'right'
    }
  }, "axisFormat"), /*#__PURE__*/React.createElement(UField, {
    mono: true,
    style: {
      width: 110
    },
    value: data.axisFormat,
    onLive: v => api.edit(d => {
      d.axisFormat = v;
    }),
    onCommitPre: {
      snap: api.snap,
      push: api.pushPre
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--muted)',
      width: 60,
      textAlign: 'right'
    }
  }, "excludes"), /*#__PURE__*/React.createElement(UField, {
    mono: true,
    style: {
      width: 120
    },
    value: data.excludes,
    placeholder: "weekends",
    onLive: v => api.edit(d => {
      d.excludes = v;
    }),
    onCommitPre: {
      snap: api.snap,
      push: api.pushPre
    }
  }))), sections.map((sec, si) => /*#__PURE__*/React.createElement("div", {
    className: "scard",
    key: si
  }, /*#__PURE__*/React.createElement("div", {
    className: "scard-h"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      textTransform: 'none',
      letterSpacing: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "sin",
    style: {
      padding: '2px 7px',
      fontWeight: 600
    },
    value: sec.name,
    placeholder: "section name",
    onFocus: e => e.target.dataset.pre = api.snap(),
    onChange: e => api.edit(d => {
      d.sections[si].name = e.target.value;
    }),
    onBlur: e => {
      if (e.target.dataset.pre) {
        api.pushPre(e.target.dataset.pre);
        delete e.target.dataset.pre;
      }
    },
    onKeyDown: e => {
      if (e.key === 'Enter') e.target.blur();
      e.stopPropagation();
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "grow"
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => api.edit(d => {
      d.sections[si].tasks.push({
        label: 'New task',
        status: '',
        alias: '',
        start: {
          kind: 'date',
          value: todayIso()
        },
        dur: '3d',
        end: ''
      });
    }, true)
  }, "+ Task"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "danger",
    onClick: () => api.edit(d => {
      d.sections.splice(si, 1);
    }, true)
  }, "Delete section")), sec.tasks.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "sheet-empty"
  }, "No tasks here yet."), sec.tasks.map((t, ti) => {
    const invalid = !t.label && !(t.start && (t.start.kind === 'after' ? (t.start.value || []).length : t.start.value)) && !t.dur && !t.end;
    const dateKind = t.start && t.start.kind === 'date';
    const afterKind = t.start && t.start.kind === 'after';
    return /*#__PURE__*/React.createElement("div", {
      className: 'trow' + (invalid ? ' row-warn' : ''),
      key: ti
    }, /*#__PURE__*/React.createElement(UField, {
      style: {
        flex: 1,
        minWidth: 130
      },
      value: t.label,
      placeholder: "task name",
      onLive: v => api.edit(d => {
        d.sections[si].tasks[ti].label = v;
      }),
      onCommitPre: {
        snap: api.snap,
        push: api.pushPre
      }
    }), /*#__PURE__*/React.createElement(USelect, {
      style: {
        width: 108
      },
      value: t.status,
      options: GANTT_STATUS_OPTS,
      onLive: v => api.edit(d => {
        d.sections[si].tasks[ti].status = v;
      }),
      onCommitPre: {
        snap: api.snap,
        push: api.pushPre
      }
    }), /*#__PURE__*/React.createElement(UField, {
      mono: true,
      style: {
        width: 62
      },
      value: t.alias,
      placeholder: "id",
      title: "Optional task id, used by 'after' dependencies",
      onLive: v => api.edit(d => {
        d.sections[si].tasks[ti].alias = v.replace(/[^\w.\-]/g, '');
      }),
      onCommitPre: {
        snap: api.snap,
        push: api.pushPre
      }
    }), /*#__PURE__*/React.createElement(USelect, {
      style: {
        width: 82
      },
      value: dateKind ? 'date' : afterKind ? 'after' : 'none',
      options: [{
        value: 'none',
        label: 'start…'
      }, {
        value: 'date',
        label: 'on date'
      }, {
        value: 'after',
        label: 'after…'
      }],
      onLive: v => api.edit(d => {
        const task = d.sections[si].tasks[ti];
        if (v === 'date') task.start = {
          kind: 'date',
          value: task.start && task.start.kind === 'date' ? task.start.value : todayIso()
        };else if (v === 'after') {
          const flat = tasksOf(d).filter(o => o !== task && o.alias);
          if (flat.length) task.start = {
            kind: 'after',
            value: [flat[0].alias]
          };else {
            const any = tasksOf(d).filter(o => o !== task);
            if (any.length) pickAfter(d, task, '\u0000' + tasksOf(d).indexOf(any[0]));else task.start = null;
          }
        } else task.start = null;
      }, true),
      onCommitPre: {
        snap: api.snap,
        push: api.pushPre
      }
    }), dateKind && /*#__PURE__*/React.createElement(GanttDateInput, {
      value: t.start.value || '',
      iso: isIso(t.start.value),
      api: api,
      onSet: (d, v) => {
        d.sections[si].tasks[ti].start.value = v;
      }
    }), afterKind && /*#__PURE__*/React.createElement(USelect, {
      style: {
        width: 170
      },
      value: (t.start.value || [])[0] || '',
      options: depOptions(t),
      onLive: v => api.edit(d => {
        pickAfter(d, d.sections[si].tasks[ti], v);
      }),
      onCommitPre: {
        snap: api.snap,
        push: api.pushPre
      }
    }), /*#__PURE__*/React.createElement(UField, {
      mono: true,
      style: {
        width: 96
      },
      value: t.dur || t.end || '',
      placeholder: "5d or date",
      title: "Duration (5d) or end date",
      onLive: v => api.edit(d => {
        const task = d.sections[si].tasks[ti];
        if (DUR_RE2.test(v.trim())) {
          task.dur = v.trim();
          task.end = '';
        } else {
          task.end = v.trim();
          task.dur = '';
        }
      }),
      onCommitPre: {
        snap: api.snap,
        push: api.pushPre
      }
    }), /*#__PURE__*/React.createElement(RowBtns, {
      upDis: ti === 0,
      downDis: ti === sec.tasks.length - 1,
      onUp: () => api.edit(d => {
        const arr = d.sections[si].tasks;
        const tmp = arr[ti - 1];
        arr[ti - 1] = arr[ti];
        arr[ti] = tmp;
      }, true),
      onDown: () => api.edit(d => {
        const arr = d.sections[si].tasks;
        const tmp = arr[ti + 1];
        arr[ti + 1] = arr[ti];
        arr[ti] = tmp;
      }, true),
      onDel: () => api.edit(d => {
        d.sections[si].tasks.splice(ti, 1);
      }, true)
    }));
  }))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => api.edit(d => {
      let i = d.sections.length + 1;
      while (d.sections.some(s => s.name === 'Phase ' + i)) i++;
      d.sections.push({
        name: 'Phase ' + i,
        tasks: []
      });
    }, true)
  }, "+ Section"), /*#__PURE__*/React.createElement("div", {
    className: "sheet-note"
  }, "Rows outlined in amber are skipped until they have a name or dates. \u201Cafter\u201D dependencies chain automatically; give tasks an id to reference them."));
}
function GanttDateInput({
  value,
  iso,
  api,
  onSet
}) {
  const u = useUndoablePre({
    snap: api.snap,
    push: api.pushPre
  });
  return /*#__PURE__*/React.createElement("input", {
    type: iso ? 'date' : 'text',
    className: "sin",
    value: value,
    onFocus: u.grab,
    onChange: e => {
      u.grab();
      api.edit(d => onSet(d, e.target.value));
      u.arm();
    },
    onBlur: u.flush,
    onKeyDown: e => {
      if (e.key === 'Enter') e.target.blur();
      e.stopPropagation();
    },
    style: {
      width: 150
    }
  });
}
function PieValueInput({
  value,
  api,
  onSet
}) {
  const u = useUndoablePre({
    snap: api.snap,
    push: api.pushPre
  });
  return /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "any",
    className: "sin",
    value: value,
    onFocus: u.grab,
    onChange: e => {
      u.grab();
      const n = parseFloat(e.target.value);
      api.edit(d => onSet(d, isNaN(n) ? 0 : n));
      u.arm();
    },
    onBlur: u.flush,
    onKeyDown: e => {
      if (e.key === 'Enter') e.target.blur();
      e.stopPropagation();
    },
    style: {
      width: 96
    }
  });
}
function todayIso() {
  try {
    return new Date().toISOString().slice(0, 10);
  } catch (e) {
    return '2026-01-01';
  }
}
function PieSheet({
  data,
  api
}) {
  const slices = data.slices || [];
  const total = slices.reduce((a, s) => a + (Number(s.value) || 0), 0);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "scard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scard-h"
  }, /*#__PURE__*/React.createElement("span", null, "Chart settings")), /*#__PURE__*/React.createElement("div", {
    className: "trow"
  }, /*#__PURE__*/React.createElement(UCheck, {
    label: "show data labels",
    checked: data.showData,
    onLive: v => api.edit(d => {
      d.showData = v;
    }),
    onCommitPre: {
      snap: api.snap,
      push: api.pushPre
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--muted)',
      marginLeft: 8
    }
  }, "Title"), /*#__PURE__*/React.createElement(UField, {
    style: {
      flex: 1,
      minWidth: 140
    },
    value: data.title,
    placeholder: "untitled chart",
    onLive: v => api.edit(d => {
      d.title = v;
    }),
    onCommitPre: {
      snap: api.snap,
      push: api.pushPre
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "scard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scard-h"
  }, /*#__PURE__*/React.createElement("span", null, "Slices \xB7 total ", Math.round(total * 100) / 100), /*#__PURE__*/React.createElement("span", {
    className: "grow"
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => api.edit(d => {
      d.slices.push({
        label: 'Slice ' + (d.slices.length + 1),
        value: 10
      });
    }, true)
  }, "+ Slice")), slices.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "sheet-empty"
  }, "No slices yet."), slices.map((s, i) => /*#__PURE__*/React.createElement("div", {
    className: "trow",
    key: i
  }, /*#__PURE__*/React.createElement(UField, {
    style: {
      flex: 1,
      minWidth: 140
    },
    value: s.label,
    placeholder: "label",
    onLive: v => api.edit(d => {
      d.slices[i].label = v;
    }),
    onCommitPre: {
      snap: api.snap,
      push: api.pushPre
    }
  }), /*#__PURE__*/React.createElement(PieValueInput, {
    value: s.value,
    api: api,
    onSet: (d, v) => {
      d.slices[i].value = v;
    }
  }), /*#__PURE__*/React.createElement(RowBtns, {
    upDis: i === 0,
    downDis: i === slices.length - 1,
    onUp: () => api.edit(d => {
      const t = d.slices[i - 1];
      d.slices[i - 1] = d.slices[i];
      d.slices[i] = t;
    }, true),
    onDown: () => api.edit(d => {
      const t = d.slices[i + 1];
      d.slices[i + 1] = d.slices[i];
      d.slices[i] = t;
    }, true),
    onDel: () => api.edit(d => {
      d.slices.splice(i, 1);
    }, true)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "sheet-note"
  }, "Percentages are computed by mermaid itself \u2014 absolute values are fine.")));
}
function JourneySheet({ data, api }) {
  const secs = data.sections || [];
  const scoreOpts = [0,1,2,3,4,5].map(n => ({ value: String(n), label: String(n) + (n===5?' \u2605 ideal': n===1?' \u2639 poor':'') }));
  const addSection = () => api.edit(d => {
    let k = d.sections.length + 1;
    while (d.sections.some(s => s.name === 'Section ' + k)) k++;
    d.sections.push({ name: 'Section ' + k, tasks: [] });
  }, true);
  const addTask = (si) => api.edit(d => {
    const sec = d.sections[si];
    if (!sec) return;
    sec.tasks.push({ label: 'New step', score: 3, actors: sec.tasks[0] ? [...(sec.tasks[0].actors||[])] : ['Me'] });
  }, true);
  return React.createElement("div", null,
    React.createElement("div", { className: "scard" },
      React.createElement("div", { className: "scard-h" },
        React.createElement("span", null, "Journey"),
        React.createElement("span", { className: "grow" }),
        React.createElement("button", { type: "button", onClick: addSection }, "+ Section")
      ),
      React.createElement("div", { className: "trow" },
        React.createElement("span", { style: { fontSize: 11, color: 'var(--muted)', width: 44 } }, "Title"),
        React.createElement(UField, {
          style: { flex: 1, minWidth: 160 },
          value: data.title || '',
          placeholder: "My journey",
          onLive: v => api.edit(d => { d.title = v; }),
          onCommitPre: { snap: api.snap, push: api.pushPre }
        })
      )
    ),
    secs.map((sec, si) => React.createElement("div", { className: "scard", key: si },
      React.createElement("div", { className: "scard-h" },
        React.createElement("input", {
          className: "sin",
          style: { padding: '2px 7px', fontWeight: 600, flex: 1 },
          value: sec.name,
          placeholder: "section name",
          onFocus: e => e.target.dataset.pre = api.snap(),
          onChange: e => api.edit(d => { d.sections[si].name = e.target.value; }),
          onBlur: e => { if (e.target.dataset.pre) { api.pushPre(e.target.dataset.pre); delete e.target.dataset.pre; } },
          onKeyDown: e => { if (e.key === 'Enter') e.target.blur(); e.stopPropagation(); }
        }),
        React.createElement("button", { type: "button", onClick: () => addTask(si) }, "+ Step"),
        React.createElement("button", { type: "button", className: "danger", onClick: () => api.edit(d => { d.sections.splice(si,1); }, true) }, "Delete")
      ),
      sec.tasks.length === 0 && React.createElement("div", { className: "sheet-empty" }, "No steps yet \u2014 add one above."),
      sec.tasks.map((t, ti) => React.createElement("div", { className: "trow", key: ti },
        React.createElement(UField, {
          style: { flex: 1, minWidth: 140 },
          value: t.label,
          placeholder: "step label",
          onLive: v => api.edit(d => { d.sections[si].tasks[ti].label = v; }),
          onCommitPre: { snap: api.snap, push: api.pushPre }
        }),
        React.createElement(USelect, {
          style: { width: 96 },
          value: String(t.score),
          options: scoreOpts,
          onLive: v => api.edit(d => { d.sections[si].tasks[ti].score = parseInt(v,10); }),
          onCommitPre: { snap: api.snap, push: api.pushPre }
        }),
        React.createElement(JoinField, {
          style: { width: 140 },
          list: t.actors || [],
          placeholder: "Me, Cat",
          onLive: arr => api.edit(d => { d.sections[si].tasks[ti].actors = arr; }),
          onCommitPre: { snap: api.snap, push: api.pushPre }
        }),
        React.createElement(RowBtns, {
          upDis: ti===0,
          downDis: ti===sec.tasks.length-1,
          onUp: () => api.edit(d => { const a=d.sections[si].tasks; const tmp=a[ti-1]; a[ti-1]=a[ti]; a[ti]=tmp; }, true),
          onDown: () => api.edit(d => { const a=d.sections[si].tasks; const tmp=a[ti+1]; a[ti+1]=a[ti]; a[ti]=tmp; }, true),
          onDel: () => api.edit(d => { d.sections[si].tasks.splice(ti,1); }, true)
        })
      ))
    )),
    React.createElement("div", { className: "sheet-note" }, "Score 5 = delighted, 1 = frustrated. Tasks with the same actor share colours in the visual.")
  );
}
function JourneyVisual({ data, api, stamp }) {
  const hostRef = useRef(null);
  const [sel, setSel] = useState(null);
  const dragRef = useRef(null);
  const [, tickState] = useReducer(v => v+1, 0);
  useEffect(() => { setSel(null); }, [stamp]);
  useEffect(() => {
    setSel(prev => {
      if (!prev) return prev;
      const sec = data.sections && data.sections[prev.si];
      return sec && sec.tasks && sec.tasks[prev.ti] ? prev : null;
    });
  }, [data]);
  const size = useHostSize(hostRef, 720, 420);
  const W = size.w;
  const H = size.h;
  const flat = [];
  (data.sections||[]).forEach((sec, si) => (sec.tasks||[]).forEach((t, ti) => flat.push({ t, si, ti, secName: sec.name })));
  const PADL = 56, PADR = 18, PADT = 22, PADB = 48;
  const plotW = Math.max(W - PADL - PADR, 60);
  const plotH = Math.max(H - PADT - PADB, 100);
  const step = flat.length > 1 ? plotW / (flat.length - 1) : plotW;
  const yOf = s => PADT + (5 - Math.max(0, Math.min(5, s))) / 5 * plotH;
  const xOf = idx => PADL + (flat.length===1 ? plotW/2 : idx * step);
  const colors = ['#22d3ee','#34d399','#fbbf24','#fb7185','#a78bfa','#38bdf8','#f472b6','#84cc16'];
  const actorSet = {};
  flat.forEach(f => (f.t.actors||[]).forEach(a => { if (!actorSet[a]) actorSet[a]=colors[Object.keys(actorSet).length % colors.length]; }));
  const startScoreDrag = (idx, e) => {
    e.stopPropagation();
    flat[idx] && setSel({ si: flat[idx].si, ti: flat[idx].ti });
    const idx0 = idx;
    const rect = hostRef.current.getBoundingClientRect();
    const preSnap = api.snap();
    let armed = false;
    dragRef.current = { idx0 };
    const move = ev => {
      if (!armed) { armed=true; api.pushPre(preSnap); }
      const y = ev.clientY - rect.top;
      const rel = (y - PADT) / Math.max(plotH,1);
      const sc = Math.max(0, Math.min(5, Math.round(5 - rel*5)));
      api.edit(d => {
        const sec = d.sections[flat[idx0].si];
        if (sec && sec.tasks[flat[idx0].ti]) sec.tasks[flat[idx0].ti].score = sc;
      });
      tickState();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      dragRef.current = null;
      tickState();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  let pill = null;
  if (sel) {
    const flatIdx = flat.findIndex(f => f.si===sel.si && f.ti===sel.ti);
    const f = flat[flatIdx];
    const task = f && data.sections[f.si] && data.sections[f.si].tasks[f.ti];
    if (task && flatIdx>=0) {
      const px = xOf(flatIdx);
      const py = yOf(task.score);
      pill = React.createElement(FPill, { style: clampPill(px+14, py-28, W) },
        React.createElement(UField, {
          style: { width: 120 },
          value: task.label,
          placeholder: "step",
          onLive: v => api.edit(d => { const s=d.sections[sel.si]; if(s && s.tasks[sel.ti]) s.tasks[sel.ti].label=v; }),
          onCommitPre: { snap: api.snap, push: api.pushPre }
        }),
        React.createElement(USelect, {
          style: { width: 86 },
          value: String(task.score),
          options: [0,1,2,3,4,5].map(n=>({value:String(n), label:String(n)})),
          onLive: v => api.edit(d => { const s=d.sections[sel.si]; if(s && s.tasks[sel.ti]) s.tasks[sel.ti].score=parseInt(v,10); }),
          onCommitPre: { snap: api.snap, push: api.pushPre }
        }),
        React.createElement(JoinField, {
          style: { width: 110 },
          list: task.actors||[],
          placeholder: "actors",
          onLive: arr => api.edit(d => { const s=d.sections[sel.si]; if(s && s.tasks[sel.ti]) s.tasks[sel.ti].actors=arr; }),
          onCommitPre: { snap: api.snap, push: api.pushPre }
        }),
        React.createElement("button", { type: "button", className: "mini-btn del", title: "Delete step", onClick: () => { api.edit(d=>{ const s=d.sections[sel.si]; if(s) s.tasks.splice(sel.ti,1); }, true); setSel(null); } }, "\u2715")
      );
    }
  }
  const sectBands = [];
  let acc = 0;
  (data.sections||[]).forEach((sec, si) => {
    const n = (sec.tasks||[]).length;
    if (!n) return;
    const x0 = xOf(acc) - step*0.5;
    const x1 = xOf(acc+n-1) + step*0.5;
    sectBands.push({ x0: Math.max(PADL, x0), x1: Math.min(W-PADR, x1), name: sec.name, si });
    acc += n;
  });
  return React.createElement("div", { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
    React.createElement("div", { className: "viz-head", style: { borderBottom: 'none', paddingBottom: 0 } },
      React.createElement("button", { type: "button", onClick: () => api.edit(d=>{ let k=d.sections.length+1; while(d.sections.some(s=>s.name==='Section '+k)) k++; d.sections.push({name:'Section '+k, tasks:[]}); }, true) }, "+ Section"),
      React.createElement("button", { type: "button", onClick: () => {
        if (!data.sections.length) api.edit(d=>d.sections.push({name:'Section 1', tasks:[{label:'New step', score:3, actors:['Me']}]}), true);
        else {
          const last = data.sections.length-1;
          api.edit(d=>d.sections[last].tasks.push({label:'New step', score:3, actors: d.sections[last].tasks[0]?[...(d.sections[last].tasks[0].actors||['Me'])]:['Me']}), true);
        }
      }}, "+ Step"),
      React.createElement("span", { style: { fontSize: 11, marginLeft: 8 } }, "drag dots vertically to score \u00B7 click dot to edit")
    ),
    React.createElement("div", { className: "viz-body", ref: hostRef, onPointerDown: () => setSel(null) },
      React.createElement("svg", { width: W, height: H },
        sectBands.map((b,i) => React.createElement("g", { key: 'sb'+i },
          React.createElement("rect", { className: "g-sec-band", x: b.x0, y: PADT, width: b.x1-b.x0, height: plotH, fill: i%2?'rgba(34,211,238,.04)':'rgba(148,163,184,.04)' }),
          React.createElement("text", { x: (b.x0+b.x1)/2, y: PADT-6, textAnchor: "middle", fill: "#7f96b4", fontSize: 11, fontWeight: 700 }, b.name)
        )),
        [0,1,2,3,4,5].map(s => React.createElement("g", { key: 'gl'+s },
          React.createElement("line", { className: "g-tick", x1: PADL, y1: yOf(s), x2: W-PADR, y2: yOf(s) }),
          React.createElement("text", { className: "g-tick-txt", x: PADL-8, y: yOf(s)+3, textAnchor: "end" }, String(s))
        )),
        flat.length>1 && React.createElement("polyline", {
          fill: "none", stroke: "#5b7292", strokeWidth: 1.6, strokeDasharray: "0",
          points: flat.map((f,i)=> xOf(i)+","+yOf(f.t.score)).join(' ')
        }),
        flat.map((f,i) => {
          const x = xOf(i), y = yOf(f.t.score);
          const selHere = sel && sel.si===f.si && sel.ti===f.ti;
          const actorDots = (f.t.actors||[]).slice(0,3);
          return React.createElement("g", { key: i, onPointerDown: e => { e.stopPropagation(); setSel({si:f.si, ti:f.ti}); } },
            React.createElement("circle", { cx: x, cy: y, r: selHere?9:7, fill: "#131f36", stroke: selHere?"#22d3ee":"#4a6079", strokeWidth: selHere?2:1.4, style: { cursor: 'grab', filter: selHere?'drop-shadow(0 0 6px rgba(34,211,238,.5))':'' }, onPointerDown: e => startScoreDrag(i, e) }),
            React.createElement("text", { x: x, y: y+4, textAnchor: "middle", fill: "#e2e8f0", fontSize: 9, fontWeight: 700, pointerEvents: "none" }, String(f.t.score)),
            actorDots.map((a,ai) => React.createElement("circle", { key: ai, cx: x-8+ai*8, cy: y+16, r: 4, fill: actorSet[a]||'#8fa6c4', stroke: "#0b1220", strokeWidth: 1 })),
            React.createElement("text", { x: x, y: H-14, textAnchor: "middle", fill: "#c3cfdd", fontSize: 10, fontWeight: 600 }, f.t.label.length>14?f.t.label.slice(0,13)+'\u2026':f.t.label)
          );
        })
      ),
      !flat.length && React.createElement("div", { className: "viz-empty" }, "No steps yet \u2014 add a section and a step above."),
      pill
    )
  );
}
function useHostSize(ref, minW, h) {
  const [size, setSize] = useState({
    w: Math.max(minW, 900),
    h
  });
  useEffect(() => {
    const m = () => {
      const el = ref.current;
      if (el) setSize({
        w: Math.max(el.clientWidth || 0, minW),
        h
      });
    };
    m();
    window.addEventListener('resize', m);
    return () => window.removeEventListener('resize', m);
  }, [minW, h]);
  return size;
}
function clampPill(x, y, hostW) {
  return {
    left: Math.max(6, Math.min(x, hostW - 320)),
    top: Math.max(4, y)
  };
}
function PieVisual({
  data,
  api,
  stamp
}) {
  const hostRef = useRef(null);
  const [sel, setSel] = useState(-1);
  const dragRef = useRef(null);
  const [, tickState] = useReducer(v => v + 1, 0);
  // keep the selection across in-place edits; drop it if the slice disappeared
  // or the whole document was replaced
  useEffect(() => {
    setSel(-1);
  }, [stamp]);
  useEffect(() => {
    setSel(prev => prev >= 0 && (!data.slices || !data.slices[prev]) ? -1 : prev);
  }, [data]);
  const size = useHostSize(hostRef, 520, 430);
  const w = size.w,
    h = size.h;
  const cx = w / 2,
    cy = h / 2 + 10;
  const R = Math.max(90, Math.min(w, h) / 2 - 52);
  const slices = data.slices || [];
  const rawTotal = slices.reduce((a, s) => a + (Number(s.value) || 0), 0);
  const eff = slices.map(s => rawTotal > 0 ? Number(s.value) || 0 : 1);
  const totEff = eff.reduce((a, b) => a + b, 0) || 1;
  const bounds = pieBounds(eff);
  if (dragRef.current) bounds[dragRef.current.i] = dragRef.current.a;
  const localPt = e => {
    const r = hostRef.current.getBoundingClientRect();
    return {
      x: e.clientX - r.left,
      y: e.clientY - r.top
    };
  };
  const normA = a => {
    while (a < -Math.PI / 2) a += Math.PI * 2;
    while (a >= -Math.PI / 2 + Math.PI * 2) a -= Math.PI * 2;
    return a;
  };
  const startDrag = (i, e) => {
    e.stopPropagation();
    setSel(i - 1 < 0 ? slices.length - 1 : i - 1);
    const preSnap = api.snap();
    let armed = false;
    dragRef.current = {
      i,
      a: bounds[i]
    };
    const move = ev => {
      if (!armed) {
        armed = true;
        api.pushPre(preSnap);
      }
      const p = localPt(ev);
      const a = normA(Math.atan2(p.y - cy, p.x - cx));
      const lo = bounds[i - 1] + 0.02,
        hi = bounds[i + 1] - 0.02;
      dragRef.current.a = Math.min(hi, Math.max(lo, a));
      tickState();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const dr = dragRef.current;
      dragRef.current = null;
      if (dr && slices[i - 1 >= 0 ? i - 1 : slices.length - 1] != null) {
        const span = dr.a - bounds[i - 1];
        const val = Math.round(span / (Math.PI * 2) * totEff * 100) / 100;
        const idx = i - 1;
        api.commit(d => {
          if (d.slices[idx]) d.slices[idx].value = val;
        });
      }
      tickState();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const selSlice = sel >= 0 && sel < slices.length ? sel : -1;
  let pill = null;
  if (selSlice >= 0) {
    const mid = (bounds[selSlice] + bounds[selSlice + 1]) / 2;
    const [px, py] = polarPt(cx, cy, R * 0.62, mid);
    pill = /*#__PURE__*/React.createElement(FPill, {
      style: clampPill(px + 14, py - 16, w)
    }, /*#__PURE__*/React.createElement(UField, {
      style: {
        width: 110
      },
      value: slices[selSlice].label,
      placeholder: "label",
      onLive: v => api.edit(d => {
        if (d.slices[selSlice]) d.slices[selSlice].label = v;
      }),
      onCommitPre: {
        snap: api.snap,
        push: api.pushPre
      }
    }), /*#__PURE__*/React.createElement("input", {
      type: "number",
      step: "any",
      className: "sin",
      style: {
        width: 76
      },
      value: slices[selSlice].value,
      onChange: e => {
        const n = parseFloat(e.target.value);
        api.edit(d => {
          if (d.slices[selSlice]) d.slices[selSlice].value = isNaN(n) ? 0 : n;
        });
      },
      onKeyDown: e => e.stopPropagation()
    }), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "mini-btn del",
      title: "Delete slice",
      onClick: () => {
        api.edit(d => {
          d.slices.splice(selSlice, 1);
        }, true);
        setSel(-1);
      }
    }, "\u2715"));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "viz-body",
    ref: hostRef,
    onPointerDown: () => setSel(-1)
  }, /*#__PURE__*/React.createElement("svg", {
    width: w,
    height: h
  }, /*#__PURE__*/React.createElement("text", {
    className: "p-title",
    x: 18,
    y: 24
  }, data.title || ''), slices.map((s, i) => /*#__PURE__*/React.createElement("path", {
    key: i,
    className: 'p-slice' + (sel === i ? ' sel' : ''),
    d: slicePath(cx, cy, R, bounds[i], bounds[i + 1]),
    fill: PIE_COLORS[i % PIE_COLORS.length],
    opacity: sel === -1 || sel === i ? 1 : 0.45,
    onPointerDown: e => {
      e.stopPropagation();
      setSel(i);
    }
  })), bounds.map((a, i) => {
    if (i === 0 || i === bounds.length - 1) return null;
    const [hx, hy] = polarPt(cx, cy, R * 0.88, a);
    return /*#__PURE__*/React.createElement("circle", {
      key: 'h' + i,
      className: "p-handle",
      cx: hx,
      cy: hy,
      r: 7,
      onPointerDown: e => startDrag(i, e)
    });
  }), /*#__PURE__*/React.createElement("text", {
    className: "p-total",
    x: cx,
    y: cy + 4
  }, Math.round(rawTotal * 100) / 100), /*#__PURE__*/React.createElement("text", {
    className: "p-total",
    x: cx,
    y: cy + 20,
    style: {
      fontSize: 9.5,
      fill: '#64748b'
    }
  }, "total")), !slices.length && /*#__PURE__*/React.createElement("div", {
    className: "viz-empty"
  }, "No slices \u2014 switch to Rows or paste pie source."), pill);
}
function GanttVisual({
  data,
  api,
  stamp
}) {
  const hostRef = useRef(null);
  const [sel, setSel] = useState(null);
  const dragRef = useRef(null);
  const [, tickState] = useReducer(v => v + 1, 0);
  // keep the selection across in-place edits; drop it if the task disappeared
  // or the whole document was replaced
  useEffect(() => {
    setSel(null);
  }, [stamp]);
  useEffect(() => {
    setSel(prev => {
      if (!prev) return prev;
      const sec = data.sections && data.sections[prev.si];
      return sec && sec.tasks && sec.tasks[prev.ti] ? prev : null;
    });
  }, [data]);
  const size = useHostSize(hostRef, 720, 470);
  const W = size.w;
  const DAY = 86400000;
  const Rg = resolveGantt(data);
  const LG = 178,
    PADR = 20,
    AXIS = 30;
  const H = AXIS + (data.sections || []).length * 26 + Rg.flat.length * 34 + 34;
  const plotW = Math.max(W - LG - PADR, 60);
  const xOf = ms => LG + (ms - Rg.min) / (Rg.max - Rg.min) * plotW;
  const colMs = () => (Rg.max - Rg.min) / plotW;
  const rowYs = [];
  let yy = AXIS;
  (data.sections || []).forEach((sec, si) => {
    yy += 26;
    sec.tasks.forEach((t, ti) => {
      rowYs.push({
        t,
        si,
        ti,
        y: yy
      });
      yy += 34;
    });
  });
  const viewOf = row => {
    const p = Rg.pos.get(row.t) || {
      sd: Date.now(),
      ed: Date.now() + DAY
    };
    if (dragRef.current && dragRef.current.si === row.si && dragRef.current.ti === row.ti) {
      return Object.assign({}, p, dragRef.current.over);
    }
    return p;
  };
  const barDown = (row, zone, e) => {
    e.stopPropagation();
    setSel({
      si: row.si,
      ti: row.ti
    });
    const startX = e.clientX;
    const p0 = Rg.pos.get(row.t);
    const sd0 = p0.sd,
      ed0 = p0.ed;
    const preSnap = api.snap();
    let armed = false;
    dragRef.current = {
      si: row.si,
      ti: row.ti,
      over: {}
    };
    const move = ev => {
      if (!armed && Math.abs(ev.clientX - startX) > 3) {
        armed = true;
        api.pushPre(preSnap);
      }
      const dd = Math.round((ev.clientX - startX) * colMs() / DAY);
      const over = {};
      if (zone === 'body') {
        over.sd = sd0 + dd * DAY;
        over.ed = ed0 + dd * DAY;
      } else if (zone === 'l') {
        over.sd = Math.min(sd0 + dd * DAY, ed0 - DAY / 2);
        over.ed = ed0;
      } else {
        over.sd = sd0;
        over.ed = Math.max(ed0 + dd * DAY, sd0 + DAY / 2);
      }
      dragRef.current.over = over;
      tickState();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const over = dragRef.current ? dragRef.current.over : {};
      dragRef.current = null;
      const nsd = over.sd != null ? over.sd : sd0;
      const ned = over.ed != null ? over.ed : ed0;
      if (over.sd == null && over.ed == null) {
        tickState();
        return;
      }
      api.commit(d => {
        const hit = d.sections[row.si] && d.sections[row.si].tasks[row.ti];
        if (!hit) return;
        if (zone === 'r') {
          hit.end = fmtIso(ned);
          hit.dur = '';
          if (!hit.start || hit.start.kind !== 'date') hit.start = {
            kind: 'date',
            value: fmtIso(nsd)
          };
        } else {
          hit.start = {
            kind: 'date',
            value: fmtIso(nsd)
          };
          hit.dur = fmtDur(ned - nsd);
          hit.end = '';
        }
      });
      tickState();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const addTaskToLast = () => api.edit(d => {
    if (!d.sections.length) d.sections.push({
      name: 'Phase 1',
      tasks: []
    });
    d.sections[d.sections.length - 1].tasks.push({
      label: 'New task',
      status: '',
      alias: '',
      start: {
        kind: 'date',
        value: fmtIso(Date.now())
      },
      dur: '3d',
      end: ''
    });
  }, true);
  const addSection = () => api.edit(d => {
    let k = d.sections.length + 1;
    while (d.sections.some(s => s.name === 'Phase ' + k)) k++;
    d.sections.push({
      name: 'Phase ' + k,
      tasks: []
    });
  }, true);
  const selRow = sel ? rowYs.find(r => r.si === sel.si && r.ti === sel.ti) : null;
  let pill = null;
  if (selRow) {
    const v = viewOf(selRow);
    const px = xOf(zoneRight(v)) + 12;
    const py = selRow.y - 8;
    const task = data.sections[selRow.si] && data.sections[selRow.si].tasks[selRow.ti];
    pill = task ? /*#__PURE__*/React.createElement(FPill, {
      style: clampPill(px, py, W)
    }, /*#__PURE__*/React.createElement(UField, {
      style: {
        width: 118
      },
      value: task.label,
      placeholder: "task name",
      onLive: val => api.edit(d => {
        const hh = d.sections[selRow.si] && d.sections[selRow.si].tasks[selRow.ti];
        if (hh) hh.label = val;
      }),
      onCommitPre: {
        snap: api.snap,
        push: api.pushPre
      }
    }), /*#__PURE__*/React.createElement(USelect, {
      style: {
        width: 96
      },
      value: task.status,
      options: [{
        value: '',
        label: '—'
      }, {
        value: 'done',
        label: 'done'
      }, {
        value: 'active',
        label: 'active'
      }, {
        value: 'crit',
        label: 'crit'
      }, {
        value: 'milestone',
        label: 'milestone'
      }],
      onLive: val => api.edit(d => {
        const hh = d.sections[selRow.si] && d.sections[selRow.si].tasks[selRow.ti];
        if (hh) hh.status = val;
      }),
      onCommitPre: {
        snap: api.snap,
        push: api.pushPre
      }
    }), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "mini-btn del",
      title: "Delete task",
      onClick: () => {
        api.edit(d => {
          const sec = d.sections[selRow.si];
          if (sec) sec.tasks.splice(selRow.ti, 1);
        }, true);
        setSel(null);
      }
    }, "\u2715")) : null;
  }
  function zoneRight(v) {
    return v.ed;
  }
  const ticks = niceTicks(Rg.min, Rg.max);
  const today = Date.now();
  const isMilestone = t => t.status === 'milestone';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "viz-head",
    style: {
      borderBottom: 'none',
      paddingBottom: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: addTaskToLast
  }, "+ Task"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: addSection
  }, "+ Section"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      marginLeft: 8
    }
  }, "drag bars to reschedule \xB7 edges to resize \xB7 click for details")), /*#__PURE__*/React.createElement("div", {
    className: "viz-body",
    ref: hostRef,
    onPointerDown: () => setSel(null)
  }, /*#__PURE__*/React.createElement("svg", {
    width: W,
    height: H
  }, ticks.map((t, i) => /*#__PURE__*/React.createElement("g", {
    key: 'tk' + i
  }, /*#__PURE__*/React.createElement("line", {
    className: "g-tick",
    x1: xOf(t),
    y1: AXIS - 4,
    x2: xOf(t),
    y2: H - 8
  }), /*#__PURE__*/React.createElement("text", {
    className: "g-tick-txt",
    x: xOf(t),
    y: AXIS - 10,
    textAnchor: "middle"
  }, dayLabel(t)))), today > Rg.min && today < Rg.max && /*#__PURE__*/React.createElement("line", {
    className: "g-today",
    x1: xOf(today),
    y1: AXIS,
    x2: xOf(today),
    y2: H - 8
  }), (data.sections || []).map((sec, si) => {
    const rowsHere = rowYs.filter(r => r.si === si);
    if (!rowsHere.length) return null;
    const bandTop = rowsHere[0].y - 26;
    const bandBot = rowsHere[rowsHere.length - 1].y + 34;
    return /*#__PURE__*/React.createElement("g", {
      key: 'sec' + si
    }, /*#__PURE__*/React.createElement("rect", {
      className: "g-sec-band",
      x: 0,
      y: bandTop,
      width: W,
      height: bandBot - bandTop
    }), /*#__PURE__*/React.createElement("line", {
      className: "g-sec-line",
      x1: 0,
      y1: bandBot,
      x2: W,
      y2: bandBot
    }), /*#__PURE__*/React.createElement("text", {
      className: "g-tick-txt",
      x: 10,
      y: bandTop + 17,
      style: {
        fontWeight: 700,
        fill: '#7f96b4'
      }
    }, sec.name || ''));
  }), rowYs.map(row => {
    const t = row.t;
    const v = viewOf(row);
    const hasStart = t.start && (t.start.kind === 'after' ? (t.start.value || []).length : t.start.value);
    const invalid = !t.label && !hasStart && !t.dur && !t.end;
    if (invalid) return null;
    const [bg, bd] = GANTT_STATUS_STYLE[t.status] || GANTT_STATUS_STYLE[''];
    const selected = sel && sel.si === row.si && sel.ti === row.ti;
    const x0 = xOf(Math.max(v.sd, Rg.min));
    const x1 = xOf(Math.min(v.ed, Rg.max));
    if (isMilestone(t)) {
      const mx = xOf(v.sd),
        my = row.y + 17,
        s = 9;
      return /*#__PURE__*/React.createElement("g", {
        key: row.si + '-' + row.ti,
        className: 'g-ms' + (selected ? ' g-bar sel' : ''),
        onPointerDown: e => barDown(row, 'body', e)
      }, /*#__PURE__*/React.createElement("polygon", {
        points: `${mx},${my - s} ${mx + s},${my} ${mx},${my + s} ${mx - s},${my}`,
        fill: bg,
        stroke: bd,
        strokeWidth: 2
      }), /*#__PURE__*/React.createElement("text", {
        className: "g-label",
        x: 12,
        y: my + 4
      }, t.label));
    }
    return /*#__PURE__*/React.createElement("g", {
      key: row.si + '-' + row.ti,
      className: 'g-bar' + (selected ? ' sel' : '')
    }, /*#__PURE__*/React.createElement("rect", {
      x: x0,
      y: row.y + 8,
      width: Math.max(x1 - x0, 5),
      height: 19,
      rx: 5,
      fill: bg,
      stroke: bd,
      strokeWidth: 1.6,
      onPointerDown: e => barDown(row, 'body', e)
    }), /*#__PURE__*/React.createElement("rect", {
      className: "g-grip",
      x: x0 - 3,
      y: row.y + 10,
      width: 7,
      height: 15,
      rx: 3,
      onPointerDown: e => barDown(row, 'l', e)
    }), /*#__PURE__*/React.createElement("rect", {
      className: "g-grip",
      x: x1 - 4,
      y: row.y + 10,
      width: 7,
      height: 15,
      rx: 3,
      onPointerDown: e => barDown(row, 'r', e)
    }), /*#__PURE__*/React.createElement("text", {
      className: "g-label",
      x: 12,
      y: row.y + 22,
      onClick: e => {
        e.stopPropagation();
        setSel({
          si: row.si,
          ti: row.ti
        });
      }
    }, t.label));
  })), !Rg.flat.length && /*#__PURE__*/React.createElement("div", {
    className: "viz-empty"
  }, "No tasks yet \u2014 add one above."), pill));
}
const SEQ_ARROW_STYLE = {
  solid: {
    dash: null,
    head: 's'
  },
  dotted: {
    dash: '5 4',
    head: 's'
  },
  open: {
    dash: null,
    head: 'o'
  },
  opendash: {
    dash: '5 4',
    head: 'o'
  },
  cross: {
    dash: null,
    head: 'x'
  },
  crossdash: {
    dash: '5 4',
    head: 'x'
  }
};
function seqArrowStyle(arrow) {
  if (arrow === '->>') return SEQ_ARROW_STYLE.solid;
  if (arrow === '-->>') return SEQ_ARROW_STYLE.dotted;
  if (arrow === '->') return SEQ_ARROW_STYLE.open;
  if (arrow === '-->') return SEQ_ARROW_STYLE.opendash;
  if (arrow === '-x') return SEQ_ARROW_STYLE.cross;
  if (arrow === '--x') return SEQ_ARROW_STYLE.crossdash;
  if (arrow === '-)' || arrow === '--)') return SEQ_ARROW_STYLE.open;
  return SEQ_ARROW_STYLE.solid;
}
function SeqVisual({
  data,
  api,
  stamp
}) {
  const hostRef = useRef(null);
  const [sel, setSel] = useState(null);
  const [ghostY, setGhostY] = useState(null);
  const [hotCol, setHotCol] = useState(null);
  const hotColRef = useRef(null);
  const [gapHover, setGapHover] = useState(null);
  const [, tickState] = useReducer(v => v + 1, 0);
  // Selection survives edits (the data object is replaced on every change) —
  // only drop it when the selected item/participant no longer exists, or when
  // the whole document was replaced (stamp: typed source, template, undo…).
  useEffect(() => {
    setSel(null);
  }, [stamp]);
  useEffect(() => {
    setSel(prev => {
      if (!prev) return prev;
      if (prev.type === 'item') return data.items && data.items[prev.idx] ? prev : null;
      return data.participants && data.participants[prev.pi] ? prev : null;
    });
  }, [data]);
  const size = useHostSize(hostRef, 760, 500);
  const W = size.w;
  const L = seqLayout(data, W);
  const ptX = e => {
    const r = hostRef.current.getBoundingClientRect();
    return e.clientX - r.left;
  };
  const ptY = e => {
    const r = hostRef.current.getBoundingClientRect();
    return e.clientY - r.top;
  };
  const insertMsgAt = idx => {
    const ps = data.participants;
    const a = ps[0] ? ps[0].id : 'A';
    const b = ps[1] ? ps[1].id : a;
    api.edit(d => {
      d.items.splice(idx, 0, {
        kind: 'msg',
        from: a,
        arrow: '->>',
        to: b,
        text: 'message'
      });
    }, true);
    setSel({
      type: 'item',
      idx
    });
  };
  const itemDown = (gi, e) => {
    e.stopPropagation();
    setSel({
      type: 'item',
      idx: gi
    });
    const startY = e.clientY;
    let moved = false;
    const move = ev => {
      const dy = ev.clientY - startY;
      if (!moved && Math.abs(dy) > 6) moved = true;
      if (moved) setGhostY(Math.max(48, Math.min(L.height - 20, ptY(ev))));
    };
    const up = ev => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (moved) {
        const gy = ptY(ev);
        const others = L.rows.filter(r => r.i !== gi);
        const target = others.filter(r => r.y + r.h / 2 < gy).length;
        if (target !== gi) {
          api.edit(d => {
            const [it] = d.items.splice(gi, 1);
            d.items.splice(target, 0, it);
          }, true);
        }
      }
      setGhostY(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const endPointDown = (gi, which, e) => {
    e.stopPropagation();
    const preSnap = api.snap();
    let armed = false;
    const move = ev => {
      if (!armed) {
        armed = true;
        api.pushPre(preSnap);
      }
      const x = ptX(ev);
      let best = null,
        bd = Infinity;
      for (const p of L.parts) {
        const d2 = Math.abs(L.cols[p.id] - x);
        if (d2 < bd) {
          bd = d2;
          best = p.id;
        }
      }
      hotColRef.current = best;
      setHotCol(best);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const target = hotColRef.current;
      hotColRef.current = null;
      setHotCol(null);
      if (target != null) {
        api.commit(d => {
          const it = d.items[gi];
          if (!it || it.kind !== 'msg') return;
          if (which === 'from') it.from = target;else it.to = target;
        });
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const headDown = (pi, id, e) => {
    e.stopPropagation();
    setSel({
      type: 'part',
      pi
    });
    const startX = e.clientX;
    const gap = L.colGap || 120;
    const move = () => {};
    const up = ev => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const k = Math.round((ev.clientX - startX) / gap);
      if (k !== 0) {
        api.edit(d => {
          const j = Math.max(0, Math.min(d.participants.length - 1, pi + k));
          const [p] = d.participants.splice(pi, 1);
          d.participants.splice(j, 0, p);
        }, true);
      }
    };
    window.addEventListener('pointerup', up);
  };
  const delPart = pid => api.edit(d => {
    d.participants = d.participants.filter(p => p.id !== pid);
    d.items = d.items.filter(it => {
      if (it.kind === 'msg') return it.from !== pid && it.to !== pid;
      if (it.kind === 'note') return !(it.who || []).includes(pid);
      if (it.kind === 'act') return it.who !== pid;
      return true;
    });
  }, true);
  const selItem = sel && sel.type === 'item' && L.rows.find(r => r.i === sel.idx);
  let pill = null;
  if (selItem) {
    const g = selItem;
    const it = g.it;
    const baseY = g.y + g.h + 6;
    const baseX = it.kind === 'msg' ? Math.max(g.x1, g.x2) + 14 : (g.x || L.M) + (g.w || 0) + 12;
    const pos = clampPill(baseX, baseY, W);
    if (it.kind === 'msg') {
      const pOpts = L.parts.map(p => ({
        value: p.id,
        label: p.id
      }));
      pill = /*#__PURE__*/React.createElement(FPill, {
        style: pos
      }, /*#__PURE__*/React.createElement(USelect, {
        style: {
          width: 74
        },
        value: it.from,
        options: pOpts,
        onLive: v => api.edit(d => {
          if (d.items[g.i]) d.items[g.i].from = v;
        }),
        onCommitPre: {
          snap: api.snap,
          push: api.pushPre
        }
      }), /*#__PURE__*/React.createElement(USelect, {
        style: {
          width: 92
        },
        value: it.arrow,
        options: ['->>', '-->>', '->', '-->', '-)', '--)', '-x', '--x'].map(a => ({
          value: a,
          label: a
        })),
        onLive: v => api.edit(d => {
          if (d.items[g.i]) d.items[g.i].arrow = v;
        }),
        onCommitPre: {
          snap: api.snap,
          push: api.pushPre
        }
      }), /*#__PURE__*/React.createElement(USelect, {
        style: {
          width: 74
        },
        value: it.to,
        options: pOpts,
        onLive: v => api.edit(d => {
          if (d.items[g.i]) d.items[g.i].to = v;
        }),
        onCommitPre: {
          snap: api.snap,
          push: api.pushPre
        }
      }), /*#__PURE__*/React.createElement(UField, {
        style: {
          width: 130
        },
        value: it.text,
        placeholder: "message",
        onLive: v => api.edit(d => {
          if (d.items[g.i]) d.items[g.i].text = v;
        }),
        onCommitPre: {
          snap: api.snap,
          push: api.pushPre
        }
      }), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "mini-btn del",
        title: "Delete",
        onClick: () => {
          api.edit(d => {
            d.items.splice(g.i, 1);
          }, true);
          setSel(null);
        }
      }, "\u2715"));
    } else if (it.kind === 'note') {
      pill = /*#__PURE__*/React.createElement(FPill, {
        style: pos
      }, /*#__PURE__*/React.createElement(USelect, {
        style: {
          width: 84
        },
        value: it.pos,
        options: [{
          value: 'over',
          label: 'over'
        }, {
          value: 'left',
          label: 'left of'
        }, {
          value: 'right',
          label: 'right of'
        }],
        onLive: v => api.edit(d => {
          if (d.items[g.i]) d.items[g.i].pos = v;
        }),
        onCommitPre: {
          snap: api.snap,
          push: api.pushPre
        }
      }), /*#__PURE__*/React.createElement(JoinField, {
        style: {
          width: 86
        },
        list: it.who,
        placeholder: "A,B",
        onLive: arr => api.edit(d => {
          if (d.items[g.i]) d.items[g.i].who = arr;
        }),
        onCommitPre: {
          snap: api.snap,
          push: api.pushPre
        }
      }), /*#__PURE__*/React.createElement(UField, {
        style: {
          width: 120
        },
        value: it.text,
        placeholder: "note",
        onLive: v => api.edit(d => {
          if (d.items[g.i]) d.items[g.i].text = v;
        }),
        onCommitPre: {
          snap: api.snap,
          push: api.pushPre
        }
      }), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "mini-btn del",
        title: "Delete",
        onClick: () => {
          api.edit(d => {
            d.items.splice(g.i, 1);
          }, true);
          setSel(null);
        }
      }, "\u2715"));
    } else if (it.kind === 'act') {
      const pOpts = L.parts.map(p => ({
        value: p.id,
        label: p.id
      }));
      pill = /*#__PURE__*/React.createElement(FPill, {
        style: pos
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11,
          color: 'var(--muted)'
        }
      }, it.on ? 'activate' : 'deactivate'), /*#__PURE__*/React.createElement(USelect, {
        style: {
          width: 80
        },
        value: it.who,
        options: pOpts,
        onLive: v => api.edit(d => {
          if (d.items[g.i]) d.items[g.i].who = v;
        }),
        onCommitPre: {
          snap: api.snap,
          push: api.pushPre
        }
      }), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "mini-btn",
        title: "Toggle",
        onClick: () => api.edit(d => {
          if (d.items[g.i]) d.items[g.i].on = !d.items[g.i].on;
        }, true)
      }, "\u21C4"), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "mini-btn del",
        title: "Delete",
        onClick: () => {
          api.edit(d => {
            d.items.splice(g.i, 1);
          }, true);
          setSel(null);
        }
      }, "\u2715"));
    }
  }
  const selPart = sel && sel.type === 'part' ? (data.participants || [])[sel.pi] : null;
  if (selPart) {
    const px = L.cols[selPart.id] != null ? L.cols[selPart.id] : 100;
    pill = /*#__PURE__*/React.createElement(FPill, {
      style: clampPill(px - 90, 44, W)
    }, /*#__PURE__*/React.createElement(UField, {
      style: {
        width: 64
      },
      mono: true,
      value: selPart.id,
      placeholder: "id",
      onLive: v => {
        const nid = v.trim().replace(/[^\w.\-]/g, '');
        const oldId = selPart.id;
        if (!nid || nid === oldId) return;
        if ((data.participants || []).some(p => p.id === nid)) return;
        api.commit(d => {
          const pp = d.participants[sel.pi];
          if (!pp) return;
          pp.id = nid;
          for (const it of d.items) {
            if (it.kind === 'msg') {
              if (it.from === oldId) it.from = nid;
              if (it.to === oldId) it.to = nid;
            } else if (it.kind === 'note') {
              it.who = (it.who || []).map(w => w === oldId ? nid : w);
            } else if (it.kind === 'act') {
              if (it.who === oldId) it.who = nid;
            }
          }
        });
      },
      onCommitPre: {
        snap: api.snap,
        push: api.pushPre
      }
    }), /*#__PURE__*/React.createElement(UField, {
      style: {
        width: 104
      },
      value: selPart.label,
      placeholder: "name",
      onLive: v => api.edit(d => {
        const pp = d.participants[sel.pi];
        if (pp) pp.label = v;
      }),
      onCommitPre: {
        snap: api.snap,
        push: api.pushPre
      }
    }), /*#__PURE__*/React.createElement(UCheck, {
      label: "actor",
      checked: selPart.actor,
      onLive: v => api.edit(d => {
        const pp = d.participants[sel.pi];
        if (pp) pp.actor = v;
      }),
      onCommitPre: {
        snap: api.snap,
        push: api.pushPre
      }
    }), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "mini-btn del",
      title: "Delete participant and its messages",
      onClick: () => {
        delPart(selPart.id);
        setSel(null);
      }
    }, "\u2715"));
  }
  function markerId(head, accent) {
    return 'sq-' + head + (accent ? 'a' : '');
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "viz-head",
    style: {
      borderBottom: 'none',
      paddingBottom: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => insertMsgAt(L.items.length)
  }, "+ Message"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => api.edit(d => {
      const ps = d.participants;
      const a = ps[0] ? ps[0].id : 'A';
      d.items.push({
        kind: 'note',
        pos: 'over',
        who: [a],
        text: 'note'
      });
    }, true)
  }, "+ Note"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => api.edit(d => {
      const ps = d.participants;
      const a = ps[0] ? ps[0].id : 'A';
      d.items.push({
        kind: 'act',
        on: true,
        who: a
      });
    }, true)
  }, "+ Act"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => api.edit(d => {
      let i = d.participants.length + 1;
      while (d.participants.some(p => p.id === 'P' + i)) i++;
      d.participants.push({
        id: 'P' + i,
        label: 'P' + i,
        actor: false
      });
    }, true)
  }, "+ Participant"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      marginLeft: 8
    }
  }, "drag rows to reorder \xB7 dots to retarget \xB7 headers to reorder people")), /*#__PURE__*/React.createElement("div", {
    className: "viz-body",
    ref: hostRef,
    onPointerDown: () => setSel(null)
  }, /*#__PURE__*/React.createElement("svg", {
    width: W,
    height: L.height
  }, /*#__PURE__*/React.createElement("defs", null, ['s', 'o', 'x'].map(hd => ['n', 'a'].map(acc => /*#__PURE__*/React.createElement("marker", {
    key: hd + acc,
    id: markerId(hd, acc === 'a'),
    viewBox: "0 0 10 10",
    refX: hd === 'x' ? 6 : 8.5,
    refY: "5",
    markerWidth: hd === 'x' ? 9 : 7.5,
    markerHeight: hd === 'x' ? 9 : 7.5,
    orient: "auto-start-reverse"
  }, hd === 's' && /*#__PURE__*/React.createElement("path", {
    d: "M0,0L10,5L0,10z",
    fill: acc === 'a' ? '#22d3ee' : '#8ba2bd'
  }), hd === 'o' && /*#__PURE__*/React.createElement("path", {
    d: "M1,1L9,5L1,9",
    fill: "none",
    stroke: acc === 'a' ? '#22d3ee' : '#8ba2bd',
    strokeWidth: "1.8"
  }), hd === 'x' && /*#__PURE__*/React.createElement("path", {
    d: "M2,2L8,8M8,2L2,8",
    stroke: acc === 'a' ? '#22d3ee' : '#8ba2bd',
    strokeWidth: "1.8"
  }))))), L.parts.map((p, pi) => {
    const x = L.cols[p.id];
    const hot = hotCol === p.id;
    const isSel = sel && sel.type === 'part' && sel.pi === pi;
    return /*#__PURE__*/React.createElement("g", {
      key: p.id + pi
    }, /*#__PURE__*/React.createElement("line", {
      className: 's-life' + (hot ? ' s-life-hot' : ''),
      x1: x,
      y1: 58,
      x2: x,
      y2: L.height - 14
    }), /*#__PURE__*/React.createElement("rect", {
      className: 's-head' + (p.actor ? ' actor-head' : '') + (isSel ? ' g-bar sel' : ''),
      x: x - 55,
      y: 22,
      width: 110,
      height: 32,
      rx: 8,
      onPointerDown: e => headDown(pi, p.id, e),
      onDoubleClick: e => {
        e.stopPropagation();
        setSel({
          type: 'part',
          pi
        });
      }
    }), /*#__PURE__*/React.createElement("text", {
      className: "s-head-txt",
      x: x,
      y: 42,
      textAnchor: "middle"
    }, p.id, p.label !== p.id ? ' · ' + p.label : ''));
  }), L.spans.map((sp, i) => {
    const x = L.cols[sp.who];
    if (x == null) return null;
    return /*#__PURE__*/React.createElement("rect", {
      key: 'ac' + i,
      className: "s-act",
      x: x - 4.5,
      y: sp.y0 + 4,
      width: 9,
      height: Math.max(sp.y1 - sp.y0 - 8, 8),
      rx: 2.5
    });
  }), L.rows.map(g => {
    const it = g.it;
    const my = g.y + g.h / 2;
    const isSel = sel && sel.type === 'item' && sel.idx === g.i;
    if (it.kind === 'msg') {
      const st = seqArrowStyle(it.arrow);
      const acc = isSel;
      const self = g.x1 === g.x2;
      const dPath = self ? `M${g.x1},${my} c 40,-14 52,8 4,12` : `M${g.x1},${my} L${g.x2},${my}`;
      const lw = C.textWidth(it.text || '') + 14;
      return /*#__PURE__*/React.createElement("g", {
        key: 'r' + g.i,
        className: 's-msg' + (isSel ? ' sel' : ''),
        onPointerDown: e => itemDown(g.i, e)
      }, data.autonumber && /*#__PURE__*/React.createElement("text", {
        className: "s-num",
        x: Math.min(g.x1, g.x2) - 26,
        y: my + 3
      }, g.num, "."), /*#__PURE__*/React.createElement("path", {
        className: "line",
        d: dPath,
        strokeDasharray: st.dash || undefined,
        stroke: acc ? '#22d3ee' : '#8ba2bd',
        markerEnd: `url(#${markerId(st.head, acc)})`
      }), /*#__PURE__*/React.createElement("rect", {
        x: (g.x1 + g.x2) / 2 - lw / 2,
        y: my - 21,
        width: lw,
        height: 15,
        rx: 4,
        fill: "rgba(13,21,38,.85)",
        stroke: isSel ? 'rgba(34,211,238,.5)' : 'transparent'
      }), /*#__PURE__*/React.createElement("text", {
        className: "s-msg-txt",
        x: (g.x1 + g.x2) / 2,
        y: my - 10,
        textAnchor: "middle"
      }, it.text), isSel && !self && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
        className: "s-endpoint",
        cx: g.x1,
        cy: my,
        r: 5.5,
        onPointerDown: e => endPointDown(g.i, 'from', e)
      }), /*#__PURE__*/React.createElement("circle", {
        className: "s-endpoint",
        cx: g.x2,
        cy: my,
        r: 5.5,
        onPointerDown: e => endPointDown(g.i, 'to', e)
      })));
    }
    if (it.kind === 'note') {
      const nw = g.w || 80;
      return /*#__PURE__*/React.createElement("g", {
        key: 'r' + g.i,
        onPointerDown: e => itemDown(g.i, e)
      }, /*#__PURE__*/React.createElement("rect", {
        className: 's-note-box' + (isSel ? ' sel' : ''),
        x: g.x,
        y: my - 13,
        width: nw,
        height: 26,
        rx: 6
      }), /*#__PURE__*/React.createElement("text", {
        className: "s-note-txt",
        x: g.x + nw / 2,
        y: my + 4,
        textAnchor: "middle"
      }, it.text));
    }
    return /*#__PURE__*/React.createElement("g", {
      key: 'r' + g.i,
      onPointerDown: e => itemDown(g.i, e)
    }, /*#__PURE__*/React.createElement("rect", {
      className: 's-act' + (isSel ? ' g-bar sel' : ''),
      x: (L.cols[it.who] || 0) - 4.5,
      y: g.y,
      width: 9,
      height: g.h,
      rx: 2.5
    }));
  }), ghostY != null && /*#__PURE__*/React.createElement("line", {
    className: "s-dragline",
    x1: 10,
    y1: ghostY,
    x2: W - 10,
    y2: ghostY
  }), (() => {
    const zones = [];
    for (let zi = 0; zi <= L.items.length; zi++) {
      const prev = L.rows[zi - 1];
      const next = L.rows[zi];
      const a = prev ? prev.y + prev.h : 58;
      const b = next ? next.y : prev ? a + 22 : L.height - 44;
      if (b <= a) continue;
      zones.push({
        i: zi,
        top: (a + b) / 2 - 6,
        mid: (a + b) / 2
      });
    }
    return zones.map(z => /*#__PURE__*/React.createElement("g", {
      key: 'ins' + z.i,
      onMouseEnter: () => setGapHover(z.i),
      onMouseLeave: () => setGapHover(null)
    }, /*#__PURE__*/React.createElement("rect", {
      className: "s-ins",
      x: 0,
      y: z.top,
      width: W,
      height: 12
    }), gapHover === z.i && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
      className: "s-ins-btn",
      cx: 22,
      cy: z.mid,
      r: 9,
      onClick: () => {
        setGapHover(null);
        insertMsgAt(z.i);
      }
    }), /*#__PURE__*/React.createElement("line", {
      x1: 34,
      y1: z.mid,
      x2: W - 20,
      y2: z.mid,
      stroke: "rgba(34,211,238,.3)",
      strokeDasharray: "3 4",
      pointerEvents: "none"
    }))));
  })()), !L.items.length && /*#__PURE__*/React.createElement("div", {
    className: "viz-empty"
  }, "Empty conversation \u2014 add a message above."), pill));
}
const VIEW_PREFS = {};
function ModeShell({
  mode,
  data,
  api,
  stamp
}) {
  const M = C.MODES[mode];
  const [view, setView] = useState(VIEW_PREFS[mode] || 'visual');
  useEffect(() => {
    VIEW_PREFS[mode] = view;
  }, [mode, view]);
  const Visual = M.Visual;
  return /*#__PURE__*/React.createElement("aside", {
    className: "viz-shell"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rp-head viz-head"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: 'var(--text)'
    }
  }, M.tab), /*#__PURE__*/React.createElement("span", {
    className: "chip"
  }, C.MODES[mode].stats(data)), /*#__PURE__*/React.createElement("span", {
    className: "grow"
  }), /*#__PURE__*/React.createElement("button", {
    className: view === 'visual' ? 'on' : '',
    onClick: () => setView('visual')
  }, "Visual"), /*#__PURE__*/React.createElement("button", {
    className: view === 'rows' ? 'on' : '',
    onClick: () => setView('rows')
  }, "Rows")), view === 'visual' && Visual ? /*#__PURE__*/React.createElement(Visual, {
    data: data,
    api: api,
    stamp: stamp
  }) : /*#__PURE__*/React.createElement("div", {
    className: "sheet-shell",
    style: {
      background: 'var(--bg)',
      padding: '14px 18px 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "sheet-inner"
  }, mode === 'sequence' && /*#__PURE__*/React.createElement(SeqSheet, {
    data: data,
    api: api
  }), mode === 'gantt' && /*#__PURE__*/React.createElement(GanttSheet, {
    data: data,
    api: api
  }), mode === 'pie' && /*#__PURE__*/React.createElement(PieSheet, {
    data: data,
    api: api
  }), mode === 'journey' && /*#__PURE__*/React.createElement(JourneySheet, {
    data: data,
    api: api
  }))));
}
C.MODES.sequence.Visual = SeqVisual;
C.MODES.gantt.Visual = GanttVisual;
C.MODES.pie.Visual = PieVisual;
C.MODES.journey = C.MODES.journey || (window.MSMODES && window.MSMODES.journey) || null;
if (C.MODES.journey) C.MODES.journey.Visual = JourneyVisual;
const MODE_LIST = ['flowchart', 'sequence', 'gantt', 'pie', 'journey'];
function App() {
  const docsRef = useRef({});
  const [ver, bump] = useReducer(v => v + 1, 0);
  const editSrcRef = useRef('boot');
  const modeRef = useRef('flowchart');
  const [mode, setModeState] = useState('flowchart');
  const [codeText, setCodeText] = useState('');
  const lastGoodRef = useRef('');
  const [sync, setSync] = useState({
    state: 'ok',
    err: '',
    warn: ''
  });
  const histRef = useRef([]);
  const futRef = useRef([]);
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpOpenRef = useRef(false);
  const [zoomK, setZoomK] = useState(100);
  const [saveChip, setSaveChip] = useState('—');
  const [snapOn, setSnapOnState] = useState(true);
  const snapRef = useRef(true);
  const [palHidden, setPalHiddenState] = useState(false);
  const palRef = useRef(false);
  const [focusMode, setFocusModeState] = useState(false);
  const focusRef = useRef(false);
  const [toasts, setToasts] = useState([]);
  const toastSeq = useRef(0);
  const boardRef = useRef(null);
  const wrapRef = useRef(null);
  const boardHostRef = useRef(null);
  const taRef = useRef(null);
  const pvCounter = useRef(0);
  const pvTimer = useRef(null);
  const saveTimer = useRef(null);
  const syncTimer = useRef(null);
  const [pvHtml, setPvHtml] = useState('');
  const [pvErr, setPvErr] = useState('');
  // bumped whenever a whole document is replaced (typed source, template, clear,
  // undo/redo, boot) — visuals use it to drop stale selections, while ordinary
  // in-place edits keep their selection alive
  const [docStamp, setDocStamp] = useState(0);
  const bumpStamp = useCallback(() => setDocStamp(v => v + 1), []);
  useEffect(() => {
    helpOpenRef.current = helpOpen;
  }, [helpOpen]);
  const pushToast = useCallback((msg, type) => {
    const id = ++toastSeq.current;
    setToasts(ts => [...ts, {
      id,
      msg,
      type
    }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 2400);
  }, []);
  const takeSnapshot = useCallback(() => JSON.stringify({
    mode: modeRef.current,
    data: docsRef.current[modeRef.current].data
  }), []);
  const bootedRef = useRef(false);
  const pushUndoPre = useCallback(pre => {
    const s = pre != null ? pre : JSON.stringify({
      mode: modeRef.current,
      data: docsRef.current[modeRef.current].data
    });
    histRef.current.push(s);
    if (histRef.current.length > 120) histRef.current.shift();
    futRef.current = [];
    setUndoDepth(histRef.current.length);
    setRedoDepth(0);
  }, []);
  const svc = useMemo(() => ({
    toast: (m, t) => pushToast(m, t),
    snapshot: () => JSON.stringify({
      mode: modeRef.current,
      data: docsRef.current[modeRef.current].data
    }),
    pushUndo: pre => pushUndoPre(pre),
    onChanged: () => {
      editSrcRef.current = 'ui';
      bump();
    },
    onZoom: k => setZoomK(k),
    isHelpOpen: () => helpOpenRef.current
  }), [pushToast, pushUndoPre]);
  const commitData = useCallback((m, d) => {
    docsRef.current[m] = {
      data: d
    };
    editSrcRef.current = 'ui';
    bump();
  }, []);
  const restoreSnapshot = useCallback(json => {
    let s;
    try {
      s = JSON.parse(json);
    } catch (e) {
      return;
    }
    if (!s || !s.mode || !C.MODES[s.mode]) return;
    docsRef.current[s.mode] = {
      data: s.data
    };
    if (s.mode !== modeRef.current) {
      modeRef.current = s.mode;
      setModeState(s.mode);
    }
    if (s.mode === 'flowchart' && boardRef.current) {
      boardRef.current.clearSelection();
      boardRef.current.setModel(s.data);
    } else if (window.__ENTITY_BOARDS && window.__ENTITY_BOARDS[s.mode]) {
      window.__ENTITY_BOARDS[s.mode].clearSelection();
      window.__ENTITY_BOARDS[s.mode].setModel(s.data);
    }
    editSrcRef.current = 'ui';
    bumpStamp();
    bump();
  }, [bumpStamp]);
  const doUndo = useCallback(() => {
    if (!histRef.current.length) return;
    futRef.current.push(JSON.stringify({
      mode: modeRef.current,
      data: docsRef.current[modeRef.current].data
    }));
    const s = histRef.current.pop();
    setUndoDepth(histRef.current.length);
    setRedoDepth(futRef.current.length);
    restoreSnapshot(s);
    pushToast('undo');
  }, [restoreSnapshot, pushToast]);
  const doRedo = useCallback(() => {
    if (!futRef.current.length) return;
    histRef.current.push(JSON.stringify({
      mode: modeRef.current,
      data: docsRef.current[modeRef.current].data
    }));
    const s = futRef.current.pop();
    setUndoDepth(histRef.current.length);
    setRedoDepth(futRef.current.length);
    restoreSnapshot(s);
    pushToast('redo');
  }, [restoreSnapshot, pushToast]);
  const applyTyped = useCallback(explicitText => {
    const ta = taRef.current;
    if (!ta) return false;
    const val = explicitText != null ? explicitText : ta.value;
    if (!val.trim()) return false;
    const m = modeRef.current;
    const M = C.MODES[m];
    const res = M.parse(val);
    if (res.errors.length) {
      setSync({
        state: 'error',
        err: 'line ' + res.errors[0].line + ': ' + res.errors[0].msg,
        warn: res.errors.length > 1 ? '+' + (res.errors.length - 1) + ' more' : ''
      });
      return false;
    }
    let data = res.data;
    if (m === 'flowchart' || window.MSMODES && window.MSMODES[m]) {
      if (m === 'flowchart') {
        var center = boardFor(m) ? boardFor(m).centerWorld() : {
          x: 0,
          y: 0
        };
        data = C.mergeIntoModel(docsRef.current.flowchart.data, data, center);
        docsRef.current.flowchart = {
          data: data
        };
        var ab = boardFor(m);
        if (ab) {
          ab.clearSelection();
          ab.setModel(data);
        }
      } else {
        docsRef.current[m] = {
          data: data
        };
        var ab2 = boardFor(m);
        if (ab2) {
          ab2.clearSelection();
          ab2.setModel(data);
        }
      }
    } else {
      docsRef.current[m] = {
        data: data
      };
    }
    lastGoodRef.current = M.gen(data);
    setSync({
      state: 'ok',
      err: '',
      warn: res.warnings.length ? '⚠ ' + res.warnings.length + ' ignored' : ''
    });
    editSrcRef.current = 'code';
    bumpStamp();
    bump();
    return true;
  }, [bumpStamp]);
  const renderPreviewNow = useCallback(async () => {
    const ta = taRef.current;
    const txt = (ta && ta.value.trim() || lastGoodRef.current || '').trim();
    if (!txt) {
      setPvHtml('');
      setPvErr('nothing to render yet');
      return;
    }
    try {
      if (!window.mermaid) throw new Error('mermaid library not loaded (offline?)');
      const id = 'pv-' + ++pvCounter.current;
      const {
        svg
      } = await window.mermaid.render(id, txt);
      const stale = document.getElementById('d' + id);
      if (stale) stale.remove();
      setPvHtml(svg);
      setPvErr('');
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      setPvHtml('');
      setPvErr(msg.length > 260 ? msg.slice(0, 260) + '…' : msg);
    }
  }, []);
  const schedulePreview = useCallback(() => {
    clearTimeout(pvTimer.current);
    pvTimer.current = setTimeout(renderPreviewNow, 550);
  }, [renderPreviewNow]);
  const scheduleSave = useCallback(() => {
    if (!bootedRef.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        const docs = {};
        for (const k of Object.keys(docsRef.current)) docs[k] = docsRef.current[k];
        localStorage.setItem(STORE_KEY, JSON.stringify({
          v: 2,
          docs,
          prefs: {
            snapOn: snapRef.current,
            palHidden: palRef.current,
            focus: focusRef.current,
            lastMode: modeRef.current
          }
        }));
        setSaveChip('saved');
        setTimeout(() => setSaveChip(c => c === 'saved' ? '' : c), 1200);
      } catch (e) {}
    }, 450);
  }, []);
  const ensureDoc = useCallback(m => {
    if (docsRef.current[m] && docsRef.current[m].data) return;
    const M = C.MODES[m];
    const tpl = M.templates[0];
    const res = M.parse(tpl.src);
    let data;
    if (res.errors.length) data = M.empty();else if (m === 'flowchart') {
      data = C.mergeIntoModel(null, res.data, {
        x: 0,
        y: 0
      });
      C.autoLayoutModel(data);
    } else {
      data = res.data;
    }
    docsRef.current[m] = {
      data
    };
  }, []);
  const applyTemplate = useCallback((m, src) => {
    const M = C.MODES[m];
    const res = M.parse(src);
    if (res.errors.length) {
      pushToast('template failed to parse', 'err');
      return false;
    }
    if (m === 'flowchart' || window.MSMODES && window.MSMODES[m]) {
      if (m === 'flowchart') {
        var fresh = C.mergeIntoModel(null, res.data, boardFor(m) ? boardFor(m).centerWorld() : {
          x: 0,
          y: 0
        });
        C.autoLayoutModel(fresh);
        docsRef.current.flowchart = {
          data: fresh
        };
        var ab = boardFor(m);
        if (ab) {
          ab.clearSelection();
          ab.setModel(fresh);
        }
      } else {
        docsRef.current[m] = {
          data: res.data
        };
        var ab2 = boardFor(m);
        if (ab2) {
          ab2.clearSelection();
          ab2.setModel(res.data);
        }
      }
    } else {
      docsRef.current[m] = {
        data: res.data
      };
    }
    editSrcRef.current = 'ui';
    bumpStamp();
    bump();
    return true;
  }, [pushToast, bumpStamp]);
  const loadTemplate = useCallback(key => {
    const M = C.MODES[modeRef.current];
    const tpl = M.templates.find(t => t.key === key);
    if (!tpl) return;
    pushUndoPre(takeSnapshot());
    if (applyTemplate(modeRef.current, tpl.src)) pushToast('loaded “' + tpl.name + '”');
  }, [applyTemplate, pushUndoPre, takeSnapshot, pushToast]);
  const commitPendingCode = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    if (!ta.value.trim() || ta.value === lastGoodRef.current) return;
    const ok = applyTyped(ta.value);
    if (!ok) pushToast('unsaved code discarded — kept last good diagram', 'err');
  }, [applyTyped, pushToast]);
  const switchMode = useCallback(m => {
    if (m === modeRef.current) return;
    commitPendingCode();
    ensureDoc(m);
    modeRef.current = m;
    setModeState(m);
    editSrcRef.current = 'ui';
    if (boardRef.current) {
      boardRef.current.setActive(m === 'flowchart');
      if (boardRef.current.root) boardRef.current.root.style.display = m === 'flowchart' ? '' : 'none';
      else if (boardRef.current.svg) boardRef.current.svg.style.display = m === 'flowchart' ? '' : 'none';
    }
    Object.keys(window.__ENTITY_BOARDS || {}).forEach(function(k) {
      var eb = window.__ENTITY_BOARDS[k];
      eb.setActive(k === m);
      eb.root.style.display = k === m ? '' : 'none';
    });
    // flowchart board wrapper visibility is handled via canvas-wrap display; ensure its board active state already set
    // entity board that becomes active should have its model re-set as safety (idempotent)
    if (window.__ENTITY_BOARDS && window.__ENTITY_BOARDS[m]) {
      var activeEb = window.__ENTITY_BOARDS[m];
      if (docsRef.current[m] && docsRef.current[m].data) activeEb.setModel(docsRef.current[m].data);
    }
    // ensure the board we're switching to has the latest model (covers undo/code edits done while it was hidden)
    if (m === 'flowchart' && boardRef.current && docsRef.current.flowchart && docsRef.current.flowchart.data) {
      boardRef.current.setModel(docsRef.current.flowchart.data);
    }
    // [DEBUG-7f3a] ensure newly visible board is laid out after React flips canvas-wrap display
    requestAnimationFrame(() => {
      const ab = m === 'flowchart' ? boardRef.current : window.__ENTITY_BOARDS && window.__ENTITY_BOARDS[m];
      if (ab && ab.root && ab.root.style.display !== 'none') {
        try { ab.renderAll(); } catch(e) { console.log('[DEBUG-7f3a] renderAll after switch failed', e.message); }
        // fit if view is at default and entities were placed while hidden
        if (ab.view && ab.view.k === 1 && ab.view.x === 0 && ab.view.y === 0) {
          try { ab.fitView(); } catch(e) {}
        }
      }
    });
    bump();
  }, [commitPendingCode, ensureDoc]);
  const toggleFocus = useCallback(() => {
    setFocusModeState(v => {
      focusRef.current = !v;
      return !v;
    });
  }, []);
  const togglePal = useCallback(() => {
    setPalHiddenState(v => {
      palRef.current = !v;
      return !v;
    });
  }, []);
  const toggleSnap = useCallback(() => {
    setSnapOnState(v => {
      snapRef.current = !v;
      if (boardRef.current) boardRef.current.setSnap(!v);
      Object.values(window.__ENTITY_BOARDS || {}).forEach(function(eb) { eb.setSnap(!v); });
      return !v;
    });
  }, []);
  const onTaInput = useCallback(() => {
    setSync({
      state: 'editing',
      err: '',
      warn: ''
    });
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(applyTyped, 380);
    schedulePreview();
  }, [applyTyped, schedulePreview]);
  const onTaKey = useCallback(e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target;
      const s = ta.selectionStart,
        en = ta.selectionEnd;
      const v = ta.value.slice(0, s) + '    ' + ta.value.slice(en);
      setCodeText(v);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = s + 4;
      });
    }
    e.stopPropagation();
  }, []);
  useEffect(() => {
    const h = e => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
      if (helpOpenRef.current) {
        if (e.key === 'Escape') setHelpOpen(false);
        return;
      }
      if (typing) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? doRedo() : doUndo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        doRedo();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        toggleFocus();
        return;
      }
      var abForKey = m => m === 'flowchart' ? boardRef.current : window.__ENTITY_BOARDS && window.__ENTITY_BOARDS[m] || null;
      var ab = abForKey(modeRef.current);
      if (ab && ab.onKeyDown(e)) return;
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [doUndo, doRedo, toggleFocus]);
  useEffect(() => {
    document.body.classList.toggle('focus-mode', focusMode);
    scheduleSave();
  }, [focusMode, scheduleSave]);
  useEffect(() => {
    document.body.classList.toggle('pal-hidden', palHidden);
    scheduleSave();
  }, [palHidden, scheduleSave]);
  useEffect(() => {
    scheduleSave();
  }, [mode, ver, scheduleSave]);
  useEffect(() => {
    if (window.mermaid) {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
        fontFamily: C.FONT_STACK,
        themeVariables: {
          primaryColor: '#16233c',
          primaryTextColor: '#e2e8f0',
          primaryBorderColor: '#4a6079',
          lineColor: '#7e93ae',
          fontSize: '14px'
        }
      });
    }
    const saved = loadSaved();
    if (saved && saved.docs) {
      for (const k of Object.keys(saved.docs)) {
        if (C.MODES[k]) docsRef.current[k] = saved.docs[k];
      }
      const p = saved.prefs || {};
      if (p.snapOn === false) {
        snapRef.current = false;
        setSnapOnState(false);
      }
      if (p.palHidden) {
        palRef.current = true;
        setPalHiddenState(true);
      }
      if (p.focus) {
        focusRef.current = true;
        setFocusModeState(true);
      }
      if (p.lastMode && C.MODES[p.lastMode]) {
        modeRef.current = p.lastMode;
        setModeState(p.lastMode);
      }
    }
    // [DEBUG-7f3a] validate loaded docs - ER was blank when saved doc had nodes instead of entities
    (function validateDocs() {
      for (const k of Object.keys(C.MODES)) {
        const M = C.MODES[k];
        const ent = docsRef.current[k];
        if (!ent || !ent.data) continue;
        const d = ent.data;
        const isEntityMode = !!(window.MSMODES && window.MSMODES[k]);
        if (isEntityMode) {
          if (!Array.isArray(d.entities) || !Array.isArray(d.rels)) {
            console.log(`[DEBUG-7f3a] resetting corrupted ${k} doc (missing entities/rels)`, d);
            delete docsRef.current[k];
            continue;
          }
          try {
            const g = M.gen(d);
            const r = M.parse(g);
            if (r.errors.length) {
              console.log(`[DEBUG-7f3a] resetting ${k} doc with parse errors`, r.errors);
              delete docsRef.current[k];
            }
          } catch (e) {
            console.log(`[DEBUG-7f3a] resetting ${k} doc throw`, e.message);
            delete docsRef.current[k];
          }
        }
      }
    })();
    ensureDoc('flowchart');
    const b = new C.Board(wrapRef.current, boardHostRef.current, svc);
    boardRef.current = b;
    b.setSnap(snapRef.current);
    const fm = docsRef.current.flowchart.data;
    b.setModel(fm);
    b.normalizeModel();
    b.renderAll();
    b.setActive(modeRef.current === 'flowchart');
    // Wrap graph board DOM in a root so switchMode can hide it like entity boards
    if (!b.root) {
      b.root = document.createElement('div');
      b.root.className = 'flow-board-root';
      b.root.style.cssText = 'position:absolute;inset:0;';
      try {
        if (b.svg && b.svg.parentNode) b.root.appendChild(b.svg);
        if (b.band && b.band.parentNode) b.root.appendChild(b.band);
        if (b.pill && b.pill.parentNode) b.root.appendChild(b.pill);
        if (b.editor && b.editor.parentNode) b.root.appendChild(b.editor);
        if (b.form && b.form.parentNode) b.root.appendChild(b.form);
        if (boardHostRef.current) boardHostRef.current.appendChild(b.root);
      } catch (e) {}
    }
    b.root.style.display = modeRef.current === 'flowchart' ? '' : 'none';
    Object.keys(window.MSMODES || {}).forEach(function(k) {
      var M = C.MODES[k];
      var res = M.parse(M.templates[0].src);
      if (!docsRef.current[k] || !docsRef.current[k].data) docsRef.current[k] = { data: res.errors.length ? M.empty() : res.data };
    });
    window.__ENTITY_BOARDS = {};
    Object.keys(window.MSMODES || {}).forEach(function(k) {
      var EB = window.MSBoard.EntityBoard;
      var eb = new EB(wrapRef.current, boardHostRef.current, svc, Object.assign({ modeId: k }, C.MODES[k].boardCfg));
      eb.setModel(docsRef.current[k].data);
      eb.setSnap(snapRef.current);
      eb.setActive(false);
      eb.root.style.display = 'none';
      window.__ENTITY_BOARDS[k] = eb;
    });
    requestAnimationFrame(function() {
      var am = modeRef.current;
      if (am !== 'flowchart' && C.MODES[am]) {
        switchMode(am);
        setTimeout(function() {
          var ab2 = window.__ENTITY_BOARDS && window.__ENTITY_BOARDS[am] || null;
          if (ab2) { try { ab2.fitView(); } catch(e) {} }
          else { try { b.fitView(); } catch(e) {} }
        }, 80);
      } else {
        try { b.fitView(); } catch(e) {}
      }
    });
    editSrcRef.current = 'boot';
    bump();
    setSaveChip(saved ? 'restored' : 'ready');
    bootedRef.current = true;
    window.__STUDIO_READY = true;
    return function() {
      b.destroy();
      Object.values(window.__ENTITY_BOARDS || {}).forEach(function(eb) {
        eb.destroy();
      });
    };
  }, []);
  useEffect(() => {
    const m = modeRef.current;
    const cur = docsRef.current[m] && docsRef.current[m].data;
    if (!cur) return;
    const text = C.MODES[m].gen(cur);
    lastGoodRef.current = text;
    if (editSrcRef.current !== 'code') {
      setCodeText(text);
      setSync({
        state: 'ok',
        err: '',
        warn: ''
      });
    }
    scheduleSave();
    schedulePreview();
    if ((m === 'flowchart' || window.MSMODES && window.MSMODES[m]) && editSrcRef.current !== 'code') {
      var ab = m === 'flowchart' ? boardRef.current : window.__ENTITY_BOARDS && window.__ENTITY_BOARDS[m] || null;
      if (ab) {
        try { ab.renderAll(); } catch(e) { console.log('[DEBUG-7f3a] renderAll failed for', m, e.message); }
        // [DEBUG-7f3a] detect LHS blank: model has entities but nothing rendered
        if (ab.entLayer && ab.entLayer.children.length === 0 && cur.entities && cur.entities.length > 0) {
          console.log(`[DEBUG-7f3a] ${m} blank: ${cur.entities.length} entities but 0 rendered, x/y:`, cur.entities.map(e=>`${e.id}:${e.x},${e.y}`).join(' | '));
          try { ab.setModel(cur); ab.fitView(); } catch(e) {}
        }
      }
    } else if (editSrcRef.current === 'code') {
      // still ensure canvas boards are not left blank when code came from typing but board is visible
      var ab2 = m === 'flowchart' ? boardRef.current : window.__ENTITY_BOARDS && window.__ENTITY_BOARDS[m] || null;
      if (ab2 && ab2.entLayer && ab2.entLayer.children.length === 0 && cur.entities && cur.entities.length > 0) {
        console.log(`[DEBUG-7f3a] ${m} blank after code edit, forcing render`);
        try { ab2.renderAll(); } catch(e) {}
      }
    }
  }, [ver, mode, scheduleSave, schedulePreview]);
  const isFc = mode === 'flowchart';
  const isCanvas = mode === 'flowchart' || !!(C.MODES[mode] && C.MODES[mode].kind === 'canvas');
  const boardFor = function(m) {
    return m === 'flowchart' ? boardRef.current : window.__ENTITY_BOARDS && window.__ENTITY_BOARDS[m] || null;
  };
  const activeBoard = boardFor(mode);
  const curData = docsRef.current[mode] ? docsRef.current[mode].data : null;
  const statsTxt = curData ? C.MODES[mode].stats(curData) : '';
  const fcNodes = isCanvas && curData ? (curData.nodes ? curData.nodes.length : curData.entities ? curData.entities.length : 0) : 0;
  const sheetApi = curData ? makeApi({
    data: curData,
    commitData: d => commitData(mode, d),
    snapOf: () => JSON.stringify({
      mode,
      data: curData
    }),
    pushPre: s => pushUndoPre(s)
  }) : null;
  const copySource = async () => {
    const txt = lastGoodRef.current;
    try {
      await navigator.clipboard.writeText(txt);
      pushToast('mermaid copied to clipboard ✓');
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      pushToast('copied ✓');
    }
  };
  const exportSvg = async () => {
    try {
      if (!window.mermaid) throw new Error('mermaid not loaded (offline?)');
      const id = 'ex-' + ++pvCounter.current;
      const {
        svg
      } = await window.mermaid.render(id, lastGoodRef.current);
      const stale = document.getElementById('d' + id);
      if (stale) stale.remove();
      downloadBlob('diagram.svg', new Blob([svg], {
        type: 'image/svg+xml'
      }));
      pushToast('SVG downloaded');
    } catch (e) {
      pushToast('render failed: ' + e.message, 'err');
    }
  };
  const exportPng = async () => {
    try {
      if (!window.mermaid) throw new Error('mermaid not loaded (offline?)');
      const id = 'ex-' + ++pvCounter.current;
      const {
        svg
      } = await window.mermaid.render(id, lastGoodRef.current);
      const stale = document.getElementById('d' + id);
      if (stale) stale.remove();
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      const vb = doc.documentElement.getAttribute('viewBox');
      let w = 900,
        h = 600;
      if (vb) {
        const p = vb.split(/[\s,]+/).map(Number);
        w = p[2];
        h = p[3];
      }
      const scale = Math.min(2, 2400 / Math.max(w, h)) || 2;
      const img = new Image();
      const url = URL.createObjectURL(new Blob([svg], {
        type: 'image/svg+xml'
      }));
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = url;
      });
      const cnv = document.createElement('canvas');
      cnv.width = Math.round(w * scale);
      cnv.height = Math.round(h * scale);
      const ctx = cnv.getContext('2d');
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, cnv.width, cnv.height);
      ctx.drawImage(img, 0, 0, cnv.width, cnv.height);
      URL.revokeObjectURL(url);
      await new Promise(res => cnv.toBlob(b => {
        downloadBlob('diagram.png', b);
        res();
      }, 'image/png'));
      pushToast('PNG downloaded');
    } catch (e) {
      pushToast('export failed: ' + e.message, 'err');
    }
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    id: "topbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "brand"
  }, /*#__PURE__*/React.createElement("b", null, "\uD83E\uDDDC Mermaid Studio"), /*#__PURE__*/React.createElement("span", {
    className: "sub"
  }, "visual \u21C4 mermaid")), /*#__PURE__*/React.createElement("div", {
    className: "tb-sep"
  }), /*#__PURE__*/React.createElement("div", {
    className: "mode-tabs"
  }, MODE_LIST.map(m => /*#__PURE__*/React.createElement("button", {
    key: m,
    className: 'mode-tab' + (mode === m ? ' on' : ''),
    onClick: () => switchMode(m)
  }, C.MODES[m].tab))), /*#__PURE__*/React.createElement("div", {
    className: "tb-sep"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: isCanvas ? 'contents' : 'none'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: 'icon-btn' + (palHidden ? '' : ' on'),
    title: "Toggle shape palette",
    onClick: togglePal
  }, "\u25A6"), /*#__PURE__*/React.createElement("span", {
    className: "tb-group"
  }, /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    title: "Undo (Ctrl+Z)",
    disabled: !undoDepth,
    onClick: doUndo
  }, "\u21B6"), /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    title: "Redo (Ctrl+Shift+Z)",
    disabled: !redoDepth,
    onClick: doRedo
  }, "\u21B7"), /*#__PURE__*/React.createElement("button", {
    title: "Group selection into subgraph (Ctrl+G)",
    onClick: function() { var ab = boardFor(mode); if (ab) ab.groupSel(); }
  }, "\u26F6 Group"), /*#__PURE__*/React.createElement("button", {
    className: "danger",
    title: "Dissolve subgraph(s) of selection (Ctrl+Shift+G)",
    onClick: function() { var ab = boardFor(mode); if (ab) ab.ungroupSel(); }
  }, "\u293F Ungroup"), /*#__PURE__*/React.createElement("button", {
    className: "danger icon-btn",
    title: "Delete selection (Del)",
    onClick: function() { var ab = boardFor(mode); if (ab) ab.deleteSel(); }
  }, "\uD83D\uDDD1")), /*#__PURE__*/React.createElement("span", {
    className: "tb-sep"
  }), /*#__PURE__*/React.createElement("span", {
    className: "tb-group"
  }, /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    title: "Zoom out",
    onClick: function() { var ab = boardFor(mode); if (ab) ab.zoomCenter(1 / 1.22); }
  }, "\u2212"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--muted)',
      minWidth: 42,
      textAlign: 'center'
    }
  }, zoomK, "%"), /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    title: "Zoom in",
    onClick: function() { var ab = boardFor(mode); if (ab) ab.zoomCenter(1.22); }
  }, "+"), /*#__PURE__*/React.createElement("button", {
    title: "Fit to view (F)",
    onClick: function() { var ab = boardFor(mode); if (ab) ab.fitView(); }
  }, "\u2922 Fit")), /*#__PURE__*/React.createElement("span", {
    className: "tb-sep"
  }), /*#__PURE__*/React.createElement("span", {
    className: "tb-group"
  }, /*#__PURE__*/React.createElement("button", {
    className: snapOn ? 'on' : '',
    title: "Snap to 16px grid",
    onClick: toggleSnap
  }, "\u2317 Snap"), /*#__PURE__*/React.createElement("button", {
    title: "Auto-arrange with dagre",
    onClick: function() { var ab = boardFor(mode); if (ab) ab.layoutNow(); }
  }, "\u2728 Auto layout"), /*#__PURE__*/React.createElement(USelect, {
    style: {},
    value: curData ? curData.dir : 'TB',
    options: [{
      value: 'TB',
      label: '↓ Top → Bottom'
    }, {
      value: 'LR',
      label: '→ Left → Right'
    }, {
      value: 'BT',
      label: '↑ Bottom → Top'
    }, {
      value: 'RL',
      label: '← Right → Left'
    }],
    onLive: function(v) { var ab = boardFor(mode); if (ab) ab.changeDir(v); },
    onCommitPre: {
      snap: function() { return JSON.stringify({ mode: mode, data: docsRef.current[mode].data }); },
      push: s => pushUndoPre(s)
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "tb-sep"
  })), /*#__PURE__*/React.createElement("span", {
    className: "tb-group"
  }, /*#__PURE__*/React.createElement("select", {
    value: "",
    title: "Load a template",
    onChange: e => {
      const v = e.target.value;
      e.target.value = '';
      if (v) loadTemplate(v);
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\uD83D\uDCC4 Templates\u2026"), C.MODES[mode].templates.map(t => /*#__PURE__*/React.createElement("option", {
    key: t.key,
    value: t.key
  }, t.name))), /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    title: "Help & shortcuts",
    onClick: () => setHelpOpen(true)
  }, "?"), /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    title: "Toggle code panel (Tab)",
    onClick: toggleFocus
  }, "\u21E5")), /*#__PURE__*/React.createElement("div", {
    className: "spacer"
  }), /*#__PURE__*/React.createElement("div", {
    className: "saveChip"
  }, saveChip)), /*#__PURE__*/React.createElement("div", {
    id: "main"
  }, isCanvas && /*#__PURE__*/React.createElement("aside", {
    className: "palette"
  }, mode === 'flowchart' ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h3", null, "Add node"), /*#__PURE__*/React.createElement("div", {
    className: "pal-grid"
  }, C.SHAPE_ORDER.map(function(key) {
    return /*#__PURE__*/React.createElement("div", {
      key: key,
      className: "pal-tile",
      draggable: true,
      title: C.SHAPES[key].name,
      onDragStart: function(e) {
        e.dataTransfer.setData('text/plain', 'shape:' + key);
      },
      onClick: function() {
        var ab = boardFor(mode);
        if (ab) ab.addShape(key, null);
      }
    }, /*#__PURE__*/React.createElement(PalIcon, {
      shape: key
    }), /*#__PURE__*/React.createElement("span", null, C.SHAPES[key].name));
  })), /*#__PURE__*/React.createElement("h3", null, "Quick tips"), /*#__PURE__*/React.createElement("div", {
    className: "pal-tip"
  }, "Drag a tile in, or click it.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("b", null, "Drag rim dots"), " between nodes to link.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("b", null, "Double-click"), " nodes & arrows to relabel.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("code", null, "Shift"), "+drag canvas = rubber band.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("code", null, "Ctrl+G"), " groups into a subgraph.")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h3", null, "Add " + (C.MODES[mode] && C.MODES[mode].boardCfg && C.MODES[mode].boardCfg.paletteTitle || "entity")), /*#__PURE__*/React.createElement("div", {
    className: "pal-grid"
  }, (C.MODES[mode] && C.MODES[mode].boardCfg && C.MODES[mode].boardCfg.palette || []).map(function(it) {
    return /*#__PURE__*/React.createElement("div", {
      key: it.key,
      className: "pal-tile",
      draggable: true,
      title: it.hint || it.label,
      onDragStart: function(e) {
        e.dataTransfer.setData('text/plain', 'ms-tile:' + mode + ':' + it.key);
      },
      onClick: function() {
        var ab = boardFor(mode);
        if (ab) ab.addTile(it.key, null);
      }
    }, /*#__PURE__*/React.createElement("span", null, it.label));
  })), /*#__PURE__*/React.createElement("h3", null, "Quick tips"), /*#__PURE__*/React.createElement("div", {
    className: "pal-tip"
  }, "Drag a tile in, or click it.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("b", null, "Drag rim dots"), " between entities to relate.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("b", null, "Double-click"), " to edit.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("code", null, "Shift"), "+drag = select.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("code", null, "Ctrl+G"), " groups."))), /*#__PURE__*/React.createElement("div", {
    ref: wrapRef,
    className: "canvas-wrap",
    style: {
      display: isCanvas ? undefined : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: boardHostRef,
    style: {
      position: 'absolute',
      inset: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "stats"
  }, /*#__PURE__*/React.createElement("span", {
    className: "chip"
  }, statsTxt)), !fcNodes && /*#__PURE__*/React.createElement("div", {
    className: "empty-hint"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", null, "Empty canvas."), /*#__PURE__*/React.createElement("br", null), "Drag a shape from the left palette,", /*#__PURE__*/React.createElement("br", null), "or paste Mermaid code on the right \u2192"))), !isCanvas && curData && /*#__PURE__*/React.createElement(ModeShell, {
    mode: mode,
    data: curData,
    api: sheetApi,
    stamp: docStamp
  }), /*#__PURE__*/React.createElement("aside", {
    className: "right-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rp-head"
  }, /*#__PURE__*/React.createElement("span", null, "Mermaid source"), /*#__PURE__*/React.createElement("span", {
    className: "grow"
  }), /*#__PURE__*/React.createElement("button", {
    title: "Normalize formatting",
    onClick: () => {
      const ta = taRef.current;
      const before = ta.value;
      setCodeText(lastGoodRef.current);
      if (lastGoodRef.current !== before) pushToast('formatted');
      clearTimeout(syncTimer.current);
      applyTyped(lastGoodRef.current);
    }
  }, "Format"), /*#__PURE__*/React.createElement("button", {
    title: "Copy source",
    onClick: copySource
  }, "Copy"), /*#__PURE__*/React.createElement("button", {
    title: "Download .mmd file",
    onClick: () => {
      downloadBlob('diagram.mmd', new Blob([lastGoodRef.current], {
        type: 'text/plain'
      }));
      pushToast('.mmd downloaded');
    }
  }, ".mmd"), /*#__PURE__*/React.createElement("button", {
    className: "danger",
    title: "Clear everything",
    onClick: () => {
      pushUndoPre(null);
      const m = modeRef.current;
      const fresh = C.MODES[m].empty();
      if (m === 'flowchart' || window.MSMODES && window.MSMODES[m]) {
        if (m === 'flowchart') {
          fresh.dir = docsRef.current.flowchart.data.dir;
          docsRef.current.flowchart = {
            data: fresh
          };
          var ab = boardFor(m);
          if (ab) {
            ab.clearSelection();
            ab.setModel(fresh);
          }
        } else {
          docsRef.current[m] = {
            data: fresh
          };
          var ab2 = boardFor(m);
          if (ab2) {
            ab2.clearSelection();
            ab2.setModel(fresh);
          }
        }
      } else {
        docsRef.current[m] = {
          data: fresh
        };
      }
      editSrcRef.current = 'ui';
      bumpStamp();
      bump();
      pushToast('cleared — Ctrl+Z to undo');
    }
  }, "Clear")), /*#__PURE__*/React.createElement("textarea", {
    ref: taRef,
    className: "code-ta",
    spellCheck: "false",
    autoCapitalize: "off",
    autoComplete: "off",
    value: codeText,
    onChange: e => {
      setCodeText(e.target.value);
      onTaInput();
    },
    onKeyDown: onTaKey
  }), /*#__PURE__*/React.createElement("div", {
    className: "sync-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: 'sync-chip ' + sync.state
  }, sync.state === 'ok' ? 'synced' : sync.state === 'editing' ? 'editing…' : 'parse error'), /*#__PURE__*/React.createElement("span", {
    className: "warn-chip"
  }, sync.warn), /*#__PURE__*/React.createElement("span", {
    className: "err-chip"
  }, sync.err)), /*#__PURE__*/React.createElement("div", {
    className: "rp-head"
  }, /*#__PURE__*/React.createElement("span", null, isFc ? 'Live render' : 'Official render', statsTxt ? '' : ''), /*#__PURE__*/React.createElement("span", {
    className: "grow"
  }), /*#__PURE__*/React.createElement("button", {
    title: "Download SVG",
    onClick: exportSvg
  }, "\u2B07 SVG"), /*#__PURE__*/React.createElement("button", {
    title: "Download PNG",
    onClick: exportPng
  }, "\u2B07 PNG")), /*#__PURE__*/React.createElement("div", {
    className: "preview"
  }, pvErr ? /*#__PURE__*/React.createElement("div", {
    className: "preview-msg err"
  }, pvErr) : pvHtml ? /*#__PURE__*/React.createElement("div", {
    dangerouslySetInnerHTML: {
      __html: pvHtml
    }
  }) : /*#__PURE__*/React.createElement("div", {
    className: "preview-msg"
  }, "rendering\u2026")))), /*#__PURE__*/React.createElement("div", {
    className: "toasts"
  }, toasts.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    className: 'toast' + (t.type ? ' ' + t.type : '')
  }, t.msg))), helpOpen && /*#__PURE__*/React.createElement("div", {
    className: "help-modal",
    onClick: e => {
      if (e.target === e.currentTarget) setHelpOpen(false);
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "help-card"
  }, /*#__PURE__*/React.createElement("button", {
    className: "help-close",
    onClick: () => setHelpOpen(false)
  }, "\u2715 Close"), /*#__PURE__*/React.createElement("h2", null, "\uD83E\uDDDC Mermaid Studio"), /*#__PURE__*/React.createElement("div", {
    className: "hsub"
  }, "Eight diagram modes, each perfectly in sync between a visual editor and Mermaid text \u2014 edit either side, both stay true."), /*#__PURE__*/React.createElement("div", {
    className: "help-cols"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", null, "Modes"), /*#__PURE__*/React.createElement("ul", {
    className: "syn"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "\uD83E\uDEA2 Graph"), " \u2014 drag-and-drop flowchart canvas (all shapes, subgraphs, colours)"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "\uD83D\uDCAC Sequence"), " \u2014 participants & message rows, notes, dividers, activations"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "\uD83D\uDCCA Gantt"), " \u2014 sections & task bars with dates, durations, \u201Cafter\u201D chains, milestones"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "\uD83E\uDD67 Pie"), " \u2014 labelled slices with values"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "\uD83C\uDFDB Class"), " \u2014 classes, relations, namespaces, notes"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "\uD83D\uDDC4 ER"), " \u2014 entities, attributes, cardinalities"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "\u2699\uFE0F State"), " \u2014 states, transitions, composites, notes"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "\uD83E\uDDED Journey"), " \u2014 sections, tasks scored 1-5 with actors")), /*#__PURE__*/React.createElement("h4", null, "Graph canvas"), /*#__PURE__*/React.createElement("table", {
    className: "keys"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("kbd", null, "drag"), " node"), /*#__PURE__*/React.createElement("td", null, "move (snaps when enabled)")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("kbd", null, "drag"), " rim dot"), /*#__PURE__*/React.createElement("td", null, "draw an edge")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("kbd", null, "dbl-click")), /*#__PURE__*/React.createElement("td", null, "relabel node / edge / group")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("kbd", null, "Shift"), "+drag empty"), /*#__PURE__*/React.createElement("td", null, "rubber-band select")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("kbd", null, "Space"), "+drag \xB7 wheel"), /*#__PURE__*/React.createElement("td", null, "pan \xB7 zoom"))), /*#__PURE__*/React.createElement("h4", null, "Everywhere"), /*#__PURE__*/React.createElement("table", {
    className: "keys"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("kbd", null, "Ctrl"), /*#__PURE__*/React.createElement("kbd", null, "Z"), " / ", /*#__PURE__*/React.createElement("kbd", null, "Y")), /*#__PURE__*/React.createElement("td", null, "undo / redo")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("kbd", null, "Ctrl"), /*#__PURE__*/React.createElement("kbd", null, "D"), " ", /*#__PURE__*/React.createElement("kbd", null, "A"), " ", /*#__PURE__*/React.createElement("kbd", null, "G")), /*#__PURE__*/React.createElement("td", null, "duplicate \xB7 select all \xB7 group")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("kbd", null, "Del")), /*#__PURE__*/React.createElement("td", null, "delete selection")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("kbd", null, "F")), /*#__PURE__*/React.createElement("td", null, "fit graph view")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("kbd", null, "Tab")), /*#__PURE__*/React.createElement("td", null, "toggle code panel")))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", null, "Two-way sync, how it works"), /*#__PURE__*/React.createElement("ul", {
    className: "syn"
  }, /*#__PURE__*/React.createElement("li", null, "Visual edits rewrite the source instantly."), /*#__PURE__*/React.createElement("li", null, "Typing in the source re-parses after a short pause and updates the visual side."), /*#__PURE__*/React.createElement("li", null, "Each mode keeps its own document \u2014 switching tabs never loses work. Undo history works across modes too."), /*#__PURE__*/React.createElement("li", null, "In Graph mode positions are remembered by node id; newcomers arrive near their neighbours and \u2728 Auto layout re-arranges cleanly.")), /*#__PURE__*/React.createElement("h4", null, "Supported syntax"), /*#__PURE__*/React.createElement("ul", {
    className: "syn"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("code", null, "flowchart TB|LR|BT|RL"), ", all node shapes, ", /*#__PURE__*/React.createElement("code", null, "-->"), " ", /*#__PURE__*/React.createElement("code", null, "---"), " ", /*#__PURE__*/React.createElement("code", null, "-.->"), " ", /*#__PURE__*/React.createElement("code", null, "==>"), " with ", /*#__PURE__*/React.createElement("code", null, "|labels|"), ", ", /*#__PURE__*/React.createElement("code", null, "&"), " chaining, ", /*#__PURE__*/React.createElement("code", null, "subgraph"), ", ", /*#__PURE__*/React.createElement("code", null, "classDef/class/style")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("code", null, "sequenceDiagram"), ": participant/actor, all eight arrows, ", /*#__PURE__*/React.createElement("code", null, "Note over/left/right"), ", activate/deactivate, autonumber"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("code", null, "gantt"), ": sections, tasks with ", /*#__PURE__*/React.createElement("code", null, "done/active/crit/milestone"), ", aliases, dates or ", /*#__PURE__*/React.createElement("code", null, "after"), " deps, durations, dateFormat/axisFormat/excludes"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("code", null, "pie"), ": quoted labels, values, showData, title"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("code", null, "classDiagram"), " — classes, members, relations, namespaces, notes, direction"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("code", null, "erDiagram"), " — entities, attributes, identifying/non-identifying relations"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("code", null, "stateDiagram-v2"), " — states, transitions, composites, choice/fork/join, notes"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("code", null, "journey"), " — sections, tasks “task” : score : actors, title")), /*#__PURE__*/React.createElement("div", {
    className: "muted-note"
  }, "Gracefully ignored on import: linkStyle/click, nested subgraphs (flattened), loop/alt blocks. Everything exports back as clean canonical Mermaid. Work autosaves to this browser."))))));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));