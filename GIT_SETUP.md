# Git Setup Instructions

## To push this repository to GitHub:

### Step 1: Install Git (if not installed)
Download and install Git from: https://git-scm.com/download/win

### Step 2: Initialize Git Repository
Open PowerShell or Command Prompt in the project directory and run:

```bash
cd "D:\Cse 3rd time proj"
git init
```

### Step 3: Add Remote Repository
```bash
git remote add origin https://github.com/KoushikGIT7/CSE-Cafeteria-Automation.git
```

### Step 4: Add All Files
```bash
git add .
```

### Step 5: Create Initial Commit
```bash
git commit -m "Initial commit: CSE Cafeteria Automation System"
```

### Step 6: Push to GitHub
```bash
git branch -M main
git push -u origin main
```

## If you get authentication errors:
You may need to use a Personal Access Token instead of password:
1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Generate a new token with `repo` permissions
3. Use the token as your password when pushing

## Alternative: Using GitHub Desktop
1. Download GitHub Desktop: https://desktop.github.com/
2. File > Add Local Repository
3. Select "D:\Cse 3rd time proj"
4. Publish repository to GitHub
