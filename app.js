const sourceText = document.getElementById('source-text');
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

let nodes = [];
let edges = [];
let groups = [];
let selectedText = '';
let selectedNodeId = null;
let pendingSourceId = null;
let pendingTargetId = null;
let pendingSourceSide = null;
let pendingTargetSide = null;
let selectedEdgeIndex = null;
let selectedGroupId = null;
let dragState = null;

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
    const schemeControl =
      selectedNodeId === node.id
        ? `<select class="scheme-select" aria-label="Argument scheme for ${escapeHtml(node.number)}">
            <option value="" ${!node.scheme ? 'selected' : ''}>Scheme</option>
            <option value="Causal" ${node.scheme === 'Causal' ? 'selected' : ''}>Causal</option>
            <option value="Analogy" ${node.scheme === 'Analogy' ? 'selected' : ''}>Analogy</option>
            <option value="Example" ${node.scheme === 'Example' ? 'selected' : ''}>Example</option>
          </select>`
        : node.scheme
          ? `<span class="scheme-pill">${escapeHtml(node.scheme)}</span>`
          : '';
    element.innerHTML = `
      <button class="delete-node" type="button" aria-label="Delete ${node.number}">×</button>
      <span class="node-number">${escapeHtml(node.number)}</span>
      <div class="node-body">
        <span class="node-type">${label}</span>
        <p class="node-text">${escapeHtml(node.text)}</p>
      </div>
      <div class="scheme-control">${schemeControl}</div>
      <span class="node-port port-top" data-side="top" title="Connect from the top"></span>
      <span class="node-port port-right" data-side="right" title="Connect from the right"></span>
      <span class="node-port port-bottom" data-side="bottom" title="Connect from the bottom"></span>
      <span class="node-port port-left" data-side="left" title="Connect from the left"></span>
    `;
    element.addEventListener('pointerdown', startNodeDrag);
    element.addEventListener('click', () => selectNode(node.id));
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
      render();
    });
    nodesLayer.appendChild(element);
  });
  emptyState.hidden = nodes.length > 0;
  premiseButton.disabled = !getSelectedExpressedNode();
  drawConnections();
}

function escapeHtml(value) {
  return value.replace(
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
  selectedNodeId = id;
  render();
}

function startNodeDrag(event) {
  if (
    event.target.classList.contains('node-port') ||
    event.target.classList.contains('delete-node') ||
    event.target.classList.contains('scheme-select')
  )
    return;
  const node = getNode(event.currentTarget.dataset.nodeId);
  const bounds = canvas.getBoundingClientRect();
  dragState = {
    node,
    offsetX: event.clientX - bounds.left - node.x,
    offsetY: event.clientY - bounds.top - node.y,
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
  element.style.left = `${dragState.node.x}px`;
  element.style.top = `${dragState.node.y}px`;
  drawConnections();
}

function stopNodeDrag(event) {
  event.currentTarget.removeEventListener('pointermove', moveNode);
  dragState = null;
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
  connectionPopover.style.left = `${x}px`;
  connectionPopover.style.top = `${y}px`;
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
    x: expressed.x + 215,
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

  function layoutElementaryGroup(group) {
    const expressed = getNode(
      group.memberIds.find((id) => getNode(id)?.type !== 'unexpressed'),
    );
    const premise = getNode(
      group.memberIds.find((id) => getNode(id)?.type === 'unexpressed'),
    );
    if (!expressed || !premise) return;
    premise.x = Math.min(canvas.clientWidth - 205, expressed.x + 215);
    premise.y = expressed.y;
  }

  function layoutCoordinativeGroup(group) {
    const target = getNode(group.target);
    if (!target) return;
    const spacing = 215;
    const startX = Math.max(
      15,
      target.x + 95 - ((group.memberIds.length - 1) * spacing + 190) / 2,
    );
    group.memberIds.forEach((memberId, index) => {
      const member = getNode(memberId);
      if (!member) return;
      member.x = Math.min(canvas.clientWidth - 205, startX + index * spacing);
      member.y = Math.min(canvas.clientHeight - 180, target.y + 170);
      const premiseId = group.premises?.[memberId];
      const premise = premiseId ? getNode(premiseId) : null;
      if (premise) {
        premise.x = Math.min(canvas.clientWidth - 205, member.x + 205);
        premise.y = member.y;
      }
    });
  }
  premiseDialog.hidden = true;
  premiseForm.reset();
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
  selectedEdgeIndex = null;
  connectionPopover.hidden = true;
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
  const width = element.offsetWidth;
  const height = element.offsetHeight;
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

sourceText.addEventListener('mouseup', () => {
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

function createNode(type) {
  if (!selectedText) return;
  const count = nodes.filter((node) => node.type === type).length;
  const id = `${type}-${Date.now()}`;
  nodes.push({
    id,
    number:
      type === 'standpoint'
        ? String(nodes.filter((node) => node.type === 'standpoint').length + 1)
        : `1.${count + 1}`,
    type,
    text: selectedText,
    scheme: '',
    x:
      type === 'standpoint'
        ? Math.max(20, (canvas.clientWidth - 190) / 2)
        : 30 + (count % 3) * 215,
    y: type === 'standpoint' ? 30 : 350,
  });
  selectedText = '';
  selectionMenu.hidden = true;
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

document.addEventListener('keydown', (event) => {
  if (
    (event.key !== 'Delete' && event.key !== 'Backspace') ||
    event.target.matches('textarea, input')
  )
    return;
  if (selectedGroupId) {
    groups = groups.filter((group) => group.id !== selectedGroupId);
    selectedGroupId = null;
    render();
    return;
  }
  if (selectedEdgeIndex === null) return;
  edges.splice(selectedEdgeIndex, 1);
  selectedEdgeIndex = null;
  render();
});

document.getElementById('reset-button').addEventListener('click', () => {
  nodes = [];
  edges = [];
  groups = [];
  selectedNodeId = null;
  selectedEdgeIndex = null;
  selectedGroupId = null;
  feedback.hidden = true;
  connectionPopover.hidden = true;
  render();
});

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

window.addEventListener('resize', drawConnections);
render();
