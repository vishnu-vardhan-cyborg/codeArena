import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  Compass,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "../../../shared/services/supabase";
import { showAppToast } from "../../../shared/utils/appToast";
import "../../../styles/features/Profile.css";

const DEFAULT_AVATAR = "https://i.pravatar.cc/150?img=12";
const SOCIAL_TABLE_MISSING_CODES = new Set(["PGRST205", "42P01"]);

const readCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem("loggedInUser") || "null");
  } catch {
    return null;
  }
};

export default function Posts() {
  const navigate = useNavigate();
  const [currentUser] = useState(readCurrentUser);
  const currentUserId = currentUser?.id ? String(currentUser.id) : "";

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [postContent, setPostContent] = useState("");
  const [postView, setPostView] = useState("active");
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postActionId, setPostActionId] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [socialSetupMissing, setSocialSetupMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadPostsPage = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);

    const [profileResult, postsResult, usersResult] = await Promise.all([
      supabase.from("lusers").select("*").eq("id", currentUser.id).single(),
      supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("lusers").select("id, username, uusername, profile_pic, xp"),
    ]);

    if (postsResult.error) {
      if (SOCIAL_TABLE_MISSING_CODES.has(postsResult.error.code)) {
        setSocialSetupMissing(true);
      }
      showAppToast(postsResult.error.message, "error");
    } else {
      setSocialSetupMissing(false);
      setPosts(postsResult.data || []);
    }

    setProfile(profileResult.data || currentUser);
    setProfilesById(
      (usersResult.data || []).reduce((profiles, user) => {
        profiles[String(user.id)] = user;
        return profiles;
      }, {})
    );
    setLoading(false);
  }, [currentUser, currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      navigate("/login", { replace: true });
      return;
    }

    loadPostsPage();
  }, [currentUserId, loadPostsPage, navigate]);

  useEffect(() => {
    if (!postModalOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setPostModalOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [postModalOpen]);

  const myPosts = useMemo(
    () => posts.filter((post) => String(post.user_id) === currentUserId),
    [currentUserId, posts]
  );

  const visibleMyPosts = useMemo(
    () =>
      myPosts.filter((post) =>
        postView === "archived" ? Boolean(post.archived_at) : !post.archived_at
      ),
    [myPosts, postView]
  );

  const explorePosts = useMemo(
    () =>
      posts.filter(
        (post) => !post.archived_at && String(post.user_id) !== currentUserId
      ),
    [currentUserId, posts]
  );

  const createPost = async () => {
    const content = postContent.trim();

    if (!content) {
      showAppToast("Write something valuable before sharing.", "error");
      return;
    }

    if (content.length > 2000) {
      showAppToast("Posts can contain up to 2,000 characters.", "error");
      return;
    }

    setIsPosting(true);
    const { data, error } = await supabase
      .from("posts")
      .insert([{ user_id: currentUserId, content }])
      .select("*")
      .single();
    setIsPosting(false);

    if (error) {
      if (SOCIAL_TABLE_MISSING_CODES.has(error.code)) {
        setSocialSetupMissing(true);
      }
      showAppToast(error.message, "error");
      return;
    }

    setPosts((existingPosts) => [data, ...existingPosts]);
    setPostContent("");
    setPostModalOpen(false);
    showAppToast("Post shared with your network.", "success");
  };

  const archivePost = async (post, shouldArchive) => {
    setPostActionId(post.id);

    const archivedAt = shouldArchive ? new Date().toISOString() : null;
    const { data, error } = await supabase
      .from("posts")
      .update({ archived_at: archivedAt, updated_at: new Date().toISOString() })
      .eq("id", post.id)
      .eq("user_id", currentUserId)
      .select("*")
      .single();

    setPostActionId("");

    if (error) {
      showAppToast(
        error.code === "PGRST204"
          ? "Run backend/schemas/social-schema.sql in Supabase to enable post archiving."
          : error.message,
        "error"
      );
      return;
    }

    setPosts((existingPosts) =>
      existingPosts.map((existingPost) =>
        existingPost.id === post.id ? data : existingPost
      )
    );
    showAppToast(shouldArchive ? "Post archived." : "Post restored.", "success");
  };

  const deletePost = async (post) => {
    if (!window.confirm("Delete this post permanently?")) return;

    setPostActionId(post.id);

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", post.id)
      .eq("user_id", currentUserId);

    setPostActionId("");

    if (error) {
      showAppToast(error.message, "error");
      return;
    }

    setPosts((existingPosts) =>
      existingPosts.filter((existingPost) => existingPost.id !== post.id)
    );
    showAppToast("Post deleted.", "success");
  };

  const renderPostAuthor = (post) => {
    const author =
      profilesById[String(post.user_id)] ||
      (String(post.user_id) === currentUserId ? profile : {});

    return {
      name: author?.uusername || author?.username || "Arena player",
      avatar: author?.profile_pic || DEFAULT_AVATAR,
      xp: Number(author?.xp || 0),
    };
  };

  const renderPostCard = (post, editable = false) => {
    const author = renderPostAuthor(post);

    return (
      <article key={post.id}>
        <div className="profile-post-header">
          <img src={author.avatar} alt="" />
          <span>
            <strong>{author.name}</strong>
            <small>
              {new Date(post.created_at).toLocaleString()}
              {editable ? "" : ` - ${author.xp} XP`}
            </small>
          </span>
          {editable && (
            <div className="profile-post-actions">
              <button
                type="button"
                title={post.archived_at ? "Restore post" : "Archive post"}
                aria-label={post.archived_at ? "Restore post" : "Archive post"}
                disabled={postActionId === post.id}
                onClick={() => archivePost(post, !post.archived_at)}
              >
                {post.archived_at ? <RotateCcw size={15} /> : <Archive size={15} />}
              </button>
              <button
                className="delete"
                type="button"
                title="Delete post"
                aria-label="Delete post"
                disabled={postActionId === post.id}
                onClick={() => deletePost(post)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>
        <p>{post.content}</p>
        {post.archived_at && (
          <small className="profile-archive-time">
            Archived {new Date(post.archived_at).toLocaleString()}
          </small>
        )}
      </article>
    );
  };

  if (loading || !profile) {
    return <p className="profile-loading">Loading posts...</p>;
  }

  return (
    <div className="page posts-page">
      <header className="profile-page-header posts-page-header">
        <div>
          <span className="profile-eyebrow">Knowledge board</span>
          <h1>Posts</h1>
          <p>Share useful discoveries and explore what other players are learning.</p>
        </div>
        <button
          className="profile-create-post-button posts-create-button"
          type="button"
          onClick={() => setPostModalOpen(true)}
        >
          <Plus size={16} />
          Create post
        </button>
      </header>

      {socialSetupMissing && (
        <p className="profile-setup-note">
          Run <strong>backend/schemas/social-schema.sql</strong> in Supabase to enable
          posts, followers, and social notifications.
        </p>
      )}

      <div className="posts-layout">
        <section className="profile-posts-panel posts-feed-panel">
          <div className="profile-panel-heading">
            <div>
              <span className="profile-eyebrow">Your drops</span>
              <h2>My Posts</h2>
              <p>Create, archive, restore, or delete your own posts.</p>
            </div>
          </div>

          <div className="profile-post-tabs" role="tablist">
            <button
              className={postView === "active" ? "active" : ""}
              type="button"
              role="tab"
              aria-selected={postView === "active"}
              onClick={() => setPostView("active")}
            >
              Published
              <span>{myPosts.filter((post) => !post.archived_at).length}</span>
            </button>
            <button
              className={postView === "archived" ? "active" : ""}
              type="button"
              role="tab"
              aria-selected={postView === "archived"}
              onClick={() => setPostView("archived")}
            >
              Archived
              <span>{myPosts.filter((post) => post.archived_at).length}</span>
            </button>
          </div>

          {visibleMyPosts.length === 0 ? (
            <p className="profile-empty">
              {postView === "archived"
                ? "No archived posts."
                : "No posts shared yet."}
            </p>
          ) : (
            <div className="profile-post-list">
              {visibleMyPosts.map((post) => renderPostCard(post, true))}
            </div>
          )}
        </section>

        <section className="profile-posts-panel posts-explore-panel">
          <div className="profile-panel-heading">
            <div>
              <span className="profile-eyebrow">Explore</span>
              <h2>Player Signals</h2>
              <p>Recent public posts from other arena players.</p>
            </div>
            <Compass size={20} />
          </div>

          {explorePosts.length === 0 ? (
            <p className="profile-empty">No public posts to explore yet.</p>
          ) : (
            <div className="profile-post-list">
              {explorePosts.map((post) => renderPostCard(post))}
            </div>
          )}
        </section>
      </div>

      {postModalOpen && (
        <div
          className="profile-post-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPostModalOpen(false);
            }
          }}
        >
          <section
            className="profile-post-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-post-modal-title"
          >
            <div className="profile-post-modal-heading">
              <div>
                <span className="profile-eyebrow">Knowledge drop</span>
                <h2 id="profile-post-modal-title">Create a post</h2>
              </div>
              <button
                type="button"
                aria-label="Close post composer"
                title="Close"
                onClick={() => setPostModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="profile-post-composer">
              <textarea
                autoFocus
                maxLength={2000}
                placeholder="Share something useful with your network..."
                value={postContent}
                onChange={(event) => setPostContent(event.target.value)}
              />
              <div>
                <span>{postContent.length}/2000</span>
                <button type="button" onClick={createPost} disabled={isPosting}>
                  <Send size={15} />
                  {isPosting ? "Sharing..." : "Share post"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
