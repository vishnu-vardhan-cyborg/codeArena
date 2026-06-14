// src/pages/Signup.jsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function Signup() {
    const navigate = useNavigate();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [age, setAge] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleSignup = async () => {
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
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

        if (!gmailRegex.test(username)) {
            setError("Please enter a valid Gmail address");
            return;
        }

        if (!passwordRegex.test(password)) {
            setError(
                "Password must be at least 8 characters and include uppercase, lowercase, number, and special character"
            );
            return;
        }

        const { data: existingUser } = await supabase
            .from("lusers")
            .select("*")
            .eq("username", username)
            .maybeSingle();

        if (existingUser) {
            setError("Username already exists");
            return;
        }

        const { data: existingName } = await supabase
            .from("lusers")
            .select("*")
            .eq("uusername", name)
            .maybeSingle();

        if (existingName) {
            setError("Name already exists");
            return;
        }

        const { error } = await supabase
            .from("lusers")
            .insert([
                {
                    username,
                    password,
                    xp: 0,
                    uusername: name,
                    age: ageValue,
                },
            ]);

        if (error) {
            setError(error.message);
            return;
        }

        setSuccess("Account created successfully");

        setTimeout(() => {
            navigate("/");
        }, 1000);
    };
   



    return (
        <div className="container">
            <div className="auth-card">
                <h1>Create Account</h1>

                <input
                    className="input"
                    type="email"
                    placeholder="Email Address"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />

                <input
                    className="input"
                    placeholder="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />

                <input
                    className="input"
                    type="number"
                    placeholder="Age"
                    min="1"
                    max="99"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                />

                <input
                    className="input"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                <button className="btn" onClick={handleSignup}>
                    Sign Up
                </button>

                <button
                    className="btn secondary-btn"
                    onClick={() => navigate("/")}
                >
                    Back To Login
                </button>

                {error && <p className="error">{error}</p>}
                {success && <p className="success">{success}</p>}
            </div>
        </div>
    );
}