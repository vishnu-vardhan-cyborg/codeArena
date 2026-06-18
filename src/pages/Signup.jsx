import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { COUNTRIES } from "../data/countries";
import { supabase } from "../supabase";
import heroImage from "../assets/code-arena-hero.png";

const GENDER_OPTIONS = ["Male", "Female", "Prefer not to say"];
const PROFILE_TYPE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "employee", label: "Employee" },
  { value: "vibe_coder", label: "Vibe coder" },
];
const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export default function Signup() {
  const navigate = useNavigate();

  const [signupStep, setSignupStep] = useState("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [country, setCountry] = useState("India");
  const [profileType, setProfileType] = useState("");
  const [collegeName, setCollegeName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getCredentialError = () => {
    if (!username || !password) {
      return "Enter your email and password";
    }

    if (!GMAIL_REGEX.test(username)) {
      return "Please enter a valid Gmail address";
    }

    if (!PASSWORD_REGEX.test(password)) {
      return "Use 8+ characters with uppercase, lowercase, number, and symbol";
    }

    return "";
  };

  const handleCredentialNext = (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const credentialError = getCredentialError();
    if (credentialError) {
      setError(credentialError);
      return;
    }

    setSignupStep("details");
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const credentialError = getCredentialError();
    if (credentialError) {
      setError(credentialError);
      setSignupStep("credentials");
      return;
    }

    if (
      !username ||
      !password ||
      !name ||
      !age ||
      !gender ||
      !country ||
      !profileType
    ) {
      setError("Please fill all fields");
      return;
    }

    if (profileType === "student" && !collegeName.trim()) {
      setError("Please enter your college name");
      return;
    }

    if (profileType === "employee" && !organizationName.trim()) {
      setError("Please enter your organization name");
      return;
    }

    const ageValue = Number(age);
    if (!Number.isInteger(ageValue) || ageValue <= 0 || ageValue >= 100) {
      setError("Age must be a whole number between 1 and 99");
      return;
    }

    setIsSubmitting(true);

    const { data: existingUser } = await supabase
      .from("lusers")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (existingUser) {
      setError("Email already exists");
      setIsSubmitting(false);
      return;
    }

    const { data: existingName } = await supabase
      .from("lusers")
      .select("*")
      .eq("uusername", name)
      .maybeSingle();

    if (existingName) {
      setError("Player name already exists");
      setIsSubmitting(false);
      return;
    }

    const { error: signupError } = await supabase.from("lusers").insert([
      {
        username,
        password,
        xp: 0,
        uusername: name,
        age: ageValue,
        gender,
        country,
        profile_type: profileType,
        college_name:
          profileType === "student" ? collegeName.trim() || null : null,
        organization_name:
          profileType === "employee" ? organizationName.trim() || null : null,
      },
    ]);

    if (signupError) {
      setError(signupError.message);
      setIsSubmitting(false);
      return;
    }

    setSuccess("Account created. Redirecting to login...");
    setTimeout(() => navigate("/login"), 900);
  };

  return (
    <div
      className="auth-page signup-page"
      style={{ "--auth-background": `url(${heroImage})` }}
    >
      <button className="auth-brand" onClick={() => navigate("/")}>
        <span className="brand-mark">&lt;/&gt;</span>
        <span>CodeArena</span>
      </button>

      <div className="auth-layout">
        <section className="auth-intro">
          <span className="hero-kicker">New challenger</span>
          <h1>Create your player profile.</h1>
          <p>
            Join the arena, solve your first challenge, and start building your
            rank.
          </p>
          <div className="signup-checklist">
            <span>Practice by difficulty</span>
            <span>Code with Typhon</span>
            <span>Join clans and chat</span>
          </div>
        </section>

        <form
          className="auth-panel signup-panel"
          onSubmit={
            signupStep === "credentials" ? handleCredentialNext : handleSignup
          }
        >
          <div className="auth-panel-heading">
            <span>Player registration</span>
            <h2>{signupStep === "credentials" ? "Create account" : "Player details"}</h2>
            <p>
              {signupStep === "credentials"
                ? "Start with your login details."
                : "Finish your arena identity."}
            </p>
          </div>

          {signupStep === "credentials" ? (
            <>
              <label className="auth-field">
                <span>Email address</span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="player@gmail.com"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </label>

              <label className="auth-field">
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="8+ characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>

              {error && <p className="auth-message error">{error}</p>}

              <button className="button-primary auth-submit" type="submit">
                Next
              </button>
            </>
          ) : (
            <>
              <div className="auth-field-row">
                <label className="auth-field auth-input-field">
                  <span>Player name</span>
                  <input
                    placeholder="Your display name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>

                <label className="auth-field auth-input-field">
                  <span>Age</span>
                  <input
                    type="number"
                    placeholder="18"
                    min="1"
                    max="99"
                    value={age}
                    onChange={(event) => setAge(event.target.value)}
                  />
                </label>
              </div>

              <label className="auth-field auth-select-field gender-select-field">
                <span>Gender</span>
                <select
                  value={gender}
                  onChange={(event) => setGender(event.target.value)}
                >
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="auth-field auth-select-field">
                <span>Country</span>
                <select
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                >
                  {COUNTRIES.map((countryName) => (
                    <option key={countryName} value={countryName}>
                      {countryName}
                    </option>
                  ))}
                </select>
              </label>

              <div className="auth-field auth-choice-field">
                <span>Select one</span>
                <div className="auth-choice-grid">
                  {PROFILE_TYPE_OPTIONS.map((option) => (
                    <button
                      type="button"
                      className={profileType === option.value ? "active" : ""}
                      key={option.value}
                      onClick={() => setProfileType(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {profileType === "student" && (
                <label className="auth-field auth-input-field">
                  <span>College name</span>
                  <input
                    placeholder="Your college"
                    value={collegeName}
                    onChange={(event) => setCollegeName(event.target.value)}
                  />
                </label>
              )}

              {profileType === "employee" && (
                <label className="auth-field auth-input-field">
                  <span>Organization</span>
                  <input
                    placeholder="Company or organization"
                    value={organizationName}
                    onChange={(event) => setOrganizationName(event.target.value)}
                  />
                </label>
              )}

              {error && <p className="auth-message error">{error}</p>}
              {success && <p className="auth-message success">{success}</p>}

              <div className="auth-step-actions">
                <button
                  className="button-outline auth-back-step"
                  type="button"
                  onClick={() => {
                    setError("");
                    setSuccess("");
                    setSignupStep("credentials");
                  }}
                  disabled={isSubmitting}
                >
                  Back
                </button>
                <button
                  className="button-primary auth-submit"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating profile..." : "Create player profile"}
                </button>
              </div>
            </>
          )}

          <p className="auth-switch">
            Already have an account?{" "}
            <button type="button" onClick={() => navigate("/login")}>
              Log in
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
