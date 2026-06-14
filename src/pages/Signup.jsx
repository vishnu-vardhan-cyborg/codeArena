import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import heroImage from "../assets/code-arena-hero.png";

export default function Signup() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignup = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!username || !password || !name || !age) {
      setError("Please fill all fields");
      return;
    }

    const ageValue = Number(age);
    if (!Number.isInteger(ageValue) || ageValue <= 0 || ageValue >= 100) {
      setError("Age must be a whole number between 1 and 99");
      return;
    }

    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    if (!gmailRegex.test(username)) {
      setError("Please enter a valid Gmail address");
      return;
    }

    if (!passwordRegex.test(password)) {
      setError(
        "Use 8+ characters with uppercase, lowercase, number, and symbol"
      );
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
            <span>Run code with Judge0</span>
            <span>Join clans and chat</span>
          </div>
        </section>

        <form className="auth-panel signup-panel" onSubmit={handleSignup}>
          <div className="auth-panel-heading">
            <span>Player registration</span>
            <h2>Create account</h2>
            <p>Your first challenge is waiting.</p>
          </div>

          <div className="auth-field-row">
            <label className="auth-field">
              <span>Player name</span>
              <input
                placeholder="Your display name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <label className="auth-field">
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
          {success && <p className="auth-message success">{success}</p>}

          <button
            className="button-primary auth-submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating profile..." : "Create player profile"}
          </button>

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
