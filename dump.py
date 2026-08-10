import os

# Folders and file extensions to ignore so the dump isn't too large
IGNORE_DIRS = {'.git', 'target', 'node_modules', 'venv', '.env', '__pycache__', '.idea', 'build', 'dist', '.vscode'}
IGNORE_EXTS = {'.class', '.jar', '.exe', '.pyc', '.png', '.jpg', '.ico', '.zip', '.pdf', '.db', '.sqlite3'}

OUTPUT_FILE = 'code_dump.txt'

def generate_dump():
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as outfile:
        for root, dirs, files in os.walk('.'):
            # Skip ignored directories
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

            for file in files:
                ext = os.path.splitext(file)[1].lower()
                
                # Skip ignored files and the dump script itself
                if ext in IGNORE_EXTS or file == OUTPUT_FILE or file == 'dump.py' or file == 'package-lock.json':
                    continue

                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as infile:
                        content = infile.read()
                        
                    outfile.write(f"\n{'='*70}\n")
                    outfile.write(f"FILE: {filepath}\n")
                    outfile.write(f"{'='*70}\n")
                    outfile.write(content)
                    outfile.write("\n")
                except Exception as e:
                    outfile.write(f"\n[Skipped {filepath}: Not a readable text file]\n")

    print(f"✅ Success! Your code has been saved to {OUTPUT_FILE}")

if __name__ == '__main__':
    generate_dump()