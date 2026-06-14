import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  MessageCircle,
  Plus,
  Search,
  Send,
  UsersRound,
} from "lucide-react";
import { supabase } from "../supabase";
import {
  connectSocket,
  createChatGroup,
  joinChatRoom,
  sendChatMessage,
  socket,
} from "../socket";
import "../styles/Chat.css";

const DEFAULT_AVATAR = "https://i.pravatar.cc/150?img=12";

const directRoomId = (firstUserId, secondUserId) =>
  `direct:${[String(firstUserId), String(secondUserId)].sort().join(":")}`;

const getDisplayName = (user) => user?.uusername || user?.username || "Friend";

const mergeGroups = (currentGroups, incomingGroups) => {
  const groupsById = new Map(currentGroups.map((group) => [group.id, group]));

  incomingGroups.forEach((group) => {
    groupsById.set(group.id, group);
  });

  return [...groupsById.values()];
};

export default function Chat() {
  const navigate = useNavigate();
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("loggedInUser"));
    } catch {
      return null;
    }
  }, []);

  const currentUserId = String(currentUser?.id || "");

  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messagesByRoom, setMessagesByRoom] = useState({});
  const [messageText, setMessageText] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");
  const [socketConnected, setSocketConnected] = useState(socket.connected);

  useEffect(() => {
    const loadFriends = async () => {
      if (!currentUserId) {
        setFriends([]);
        setStatusMessage("Unable to load friends: missing user session.");
        return;
      }

      const { data: relations, error: relationError } = await supabase
        .from("friends")
        .select("*");

      if (relationError) {
        console.error("Chat friend relations error:", relationError);
        setStatusMessage("Unable to load friends. Please try again.");
        setFriends([]);
        return;
      }

      const friendIds = [
        ...new Set(
          (relations || [])
            .filter(
              (relation) =>
                String(relation.user1_id) === currentUserId ||
                String(relation.user2_id) === currentUserId
            )
            .map((relation) =>
              String(relation.user1_id) === currentUserId
                ? relation.user2_id
                : relation.user1_id
            )
        ),
      ];

      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      const { data: friendUsers, error: friendError } = await supabase
        .from("lusers")
        .select("*")
        .in("id", friendIds);

      if (friendError) {
        console.error("Chat friend profile error:", friendError);
        setStatusMessage(
          `Unable to load friend profiles: ${friendError.message}`
        );
        setFriends([]);
        return;
      }

      setStatusMessage("");
      setFriends(friendUsers || []);
    };

    loadFriends();
  }, [currentUserId]);

  useEffect(() => {
    connectSocket(currentUserId);

    const handleMessage = (message) => {
      setMessagesByRoom((currentMessages) => {
        const roomMessages = currentMessages[message.roomId] || [];
        const alreadySaved = roomMessages.some(
          (savedMessage) => savedMessage.id === message.id
        );

        if (alreadySaved) {
          return currentMessages;
        }

        return {
          ...currentMessages,
          [message.roomId]: [...roomMessages, message],
        };
      });
    };

    const handleHistory = ({ roomId, messages }) => {
      setMessagesByRoom((currentMessages) => {
        const existingMessages = currentMessages[roomId] || [];
        const mergedMessages = [...messages, ...existingMessages].reduce(
          (allMessages, message) => {
            if (!allMessages.some((item) => item.id === message.id)) {
              allMessages.push(message);
            }

            return allMessages;
          },
          []
        );

        return {
          ...currentMessages,
          [roomId]: mergedMessages.sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
          ),
        };
      });
    };

    const handleGroupCreated = (group) => {
      if (!group.memberIds?.includes(currentUserId)) {
        return;
      }

      setGroups((currentGroups) => mergeGroups(currentGroups, [group]));

      if (group.ownerId === currentUserId) {
        setSelectedConversationId(group.id);
        setGroupName("");
        setSelectedMemberIds([]);
        setIsCreatingGroup(false);
      }
    };

    const handleGroups = ({ groups: serverGroups = [] }) => {
      setGroups((currentGroups) => mergeGroups(currentGroups, serverGroups));
    };

    const handleError = (errorMessage) => {
      setStatusMessage(errorMessage);
      setIsCreatingGroup(false);
    };
    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);

    socket.on("chat:message", handleMessage);
    socket.on("chat:history", handleHistory);
    socket.on("chat:group-created", handleGroupCreated);
    socket.on("chat:groups", handleGroups);
    socket.on("chat:error", handleError);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.emit("chat:groups:list", { userId: currentUserId });

    return () => {
      socket.off("chat:message", handleMessage);
      socket.off("chat:history", handleHistory);
      socket.off("chat:group-created", handleGroupCreated);
      socket.off("chat:groups", handleGroups);
      socket.off("chat:error", handleError);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, [currentUserId]);

  const conversations = useMemo(() => {
    const directConversations = friends.map((friend) => ({
      id: directRoomId(currentUserId, friend.id),
      type: "direct",
      name: getDisplayName(friend),
      friend,
      memberIds: [currentUserId, String(friend.id)],
    }));

    const groupConversations = groups.map((group) => ({
      id: group.id,
      type: "group",
      name: group.name,
      memberIds: group.memberIds || [],
    }));

    return [...directConversations, ...groupConversations];
  }, [currentUserId, friends, groups]);

  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedConversationId
  );

  useEffect(() => {
    if (selectedConversationId) {
      joinChatRoom(selectedConversationId);
    }
  }, [selectedConversationId]);

  const messages = selectedConversation
    ? messagesByRoom[selectedConversation.id] || []
    : [];

  const filteredFriends = friends.filter((friend) =>
    getDisplayName(friend)
      .toLowerCase()
      .includes(conversationSearch.trim().toLowerCase())
  );
  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(conversationSearch.trim().toLowerCase())
  );

  const toggleMember = (friendId) => {
    const normalizedFriendId = String(friendId);

    setSelectedMemberIds((currentIds) =>
      currentIds.includes(normalizedFriendId)
        ? currentIds.filter((id) => id !== normalizedFriendId)
        : [...currentIds, normalizedFriendId]
    );
  };

  const handleCreateGroup = () => {
    const name = groupName.trim();

    setStatusMessage("");

    if (!name || selectedMemberIds.length === 0) {
      setStatusMessage("Group chat needs a name and at least one friend");
      return;
    }

    setIsCreatingGroup(true);
    createChatGroup({
      name,
      ownerId: currentUserId,
      ownerName: getDisplayName(currentUser),
      memberIds: selectedMemberIds,
    });
  };

  const handleSendMessage = useCallback(() => {
    const text = messageText.trim();

    setStatusMessage("");

    if (!text || !selectedConversation) {
      return;
    }

    sendChatMessage({
      roomId: selectedConversation.id,
      senderId: currentUserId,
      senderName: getDisplayName(currentUser),
      text,
      conversationType: selectedConversation.type,
      receiverIds: selectedConversation.memberIds.filter(
        (memberId) => memberId !== currentUserId
      ),
    });

    setMessageText("");
  }, [currentUser, currentUserId, messageText, selectedConversation]);

  const handleComposerKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="chat-page">
      <header className="chat-page-header">
        <button
          className="chat-back-button"
          type="button"
          onClick={() => navigate("/home")}
        >
          <ArrowLeft size={17} />
          Home
        </button>
        <div>
          <span>CodeArena messenger</span>
          <h1>Chats</h1>
          <p>Plan, solve, and keep your team moving.</p>
        </div>
        <div className="chat-header-status">
          <i className={socketConnected ? "" : "offline"} />
          <span>{socketConnected ? "Socket connected" : "Socket offline"}</span>
        </div>
      </header>

      {statusMessage && <p className="chat-status-message">{statusMessage}</p>}

      <div className="chat-layout">
        <aside className="chat-sidebar">
          <div className="chat-sidebar-heading">
            <div>
              <span>Inbox</span>
              <h2>Conversations</h2>
            </div>
            <strong>{conversations.length}</strong>
          </div>

          <label className="chat-search">
            <Search size={16} />
            <input
              type="search"
              placeholder="Search chats"
              value={conversationSearch}
              onChange={(event) => setConversationSearch(event.target.value)}
            />
          </label>

          <div className="conversation-scroll">
            <div className="conversation-section-heading">
              <MessageCircle size={14} />
              <span>Direct messages</span>
            </div>

            {filteredFriends.length === 0 ? (
              <p className="chat-list-empty">No matching friends.</p>
            ) : (
              filteredFriends.map((friend) => {
                const roomId = directRoomId(currentUserId, friend.id);

                return (
                  <button
                    type="button"
                    key={friend.id}
                    className={
                      selectedConversationId === roomId
                        ? "conversation-button active-conversation"
                        : "conversation-button"
                    }
                    onClick={() => setSelectedConversationId(roomId)}
                  >
                    <span className="conversation-avatar-wrap">
                      <img
                        src={friend.profile_pic || DEFAULT_AVATAR}
                        alt=""
                        className="friend-avatar"
                      />
                      <i />
                    </span>
                    <span className="conversation-copy">
                      <strong>{getDisplayName(friend)}</strong>
                      <small>Direct message</small>
                    </span>
                  </button>
                );
              })
            )}

            <div className="conversation-section-heading">
              <UsersRound size={14} />
              <span>Group chats</span>
            </div>

            {filteredGroups.length === 0 ? (
              <p className="chat-list-empty">No group chats yet.</p>
            ) : (
              filteredGroups.map((group) => (
                <button
                  type="button"
                  key={group.id}
                  className={
                    selectedConversationId === group.id
                      ? "conversation-button active-conversation"
                      : "conversation-button"
                  }
                  onClick={() => setSelectedConversationId(group.id)}
                >
                  <span className="group-avatar">{group.name.charAt(0)}</span>
                  <span className="conversation-copy">
                    <strong>{group.name}</strong>
                    <small>{group.memberIds?.length || 0} members</small>
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="chat-panel">
          {selectedConversation ? (
            <>
              <div className="chat-panel-header">
                <span
                  className={
                    selectedConversation.type === "group"
                      ? "group-avatar chat-header-avatar"
                      : "chat-header-direct-avatar"
                  }
                >
                  {selectedConversation.type === "group"
                    ? selectedConversation.name.charAt(0)
                    : selectedConversation.name.charAt(0)}
                </span>
                <div>
                  <h2>{selectedConversation.name}</h2>
                  <p>
                    {selectedConversation.type === "group"
                      ? `${selectedConversation.memberIds.length} members`
                      : "Direct message"}
                  </p>
                </div>
              </div>

              <div className="message-list">
                {messages.length === 0 ? (
                  <div className="chat-empty-state">
                    <MessageCircle size={25} />
                    <strong>Start the conversation</strong>
                    <span>Messages are stored in Supabase chat history.</span>
                  </div>
                ) : (
                  messages.map((message) => {
                    const isMine = message.senderId === currentUserId;

                    return (
                      <div
                        key={message.id}
                        className={isMine ? "message-row mine" : "message-row"}
                      >
                        <div className="message-bubble">
                          {!isMine && <strong>{message.senderName}</strong>}
                          <p>{message.text}</p>
                          <small>
                            {new Date(message.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </small>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="message-composer">
                <textarea
                  value={messageText}
                  placeholder="Type a message"
                  onChange={(event) => setMessageText(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                />
                <button
                  type="button"
                  aria-label="Send message"
                  onClick={handleSendMessage}
                >
                  <Send size={18} />
                </button>
              </div>
            </>
          ) : (
            <div className="chat-empty-state">
              <MessageCircle size={25} />
              <strong>Select a conversation</strong>
              <span>Add friends or create a group to start chatting.</span>
            </div>
          )}
        </main>

        <aside className="group-panel">
          <div className="group-panel-heading">
            <span className="group-create-icon">
              <Plus size={17} />
            </span>
            <div>
              <span>New conversation</span>
              <h2>Create group</h2>
            </div>
          </div>

          <label className="group-name-field">
            <span>Group name</span>
            <input
              value={groupName}
              placeholder="e.g. DSA challengers"
              onChange={(event) => setGroupName(event.target.value)}
            />
          </label>

          <div className="member-picker">
            <span>Select members</span>
            {friends.length === 0 ? (
              <p>Add friends before creating a group.</p>
            ) : (
              friends.map((friend) => (
                <label key={friend.id} className="member-option">
                  <input
                    type="checkbox"
                    checked={selectedMemberIds.includes(String(friend.id))}
                    onChange={() => toggleMember(friend.id)}
                  />
                  <span className="member-check">
                    <Check size={12} />
                  </span>
                  <img
                    src={friend.profile_pic || DEFAULT_AVATAR}
                    alt=""
                  />
                  <span>{getDisplayName(friend)}</span>
                </label>
              ))
            )}
          </div>

          <button
            className={
              isCreatingGroup ? "create-group-button disabled" : "create-group-button"
            }
            disabled={isCreatingGroup}
            onClick={handleCreateGroup}
          >
            <UsersRound size={16} />
            {isCreatingGroup ? "Creating..." : "Create group"}
          </button>
        </aside>
      </div>
    </div>
  );
}
