import os
import subprocess

SANDBOXES_DIR = "sandboxes"

for language in os.listdir(SANDBOXES_DIR):

    sandbox_path = os.path.join(
        SANDBOXES_DIR,
        language
    )

    dockerfile = os.path.join(
        sandbox_path,
        "Dockerfile"
    )

    if not os.path.isfile(dockerfile):
        continue

    image_name = f"typhon-{language}"

    print(f"Building {image_name}")

    subprocess.run(
        [
            "docker",
            "build",
            "-t",
            image_name,
            sandbox_path
        ],
        check=True
    )

print("All sandbox images built successfully.")