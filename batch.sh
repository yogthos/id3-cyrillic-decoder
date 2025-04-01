#!/bin/bash

# Check if directory is provided, default to current directory
directory="${1:-.}"

# Verify directory exists
if [ ! -d "$directory" ]; then
    echo "Error: Directory '$directory' not found!"
    exit 1
fi

# Loop through files and echo them
echo "Files in '$directory':"
for file in "$directory"/*.mp3
do
    if [ -e "$file" ]; then  # Check if file exists (handles empty directories)
        node decode.js $file
    fi
done
