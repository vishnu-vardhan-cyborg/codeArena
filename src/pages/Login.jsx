import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");

    const { data, error: loginError } = await supabase
      .from("lusers")
      .select("*")
      .match({
        username,
        password,
      })
      .maybeSingle();

    if (loginError || !data) {
      setError("Invalid username or password");
      return;
    }

    localStorage.setItem(
      "loggedInUser",
      JSON.stringify(data)
    );

    localStorage.setItem(
      "isLoggedIn",
      "true"
    );

    navigate("/home");
  };

  return (
    <div className="container">
      <div className="auth-card">
        <h1>Login</h1>

        <input
          className="input"
          placeholder="Username"
          value={username}
          onChange={(e) =>
            setUsername(e.target.value)
          }
        />

        <input
          className="input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
        />

        <button
          className="btn"
          onClick={handleLogin}
        >
          Login
        </button>

        <button
          className="btn secondary-btn"
          onClick={() => navigate("/signup")}
        >
          Create Account
        </button>

        {error && (
          <p className="error">{error}</p>
        )}
      </div>
    </div>
  );
}