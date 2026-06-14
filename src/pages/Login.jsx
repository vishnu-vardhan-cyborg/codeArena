import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import heroImage from "../assets/code-arena-hero.png";

export default function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (event) => {
    event?.preventDefault();
    setError("");
    setIsSubmitting(true);

    const { data, error: loginError } = await supabase
      .from("lusers")
      .select("*")
      .match({
        username,
        password,
      })
      .maybeSingle();

    if (loginError || !data) {
      setError("Invalid email or password");
      setIsSubmitting(false);
      return;
    }

    localStorage.setItem("loggedInUser", JSON.stringify(data));
    localStorage.setItem("isLoggedIn", "true");
    navigate("/home");
  };

  return (
    <div
      className="auth-page"
      style={{ "--auth-background": `url(${heroImage})` }}
    >
      <button className="auth-brand" onClick={() => navigate("/")}>
        <span className="brand-mark">&lt;/&gt;</span>
        <span>CodeArena</span>
      </button>

      <div className="auth-layout">
        <section className="auth-intro">
          <span className="hero-kicker">Welcome back, player</span>
          <h1>Return to the arena.</h1>
          <p>
            Continue solving challenges, earning XP, and competing with your
            clan.
          </p>
          <div className="auth-progress">
            <span />
            <span />
            <span />
            <span />
          </div>
        </section>

        <form className="auth-panel" onSubmit={handleLogin}>
          <div className="auth-panel-heading">
            <span>Player access</span>
            <h2>Log in</h2>
            <p>Use your CodeArena account to continue.</p>
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
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error && <p className="auth-message error">{error}</p>}

          <button
            className="button-primary auth-submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Entering..." : "Enter arena"}
          </button>

          <p className="auth-switch">
            New to CodeArena?{" "}
            <button type="button" onClick={() => navigate("/signup")}>
              Create an account
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
