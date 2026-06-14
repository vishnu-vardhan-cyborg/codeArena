import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

const DEFAULT_AVATAR =
  "https://i.pravatar.cc/150?img=12";

const PROFILE_PICS_BUCKET = "profilepics";
const XP_GOAL = 100;

const getProfilePicPath = (url) => {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    const marker = `/storage/v1/object/public/${PROFILE_PICS_BUCKET}/`;
    const markerIndex = parsedUrl.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    const path = parsedUrl.pathname.slice(
      markerIndex + marker.length
    );

    return path ? decodeURIComponent(path) : null;
  } catch {
    return null;
  }
};

export default function Profile() {
  const navigate = useNavigate();

  const [currentUser] = useState(() =>
    JSON.parse(localStorage.getItem("loggedInUser"))
  );

  const [profile, setProfile] =
    useState(null);
  const [editedName, setEditedName] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [editMode, setEditMode] = useState(false);
  const [uploading, setUploading] = useState(false);

  

  const [friends, setFriends] =
    useState([]);

  const loadProfile = useCallback(async () => {
    const { data } = await supabase
      .from("lusers")
      .select("*")
      .eq("id", currentUser.id)
      .single();

    setProfile(data);
    setEditedName(data?.uusername || "");
    setEditMode(false);
  }, [currentUser.id]);

  const loadFriends = useCallback(async () => {
    const { data } = await supabase
      .from("friends")
      .select("*");

    const myRelations =
      data?.filter(
        (friend) =>
          friend.user1_id ===
          currentUser.id ||
          friend.user2_id ===
          currentUser.id
      ) || [];

    const friendUsers = [];

    for (const relation of myRelations) {
      const friendId =
        relation.user1_id ===
          currentUser.id
          ? relation.user2_id
          : relation.user1_id;

      const { data: friend } =
        await supabase
          .from("lusers")
          .select("*")
          .eq("id", friendId)
          .single();

      if (friend) {
        friendUsers.push(friend);
      }
    }

    setFriends(friendUsers);
  }, [currentUser.id]);

  useEffect(() => {
    loadProfile();
    loadFriends();
  }, [loadProfile, loadFriends]);

  const handleNameUpdate = async () => {
    setMessage("");
    setMessageType("success");

    const newName = editedName.trim();
    if (!newName) {
      setMessageType("error");
      setMessage("Name cannot be empty");
      return;
    }

    if (newName === profile.uusername) {
      setMessageType("error");
      setMessage("Name is unchanged");
      return;
    }

    const { data: existingName } = await supabase
      .from("lusers")
      .select("*")
      .eq("uusername", newName)
      .neq("id", currentUser.id)
      .maybeSingle();

    if (existingName) {
      setMessageType("error");
      setMessage("Name already exists");
      return;
    }

    const { data, error } = await supabase
      .from("lusers")
      .update({ uusername: newName })
      .eq("id", currentUser.id)
      .select()
      .single();

    if (error) {
      setMessageType("error");
      setMessage(error.message);
      return;
    }

    setProfile(data);
    setEditMode(false);
    const updatedUser = { ...currentUser, uusername: data.uusername };
    localStorage.setItem(
      "loggedInUser",
      JSON.stringify(updatedUser)
    );
    setMessage("Name updated successfully");
  };

  const handleProfilePicUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      event.target.value = "";
      setMessageType("error");
      setMessage("Please upload a valid image file");
      return;
    }

    setUploading(true);
    setMessage("");
    setMessageType("success");

    const extension = file.name.split(".").pop() || "jpg";
    const filePath = `${currentUser.id}/${Date.now()}.${extension}`;
    const previousPicPath = getProfilePicPath(profile.profile_pic);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(PROFILE_PICS_BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      event.target.value = "";
      setMessageType("error");
      setMessage(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from(PROFILE_PICS_BUCKET)
      .getPublicUrl(uploadData.path);

    const profileUrl = publicUrlData?.publicUrl;

    const { data, error } = await supabase
      .from("lusers")
      .update({ profile_pic: profileUrl })
      .eq("id", currentUser.id)
      .select()
      .single();

    if (error) {
      await supabase.storage
        .from(PROFILE_PICS_BUCKET)
        .remove([uploadData.path]);

      event.target.value = "";
      setUploading(false);
      setMessageType("error");
      setMessage(error.message);
      return;
    }

    let oldFileRemoved = true;
    if (previousPicPath && previousPicPath !== uploadData.path) {
      const { error: deleteError } = await supabase.storage
        .from(PROFILE_PICS_BUCKET)
        .remove([previousPicPath]);

      oldFileRemoved = !deleteError;
    }

    event.target.value = "";
    setUploading(false);

    setProfile(data);
    const updatedUser = { ...currentUser, profile_pic: profileUrl };
    localStorage.setItem("loggedInUser", JSON.stringify(updatedUser));
    setMessageType(oldFileRemoved ? "success" : "error");
    setMessage(
      oldFileRemoved
        ? "Profile picture updated successfully"
        : "Profile picture updated, but the old image could not be removed"
    );
  };

  if (!profile) {
    return <p>Loading...</p>;
  }

  const xpValue =
    profile.xp || 0;

  const progress =
    (xpValue / XP_GOAL) * 100;

  return (
    <div className="page">
      <button
        onClick={() =>
          navigate("/home")
        }
      >
        Back
      </button>

      <div className="profile-card">
        <img
          src={
            profile.profile_pic ||
            DEFAULT_AVATAR
          }
          alt="Profile"
          className="profile-avatar"
        />

        <label
          className={`btn profile-pic-btn ${uploading ? "disabled" : ""}`}
        >
          {uploading ? "Uploading..." : "Change Profile Pic"}
          <input
            type="file"
            accept="image/*"
            onChange={handleProfilePicUpload}
            disabled={uploading}
            className="profile-pic-input"
          />
        </label>

        <div className="name-edit-group">
          <h1>{profile.uusername || profile.username}</h1>
          <div className="name-actions">
            {!editMode ? (
              <button
                className="btn secondary-btn"
                onClick={() => setEditMode(true)}
              >
                Edit Name
              </button>
            ) : (
              <>
                <input
                  id="nameInput"
                  className="input"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                />
                <button className="btn" onClick={handleNameUpdate}>
                  Save Name
                </button>
                <button
                  className="btn secondary-btn"
                  onClick={() => {
                    setEditedName(profile.uusername || "");
                    setEditMode(false);
                    setMessage("");
                    setMessageType("success");
                  }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        <p>
          Email: {profile.username}
        </p>

        <p>
          Age: {profile.age ?? "N/A"}
        </p>

        <p>
          XP: {xpValue}
        </p>

        {message && <p className={messageType}>{message}</p>}

        <div className="xp-bar">
          <div
            className="xp-fill"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </div>

      <div className="friends-section">
        <h2>
          Friends (
          {friends.length})
        </h2>

        {friends.length === 0 ? (
          <p>
            No friends yet
          </p>
        ) : (
          friends.map(
            (friend) => (
              <div
                key={friend.id}
                className="friend-card"
              >
                <img
                  src={
                    friend.profile_pic ||
                    DEFAULT_AVATAR
                  }
                  alt=""
                  className="friend-avatar"
                />

                <h3>
                  {
                    friend.username
                  }
                </h3>
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}
