from app.languages.language_config import LanguageConfig


LANGUAGES = {

    "python": LanguageConfig(
        name="python",
        file_extension=".py",
        image="typhon-python",
        run_command=[
            "python",
            "/sandbox/python/main.py"
        ],
        container_path="/sandbox/python/main.py"
    ),
    "java": LanguageConfig(
        name="java",
        file_extension=".java",
        image="typhon-java",
        compile_command=[
            "javac",
            "-cp",
            "/libs/gson.jar",
            "/sandbox/Main.java"
        ],
        run_command=[
            "java",
            "-cp",
            "/sandbox:/libs/gson.jar",
            "Main"
        ],
    
        container_path="/sandbox/Main.java"
    ),
    "cpp": LanguageConfig(
        name="cpp",
        file_extension=".cpp",
        image="typhon-cpp",
    
        compile_command=[
            "g++",
            "/sandbox/main.cpp",
            "-o",
            "/sandbox/main"
        ],
    
        run_command=[
            "/sandbox/main"
        ],
    
        container_path="/sandbox/main.cpp"
    )
}