export const LEARNING_PATHS = [
  {
    id: "dsa",
    name: "Data Structures & Algorithms",
    shortName: "DSA",
    description:
      "Build problem-solving instincts from core collections to advanced optimization.",
    accent: "#ef6655",
    estimatedHours: 42,
    stages: [
      {
        title: "Complexity & Arrays",
        level: "Beginner",
        summary: "Read Big O, traverse arrays, and reason about memory.",
        skills: ["Big O", "Arrays", "Two pointers"],
      },
      {
        title: "Searching & Sorting",
        level: "Foundation",
        summary: "Recognize ordering patterns and choose efficient searches.",
        skills: ["Binary search", "Merge sort", "Intervals"],
      },
      {
        title: "Linked Structures",
        level: "Explorer",
        summary: "Work with linked lists, stacks, queues, and pointer movement.",
        skills: ["Linked lists", "Stacks", "Queues"],
      },
      {
        title: "Trees & Heaps",
        level: "Intermediate",
        summary: "Navigate hierarchy and maintain ordered priority data.",
        skills: ["Tree traversal", "BST", "Heaps"],
      },
      {
        title: "Graphs",
        level: "Deep",
        summary: "Model connected systems and find paths through them.",
        skills: ["BFS", "DFS", "Shortest path"],
      },
      {
        title: "Dynamic Programming",
        level: "Deeper",
        summary: "Turn repeated subproblems into reusable state.",
        skills: ["Memoization", "Tabulation", "State design"],
      },
      {
        title: "Advanced Patterns",
        level: "Core",
        summary: "Combine patterns under constraints and explain tradeoffs.",
        skills: ["Greedy", "Union find", "Tries"],
      },
    ],
  },
  {
    id: "system-design",
    name: "System Design",
    shortName: "Systems",
    description:
      "Descend from reliable APIs into distributed systems and architecture tradeoffs.",
    accent: "#118b7c",
    estimatedHours: 38,
    stages: [
      {
        title: "Requirements First",
        level: "Beginner",
        summary: "Translate a product request into scale and reliability targets.",
        skills: ["Use cases", "Constraints", "Capacity"],
      },
      {
        title: "API & Data Models",
        level: "Foundation",
        summary: "Design clear contracts and data that supports access patterns.",
        skills: ["REST", "Schemas", "Indexes"],
      },
      {
        title: "Caching & Delivery",
        level: "Explorer",
        summary: "Reduce latency with caches, CDNs, and invalidation plans.",
        skills: ["Cache policy", "CDN", "Invalidation"],
      },
      {
        title: "Scale & Balance",
        level: "Intermediate",
        summary: "Distribute traffic and remove single points of failure.",
        skills: ["Load balancing", "Replication", "Sharding"],
      },
      {
        title: "Async Systems",
        level: "Deep",
        summary: "Use queues and streams to decouple expensive work.",
        skills: ["Queues", "Streams", "Backpressure"],
      },
      {
        title: "Consistency",
        level: "Deeper",
        summary: "Choose useful consistency and failure-handling guarantees.",
        skills: ["CAP", "Consensus", "Idempotency"],
      },
      {
        title: "Architecture Review",
        level: "Core",
        summary: "Defend a complete design with measurable tradeoffs.",
        skills: ["Observability", "Resilience", "Cost"],
      },
    ],
  },
  {
    id: "programming-languages",
    name: "Programming Languages",
    shortName: "Languages",
    description:
      "Move from syntax and runtime fundamentals into language design and polyglot systems.",
    accent: "#d99016",
    estimatedHours: 46,
    stages: [
      {
        title: "Programming Fundamentals",
        level: "Beginner",
        summary: "Use variables, control flow, functions, and basic debugging.",
        skills: ["Control flow", "Functions", "Debugging"],
      },
      {
        title: "JavaScript & TypeScript",
        level: "Foundation",
        summary: "Understand the web runtime and add reliable type contracts.",
        skills: ["Event loop", "Types", "Modules"],
      },
      {
        title: "Python",
        level: "Explorer",
        summary: "Write expressive scripts, services, and data workflows.",
        skills: ["Python model", "Iterators", "Packaging"],
      },
      {
        title: "Java & OOP",
        level: "Intermediate",
        summary: "Design maintainable object models on a managed runtime.",
        skills: ["OOP", "Generics", "JVM"],
      },
      {
        title: "Systems Languages",
        level: "Deep",
        summary: "Reason about memory, ownership, and low-level performance.",
        skills: ["C++", "Rust", "Memory"],
      },
      {
        title: "Compilers & Runtimes",
        level: "Deeper",
        summary: "See how source becomes executable behavior.",
        skills: ["Parsing", "Bytecode", "Garbage collection"],
      },
      {
        title: "Polyglot Architecture",
        level: "Core",
        summary: "Select languages based on constraints instead of habit.",
        skills: ["Tradeoffs", "Interop", "Tooling"],
      },
    ],
  },
  {
    id: "ai-ml",
    name: "AI & Machine Learning",
    shortName: "AI / ML",
    description:
      "Start with data and models, then descend into deep learning and production AI.",
    accent: "#4967c7",
    estimatedHours: 54,
    stages: [
      {
        title: "Math & Data",
        level: "Beginner",
        summary: "Prepare data and build intuition for vectors and probability.",
        skills: ["Linear algebra", "Probability", "Data cleaning"],
      },
      {
        title: "Classical ML",
        level: "Foundation",
        summary: "Train and compare practical supervised models.",
        skills: ["Regression", "Trees", "Classification"],
      },
      {
        title: "Evaluation",
        level: "Explorer",
        summary: "Measure models correctly and detect misleading results.",
        skills: ["Metrics", "Validation", "Bias"],
      },
      {
        title: "Neural Networks",
        level: "Intermediate",
        summary: "Understand layers, gradients, and learned representations.",
        skills: ["Backpropagation", "Optimization", "Embeddings"],
      },
      {
        title: "Deep Learning",
        level: "Deep",
        summary: "Apply modern architectures to images, language, and sequences.",
        skills: ["CNNs", "Transformers", "Attention"],
      },
      {
        title: "Generative AI",
        level: "Deeper",
        summary: "Build useful systems around generative models.",
        skills: ["LLMs", "RAG", "Evaluation"],
      },
      {
        title: "Production ML",
        level: "Core",
        summary: "Deploy, monitor, and improve models after release.",
        skills: ["MLOps", "Monitoring", "Safety"],
      },
    ],
  },
];

export const getLearningPath = (pathId) =>
  LEARNING_PATHS.find((path) => path.id === pathId);
