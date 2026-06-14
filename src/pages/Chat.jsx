import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import {
  connectSocket,
  createChatGroup,
  joinChatRoom,
  sendChatMessage,
  socket,
} from "../socket";

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

    socket.on("chat:message", handleMessage);
    socket.on("chat:history", handleHistory);
    socket.on("chat:group-created", handleGroupCreated);
    socket.on("chat:groups", handleGroups);
    socket.on("chat:error", handleError);
    socket.emit("chat:groups:list", { userId: currentUserId });

    return () => {
      socket.off("chat:message", handleMessage);
      socket.off("chat:history", handleHistory);
      socket.off("chat:group-created", handleGroupCreated);
      socket.off("chat:groups", handleGroups);
      socket.off("chat:error", handleError);
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
    <div className="page chat-page">
      <div className="page-header">
        <div>
          <h1>Chat</h1>
          <p>Message friends</p>
        </div>

        <button onClick={() => navigate("/home")}>Back</button>
      </div>

      {statusMessage && <p className="error">{statusMessage}</p>}

      <div className="chat-layout">
        <aside className="chat-sidebar">
          <h2>Friends</h2>

          {friends.length === 0 ? (
            <p>No friends yet</p>
          ) : (
            friends.map((friend) => {
              const roomId = directRoomId(currentUserId, friend.id);

              return (
                <button
                  key={friend.id}
                  className={
                    selectedConversationId === roomId
                      ? "conversation-button active-conversation"
                      : "conversation-button"
                  }
                  onClick={() => setSelectedConversationId(roomId)}
                >
                  <img
                    src={friend.profile_pic || DEFAULT_AVATAR}
                    alt=""
                    className="friend-avatar"
                  />
                  <span>{getDisplayName(friend)}</span>
                </button>
              );
            })
          )}

          <h2>Groups</h2>

          {groups.length === 0 ? (
            <p>No group chats</p>
          ) : (
            groups.map((group) => (
              <button
                key={group.id}
                className={
                  selectedConversationId === group.id
                    ? "conversation-button active-conversation"
                    : "conversation-button"
                }
                onClick={() => setSelectedConversationId(group.id)}
              >
                <span className="group-avatar">{group.name.charAt(0)}</span>
                <span>{group.name}</span>
              </button>
            ))
          )}
        </aside>

        <main className="chat-panel">
          {selectedConversation ? (
            <>
              <div className="chat-panel-header">
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
                  <p className="empty-state">Start the conversation.</p>
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
                <button className="btn" onClick={handleSendMessage}>
                  Send
                </button>
              </div>
            </>
          ) : (
            <p className="empty-state">Add friends to start chatting.</p>
          )}
        </main>

        <aside className="group-panel">
          <h2>Create Group</h2>

          <input
            className="input"
            value={groupName}
            placeholder="Group name"
            onChange={(event) => setGroupName(event.target.value)}
          />

          <div className="member-picker">
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
                  <span>{getDisplayName(friend)}</span>
                </label>
              ))
            )}
          </div>

          <button
            className={isCreatingGroup ? "btn disabled" : "btn"}
            disabled={isCreatingGroup}
            onClick={handleCreateGroup}
          >
            {isCreatingGroup ? "Creating..." : "Create Group"}
          </button>
        </aside>
      </div>
    </div>
  );
}
