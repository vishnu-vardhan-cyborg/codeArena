import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getLearningPath } from "../data/learningPaths";
import "../styles/RabbitHole.css";

const buildNodes = (path, activeIndex) =>
  path.stages.map((stage, index) => ({
    id: `${path.id}-${index}`,
    type: "learningNode",
    position: {
      x: index % 2 === 0 ? 120 : 430,
      y: index * 180,
    },
    data: {
      ...stage,
      depth: index + 1,
      status:
        index < activeIndex
          ? "completed"
          : index === activeIndex
            ? "current"
            : "locked",
      accent: path.accent,
    },
    draggable: false,
  }));

const buildEdges = (path, activeIndex) =>
  path.stages.slice(0, -1).map((_, index) => ({
    id: `${path.id}-edge-${index}`,
    source: `${path.id}-${index}`,
    target: `${path.id}-${index + 1}`,
    type: "smoothstep",
    animated: index === activeIndex - 1,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: index < activeIndex ? path.accent : "#9da9aa",
    },
    style: {
      stroke: index < activeIndex ? path.accent : "#9da9aa",
      strokeWidth: index < activeIndex ? 3 : 2,
      strokeDasharray: index < activeIndex ? "0" : "6 6",
    },
  }));

function LearningNode({ data }) {
  return (
    <div
      className={`learning-node ${data.status}`}
      style={{ "--node-accent": data.accent }}
    >
      <Handle type="target" position={Position.Top} />
      <span className="learning-node-depth">Depth {data.depth}</span>
      <strong>{data.title}</strong>
      <small>{data.level}</small>
      {data.status === "current" && <i>You are here</i>}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { learningNode: LearningNode };

export default function LearningPath() {
  const navigate = useNavigate();
  const { pathId } = useParams();
  const path = getLearningPath(pathId);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const nodes = useMemo(
    () => (path ? buildNodes(path, activeIndex) : []),
    [activeIndex, path]
  );
  const edges = useMemo(
    () => (path ? buildEdges(path, activeIndex) : []),
    [activeIndex, path]
  );

  const handleNodeClick = useCallback(
    (_, node) => {
      const index = Number(node.id.split("-").at(-1));
      if (index <= activeIndex) {
        setSelectedIndex(index);
      }
    },
    [activeIndex]
  );

  if (!path) {
    return (
      <div className="rabbit-missing">
        <h1>Learning trail not found</h1>
        <button type="button" onClick={() => navigate("/rabbit-hole")}>
          Back to Rabbit Hole
        </button>
      </div>
    );
  }

  const selectedStage = path.stages[selectedIndex];
  const atCore = activeIndex === path.stages.length - 1;
  const progress = ((activeIndex + 1) / path.stages.length) * 100;

  const moveDeeper = () => {
    const nextIndex = Math.min(path.stages.length - 1, activeIndex + 1);
    setActiveIndex(nextIndex);
    setSelectedIndex(nextIndex);
  };

  return (
    <div
      className="learning-path-page"
      style={{ "--path-accent": path.accent }}
    >
      <header className="learning-path-header">
        <button type="button" onClick={() => navigate("/rabbit-hole")}>
          All trails
        </button>
        <div>
          <span className="rabbit-eyebrow">Rabbit Hole / {path.shortName}</span>
          <h1>{path.name}</h1>
          <p>{path.description}</p>
        </div>
        <div className="path-progress">
          <div>
            <span>Current depth</span>
            <strong>
              {activeIndex + 1}/{path.stages.length}
            </strong>
          </div>
          <div className="path-progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </header>

      <main className="learning-workspace">
        <section className="learning-flow" aria-label={`${path.name} map`}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            nodesConnectable={false}
            nodesDraggable={false}
            elementsSelectable
            fitView
            fitViewOptions={{ padding: 0.18 }}
            minZoom={0.45}
            maxZoom={1.25}
            onNodeClick={handleNodeClick}
          >
            <Background color="#c4cecf" gap={24} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(node) =>
                node.data.status === "locked" ? "#cbd4d5" : path.accent
              }
              maskColor="rgba(240, 244, 244, 0.78)"
            />
          </ReactFlow>
        </section>

        <aside className="learning-stage-panel">
          <span className="rabbit-eyebrow">
            Depth {selectedIndex + 1} / {selectedStage.level}
          </span>
          <h2>{selectedStage.title}</h2>
          <p>{selectedStage.summary}</p>

          <div className="stage-skills">
            <span>Core skills</span>
            {selectedStage.skills.map((skill) => (
              <strong key={skill}>{skill}</strong>
            ))}
          </div>

          <div className="stage-status">
            <span>Status</span>
            <strong>
              {selectedIndex < activeIndex
                ? "Completed"
                : selectedIndex === activeIndex
                  ? "In progress"
                  : "Locked"}
            </strong>
          </div>

          <button
            className="go-deeper-button"
            type="button"
            disabled={atCore}
            onClick={moveDeeper}
          >
            {atCore ? "Core reached" : "Complete level and go deeper"}
          </button>
        </aside>
      </main>
    </div>
  );
}
