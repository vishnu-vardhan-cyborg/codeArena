const http = require("http");
const { Server } = require("socket.io");
const { readJsonBody, sendJson } = require("./http");
const { getProblem, judgeSubmission, listProblems } = require("./problems");
const { adminKeyType, supabase } = require("./supabase");
const { executeTyphon, getLanguages, requestTyphon } = require("./typhon");
const { getUserProblemStats } = require("./userStats");

const PORT = Number(process.env.SOCKET_PORT) || 4000;
const MAX_ROOM_HISTORY = 100;
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
];

const requestHandler = async (request, response) => {
  const origin = request.headers.origin;

  if (ALLOWED_ORIGINS.includes(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
  }

  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Vary", "Origin");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  try {
    if (request.method === "GET" && url.pathname === "/api/typhon/health") {
      sendJson(response, 200, {
        ok: true,
        languages: await requestTyphon("/languages", {}, 5000),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/typhon/languages") {
      sendJson(response, 200, { languages: await getLanguages() });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/typhon/run") {
      const payload = await readJsonBody(request);
      sendJson(response, 200, await executeTyphon(payload));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/problems") {
      sendJson(response, 200, {
        problems: await listProblems(url.searchParams.get("userId")),
      });
      return;
    }

    const userStatsMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/problem-stats$/);
    if (request.method === "GET" && userStatsMatch) {
      sendJson(
        response,
        200,
        await getUserProblemStats(decodeURIComponent(userStatsMatch[1]))
      );
      return;
    }

    const problemMatch = url.pathname.match(/^\/api\/problems\/([^/]+)$/);
    if (request.method === "GET" && problemMatch) {
      sendJson(response, 200, {
        problem: await getProblem(
          decodeURIComponent(problemMatch[1]),
          url.searchParams.get("userId")
        ),
      });
      return;
    }

    const submissionMatch = url.pathname.match(
      /^\/api\/problems\/([^/]+)\/submit$/
    );
    if (request.method === "POST" && submissionMatch) {
      const payload = await readJsonBody(request);
      sendJson(
        response,
        200,
        await judgeSubmission({
          ...payload,
          problemId: decodeURIComponent(submissionMatch[1]),
        })
      );
      return;
    }
  } catch (error) {
    sendJson(response, error.statusCode || 503, {
      error: error.message,
    });
    return;
  }

  sendJson(response, 404, {
    error: "Not found",
  });
};

const httpServer = http.createServer((request, response) => {
  requestHandler(request, response).catch((error) => {
    sendJson(response, 500, {
      error: error.message,
    });
  });
});

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
  },
});

const normalizeId = (id) => String(id || "").trim();

const normalizeRoomId = (roomId) =>
  String(roomId || "")
    .trim()
    .replace(/\s+/g, "-");

const normalizeText = (text) => String(text || "").trim().slice(0, 1000);

const uniqueIds = (ids) => [...new Set(ids.map(normalizeId).filter(Boolean))];

const toClientMessage = (message) => ({
  id: String(message.id),
  roomId: message.room_id,
  senderId: message.sender_id,
  senderName: message.sender_name || "Friend",
  text: message.message,
  conversationType: message.conversation_type,
  createdAt: message.created_at,
});

const toClientGroup = (group, members) => ({
  id: String(group.id),
  name: group.name,
  ownerId: group.owner_id,
  ownerName: group.owner_name || "Friend",
  memberIds: members
    .filter((member) => member.group_id === group.id)
    .map((member) => member.user_id),
  createdAt: group.created_at,
});

const loadRoomHistory = async (roomId) => {
  const { data, error } = await supabase
    .from("chat_messages")
    .select(
      "id, room_id, conversation_type, sender_id, sender_name, message, created_at"
    )
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(MAX_ROOM_HISTORY);

  if (error) {
    throw error;
  }

  return (data || []).reverse().map(toClientMessage);
};

const saveChatMessage = async (payload) => {
  const roomId = normalizeRoomId(payload.roomId);
  const senderId = normalizeId(payload.senderId);
  const text = normalizeText(payload.text);
  const conversationType =
    payload.conversationType === "group" ? "group" : "direct";

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      room_id: roomId,
      group_id: conversationType === "group" ? roomId : null,
      conversation_type: conversationType,
      sender_id: senderId,
      sender_name: payload.senderName || "Friend",
      message: text,
    })
    .select(
      "id, room_id, conversation_type, sender_id, sender_name, message, created_at"
    )
    .single();

  if (error) {
    throw error;
  }

  return toClientMessage(data);
};

const loadGroupsForUser = async (userId) => {
  const { data: memberships, error: membershipError } = await supabase
    .from("chat_group_members")
    .select("group_id, user_id")
    .eq("user_id", userId);

  if (membershipError) {
    throw membershipError;
  }

  const groupIds = [...new Set((memberships || []).map((item) => item.group_id))];

  if (groupIds.length === 0) {
    return [];
  }

  const [
    { data: groups, error: groupError },
    { data: allMembers, error: allMembersError },
  ] = await Promise.all([
    supabase
      .from("chat_groups")
      .select("id, name, owner_id, owner_name, created_at")
      .in("id", groupIds)
      .order("created_at", { ascending: true }),
    supabase
      .from("chat_group_members")
      .select("group_id, user_id")
      .in("group_id", groupIds),
  ]);

  if (groupError || allMembersError) {
    throw groupError || allMembersError;
  }

  return (groups || []).map((group) => toClientGroup(group, allMembers || []));
};

const createGroup = async (payload, socketUserId) => {
  const ownerId = normalizeId(payload.ownerId || socketUserId);
  const requestedMemberIds = Array.isArray(payload.memberIds)
    ? payload.memberIds
    : [];
  const memberIds = uniqueIds([ownerId, ...requestedMemberIds]);
  const name = String(payload.name || "").trim().slice(0, 60);

  if (!ownerId || !name || memberIds.length < 2) {
    throw new Error("Group chat needs a name and at least one friend");
  }

  const { data: group, error: groupError } = await supabase
    .from("chat_groups")
    .insert({
      name,
      owner_id: ownerId,
      owner_name: payload.ownerName || "Friend",
    })
    .select("id, name, owner_id, owner_name, created_at")
    .single();

  if (groupError) {
    throw groupError;
  }

  const memberRows = memberIds.map((memberId) => ({
    group_id: group.id,
    user_id: memberId,
  }));

  const { error: memberError } = await supabase
    .from("chat_group_members")
    .insert(memberRows);

  if (memberError) {
    await supabase.from("chat_groups").delete().eq("id", group.id);
    throw memberError;
  }

  return toClientGroup(group, memberRows);
};

io.on("connection", (socket) => {
  socket.on("user:join", (userId) => {
    const normalizedUserId = normalizeId(userId);

    if (!normalizedUserId) {
      return;
    }

    if (socket.data.userId) {
      socket.leave(`user:${socket.data.userId}`);
    }

    socket.data.userId = normalizedUserId;
    socket.join(`user:${normalizedUserId}`);
  });

  socket.on("xp:increased", (payload = {}) => {
    const senderId = normalizeId(payload.senderId);
    const receiverIds = Array.isArray(payload.receiverIds)
      ? payload.receiverIds.map(normalizeId).filter(Boolean)
      : [];

    if (!senderId || receiverIds.length === 0) {
      return;
    }

    const notification = {
      id: `${senderId}-${Date.now()}`,
      type: "xp",
      senderId,
      senderName: payload.senderName || "Your friend",
      amount: Number(payload.amount) || 0,
      xp: Number(payload.xp) || 0,
      createdAt: new Date().toISOString(),
    };

    receiverIds.forEach((receiverId) => {
      if (receiverId !== senderId) {
        io.to(`user:${receiverId}`).emit("xp:notification", notification);
      }
    });
  });

  socket.on("chat:join", async (payload = {}) => {
    const roomId = normalizeRoomId(payload.roomId);

    if (!roomId) {
      socket.emit("chat:error", "Unable to join chat room");
      return;
    }

    socket.join(`chat:${roomId}`);

    try {
      socket.emit("chat:history", {
        roomId,
        messages: await loadRoomHistory(roomId),
      });
    } catch (error) {
      socket.emit("chat:error", error.message);
    }
  });

  socket.on("chat:message", async (payload = {}) => {
    const roomId = normalizeRoomId(payload.roomId);
    const senderId = normalizeId(payload.senderId || socket.data.userId);
    const text = normalizeText(payload.text);

    if (!roomId || !senderId || !text) {
      socket.emit("chat:error", "Message could not be sent");
      return;
    }

    const receiverIds = Array.isArray(payload.receiverIds)
      ? uniqueIds(payload.receiverIds).filter((receiverId) => receiverId !== senderId)
      : [];

    try {
      const message = await saveChatMessage({
        ...payload,
        roomId,
        senderId,
        text,
      });

      let target = io.to(`chat:${roomId}`);
      receiverIds.forEach((receiverId) => {
        target = target.to(`user:${receiverId}`);
      });

      target.emit("chat:message", message);
    } catch (error) {
      socket.emit("chat:error", error.message);
    }
  });

  socket.on("chat:group:create", async (payload = {}) => {
    try {
      const group = await createGroup(payload, socket.data.userId);
      socket.join(`chat:${group.id}`);

      group.memberIds.forEach((memberId) => {
        io.to(`user:${memberId}`).emit("chat:group-created", group);
      });

      socket.emit("chat:group-created", group);
    } catch (error) {
      socket.emit("chat:error", error.message);
    }
  });

  socket.on("chat:groups:list", async (payload = {}) => {
    const userId = normalizeId(payload.userId || socket.data.userId);

    if (!userId) {
      return;
    }

    try {
      socket.emit("chat:groups", {
        groups: await loadGroupsForUser(userId),
      });
    } catch (error) {
      socket.emit("chat:error", error.message);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`CodeArena backend running on port ${PORT}`);
  console.log(`Supabase backend admin key: ${adminKeyType}`);
});
