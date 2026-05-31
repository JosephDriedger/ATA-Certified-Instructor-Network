
## 📜 **4. `setup.sh`** (Bash Script for Setup)
#!/bin/bash

# Create .env file if not exists
if [ ! -f .env ]; then
    cp .env.example .env
    echo ".env file created."
else
    echo ".env file already exists."
fi

# Create required directories
mkdir -p logs data
echo "Created logs/ and data/ directories."

# Ensure logs folder has a .gitkeep
touch logs/.gitkeep
touch data/.gitkeep
echo "Added .gitkeep to logs/ and data/."

echo "✅ Setup complete!"
