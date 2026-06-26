import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bookmark,
  Brain,
  BriefcaseBusiness,
  Code2,
  ExternalLink,
  Flame,
  Lightbulb,
  Link as LinkIcon,
  MessageSquare,
  Plus,
  Rocket,
  Search,
  Send,
  SlidersHorizontal,
  Star,
  ThumbsDown,
  Trophy,
  Wrench,
  X,
} from "lucide-react";
import { supabase } from "../../../shared/services/supabase";
import { showAppToast } from "../../../shared/utils/appToast";
import "../../../styles/features/AuraFarming.css";

const DEFAULT_AVATAR = "https://i.pravatar.cc/150?img=12";
const TABLE_MISSING_CODES = new Set(["PGRST205", "42P01"]);

const CREATION_TYPES = [
  { value: "project", label: "Project" },
  { value: "research_note", label: "Research Note" },
  { value: "experiment", label: "Experiment" },
  { value: "blog", label: "Blog" },
  { value: "code_snippet", label: "Code Snippet" },
  { value: "case_study", label: "Case Study" },
  { value: "learning_log", label: "Learning Log" },
  { value: "tool_mini_app", label: "Tool / Mini App" },
  { value: "open_source_contribution", label: "Open Source" },
  { value: "resume_portfolio_item", label: "Portfolio Item" },
];

const REACTION_CONFIG = [
  { key: "star", label: "Star", icon: Star, points: 1, countKey: "stars_count" },
  { key: "save", label: "Save", icon: Bookmark, points: 2, countKey: "saves_count" },
  { key: "aura_plus", label: "Give Aura", icon: Flame, points: 3, countKey: "aura_plus_count" },
  { key: "insightful", label: "Insightful", icon: Brain, points: 3, countKey: "insightful_count" },
  { key: "useful", label: "Useful", icon: Wrench, points: 3, countKey: "useful_count" },
  { key: "innovative", label: "Innovative", icon: Rocket, points: 4, countKey: "innovative_count" },
  { key: "hire_worthy", label: "Hire-worthy", icon: BriefcaseBusiness, points: 6, countKey: "hire_worthy_count" },
  { key: "dislike", label: "Dislike", icon: ThumbsDown, points: -2, countKey: "dislikes_count" },
];

const RATING_FIELDS = [
  ["originality", "Originality"],
  ["usefulness", "Usefulness"],
  ["technical_depth", "Technical depth"],
  ["presentation", "Presentation"],
  ["research_quality", "Research quality"],
  ["real_world_impact", "Real-world impact"],
  ["code_quality", "Code quality"],
];

const EMPTY_FORM = {
  type: "project",
  title: "",
  shortDescription: "",
  problemStatement: "",
  solutionDescription: "",
  howItWorks: "",
  techStack: "",
  tags: "",
  githubUrl: "",
  demoUrl: "",
  reportUrl: "",
  coverImageUrl: "",
  researchNotes: "",
  challengesFaced: "",
  futureImprovements: "",
};

const DEFAULT_RATING = RATING_FIELDS.reduce(
  (rating, [key]) => ({ ...rating, [key]: 5 }),
  { review_text: "" }
);

const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem("loggedInUser") || "null");
  } catch {
    return null;
  }
};

const isMissingTable = (error) =>
  TABLE_MISSING_CODES.has(error?.code) ||
  error?.message?.toLowerCase().includes("could not find the table");

const getTypeLabel = (value) =>
  CREATION_TYPES.find((type) => type.value === value)?.label || "Creation";

const parseList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const formatList = (value) =>
  Array.isArray(value) ? value.join(", ") : String(value || "");

const getDisplayName = (profile) =>
  profile?.uusername || profile?.username || "Arena builder";

const getAuraLevel = (aura) => {
  if (aura >= 50000) return "Legendary Creator";
  if (aura >= 25000) return "Aura Architect";
  if (aura >= 10000) return "Impact Maker";
  if (aura >= 5000) return "Innovation Creator";
  if (aura >= 2000) return "Research Builder";
  if (aura >= 500) return "Verified Builder";
  if (aura >= 100) return "Curious Creator";
  return "New Builder";
};

const getRatingAverage = (ratings) => {
  if (!ratings.length) return 0;

  const total = ratings.reduce((sum, rating) => {
    const ratingTotal = RATING_FIELDS.reduce(
      (fieldSum, [key]) => fieldSum + Number(rating[key] || 0),
      0
    );
    return sum + ratingTotal / RATING_FIELDS.length;
  }, 0);

  return Number((total / ratings.length).toFixed(2));
};

const getRatingBonus = (averageRating) => {
  if (averageRating >= 4.8) return 50;
  if (averageRating >= 4.5) return 35;
  if (averageRating >= 4.0) return 20;
  if (averageRating >= 3.5) return 10;
  if (averageRating >= 3.0 || averageRating === 0) return 0;
  if (averageRating >= 2.0) return -5;
  return -15;
};

const buildReactionCounts = (reactionRows) =>
  REACTION_CONFIG.reduce(
    (counts, reaction) => ({
      ...counts,
      [reaction.key]: reactionRows.filter((row) => row.reaction === reaction.key)
        .length,
    }),
    {}
  );

const calculateAuraScore = (creation, creationReactions, creationRatings, creationComments) => {
  const reactionCounts = buildReactionCounts(creationReactions);
  const reactionScore = REACTION_CONFIG.reduce(
    (score, reaction) => score + reactionCounts[reaction.key] * reaction.points,
    0
  );
  const ratingAverage = getRatingAverage(creationRatings);
  const ratingBonus = getRatingBonus(ratingAverage);
  const commentScore = creationComments.length * 2;
  const linkScore =
    (creation.github_url ? 10 : 0) +
    (creation.demo_url ? 10 : 0) +
    (creation.report_url ? 4 : 0);

  return Math.max(0, reactionScore + ratingBonus + commentScore + linkScore);
};

export default function AuraFarming() {
  const navigate = useNavigate();
  const [currentUser] = useState(getCurrentUser);
  const currentUserId = currentUser?.id ? String(currentUser.id) : "";

  const [creations, setCreations] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [comments, setComments] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [setupMissing, setSetupMissing] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortMode, setSortMode] = useState("new");
  const [creationForm, setCreationForm] = useState(EMPTY_FORM);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedCreationId, setSelectedCreationId] = useState("");
  const [ratingDraft, setRatingDraft] = useState(DEFAULT_RATING);
  const [commentDraft, setCommentDraft] = useState("");
  const [busyReaction, setBusyReaction] = useState("");
  const [isSavingRating, setIsSavingRating] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);

  const loadAuraPage = useCallback(async () => {
    if (!currentUserId) return;
    setIsLoading(true);

    const [profilesResult, creationsResult, reactionsResult, ratingsResult, commentsResult] =
      await Promise.all([
        supabase.from("lusers").select("id, username, uusername, profile_pic, bio, country"),
        supabase.from("creations").select("*").order("created_at", { ascending: false }),
        supabase.from("creation_reactions").select("*"),
        supabase.from("creation_ratings").select("*"),
        supabase.from("creation_comments").select("*").order("created_at", { ascending: true }),
      ]);

    if (creationsResult.error) {
      if (isMissingTable(creationsResult.error)) {
        setSetupMissing(true);
      } else {
        showAppToast(creationsResult.error.message, "error");
      }

      setCreations([]);
      setReactions([]);
      setRatings([]);
      setComments([]);
      setProfilesById({});
      setIsLoading(false);
      return;
    }

    setSetupMissing(false);
    setCreations(creationsResult.data || []);
    setReactions(reactionsResult.error ? [] : reactionsResult.data || []);
    setRatings(ratingsResult.error ? [] : ratingsResult.data || []);
    setComments(commentsResult.error ? [] : commentsResult.data || []);
    setProfilesById(
      (profilesResult.data || []).reduce((profiles, profile) => {
        profiles[String(profile.id)] = profile;
        return profiles;
      }, {})
    );
    setIsLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      navigate("/login", { replace: true });
      return;
    }

    loadAuraPage();
  }, [currentUserId, loadAuraPage, navigate]);

  useEffect(() => {
    if (!createModalOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [createModalOpen]);

  const enrichedCreations = useMemo(
    () =>
      creations.map((creation) => {
        const creationReactions = reactions.filter(
          (reaction) => reaction.creation_id === creation.id
        );
        const creationRatings = ratings.filter(
          (rating) => rating.creation_id === creation.id
        );
        const creationComments = comments.filter(
          (comment) => comment.creation_id === creation.id
        );
        const reactionCounts = buildReactionCounts(creationReactions);
        const averageRating = getRatingAverage(creationRatings);
        const auraScore = calculateAuraScore(
          creation,
          creationReactions,
          creationRatings,
          creationComments
        );

        return {
          ...creation,
          reactionCounts,
          averageRating,
          auraScore,
          commentsCount: creationComments.length,
          ratingsCount: creationRatings.length,
          creator: profilesById[String(creation.user_id)] || {},
          userReactions: new Set(
            creationReactions
              .filter((reaction) => String(reaction.user_id) === currentUserId)
              .map((reaction) => reaction.reaction)
          ),
          userRating:
            creationRatings.find(
              (rating) => String(rating.user_id) === currentUserId
            ) || null,
        };
      }),
    [comments, creations, currentUserId, profilesById, ratings, reactions]
  );

  const currentUserAura = useMemo(
    () =>
      enrichedCreations
        .filter((creation) => String(creation.user_id) === currentUserId)
        .reduce((total, creation) => total + creation.auraScore, 0),
    [currentUserId, enrichedCreations]
  );

  const leaderboard = useMemo(() => {
    const scoresByUser = new Map();

    enrichedCreations.forEach((creation) => {
      const userId = String(creation.user_id);
      const existing = scoresByUser.get(userId) || {
        userId,
        profile: creation.creator,
        aura: 0,
        creations: 0,
      };

      existing.aura += creation.auraScore;
      existing.creations += 1;
      scoresByUser.set(userId, existing);
    });

    return [...scoresByUser.values()]
      .sort((first, second) => second.aura - first.aura || second.creations - first.creations)
      .slice(0, 6);
  }, [enrichedCreations]);

  const filteredCreations = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();

    return enrichedCreations
      .filter((creation) => {
        const matchesType = typeFilter === "all" || creation.type === typeFilter;
        const searchable = [
          creation.title,
          creation.short_description,
          creation.problem_statement,
          creation.solution_description,
          formatList(creation.tags),
          formatList(creation.tech_stack),
          getDisplayName(creation.creator),
        ]
          .join(" ")
          .toLowerCase();

        return matchesType && (!loweredQuery || searchable.includes(loweredQuery));
      })
      .sort((first, second) => {
        if (sortMode === "top_aura") {
          return second.auraScore - first.auraScore;
        }

        if (sortMode === "most_useful") {
          return second.reactionCounts.useful - first.reactionCounts.useful;
        }

        if (sortMode === "hire_worthy") {
          return (
            second.reactionCounts.hire_worthy - first.reactionCounts.hire_worthy
          );
        }

        return new Date(second.created_at).getTime() - new Date(first.created_at).getTime();
      });
  }, [enrichedCreations, query, sortMode, typeFilter]);

  const selectedCreation = useMemo(
    () => enrichedCreations.find((creation) => creation.id === selectedCreationId),
    [enrichedCreations, selectedCreationId]
  );

  const selectedComments = useMemo(
    () =>
      selectedCreation
        ? comments.filter((comment) => comment.creation_id === selectedCreation.id)
        : [],
    [comments, selectedCreation]
  );

  const openCreationDetail = (creation) => {
    const existingRating = creation.userRating || {};
    setSelectedCreationId(creation.id);
    setRatingDraft({
      ...DEFAULT_RATING,
      ...RATING_FIELDS.reduce(
        (draft, [key]) => ({
          ...draft,
          [key]: Number(existingRating[key] || DEFAULT_RATING[key]),
        }),
        {}
      ),
      review_text: existingRating.review_text || "",
    });
    setCommentDraft("");
  };

  const persistCreationStats = async (creationId, nextReactions, nextRatings, nextComments) => {
    const creation = creations.find((item) => item.id === creationId);
    if (!creation) return;

    const counts = buildReactionCounts(nextReactions);
    const averageRating = getRatingAverage(nextRatings);
    const auraScore = calculateAuraScore(creation, nextReactions, nextRatings, nextComments);

    await supabase
      .from("creations")
      .update({
        stars_count: counts.star,
        saves_count: counts.save,
        aura_plus_count: counts.aura_plus,
        insightful_count: counts.insightful,
        useful_count: counts.useful,
        innovative_count: counts.innovative,
        hire_worthy_count: counts.hire_worthy,
        dislikes_count: counts.dislike,
        comments_count: nextComments.length,
        reviews_count: nextRatings.length,
        average_rating: averageRating,
        aura_score: auraScore,
        updated_at: new Date().toISOString(),
      })
      .eq("id", creationId);
  };

  const createCreation = async () => {
    const title = creationForm.title.trim();
    const shortDescription = creationForm.shortDescription.trim();

    if (!title || !shortDescription) {
      showAppToast("Add a title and short description.", "error");
      return;
    }

    setIsCreating(true);

    const { data, error } = await supabase
      .from("creations")
      .insert({
        user_id: currentUserId,
        type: creationForm.type,
        title,
        short_description: shortDescription,
        problem_statement: creationForm.problemStatement.trim() || null,
        solution_description: creationForm.solutionDescription.trim() || null,
        how_it_works: creationForm.howItWorks.trim() || null,
        tech_stack: parseList(creationForm.techStack),
        tags: parseList(creationForm.tags),
        github_url: creationForm.githubUrl.trim() || null,
        demo_url: creationForm.demoUrl.trim() || null,
        report_url: creationForm.reportUrl.trim() || null,
        cover_image_url: creationForm.coverImageUrl.trim() || null,
        research_notes: creationForm.researchNotes.trim() || null,
        challenges_faced: creationForm.challengesFaced.trim() || null,
        future_improvements: creationForm.futureImprovements.trim() || null,
        is_public: true,
      })
      .select("*")
      .single();

    setIsCreating(false);

    if (error) {
      if (isMissingTable(error)) {
        setSetupMissing(true);
      }
      showAppToast(error.message, "error");
      return;
    }

    setCreations((existing) => [data, ...existing]);
    setCreationForm(EMPTY_FORM);
    setCreateModalOpen(false);
    showAppToast("Creation published.", "success");
  };

  const toggleReaction = async (creation, reactionKey) => {
    if (String(creation.user_id) === currentUserId) {
      showAppToast("You cannot react to your own creation.", "error");
      return;
    }

    const busyKey = `${creation.id}:${reactionKey}`;
    setBusyReaction(busyKey);

    const existingReaction = reactions.find(
      (reaction) =>
        reaction.creation_id === creation.id &&
        String(reaction.user_id) === currentUserId &&
        reaction.reaction === reactionKey
    );

    if (existingReaction) {
      const { error } = await supabase
        .from("creation_reactions")
        .delete()
        .eq("id", existingReaction.id);

      if (error) {
        setBusyReaction("");
        showAppToast(error.message, "error");
        return;
      }

      const nextReactions = reactions.filter(
        (reaction) => reaction.id !== existingReaction.id
      );
      setReactions(nextReactions);
      await persistCreationStats(
        creation.id,
        nextReactions.filter((reaction) => reaction.creation_id === creation.id),
        ratings.filter((rating) => rating.creation_id === creation.id),
        comments.filter((comment) => comment.creation_id === creation.id)
      );
      setBusyReaction("");
      return;
    }

    const { data, error } = await supabase
      .from("creation_reactions")
      .insert({
        creation_id: creation.id,
        user_id: currentUserId,
        reaction: reactionKey,
      })
      .select("*")
      .single();

    if (error) {
      setBusyReaction("");
      showAppToast(error.message, "error");
      return;
    }

    const nextReactions = [data, ...reactions];
    setReactions(nextReactions);
    await persistCreationStats(
      creation.id,
      nextReactions.filter((reaction) => reaction.creation_id === creation.id),
      ratings.filter((rating) => rating.creation_id === creation.id),
      comments.filter((comment) => comment.creation_id === creation.id)
    );
    setBusyReaction("");
  };

  const saveRating = async () => {
    if (!selectedCreation) return;

    if (String(selectedCreation.user_id) === currentUserId) {
      showAppToast("You cannot rate your own creation.", "error");
      return;
    }

    setIsSavingRating(true);
    const payload = {
      creation_id: selectedCreation.id,
      user_id: currentUserId,
      review_text: ratingDraft.review_text.trim() || null,
      ...RATING_FIELDS.reduce(
        (values, [key]) => ({
          ...values,
          [key]: Number(ratingDraft[key] || 1),
        }),
        {}
      ),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("creation_ratings")
      .upsert(payload, { onConflict: "creation_id,user_id" })
      .select("*")
      .single();

    setIsSavingRating(false);

    if (error) {
      showAppToast(error.message, "error");
      return;
    }

    const nextRatings = [
      data,
      ...ratings.filter(
        (rating) =>
          !(
            rating.creation_id === selectedCreation.id &&
            String(rating.user_id) === currentUserId
          )
      ),
    ];
    setRatings(nextRatings);
    await persistCreationStats(
      selectedCreation.id,
      reactions.filter((reaction) => reaction.creation_id === selectedCreation.id),
      nextRatings.filter((rating) => rating.creation_id === selectedCreation.id),
      comments.filter((comment) => comment.creation_id === selectedCreation.id)
    );
    showAppToast("Rating saved.", "success");
  };

  const addComment = async () => {
    if (!selectedCreation) return;
    const comment = commentDraft.trim();

    if (!comment) {
      showAppToast("Write a useful review before posting.", "error");
      return;
    }

    setIsCommenting(true);
    const { data, error } = await supabase
      .from("creation_comments")
      .insert({
        creation_id: selectedCreation.id,
        user_id: currentUserId,
        comment,
      })
      .select("*")
      .single();
    setIsCommenting(false);

    if (error) {
      showAppToast(error.message, "error");
      return;
    }

    const nextComments = [...comments, data];
    setComments(nextComments);
    setCommentDraft("");
    await persistCreationStats(
      selectedCreation.id,
      reactions.filter((reaction) => reaction.creation_id === selectedCreation.id),
      ratings.filter((rating) => rating.creation_id === selectedCreation.id),
      nextComments.filter((item) => item.creation_id === selectedCreation.id)
    );
  };

  const renderCreationCard = (creation) => {
    const isOwnCreation = String(creation.user_id) === currentUserId;
    const tags = Array.isArray(creation.tags) ? creation.tags : [];
    const techStack = Array.isArray(creation.tech_stack) ? creation.tech_stack : [];

    return (
      <article className="aura-creation-card" key={creation.id}>
        {creation.cover_image_url ? (
          <img className="aura-creation-cover" src={creation.cover_image_url} alt="" />
        ) : (
          <div className="aura-creation-cover empty">
            <Lightbulb size={28} />
          </div>
        )}

        <div className="aura-card-main">
          <div className="aura-card-topline">
            <span>{getTypeLabel(creation.type)}</span>
            <strong>{creation.auraScore} aura</strong>
          </div>

          <h3>{creation.title}</h3>
          <p>{creation.short_description}</p>

          <div className="aura-tag-row">
            {tags.slice(0, 4).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
            {techStack.slice(0, 3).map((tech) => (
              <span className="tech" key={tech}>{tech}</span>
            ))}
          </div>

          <div className="aura-creator-row">
            <img src={creation.creator?.profile_pic || DEFAULT_AVATAR} alt="" />
            <span>
              <strong>{getDisplayName(creation.creator)}</strong>
              <small>
                {creation.averageRating ? `${creation.averageRating}/5` : "No ratings"} -{" "}
                {creation.commentsCount} reviews
              </small>
            </span>
          </div>

          <div className="aura-reaction-row">
            {REACTION_CONFIG.map(({ key, label, icon: Icon }) => {
              const active = creation.userReactions.has(key);
              return (
                <button
                  type="button"
                  className={active ? "active" : ""}
                  key={key}
                  disabled={isOwnCreation || busyReaction === `${creation.id}:${key}`}
                  title={isOwnCreation ? "Own creations cannot be reacted to" : label}
                  onClick={() => toggleReaction(creation, key)}
                >
                  <Icon size={14} />
                  <span>{creation.reactionCounts[key] || 0}</span>
                </button>
              );
            })}
          </div>

          <div className="aura-card-actions">
            <button type="button" onClick={() => openCreationDetail(creation)}>
              Open proof
            </button>
            {creation.github_url && (
              <a href={creation.github_url} target="_blank" rel="noreferrer">
                <Code2 size={15} />
                GitHub
              </a>
            )}
            {creation.demo_url && (
              <a href={creation.demo_url} target="_blank" rel="noreferrer">
                <ExternalLink size={15} />
                Demo
              </a>
            )}
          </div>
        </div>
      </article>
    );
  };

  if (isLoading) {
    return <p className="profile-loading">Loading aura farming...</p>;
  }

  return (
    <main className="page aura-page">
      <header className="aura-hero">
        <div>
          <span className="aura-eyebrow">
            <Flame size={16} />
            Aura Farming
          </span>
          <h1>Proof-of-work creations</h1>
          <p>
            Publish projects, research notes, tools, case studies, and portfolio
            items. Aura comes from useful community signals, ratings, and reviews.
          </p>
        </div>

        <div className="aura-user-score">
          <span>Your aura</span>
          <strong>{currentUserAura}</strong>
          <small>{getAuraLevel(currentUserAura)}</small>
        </div>

        <button
          className="aura-create-button"
          type="button"
          onClick={() => setCreateModalOpen(true)}
        >
          <Plus size={17} />
          Create
        </button>
      </header>

      {setupMissing && (
        <p className="aura-schema-note">
          Run <strong>backend/schemas/aura-farming-schema.sql</strong> in Supabase
          to enable creations, reactions, ratings, and comments.
        </p>
      )}

      <section className="aura-toolbar" aria-label="Aura creation controls">
        <label className="aura-search-field">
          <Search size={16} />
          <input
            value={query}
            placeholder="Search creations, tags, stack, or creators"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <label>
          <SlidersHorizontal size={16} />
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="all">All types</option>
            {CREATION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <Trophy size={16} />
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
            <option value="new">New</option>
            <option value="top_aura">Top Aura</option>
            <option value="most_useful">Most Useful</option>
            <option value="hire_worthy">Hire-worthy</option>
          </select>
        </label>
      </section>

      <section className="aura-layout">
        <div className="aura-feed">
          <div className="aura-section-heading">
            <div>
              <span className="aura-eyebrow">Creations</span>
              <h2>Builder proof feed</h2>
            </div>
            <strong>{filteredCreations.length} shown</strong>
          </div>

          {filteredCreations.length === 0 ? (
            <p className="aura-empty">
              No creations yet. Publish a project, research note, tool, or portfolio
              item to start farming aura.
            </p>
          ) : (
            <div className="aura-card-grid">
              {filteredCreations.map(renderCreationCard)}
            </div>
          )}
        </div>

        <aside className="aura-side-panel">
          <section className="aura-leaderboard">
            <div className="aura-section-heading compact">
              <div>
                <span className="aura-eyebrow">Leaderboard</span>
                <h2>Top creators</h2>
              </div>
            </div>

            {leaderboard.length === 0 ? (
              <p className="aura-empty compact">No aura scores yet.</p>
            ) : (
              <div className="aura-leader-list">
                {leaderboard.map((leader, index) => (
                  <div key={leader.userId}>
                    <strong>#{index + 1}</strong>
                    <img src={leader.profile?.profile_pic || DEFAULT_AVATAR} alt="" />
                    <span>
                      <b>{getDisplayName(leader.profile)}</b>
                      <small>{leader.creations} creations</small>
                    </span>
                    <em>{leader.aura}</em>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="aura-rules-card">
            <span className="aura-eyebrow">Aura rules</span>
            <h2>Signals that matter</h2>
            <div>
              <p><Star size={15} /> Star, save, useful, and insight signals add aura.</p>
              <p><BriefcaseBusiness size={15} /> Hire-worthy signals carry the strongest weight.</p>
              <p><ThumbsDown size={15} /> Dislikes are limited and small quality signals.</p>
            </div>
          </section>
        </aside>
      </section>

      {createModalOpen && (
        <div className="aura-modal-backdrop" role="presentation">
          <section
            className="aura-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="aura-create-title"
          >
            <div className="aura-modal-heading">
              <div>
                <span className="aura-eyebrow">Proof of work</span>
                <h2 id="aura-create-title">Create a creation</h2>
              </div>
              <button
                type="button"
                aria-label="Close creation form"
                onClick={() => setCreateModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="aura-form-grid">
              <label>
                <span>Post type</span>
                <select
                  value={creationForm.type}
                  onChange={(event) =>
                    setCreationForm((current) => ({
                      ...current,
                      type: event.target.value,
                    }))
                  }
                >
                  {CREATION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Title</span>
                <input
                  value={creationForm.title}
                  onChange={(event) =>
                    setCreationForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="wide">
                <span>Short description</span>
                <textarea
                  value={creationForm.shortDescription}
                  onChange={(event) =>
                    setCreationForm((current) => ({
                      ...current,
                      shortDescription: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Problem it solves</span>
                <textarea
                  value={creationForm.problemStatement}
                  onChange={(event) =>
                    setCreationForm((current) => ({
                      ...current,
                      problemStatement: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Solution</span>
                <textarea
                  value={creationForm.solutionDescription}
                  onChange={(event) =>
                    setCreationForm((current) => ({
                      ...current,
                      solutionDescription: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="wide">
                <span>How it works</span>
                <textarea
                  value={creationForm.howItWorks}
                  onChange={(event) =>
                    setCreationForm((current) => ({
                      ...current,
                      howItWorks: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Tech stack</span>
                <input
                  placeholder="React, Supabase, FastAPI"
                  value={creationForm.techStack}
                  onChange={(event) =>
                    setCreationForm((current) => ({
                      ...current,
                      techStack: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Tags</span>
                <input
                  placeholder="AI, RAG, Portfolio"
                  value={creationForm.tags}
                  onChange={(event) =>
                    setCreationForm((current) => ({
                      ...current,
                      tags: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>GitHub URL</span>
                <input
                  value={creationForm.githubUrl}
                  onChange={(event) =>
                    setCreationForm((current) => ({
                      ...current,
                      githubUrl: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Live demo URL</span>
                <input
                  value={creationForm.demoUrl}
                  onChange={(event) =>
                    setCreationForm((current) => ({
                      ...current,
                      demoUrl: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Report / PDF URL</span>
                <input
                  value={creationForm.reportUrl}
                  onChange={(event) =>
                    setCreationForm((current) => ({
                      ...current,
                      reportUrl: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Cover image URL</span>
                <input
                  value={creationForm.coverImageUrl}
                  onChange={(event) =>
                    setCreationForm((current) => ({
                      ...current,
                      coverImageUrl: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Research notes</span>
                <textarea
                  value={creationForm.researchNotes}
                  onChange={(event) =>
                    setCreationForm((current) => ({
                      ...current,
                      researchNotes: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Challenges faced</span>
                <textarea
                  value={creationForm.challengesFaced}
                  onChange={(event) =>
                    setCreationForm((current) => ({
                      ...current,
                      challengesFaced: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="wide">
                <span>Future improvements</span>
                <textarea
                  value={creationForm.futureImprovements}
                  onChange={(event) =>
                    setCreationForm((current) => ({
                      ...current,
                      futureImprovements: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="aura-modal-actions">
              <button type="button" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </button>
              <button type="button" disabled={isCreating} onClick={createCreation}>
                <Send size={16} />
                {isCreating ? "Publishing..." : "Publish creation"}
              </button>
            </div>
          </section>
        </div>
      )}

      {selectedCreation && (
        <div className="aura-modal-backdrop" role="presentation">
          <section
            className="aura-modal aura-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="aura-detail-title"
          >
            <div className="aura-modal-heading">
              <div>
                <span className="aura-eyebrow">{getTypeLabel(selectedCreation.type)}</span>
                <h2 id="aura-detail-title">{selectedCreation.title}</h2>
              </div>
              <button
                type="button"
                aria-label="Close creation detail"
                onClick={() => setSelectedCreationId("")}
              >
                <X size={18} />
              </button>
            </div>

            <div className="aura-detail-grid">
              <section className="aura-proof-panel">
                <div className="aura-proof-score">
                  <strong>{selectedCreation.auraScore}</strong>
                  <span>Aura score</span>
                  <small>{selectedCreation.averageRating || 0}/5 average rating</small>
                </div>

                <p>{selectedCreation.short_description}</p>

                {[
                  ["Problem", selectedCreation.problem_statement],
                  ["Solution", selectedCreation.solution_description],
                  ["How it works", selectedCreation.how_it_works],
                  ["Research notes", selectedCreation.research_notes],
                  ["Challenges", selectedCreation.challenges_faced],
                  ["Future improvements", selectedCreation.future_improvements],
                ].map(([label, value]) =>
                  value ? (
                    <div className="aura-proof-block" key={label}>
                      <span>{label}</span>
                      <p>{value}</p>
                    </div>
                  ) : null
                )}

                <div className="aura-proof-links">
                  {selectedCreation.github_url && (
                    <a href={selectedCreation.github_url} target="_blank" rel="noreferrer">
                      <Code2 size={15} />
                      GitHub
                    </a>
                  )}
                  {selectedCreation.demo_url && (
                    <a href={selectedCreation.demo_url} target="_blank" rel="noreferrer">
                      <ExternalLink size={15} />
                      Live demo
                    </a>
                  )}
                  {selectedCreation.report_url && (
                    <a href={selectedCreation.report_url} target="_blank" rel="noreferrer">
                      <LinkIcon size={15} />
                      Report
                    </a>
                  )}
                </div>
              </section>

              <aside className="aura-rating-panel">
                <span className="aura-eyebrow">Builder rating</span>
                <h3>Rate this creation</h3>
                {RATING_FIELDS.map(([key, label]) => (
                  <label className="aura-rating-row" key={key}>
                    <span>{label}</span>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={ratingDraft[key]}
                      onChange={(event) =>
                        setRatingDraft((current) => ({
                          ...current,
                          [key]: Number(event.target.value),
                        }))
                      }
                    />
                    <b>{ratingDraft[key]}</b>
                  </label>
                ))}
                <textarea
                  value={ratingDraft.review_text}
                  placeholder="Optional review"
                  onChange={(event) =>
                    setRatingDraft((current) => ({
                      ...current,
                      review_text: event.target.value,
                    }))
                  }
                />
                <button type="button" disabled={isSavingRating} onClick={saveRating}>
                  {isSavingRating ? "Saving..." : "Save rating"}
                </button>
              </aside>
            </div>

            <section className="aura-comments-panel">
              <div className="aura-section-heading compact">
                <div>
                  <span className="aura-eyebrow">Reviews</span>
                  <h2>Comments</h2>
                </div>
                <strong>{selectedComments.length}</strong>
              </div>

              <div className="aura-comment-composer">
                <textarea
                  value={commentDraft}
                  placeholder="Leave a useful review, suggestion, or proof signal..."
                  onChange={(event) => setCommentDraft(event.target.value)}
                />
                <button type="button" disabled={isCommenting} onClick={addComment}>
                  <MessageSquare size={15} />
                  {isCommenting ? "Posting..." : "Post review"}
                </button>
              </div>

              {selectedComments.length === 0 ? (
                <p className="aura-empty compact">No reviews yet.</p>
              ) : (
                <div className="aura-comment-list">
                  {selectedComments.map((comment) => {
                    const author = profilesById[String(comment.user_id)] || {};
                    return (
                      <article key={comment.id}>
                        <img src={author.profile_pic || DEFAULT_AVATAR} alt="" />
                        <span>
                          <strong>{getDisplayName(author)}</strong>
                          <small>{new Date(comment.created_at).toLocaleString()}</small>
                          <p>{comment.comment}</p>
                        </span>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </section>
        </div>
      )}
    </main>
  );
}
