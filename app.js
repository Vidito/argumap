// State & History Management
const PRESETS = {
  'preset-1': {
    title: 'Preset: Library hours',
    text: 'The university should keep the library open until midnight during exam weeks. Many students need a quiet place to study after the evening classes end. Extending the hours would also make better use of the library’s existing staff and facilities.',
  },
  'preset-2': {
    title: 'Preset: Electric vehicles',
    text: 'Cities ought to subsidize residential electric vehicle charging stations. Access to home charging significantly accelerates clean vehicle adoption. Moreover, widespread private charging reduces strain on public fast-charging corridors.',
  },
  'preset-3': {
    title: 'Preset: Remote work',
    text: 'Companies should permanently maintain flexible remote-work policies. Offering remote options broadens the talent pool across regional boundaries. Flexible scheduling also measurably reduces commute-related carbon emissions.',
  },
};

const SCHEME_DETAILS = {
  Causal: {
    title: 'Causal Argument Scheme',
    description: 'Argues that because event or action X leads to consequence Y, action X is desirable (or vice versa).',
    questions: [
      'Does the stated action really lead to the proposed effect?',
      'Are there plausible negative side-effects that outweigh the advantage?',
      'Could the desired result be achieved more effectively through other means?',
    ],
  },
  Analogy: {
    title: 'Analogy Argument Scheme',
    description: 'Argues that because case A resembles case B in relevant respects, what holds true for B also holds true for A.',
    questions: [
      'Are cases A and B truly comparable in crucial, relevant respects?',
      'Are there significant differences between the cases that invalidate the comparison?',
      'Is there another comparable case that points to a contrary conclusion?',
    ],
  },
  Example: {
    title: 'Example / Sign Scheme',
    description: 'Argues that one or more representative instances justify a general rule or symptomatic claim.',
    questions: [
      'Is the given example representative of the broader class or situation?',
      'Are there counter-examples showing that this instance is atypical?',
      'Is the sample size sufficient to warrant the generalization?',
    ],
  },
};

// Elements
const sourceTextEl = document.getElementById('source-text');
const sourceEditWrap = document.getElementById('source-edit-wrap');
const sourceEditInput = document.getElementById('source-edit-input');
const editTextBtn = document.getElementById('edit-text-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const saveEditBtn = document.getElementById('save-edit-btn');
const presetSelect = document.getElementById('preset-select');

const selectionMenu = document.getElementById('selection-menu');
const canvas = document.getElementById('canvas');
const nodesLayer = document.getElementById('nodes');
const connectionsSvg = document.getElementById('connections');
const emptyState = document.getElementById('empty-state');
const connectionPopover = document.getElementById('connection-popover');
const feedback = document.getElementById('feedback');
const premiseDialog = document.getElementById('premise-dialog');
const premiseForm = document.getElementById('premise-form');
const premiseButton = document.getElementById('premise-button');
const addStatementBtn = document.getElementById('add-statement-btn');

const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const tidyBtn = document.getElementById('tidy-btn');
const exportBtn = document.getElementById('export-btn');
const exportMenu = document.getElementById('export-menu');
const exportPngBtn = document.getElementById('export-png-btn');
const exportJsonBtn = document.getElementById('export-json-btn');
const importJsonBtn = document.getElementById('import-json-btn');
const importFileInput = document.getElementById('import-file-input');
const copySummaryBtn = document.getElementById('copy-summary-btn');

const schemeInfoPopover = document.getElementById('scheme-info-popover');
const schemeInfoTitle = document.getElementById('scheme-info-title');
const schemeInfoDesc = document.getElementById('scheme-info-desc');
const schemeInfoList = document.getElementById('scheme-info-list');
const closeSchemeInfo = document.getElementById('close-scheme-info');

// App State
let nodes = [];
let edges = [];
let groups = [];
let selectedText = '';
let selectedNodeId = null;
let editingNodeId = null;
let pendingSourceId = null;
let pendingTargetId = null;
let pendingSourceSide = null;
let pendingTargetSide = null;
let selectedEdgeIndex = null;
let selectedGroupId = null;
let dragState = null;

// History Stack for Undo/Redo
let historyStack = [];
let historyIndex = -1;
let isApplyingHistory = false;

function saveHistoryState() {
  if (isApplyingHistory) return;
  const snapshot = {
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges)),
    groups: JSON.parse(JSON.stringify(groups)),
    selectedNodeId,
  };
  // Trim redo branch
  historyStack = historyStack.slice(0, historyIndex + 1);
  historyStack.push(snapshot);
  if (historyStack.length > 50) historyStack.shift();
  historyIndex = historyStack.length - 1;
  updateHistoryButtons();
}

function updateHistoryButtons() {
  undoBtn.disabled = historyIndex <= 0;
  redoBtn.disabled = historyIndex >= historyStack.length - 1;
}

function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    applyHistoryState(historyStack[historyIndex]);
  }
}

function redo() {
  if (historyIndex < historyStack.length - 1) {
    historyIndex++;
    applyHistoryState(historyStack[historyIndex]);
  }
}

function applyHistoryState(state) {
  isApplyingHistory = true;
  nodes = JSON.parse(JSON.stringify(state.nodes));
  edges = JSON.parse(JSON.stringify(state.edges));
  groups = JSON.parse(JSON.stringify(state.groups));
  selectedNodeId = state.selectedNodeId;
  editingNodeId = null;
  selectedEdgeIndex = null;
  selectedGroupId = null;
  isApplyingHistory = false;
  updateHistoryButtons();
  render();
}

// Toast notification
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

// Discourse custom / preset handling
function initDiscourse() {
  presetSelect.addEventListener('change', () => {
    const val = presetSelect.value;
    if (PRESETS[val]) {
      sourceTextEl.textContent = PRESETS[val].text;
      sourceTextEl.hidden = false;
      sourceEditWrap.hidden = true;
    } else if (val === 'custom') {
      openDiscourseEditor();
    }
  });

  editTextBtn.addEventListener('click', () => {
    openDiscourseEditor();
  });

  cancelEditBtn.addEventListener('click', () => {
    sourceTextEl.hidden = false;
    sourceEditWrap.hidden = true;
  });

  saveEditBtn.addEventListener('click', () => {
    const newText = sourceEditInput.value.trim();
    if (newText) {
      sourceTextEl.textContent = newText;
      presetSelect.value = 'custom';
    }
    sourceTextEl.hidden = false;
    sourceEditWrap.hidden = true;
  });
}

function openDiscourseEditor() {
  sourceEditInput.value = sourceTextEl.textContent.trim();
  sourceTextEl.hidden = true;
  sourceEditWrap.hidden = false;
  sourceEditInput.focus();
}

// Rendering
function render() {
  nodesLayer.innerHTML = '';
  nodes.forEach((node) => {
    const element = document.createElement('article');
    const label =
      node.type === 'standpoint'
        ? 'standpoint'
        : node.type === 'unexpressed'
          ? 'unexpressed premise'
          : 'expressed premise';
    element.className = `node ${node.type === 'standpoint' ? 'standpoint' : ''} ${node.type === 'unexpressed' ? 'unexpressed' : ''} ${selectedNodeId === node.id ? 'selected' : ''}`;
    element.dataset.nodeId = node.id;
    element.style.left = `${node.x}px`;
    element.style.top = `${node.y}px`;

    const isEditing = editingNodeId === node.id;

    const schemeInfoBtn = node.scheme
      ? `<button class="scheme-info-trigger" data-scheme="${escapeHtml(node.scheme)}" title="View critical questions" aria-label="Critical questions for ${escapeHtml(node.scheme)}">?</button>`
      : '';

    const schemeControl =
      selectedNodeId === node.id
        ? `<select class="scheme-select" aria-label="Argument scheme for ${escapeHtml(node.number)}">
            <option value="" ${!node.scheme ? 'selected' : ''}>Scheme</option>
            <option value="Causal" ${node.scheme === 'Causal' ? 'selected' : ''}>Causal</option>
            <option value="Analogy" ${node.scheme === 'Analogy' ? 'selected' : ''}>Analogy</option>
            <option value="Example" ${node.scheme === 'Example' ? 'selected' : ''}>Example</option>
          </select>${schemeInfoBtn}`
        : node.scheme
          ? `<span class="scheme-pill">${escapeHtml(node.scheme)}</span>${schemeInfoBtn}`
          : '';

    const bodyContent = isEditing
      ? `<textarea class="node-edit-textarea" aria-label="Edit node text">${escapeHtml(node.text)}</textarea>`
      : `<p class="node-text">${escapeHtml(node.text)}</p>`;

    element.innerHTML = `
      <button class="delete-node" type="button" aria-label="Delete ${escapeHtml(node.number)}">×</button>
      <span class="node-number">${escapeHtml(node.number)}</span>
      <div class="node-body">
        <span class="node-type">${label}</span>
        ${bodyContent}
      </div>
      <div class="scheme-control">${schemeControl}</div>
      <span class="node-port port-top" data-side="top" title="Connect from the top"></span>
      <span class="node-port port-right" data-side="right" title="Connect from the right"></span>
      <span class="node-port port-bottom" data-side="bottom" title="Connect from the bottom"></span>
      <span class="node-port port-left" data-side="left" title="Connect from the left"></span>
    `;

    // Event listeners on node
    element.addEventListener('pointerdown', startNodeDrag);
    element.addEventListener('click', () => selectNode(node.id));

    // Double-click inline text editing
    element.addEventListener('dblclick', (event) => {
      if (
        event.target.classList.contains('delete-node') ||
        event.target.classList.contains('node-port') ||
        event.target.classList.contains('scheme-select') ||
        event.target.classList.contains('scheme-info-trigger')
      )
        return;
      startInlineEdit(node.id);
    });

    if (isEditing) {
      const textarea = element.querySelector('.node-edit-textarea');
      if (textarea) {
        setTimeout(() => {
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
        }, 0);
        textarea.addEventListener('pointerdown', (e) => e.stopPropagation());
        textarea.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            commitInlineEdit(node.id, textarea.value);
          } else if (e.key === 'Escape') {
            editingNodeId = null;
            render();
          }
        });
        textarea.addEventListener('blur', () => {
          commitInlineEdit(node.id, textarea.value);
        });
      }
    }

    element
      .querySelectorAll('.node-port')
      .forEach((port) => port.addEventListener('pointerdown', startConnection));

    element.querySelector('.delete-node').addEventListener('click', (event) => {
      event.stopPropagation();
      deleteNode(node.id);
    });

    element.querySelector('.scheme-select')?.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });
    element.querySelector('.scheme-select')?.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    element.querySelector('.scheme-select')?.addEventListener('change', (event) => {
      node.scheme = event.target.value;
      saveHistoryState();
      render();
    });

    element.querySelectorAll('.scheme-info-trigger').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        openSchemeInfo(btn.dataset.scheme, btn);
      });
    });

    nodesLayer.appendChild(element);
  });

  emptyState.hidden = nodes.length > 0;
  premiseButton.disabled = !getSelectedExpressedNode();
  drawConnections();
}

function startInlineEdit(nodeId) {
  editingNodeId = nodeId;
  render();
}

function commitInlineEdit(nodeId, newText) {
  const node = getNode(nodeId);
  editingNodeId = null;
  if (node && newText.trim() && newText.trim() !== node.text) {
    node.text = newText.trim();
    saveHistoryState();
  }
  render();
}

function escapeHtml(value) {
  if (!value) return '';
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[char],
  );
}

function getNode(id) {
  return nodes.find((node) => node.id === id);
}

function getSelectedExpressedNode() {
  const node = getNode(selectedNodeId);
  return node && (node.type === 'expressed' || node.type === 'coordinative')
    ? node
    : null;
}

function selectNode(id) {
  if (selectedNodeId === id) return;
  selectedNodeId = id;
  render();
}

function startNodeDrag(event) {
  if (
    event.target.classList.contains('node-port') ||
    event.target.classList.contains('delete-node') ||
    event.target.classList.contains('scheme-select') ||
    event.target.classList.contains('scheme-info-trigger') ||
    event.target.classList.contains('node-edit-textarea')
  )
    return;
  const node = getNode(event.currentTarget.dataset.nodeId);
  if (!node) return;
  const bounds = canvas.getBoundingClientRect();
  dragState = {
    node,
    startX: node.x,
    startY: node.y,
    offsetX: event.clientX - bounds.left - node.x,
    offsetY: event.clientY - bounds.top - node.y,
    moved: false,
  };
  selectedNodeId = node.id;
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.addEventListener('pointermove', moveNode);
  event.currentTarget.addEventListener('pointerup', stopNodeDrag, {
    once: true,
  });
}

function moveNode(event) {
  if (!dragState) return;
  dragState.moved = true;
  const bounds = canvas.getBoundingClientRect();
  dragState.node.x = Math.max(
    8,
    Math.min(
      canvas.clientWidth - 205,
      event.clientX - bounds.left - dragState.offsetX,
    ),
  );
  dragState.node.y = Math.max(
    8,
    Math.min(
      canvas.clientHeight - 85,
      event.clientY - bounds.top - dragState.offsetY,
    ),
  );
  const element = nodesLayer.querySelector(
    `[data-node-id="${dragState.node.id}"]`,
  );
  if (element) {
    element.style.left = `${dragState.node.x}px`;
    element.style.top = `${dragState.node.y}px`;
  }
  drawConnections();
}

function stopNodeDrag(event) {
  event.currentTarget.removeEventListener('pointermove', moveNode);
  if (
    dragState &&
    (dragState.node.x !== dragState.startX ||
      dragState.node.y !== dragState.startY)
  ) {
    saveHistoryState();
  }
  const wasMoved = dragState && dragState.moved;
  dragState = null;
  if (!wasMoved) {
    render();
  }
}

function startConnection(event) {
  event.stopPropagation();
  const sourceElement = event.currentTarget.closest('.node');
  pendingSourceId = sourceElement.dataset.nodeId;
  pendingSourceSide = event.currentTarget.dataset.side;
  pendingTargetId = null;
  pendingTargetSide = null;
  const bounds = canvas.getBoundingClientRect();

  const move = (moveEvent) => {
    const hovered = document
      .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
      ?.closest('.node');
    document
      .querySelectorAll('.drop-target')
      .forEach((item) => item.classList.remove('drop-target'));
    if (hovered && hovered.dataset.nodeId !== pendingSourceId) {
      pendingTargetId = hovered.dataset.nodeId;
      pendingTargetSide = nearestSide(
        hovered,
        moveEvent.clientX,
        moveEvent.clientY,
      );
      hovered.classList.add('drop-target');
    }
  };

  const finish = (upEvent) => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', finish);
    document
      .querySelectorAll('.drop-target')
      .forEach((item) => item.classList.remove('drop-target'));
    const hovered = document
      .elementFromPoint(upEvent.clientX, upEvent.clientY)
      ?.closest('.node');
    if (hovered && hovered.dataset.nodeId !== pendingSourceId) {
      pendingTargetId = hovered.dataset.nodeId;
      pendingTargetSide = nearestSide(
        hovered,
        upEvent.clientX,
        upEvent.clientY,
      );
      showConnectionPopover(
        upEvent.clientX - bounds.left,
        upEvent.clientY - bounds.top,
      );
    } else {
      clearPendingConnection();
    }
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', finish);
}

function clearPendingConnection() {
  pendingSourceId =
    pendingTargetId =
    pendingSourceSide =
    pendingTargetSide =
      null;
}

function showConnectionPopover(x, y) {
  connectionPopover.style.left = `${Math.min(canvas.clientWidth - 200, Math.max(10, x))}px`;
  connectionPopover.style.top = `${Math.min(canvas.clientHeight - 130, Math.max(10, y))}px`;
  connectionPopover.hidden = false;
}

function addConnection(relationship) {
  if (
    !pendingSourceId ||
    !pendingTargetId ||
    pendingSourceId === pendingTargetId
  )
    return;
  const source = getNode(pendingSourceId);
  const target = getNode(pendingTargetId);
  if (
    !source ||
    !target ||
    source.type === 'unexpressed' ||
    target.type === 'unexpressed' ||
    source.type === 'standpoint'
  ) {
    clearPendingConnection();
    connectionPopover.hidden = true;
    return;
  }

  if (relationship === 'coordinative') {
    addToCoordinativeGroup(source, target);
  } else {
    edges.push({
      source: source.id,
      target: target.id,
      relationship,
      sourceSide: pendingSourceSide,
      targetSide: pendingTargetSide || 'top',
    });
    renumberTarget(target.id);
  }
  clearPendingConnection();
  connectionPopover.hidden = true;
  saveHistoryState();
  render();
}

function addToCoordinativeGroup(source, target) {
  let group = groups.find(
    (candidate) =>
      candidate.kind === 'coordinative' && candidate.target === target.id,
  );
  if (!group) {
    group = {
      id: `group-${Date.now()}`,
      kind: 'coordinative',
      target: target.id,
      memberIds: [],
    };
    groups.push(group);
  }
  if (!group.memberIds.includes(source.id)) group.memberIds.push(source.id);
  edges = edges.filter(
    (edge) =>
      !(edge.target === target.id && group.memberIds.includes(edge.source)),
  );
  group.memberIds.forEach((memberId, index) => {
    const member = getNode(memberId);
    if (!member) return;
    member.type = 'coordinative';
    member.number = `${target.number}.1${String.fromCharCode(97 + index)}`;
    if (memberId === source.id) {
      member.x = Math.max(20, target.x - 240 - index * 205);
      member.y = Math.max(20, target.y + 130);
    }
  });
}

function addUnexpressedPremise() {
  const expressed = getSelectedExpressedNode();
  if (!expressed) return;
  premiseDialog.hidden = false;
  premiseForm.dataset.expressedId = expressed.id;
  premiseForm.querySelector('[data-step="1"]').hidden = false;
  premiseForm.querySelector('[data-step="2"]').hidden = true;
  document.getElementById('logical-minimum').value = '';
  document.getElementById('pragmatic-optimum').value = '';
  document.getElementById('logical-minimum').focus();
}

function submitPremise() {
  const expressed = getNode(premiseForm.dataset.expressedId);
  const optimum = document.getElementById('pragmatic-optimum').value.trim();
  if (!expressed || !optimum) return;
  const number = `(${expressed.number}′)`;
  const premise = {
    id: `premise-${Date.now()}`,
    number,
    type: 'unexpressed',
    text: optimum,
    scheme: '',
    x: Math.min(canvas.clientWidth - 205, expressed.x + 215),
    y: expressed.y,
  };
  nodes.push(premise);

  const existingEdge = edges.find((edge) => edge.source === expressed.id);
  const containingGroup = groups.find(
    (group) =>
      group.kind === 'coordinative' && group.memberIds.includes(expressed.id),
  );
  if (containingGroup) {
    containingGroup.premises ??= {};
    containingGroup.premises[expressed.id] = premise.id;
    layoutCoordinativeGroup(containingGroup);
  } else {
    const targetId = existingEdge?.target || null;
    let group = groups.find(
      (candidate) =>
        candidate.kind === 'elementary' &&
        candidate.target === targetId &&
        candidate.memberIds.includes(expressed.id),
    );
    if (!group) {
      group = {
        id: `group-${Date.now()}`,
        kind: 'elementary',
        target: targetId,
        memberIds: [expressed.id],
      };
      groups.push(group);
    }
    group.memberIds.push(premise.id);
    layoutElementaryGroup(group);
  }

  function layoutElementaryGroup(g) {
    const expr = getNode(
      g.memberIds.find((id) => getNode(id)?.type !== 'unexpressed'),
    );
    const prem = getNode(
      g.memberIds.find((id) => getNode(id)?.type === 'unexpressed'),
    );
    if (!expr || !prem) return;
    prem.x = Math.min(canvas.clientWidth - 205, expr.x + 215);
    prem.y = expr.y;
  }

  function layoutCoordinativeGroup(g) {
    const target = getNode(g.target);
    if (!target) return;
    const spacing = 215;
    const startX = Math.max(
      15,
      target.x + 95 - ((g.memberIds.length - 1) * spacing + 190) / 2,
    );
    g.memberIds.forEach((memberId, index) => {
      const member = getNode(memberId);
      if (!member) return;
      member.x = Math.min(canvas.clientWidth - 205, startX + index * spacing);
      member.y = Math.min(canvas.clientHeight - 180, target.y + 170);
      const premiseId = g.premises?.[memberId];
      const p = premiseId ? getNode(premiseId) : null;
      if (p) {
        p.x = Math.min(canvas.clientWidth - 205, member.x + 205);
        p.y = member.y;
      }
    });
  }

  premiseDialog.hidden = true;
  premiseForm.reset();
  saveHistoryState();
  render();
}

function renumberTarget(targetId) {
  const target = getNode(targetId);
  if (!target) return;
  const independent = edges.filter(
    (edge) => edge.target === targetId && edge.relationship === 'multiple',
  );
  independent.forEach((edge, index) => {
    const node = getNode(edge.source);
    if (node) node.number = `${target.number}.${index + 1}`;
  });
  edges
    .filter((edge) => edge.target === targetId && edge.relationship === 'sub')
    .forEach((edge) => {
      const node = getNode(edge.source);
      if (node) node.number = `${target.number}.1`;
    });
  groups
    .filter(
      (group) => group.target === targetId && group.kind === 'coordinative',
    )
    .forEach((group) => {
      group.memberIds.forEach((memberId, index) => {
        const node = getNode(memberId);
        if (node)
          node.number = `${target.number}.1${String.fromCharCode(97 + index)}`;
      });
    });
}

function deleteNode(nodeId) {
  nodes = nodes.filter((node) => node.id !== nodeId);
  edges = edges.filter(
    (edge) => edge.source !== nodeId && edge.target !== nodeId,
  );
  groups = groups.filter((group) => {
    group.memberIds = group.memberIds.filter((memberId) => memberId !== nodeId);
    return group.target !== nodeId && group.memberIds.length > 0;
  });
  if (selectedNodeId === nodeId) selectedNodeId = null;
  if (editingNodeId === nodeId) editingNodeId = null;
  selectedEdgeIndex = null;
  connectionPopover.hidden = true;
  saveHistoryState();
  render();
}

function nearestSide(element, clientX, clientY) {
  const rect = element.getBoundingClientRect();
  const distances = {
    top: Math.abs(clientY - rect.top),
    right: Math.abs(clientX - rect.right),
    bottom: Math.abs(clientY - rect.bottom),
    left: Math.abs(clientX - rect.left),
  };
  return Object.keys(distances).reduce(
    (nearest, side) => (distances[side] < distances[nearest] ? side : nearest),
    'top',
  );
}

function connectionPoint(node, element, side) {
  const width = element.offsetWidth || 190;
  const height = element.offsetHeight || 72;
  const centerX = node.x + width / 2;
  const centerY = node.y + height / 2;
  if (side === 'top') return { x: centerX, y: node.y };
  if (side === 'right') return { x: node.x + width, y: centerY };
  if (side === 'bottom') return { x: centerX, y: node.y + height };
  return { x: node.x, y: centerY };
}

function drawConnections() {
  connectionsSvg
    .querySelectorAll('.connection-line, .group-link, .group-ampersand')
    .forEach((element) => element.remove());
  edges.forEach((edge, index) => drawEdge(edge, index));
  groups.forEach(drawGroup);
}

function drawEdge(edge, index) {
  const source = getNode(edge.source);
  const target = getNode(edge.target);
  const sourceEl = nodesLayer.querySelector(`[data-node-id="${edge.source}"]`);
  const targetEl = nodesLayer.querySelector(`[data-node-id="${edge.target}"]`);
  if (!source || !target || !sourceEl || !targetEl) return;
  const elementaryPair = groups.some(
    (group) =>
      group.kind === 'elementary' &&
      group.memberIds.includes(source.id) &&
      group.memberIds.some(
        (memberId) => getNode(memberId)?.type === 'unexpressed',
      ),
  );
  const from = connectionPoint(
    source,
    sourceEl,
    elementaryPair ? 'top' : edge.sourceSide || sideTowards(source, target),
  );
  const to = connectionPoint(
    target,
    targetEl,
    edge.targetSide || sideTowards(target, source),
  );
  const path = createLine(from, to, 'connection-line');
  path.dataset.edgeIndex = String(index);
  path.addEventListener('click', (event) => {
    event.stopPropagation();
    selectedEdgeIndex = index;
    connectionsSvg
      .querySelectorAll('.connection-line')
      .forEach((line) => line.classList.remove('selected'));
    path.classList.add('selected');
  });
  connectionsSvg.appendChild(path);
}

function drawGroup(group) {
  const target = getNode(group.target);
  const targetEl = nodesLayer.querySelector(`[data-node-id="${group.target}"]`);
  const members = group.memberIds.map(getNode).filter(Boolean);
  if (members.length < 2) return;
  const memberElements = members.map((member) =>
    nodesLayer.querySelector(`[data-node-id="${member.id}"]`),
  );
  if (group.kind === 'elementary') {
    const expressed = members.find((member) => member.type !== 'unexpressed');
    const premise = members.find((member) => member.type === 'unexpressed');
    const expressedElement =
      expressed && nodesLayer.querySelector(`[data-node-id="${expressed.id}"]`);
    const premiseElement =
      premise && nodesLayer.querySelector(`[data-node-id="${premise.id}"]`);
    if (expressed && premise && expressedElement && premiseElement) {
      const internalLine = createLine(
        connectionPoint(
          premise,
          premiseElement,
          sideTowards(premise, expressed),
        ),
        connectionPoint(
          expressed,
          expressedElement,
          sideTowards(expressed, premise),
        ),
        'group-link',
      );
      connectionsSvg.appendChild(internalLine);
      const ampersand = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'text',
      );
      ampersand.setAttribute('x', (expressed.x + premise.x) / 2 + 92);
      ampersand.setAttribute('y', expressed.y + 42);
      ampersand.setAttribute('class', 'group-ampersand');
      ampersand.textContent = '&';
      connectionsSvg.appendChild(ampersand);
    }
    return;
  }
  if (!target || !targetEl) return;
  const componentCenters = members.map((member, index) => {
    const premiseId = group.premises?.[member.id];
    const premise = premiseId ? getNode(premiseId) : null;
    const premiseElement = premise
      ? nodesLayer.querySelector(`[data-node-id="${premise.id}"]`)
      : null;
    if (premise && premiseElement) {
      const pairLine = createLine(
        connectionPoint(
          member,
          memberElements[index],
          sideTowards(member, premise),
        ),
        connectionPoint(premise, premiseElement, sideTowards(premise, member)),
        'group-link',
      );
      connectionsSvg.appendChild(pairLine);
      const ampersand = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'text',
      );
      ampersand.setAttribute('x', (member.x + premise.x) / 2 + 88);
      ampersand.setAttribute('y', (member.y + premise.y) / 2 + 42);
      ampersand.setAttribute('class', 'group-ampersand');
      ampersand.textContent = '&';
      connectionsSvg.appendChild(ampersand);
      return connectionPoint(member, memberElements[index], 'top');
    }
    return connectionPoint(member, memberElements[index], 'top');
  });
  const averageX =
    componentCenters.reduce((sum, point) => sum + point.x, 0) /
    componentCenters.length;
  const componentTop = Math.min(...componentCenters.map((point) => point.y));
  const groupLineY = Math.max(16, componentTop - 34);
  const groupStartX = Math.min(...componentCenters.map((point) => point.x));
  const groupEndX = Math.max(...componentCenters.map((point) => point.x));
  const junction = { x: averageX, y: groupLineY };

  componentCenters.forEach((point) => {
    connectionsSvg.appendChild(
      createLine(
        { x: point.x, y: point.y },
        { x: point.x, y: groupLineY },
        'group-link',
      ),
    );
  });
  connectionsSvg.appendChild(
    createLine(
      { x: groupStartX, y: groupLineY },
      { x: groupEndX, y: groupLineY },
      'group-link',
    ),
  );

  const targetPoint = connectionPoint(
    target,
    targetEl,
    sideTowardsPoint(target, junction),
  );
  const sharedArrow = createLine(junction, targetPoint, 'connection-line');
  sharedArrow.dataset.groupId = group.id;
  sharedArrow.addEventListener('click', (event) => {
    event.stopPropagation();
    selectedGroupId = group.id;
    connectionsSvg
      .querySelectorAll('.connection-line')
      .forEach((line) => line.classList.remove('selected'));
    sharedArrow.classList.add('selected');
  });
  connectionsSvg.appendChild(sharedArrow);
}

function createLine(from, to, className) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', from.x);
  line.setAttribute('y1', from.y);
  line.setAttribute('x2', to.x);
  line.setAttribute('y2', to.y);
  line.classList.add(className);
  return line;
}

function sideTowards(node, other) {
  return sideTowardsPoint(node, { x: other.x + 95, y: other.y + 36 });
}

function sideTowardsPoint(node, point) {
  const center = { x: node.x + 95, y: node.y + 36 };
  return Math.abs(point.x - center.x) >= Math.abs(point.y - center.y)
    ? point.x >= center.x
      ? 'right'
      : 'left'
    : point.y >= center.y
      ? 'bottom'
      : 'top';
}

// Auto-layout / Tidy Canvas
function tidyLayout() {
  if (nodes.length === 0) return;
  const canvasW = canvas.clientWidth || 600;

  const standpoints = nodes.filter((n) => n.type === 'standpoint');
  const others = nodes.filter((n) => n.type !== 'standpoint');

  // Place standpoints at the top
  const spCount = standpoints.length || 1;
  const spSpacing = 220;
  const startSpX = Math.max(20, (canvasW - (spCount * spSpacing - 30)) / 2);
  standpoints.forEach((sp, i) => {
    sp.x = startSpX + i * spSpacing;
    sp.y = 35;
  });

  // Organize arguments by levels
  // Group coordinative members together, elementary pairs side-by-side
  const expressedNodes = others.filter((n) => n.type === 'expressed' || n.type === 'coordinative');
  const level1Y = 230;

  let currentX = Math.max(20, (canvasW - (expressedNodes.length * 220 - 30)) / 2);
  expressedNodes.forEach((node) => {
    node.x = currentX;
    node.y = level1Y;

    // Check if it has an unexpressed premise paired with it
    const group = groups.find(
      (g) => g.kind === 'elementary' && g.memberIds.includes(node.id)
    );
    if (group) {
      const premiseId = group.memberIds.find((id) => id !== node.id);
      const premise = getNode(premiseId);
      if (premise) {
        premise.x = Math.min(canvasW - 205, node.x + 215);
        premise.y = level1Y;
        currentX += 215;
      }
    }
    currentX += 220;
  });

  saveHistoryState();
  render();
  showToast('Map neatly arranged');
}

// Validation
function addFeedbackIssue(issues, message) {
  if (!issues.includes(message)) issues.push(message);
}

function validateAnalysis() {
  const issues = [];
  const independentByTarget = new Map();
  edges
    .filter((edge) => edge.relationship === 'multiple')
    .forEach((edge) => {
      const siblings = independentByTarget.get(edge.target) || [];
      siblings.push(edge);
      independentByTarget.set(edge.target, siblings);
    });
  independentByTarget.forEach((siblings, targetId) => {
    const target = getNode(targetId);
    siblings.forEach((edge, index) => {
      if (getNode(edge.source)?.number !== `${target?.number}.${index + 1}`) {
        addFeedbackIssue(
          issues,
          'Numbering: independent arguments should be numbered 1.1, 1.2, 1.3 according to their shared standpoint or target.',
        );
      }
    });
  });
  edges.forEach((edge) => {
    const source = getNode(edge.source);
    const target = getNode(edge.target);
    if (source?.type === 'standpoint' || target?.type === 'unexpressed')
      addFeedbackIssue(
        issues,
        'Arrow direction: support must point from the supporting element toward the statement it supports.',
      );
    if (source?.type === 'unexpressed')
      addFeedbackIssue(
        issues,
        'Unexpressed premise: it belongs in an elementary group with its expressed premise, not as a sub-argument.',
      );
    if (edge.relationship === 'sub' && target?.type === 'standpoint')
      addFeedbackIssue(
        issues,
        'Subordinative structure: a sub-argument must support an argument, not the main standpoint directly.',
      );
    if (edge.relationship === 'sub' && source?.number !== `${target?.number}.1`)
      addFeedbackIssue(
        issues,
        'Numbering: a subordinative support should extend the supported argument number, for example 1.1.1 → 1.1.',
      );
    const group = groups.find(
      (candidate) =>
        candidate.memberIds.includes(edge.source) &&
        candidate.target === edge.target,
    );
    if (group?.kind === 'coordinative')
      addFeedbackIssue(
        issues,
        'Coordinative structure: components must use one shared arrow, not separate arrows.',
      );
  });
  groups.forEach((group) => {
    if (group.kind === 'coordinative' && group.memberIds.length < 2)
      addFeedbackIssue(
        issues,
        'Coordinative structure: independent arguments should not be grouped alone.',
      );
    if (
      group.kind === 'coordinative' &&
      group.memberIds.some(
        (memberId) =>
          !new RegExp(
            `^${escapeRegExp(getNode(group.target)?.number || '')}\\.1[a-z]$`,
          ).test(getNode(memberId)?.number || ''),
      )
    ) {
      addFeedbackIssue(
        issues,
        'Numbering: independent arguments have been grouped with a coordinative label instead of receiving separate numbers.',
      );
    }
    if (group.kind === 'elementary') {
      const expressed = getNode(
        group.memberIds.find((id) => getNode(id)?.type !== 'unexpressed'),
      );
      const premise = getNode(
        group.memberIds.find((id) => getNode(id)?.type === 'unexpressed'),
      );
      if (!expressed || !premise || premise.number !== `(${expressed.number}′)`)
        addFeedbackIssue(
          issues,
          'Numbering: an unexpressed premise must be numbered from its associated expressed premise.',
        );
      const standpoint = nodes.find((node) => node.type === 'standpoint');
      if (
        standpoint &&
        premise &&
        normalize(premise.text) === normalize(standpoint.text)
      )
        addFeedbackIssue(
          issues,
          'Reconstruction: an unexpressed premise should not merely repeat the standpoint.',
        );
    }
  });
  nodes
    .filter((node) => node.type === 'unexpressed')
    .forEach((node) => {
      if (!groups.some((group) => group.memberIds.includes(node.id)))
        addFeedbackIssue(
          issues,
          'Unexpressed premise: select the expressed premise it belongs to and place it in an elementary argument group.',
        );
    });
  return issues;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalize(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// User text selection & Node creation
sourceTextEl.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  selectedText = selection?.toString().trim() || '';
  if (!selectedText) return;
  const range = selection.getRangeAt(0).getBoundingClientRect();
  selectionMenu.style.left = `${Math.min(window.innerWidth - 190, range.left)}px`;
  selectionMenu.style.top = `${range.bottom + 8}px`;
  selectionMenu.hidden = false;
});

document.addEventListener('mousedown', (event) => {
  if (
    !event.target.closest('#selection-menu') &&
    !event.target.closest('#source-text')
  )
    selectionMenu.hidden = true;
  if (
    !event.target.closest('#connection-popover') &&
    !event.target.closest('.node-port')
  )
    connectionPopover.hidden = true;
  if (!event.target.closest('#export-btn') && !event.target.closest('#export-menu')) {
    exportMenu.hidden = true;
  }
  if (!event.target.closest('.scheme-info-trigger') && !event.target.closest('#scheme-info-popover')) {
    schemeInfoPopover.hidden = true;
  }
});

document.querySelectorAll('[data-relationship]').forEach((button) => {
  button.addEventListener('click', () =>
    addConnection(button.dataset.relationship),
  );
});

document
  .getElementById('standpoint-action')
  .addEventListener('click', () => createNode('standpoint'));
document
  .getElementById('argument-action')
  .addEventListener('click', () => createNode('expressed'));

addStatementBtn.addEventListener('click', () => {
  createNode('expressed', 'New argument statement');
  startInlineEdit(nodes[nodes.length - 1].id);
});

function createNode(type, defaultText = null) {
  const text = defaultText || selectedText;
  if (!text) return;
  const count = nodes.filter((node) => node.type === type).length;
  const id = `${type}-${Date.now()}`;
  nodes.push({
    id,
    number:
      type === 'standpoint'
        ? String(nodes.filter((node) => node.type === 'standpoint').length + 1)
        : `1.${count + 1}`,
    type,
    text,
    scheme: '',
    x:
      type === 'standpoint'
        ? Math.max(20, (canvas.clientWidth - 190) / 2)
        : 30 + (count % 3) * 215,
    y: type === 'standpoint' ? 30 : 320,
  });
  selectedText = '';
  selectionMenu.hidden = true;
  saveHistoryState();
  render();
}

premiseButton.addEventListener('click', addUnexpressedPremise);
document.getElementById('close-dialog').addEventListener('click', () => {
  premiseDialog.hidden = true;
});
document.querySelector('.next-step').addEventListener('click', () => {
  if (!document.getElementById('logical-minimum').value.trim()) return;
  premiseForm.querySelector('[data-step="1"]').hidden = true;
  premiseForm.querySelector('[data-step="2"]').hidden = false;
  document.getElementById('pragmatic-optimum').focus();
});
document.querySelector('.previous-step').addEventListener('click', () => {
  premiseForm.querySelector('[data-step="1"]').hidden = false;
  premiseForm.querySelector('[data-step="2"]').hidden = true;
});
premiseForm.addEventListener('submit', (event) => {
  event.preventDefault();
  submitPremise();
});

// Keyboard handling: Delete / Backspace, Undo / Redo
document.addEventListener('keydown', (event) => {
  if (event.target.matches('textarea, input')) return;

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
    if (event.shiftKey) {
      redo();
    } else {
      undo();
    }
    event.preventDefault();
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
    redo();
    event.preventDefault();
    return;
  }

  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (selectedGroupId) {
      groups = groups.filter((group) => group.id !== selectedGroupId);
      selectedGroupId = null;
      saveHistoryState();
      render();
      return;
    }
    if (selectedEdgeIndex !== null) {
      edges.splice(selectedEdgeIndex, 1);
      selectedEdgeIndex = null;
      saveHistoryState();
      render();
      return;
    }
    if (selectedNodeId) {
      deleteNode(selectedNodeId);
      return;
    }
  }
});

// Reset Button
document.getElementById('reset-button').addEventListener('click', () => {
  if (nodes.length > 0 && !confirm('Reset your argument map? All nodes will be cleared.')) {
    return;
  }
  nodes = [];
  edges = [];
  groups = [];
  selectedNodeId = null;
  editingNodeId = null;
  selectedEdgeIndex = null;
  selectedGroupId = null;
  feedback.hidden = true;
  connectionPopover.hidden = true;
  saveHistoryState();
  render();
});

// Check Analysis Button
document.getElementById('check-button').addEventListener('click', () => {
  const issues = validateAnalysis();
  const standpoint = nodes.some((node) => node.type === 'standpoint');
  const expressed = nodes.filter(
    (node) => node.type === 'expressed' || node.type === 'coordinative',
  ).length;
  const hasSupport = edges.length > 0 || groups.length > 0;
  feedback.hidden = false;
  if (issues.length) {
    feedback.innerHTML = `<strong>Review the theory in your overview.</strong><ul>${issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join('')}</ul><button class="compare-button" id="compare-button">Compare with Expert Analysis →</button>`;
  } else if (standpoint && expressed >= 2 && hasSupport) {
    feedback.innerHTML = `<strong>Your overview follows the essential pragma-dialectical distinctions.</strong><p>Check that each independent defense remains separate and that any elementary argument is shown as an expressed premise joined to its unexpressed premise.</p><button class="compare-button" id="compare-button">Compare with Expert Analysis →</button>`;
  } else {
    feedback.innerHTML = `<strong>Keep working on the overview.</strong><p>Include one standpoint, two expressed premises, and at least one support relationship. Select an expressed premise before adding an unexpressed premise.</p>`;
  }
  document
    .getElementById('compare-button')
    ?.addEventListener('click', showComparison);
});

function showComparison() {
  feedback.innerHTML = `
    <strong>Expert reconstruction</strong>
    <p>
      The standpoint is <b>1</b>. The two independent defenses are separate
      elementary arguments:
      <b>1.1 & (1.1′) → 1</b> and <b>1.2 → 1</b>.
      An unexpressed premise is grouped with the expressed premise it completes;
      it is not a sub-argument and has no separate dashed arrow.
      A different wording can be defensible when it preserves the arguer's
      contextual commitment without merely repeating the standpoint.
    </p>
    <button class="compare-button" id="hide-comparison">
      Hide comparison
    </button>
  `;

  document
    .getElementById('hide-comparison')
    .addEventListener('click', () =>
      document.getElementById('check-button').click(),
    );
}

// Undo / Redo Toolbar
undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);
tidyBtn.addEventListener('click', tidyLayout);

// Export Menu Handling
exportBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  const rect = exportBtn.getBoundingClientRect();
  exportMenu.style.left = `${Math.min(window.innerWidth - 180, rect.left)}px`;
  exportMenu.style.top = `${rect.bottom + 6}px`;
  exportMenu.hidden = !exportMenu.hidden;
});

exportJsonBtn.addEventListener('click', () => {
  exportMenu.hidden = true;
  const data = {
    title: 'Argument Map Overview',
    exportedAt: new Date().toISOString(),
    sourceText: sourceTextEl.textContent.trim(),
    nodes,
    edges,
    groups,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `argument-map-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported map as JSON');
});

importJsonBtn.addEventListener('click', () => {
  exportMenu.hidden = true;
  importFileInput.click();
});

importFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
        nodes = data.nodes;
        edges = data.edges;
        groups = data.groups || [];
        if (data.sourceText) {
          sourceTextEl.textContent = data.sourceText;
          presetSelect.value = 'custom';
        }
        selectedNodeId = null;
        editingNodeId = null;
        selectedEdgeIndex = null;
        selectedGroupId = null;
        saveHistoryState();
        render();
        showToast('Argument map imported successfully');
      } else {
        alert('Invalid argument map file format.');
      }
    } catch (err) {
      alert('Could not parse JSON file.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

copySummaryBtn.addEventListener('click', () => {
  exportMenu.hidden = true;
  let text = `Argument Analysis Outline:\n`;
  const standpoints = nodes.filter((n) => n.type === 'standpoint');
  if (standpoints.length) {
    text += `\nStandpoint(s):\n`;
    standpoints.forEach((s) => {
      text += `  [${s.number}] ${s.text}\n`;
    });
  }
  const premises = nodes.filter((n) => n.type !== 'standpoint');
  if (premises.length) {
    text += `\nPremises & Arguments:\n`;
    premises.forEach((p) => {
      const schemeStr = p.scheme ? ` (${p.scheme})` : '';
      text += `  [${p.number}] ${p.text}${schemeStr}\n`;
    });
  }
  if (edges.length) {
    text += `\nSupport Relationships:\n`;
    edges.forEach((e) => {
      const src = getNode(e.source);
      const tgt = getNode(e.target);
      if (src && tgt) {
        text += `  ${src.number} → ${tgt.number} (${e.relationship})\n`;
      }
    });
  }
  navigator.clipboard.writeText(text).then(
    () => showToast('Copied outline to clipboard'),
    () => showToast('Failed to copy to clipboard'),
  );
});

exportPngBtn.addEventListener('click', () => {
  exportMenu.hidden = true;
  renderToPng();
});

function renderToPng() {
  if (nodes.length === 0) {
    alert('Canvas is empty.');
    return;
  }
  const width = canvas.clientWidth || 800;
  const height = canvas.clientHeight || 520;
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = width * 2;
  offscreenCanvas.height = height * 2;
  const ctx = offscreenCanvas.getContext('2d');
  ctx.scale(2, 2);

  // Background
  ctx.fillStyle = '#f5f8f6';
  ctx.fillRect(0, 0, width, height);

  // Background dots
  ctx.fillStyle = '#d7e1dc';
  for (let x = 8; x < width; x += 17) {
    for (let y = 8; y < height; y += 17) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw SVG lines onto canvas
  // First clone SVG content to an image
  const svgData = new XMLSerializer().serializeToString(connectionsSvg);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);
  const svgImg = new Image();

  svgImg.onload = () => {
    ctx.drawImage(svgImg, 0, 0, width, height);
    URL.revokeObjectURL(svgUrl);

    // Draw Nodes
    nodes.forEach((node) => {
      const nodeEl = nodesLayer.querySelector(`[data-node-id="${node.id}"]`);
      const w = nodeEl?.offsetWidth || 190;
      const h = nodeEl?.offsetHeight || 72;
      const r = 8;

      // Card fill & stroke
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(node.x, node.y, w, h, r);
      if (node.type === 'standpoint') {
        ctx.fillStyle = '#fffdf5';
        ctx.strokeStyle = '#9d7c34';
      } else if (node.type === 'unexpressed') {
        ctx.fillStyle = '#fdf9fc';
        ctx.strokeStyle = '#76566c';
        ctx.setLineDash([4, 4]);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#2f6257';
      }
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Number
      ctx.font = 'bold 12px Georgia, serif';
      ctx.fillStyle =
        node.type === 'standpoint'
          ? '#8c6d27'
          : node.type === 'unexpressed'
            ? '#76566c'
            : '#2f6257';
      ctx.fillText(node.number, node.x + 10, node.y + 22);

      // Type label
      ctx.font = '9px Inter, sans-serif';
      ctx.fillStyle = '#6b7774';
      const typeLabel =
        node.type === 'standpoint'
          ? 'STANDPOINT'
          : node.type === 'unexpressed'
            ? 'UNEXPRESSED PREMISE'
            : 'EXPRESSED PREMISE';
      ctx.fillText(typeLabel, node.x + 40, node.y + 20);

      // Body text wrapped
      ctx.font = '12px Georgia, serif';
      ctx.fillStyle = '#1f2c2b';
      wrapText(ctx, node.text, node.x + 12, node.y + 40, w - 24, 15);

      // Scheme pill if exists
      if (node.scheme) {
        ctx.font = 'bold 9px Inter, sans-serif';
        const schemeTxt = node.scheme.toUpperCase();
        const sw = ctx.measureText(schemeTxt).width + 12;
        ctx.fillStyle = '#f1f7f3';
        ctx.beginPath();
        ctx.roundRect(node.x + w - sw - 8, node.y + h - 18, sw, 14, 7);
        ctx.fill();
        ctx.fillStyle = '#2f6257';
        ctx.fillText(schemeTxt, node.x + w - sw - 2, node.y + h - 7);
      }
    });

    const link = document.createElement('a');
    link.download = `argument-map-${Date.now()}.png`;
    link.href = offscreenCanvas.toDataURL('image/png');
    link.click();
    showToast('Exported map as PNG image');
  };
  svgImg.src = svgUrl;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

// Scheme Critical Questions Info Popover
function openSchemeInfo(schemeName, triggerEl) {
  const details = SCHEME_DETAILS[schemeName];
  if (!details) return;
  schemeInfoTitle.textContent = details.title;
  schemeInfoDesc.textContent = details.description;
  schemeInfoList.innerHTML = details.questions
    .map((q) => `<li>${escapeHtml(q)}</li>`)
    .join('');

  const rect = triggerEl.getBoundingClientRect();
  schemeInfoPopover.style.left = `${Math.min(window.innerWidth - 330, Math.max(10, rect.left - 150))}px`;
  schemeInfoPopover.style.top = `${rect.bottom + 8}px`;
  schemeInfoPopover.hidden = false;
}

closeSchemeInfo.addEventListener('click', () => {
  schemeInfoPopover.hidden = true;
});

// Initialization
initDiscourse();
saveHistoryState();
window.addEventListener('resize', drawConnections);
render();
