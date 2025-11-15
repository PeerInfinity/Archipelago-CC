#!/bin/bash

# Interactive Branch Fetch and Merge Script
# This script helps you fetch and merge remote branches interactively

# Color codes for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# State file to track pending merges
STATE_FILE=".git/branch-merge-state"

# Function to add branch to pending merges
add_pending_merge() {
    local branch_name="$1"
    echo "$branch_name" >> "$STATE_FILE"
}

# Function to remove branch from pending merges
remove_pending_merge() {
    local branch_name="$1"
    if [ -f "$STATE_FILE" ]; then
        grep -v "^${branch_name}$" "$STATE_FILE" > "${STATE_FILE}.tmp" || true
        mv "${STATE_FILE}.tmp" "$STATE_FILE"
        # Remove state file if empty
        if [ ! -s "$STATE_FILE" ]; then
            rm -f "$STATE_FILE"
        fi
    fi
}

# Function to get pending merges
get_pending_merges() {
    if [ -f "$STATE_FILE" ]; then
        cat "$STATE_FILE"
    fi
}

# Function to check if there are pending merges
has_pending_merges() {
    [ -f "$STATE_FILE" ] && [ -s "$STATE_FILE" ]
}

# Function to get unfetched branches (remote branches without local counterpart or with updates)
get_unfetched_branches() {
    local unfetched=()

    # Get all remote branches directly from the remote server (without fetching)
    while IFS=$'\t' read -r remote_hash ref; do
        # Extract branch name from refs/heads/branch_name
        local branch_name="${ref#refs/heads/}"

        # Check if local branch exists
        if ! git show-ref --verify --quiet "refs/heads/$branch_name"; then
            # Branch doesn't exist locally at all
            unfetched+=("$branch_name [new]")
        else
            # Branch exists locally, check if remote has updates
            local local_hash=$(git rev-parse "refs/heads/$branch_name" 2>/dev/null)
            if [ "$local_hash" != "$remote_hash" ]; then
                # Remote has different commits (could be ahead, behind, or diverged)
                # Check if remote is ahead of local
                if git merge-base --is-ancestor "$local_hash" "$remote_hash" 2>/dev/null; then
                    unfetched+=("$branch_name [updates]")
                elif git merge-base --is-ancestor "$remote_hash" "$local_hash" 2>/dev/null; then
                    # Local is ahead of remote, skip
                    :
                else
                    # Branches have diverged
                    unfetched+=("$branch_name [diverged]")
                fi
            fi
        fi
    done < <(git ls-remote --heads origin)

    printf '%s\n' "${unfetched[@]}"
}

# Function to display branches and get user selection
select_branch() {
    local branches=("$@")
    local count=${#branches[@]}

    if [ "$count" -eq 0 ]; then
        echo -e "${GREEN}All remote branches are up to date!${NC}" >&2
        return 1
    fi

    echo -e "${BLUE}=== Branches with Updates ===${NC}" >&2
    for i in "${!branches[@]}"; do
        echo "$((i+1)). ${branches[$i]}" >&2
    done
    echo >&2

    while true; do
        read -p "Select a branch to fetch [1-$count, default: 1]: " selection >&2

        # Default to first branch if user just presses enter
        if [ -z "$selection" ]; then
            selection=1
        fi

        if [[ "$selection" =~ ^[0-9]+$ ]] && [ "$selection" -ge 1 ] && [ "$selection" -le "$count" ]; then
            echo "${branches[$((selection-1))]}"
            return 0
        else
            echo -e "${RED}Invalid selection. Please enter a number between 1 and $count.${NC}" >&2
        fi
    done
}

# Function to select merge type
select_merge_type() {
    echo -e "${BLUE}=== Merge Options ===${NC}" >&2
    echo "1. No-commit, no-fast-forward merge (default)" >&2
    echo "2. Automated merge (fast-forward if possible)" >&2
    echo >&2

    read -p "Select merge type [1]: " merge_choice >&2

    # Default to option 1 if user just presses enter
    if [ -z "$merge_choice" ]; then
        merge_choice=1
    fi

    echo "$merge_choice"
}

# Function to handle pending merges
handle_pending_merges() {
    if ! has_pending_merges; then
        return 0
    fi

    echo -e "${YELLOW}=== Pending Merges Detected ===${NC}"
    echo -e "${YELLOW}The following branches were fetched but not merged in a previous session:${NC}"
    echo

    local pending_branches=()
    mapfile -t pending_branches < <(get_pending_merges)

    for branch in "${pending_branches[@]}"; do
        echo "  - $branch"
    done
    echo

    read -p "Do you want to handle pending merges now? [Y/n]: " handle_pending

    if [ -z "$handle_pending" ]; then
        handle_pending="Y"
    fi

    if [[ "$handle_pending" =~ ^[Yy]$ ]]; then
        for branch in "${pending_branches[@]}"; do
            echo -e "${BLUE}========================================${NC}"
            echo -e "${GREEN}Pending branch: $branch${NC}"
            echo

            # Select merge type
            merge_type=$(select_merge_type)
            echo

            # Perform merge (without fetch since it was already fetched)
            perform_merge_only "$branch" "$merge_type"
            echo
        done
    else
        echo -e "${BLUE}Skipping pending merges. They will be shown again next time.${NC}"
        echo
    fi
}

# Function to perform only the merge (no fetch)
perform_merge_only() {
    local branch_name="$1"
    local merge_type="$2"

    # Ask if user wants to merge now
    read -p "Do you want to merge $branch_name into the current branch? [Y/n]: " merge_confirm

    # Default to Y if user just presses enter
    if [ -z "$merge_confirm" ]; then
        merge_confirm="Y"
    fi

    if [[ "$merge_confirm" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Merging $branch_name...${NC}"

        if [ "$merge_type" = "1" ]; then
            # No-commit, no-fast-forward merge
            git merge --no-commit --no-ff "$branch_name"
            echo -e "${GREEN}Merge prepared (not committed). Review changes and commit when ready.${NC}"
        else
            # Automated merge
            git merge "$branch_name"
            echo -e "${GREEN}Merge completed.${NC}"
        fi

        # Remove from pending merges since merge was attempted
        remove_pending_merge "$branch_name"
        echo

        # Ask if user wants to clean temporary files
        read -p "Do you want to clean temporary files? [Y/n]: " clean_confirm

        # Default to Y if user just presses enter
        if [ -z "$clean_confirm" ]; then
            clean_confirm="Y"
        fi

        if [[ "$clean_confirm" =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}Cleaning temporary files...${NC}"

            # Unstage and discard changes in CC/scripts/logs/
            if [ -d "CC/scripts/logs" ]; then
                # First, resolve any merge conflicts in this directory by removing the files
                git diff --name-only --diff-filter=U | grep "^CC/scripts/logs/" | while read -r file; do
                    rm -f "$file"
                    git add "$file" 2>/dev/null || true
                done
                git reset -- CC/scripts/logs/ 2>/dev/null || true
                git checkout -- CC/scripts/logs/ 2>/dev/null || true
                git clean -fd CC/scripts/logs/ 2>/dev/null || true
            fi

            # Unstage and discard changes in frontend/presets/
            if [ -d "frontend/presets" ]; then
                # First, resolve any merge conflicts in this directory by removing the files
                git diff --name-only --diff-filter=U | grep "^frontend/presets/" | while read -r file; do
                    rm -f "$file"
                    git add "$file" 2>/dev/null || true
                done
                git reset -- frontend/presets/ 2>/dev/null || true
                git checkout -- frontend/presets/ 2>/dev/null || true
                git clean -fd frontend/presets/ 2>/dev/null || true
            fi

            # Unstage and discard changes in scripts/output/
            if [ -d "scripts/output" ]; then
                # First, resolve any merge conflicts in this directory by removing the files
                git diff --name-only --diff-filter=U | grep "^scripts/output/" | while read -r file; do
                    rm -f "$file"
                    git add "$file" 2>/dev/null || true
                done
                git reset -- scripts/output/ 2>/dev/null || true
                git checkout -- scripts/output/ 2>/dev/null || true
                git clean -fd scripts/output/ 2>/dev/null || true
            fi

            # Remove new text files in project root directory
            for txtfile in *.txt; do
                if [ -f "$txtfile" ] && git ls-files --error-unmatch "$txtfile" >/dev/null 2>&1; then
                    # File is tracked by git, skip
                    :
                elif [ -f "$txtfile" ]; then
                    # File exists and is not tracked by git, remove it
                    rm -f "$txtfile"
                    echo "  Removed untracked: $txtfile"
                fi
            done

            echo -e "${GREEN}Temporary files cleaned.${NC}"
        else
            echo -e "${BLUE}Skipped cleaning temporary files.${NC}"
        fi

        # Check for merge conflicts
        if git diff --name-only --diff-filter=U | grep -q .; then
            echo
            echo -e "${YELLOW}=== Merge Conflicts Detected ===${NC}"
            echo -e "${YELLOW}The following files have conflicts:${NC}"
            git diff --name-only --diff-filter=U | while read -r file; do
                echo "  - $file"
            done
            echo

            echo -e "${BLUE}Conflict resolution options:${NC}"
            echo "1. Ignore (handle conflicts manually - default)"
            echo "2. Accept theirs (use incoming changes for all conflicts)"
            echo "3. Accept ours (keep current changes for all conflicts)"
            echo

            read -p "Select conflict resolution [1]: " conflict_choice

            # Default to option 1 if user just presses enter
            if [ -z "$conflict_choice" ]; then
                conflict_choice=1
            fi

            case "$conflict_choice" in
                2)
                    echo -e "${YELLOW}Resolving conflicts by accepting theirs...${NC}"
                    git diff --name-only --diff-filter=U | while read -r file; do
                        git checkout --theirs "$file"
                        git add "$file"
                        echo "  Resolved: $file (accepted theirs)"
                    done
                    echo -e "${GREEN}All conflicts resolved by accepting incoming changes.${NC}"
                    ;;
                3)
                    echo -e "${YELLOW}Resolving conflicts by accepting ours...${NC}"
                    git diff --name-only --diff-filter=U | while read -r file; do
                        git checkout --ours "$file"
                        git add "$file"
                        echo "  Resolved: $file (kept ours)"
                    done
                    echo -e "${GREEN}All conflicts resolved by keeping current changes.${NC}"
                    ;;
                *)
                    echo -e "${BLUE}Conflicts left for manual resolution.${NC}"
                    ;;
            esac
        fi
    else
        echo -e "${BLUE}Skipped merge. Branch $branch_name is available locally.${NC}"
    fi
}

# Function to perform fetch and merge
fetch_and_merge() {
    local branch_with_status="$1"
    local merge_type="$2"

    # Extract branch name by removing status suffix
    local branch_name="${branch_with_status%% \[*\]}"
    local status=""
    if [[ "$branch_with_status" =~ \[(.*)\] ]]; then
        status="${BASH_REMATCH[1]}"
    fi

    echo -e "${YELLOW}Fetching branch: $branch_name${NC}"

    # Fetch the specific branch
    if [ "$status" = "new" ]; then
        # For new branches, create local branch from remote
        git fetch origin "$branch_name:$branch_name"
    else
        # For existing branches with updates or diverged, just fetch
        git fetch origin "$branch_name:$branch_name"
    fi

    echo -e "${GREEN}Successfully fetched $branch_name${NC}"

    # Track that this branch has been fetched but not yet merged
    add_pending_merge "$branch_name"
    echo

    # Ask if user wants to merge now
    read -p "Do you want to merge $branch_name into the current branch? [Y/n]: " merge_confirm

    # Default to Y if user just presses enter
    if [ -z "$merge_confirm" ]; then
        merge_confirm="Y"
    fi

    if [[ "$merge_confirm" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Merging $branch_name...${NC}"

        if [ "$merge_type" = "1" ]; then
            # No-commit, no-fast-forward merge
            git merge --no-commit --no-ff "$branch_name"
            echo -e "${GREEN}Merge prepared (not committed). Review changes and commit when ready.${NC}"
        else
            # Automated merge
            git merge "$branch_name"
            echo -e "${GREEN}Merge completed.${NC}"
        fi

        # Remove from pending merges since merge was attempted
        remove_pending_merge "$branch_name"
        echo

        # Ask if user wants to clean temporary files
        read -p "Do you want to clean temporary files? [Y/n]: " clean_confirm

        # Default to Y if user just presses enter
        if [ -z "$clean_confirm" ]; then
            clean_confirm="Y"
        fi

        if [[ "$clean_confirm" =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}Cleaning temporary files...${NC}"

            # Unstage and discard changes in CC/scripts/logs/
            if [ -d "CC/scripts/logs" ]; then
                # First, resolve any merge conflicts in this directory by removing the files
                git diff --name-only --diff-filter=U | grep "^CC/scripts/logs/" | while read -r file; do
                    rm -f "$file"
                    git add "$file" 2>/dev/null || true
                done
                git reset -- CC/scripts/logs/ 2>/dev/null || true
                git checkout -- CC/scripts/logs/ 2>/dev/null || true
                git clean -fd CC/scripts/logs/ 2>/dev/null || true
            fi

            # Unstage and discard changes in frontend/presets/
            if [ -d "frontend/presets" ]; then
                # First, resolve any merge conflicts in this directory by removing the files
                git diff --name-only --diff-filter=U | grep "^frontend/presets/" | while read -r file; do
                    rm -f "$file"
                    git add "$file" 2>/dev/null || true
                done
                git reset -- frontend/presets/ 2>/dev/null || true
                git checkout -- frontend/presets/ 2>/dev/null || true
                git clean -fd frontend/presets/ 2>/dev/null || true
            fi

            # Unstage and discard changes in scripts/output/
            if [ -d "scripts/output" ]; then
                # First, resolve any merge conflicts in this directory by removing the files
                git diff --name-only --diff-filter=U | grep "^scripts/output/" | while read -r file; do
                    rm -f "$file"
                    git add "$file" 2>/dev/null || true
                done
                git reset -- scripts/output/ 2>/dev/null || true
                git checkout -- scripts/output/ 2>/dev/null || true
                git clean -fd scripts/output/ 2>/dev/null || true
            fi

            # Remove new text files in project root directory
            for txtfile in *.txt; do
                if [ -f "$txtfile" ] && git ls-files --error-unmatch "$txtfile" >/dev/null 2>&1; then
                    # File is tracked by git, skip
                    :
                elif [ -f "$txtfile" ]; then
                    # File exists and is not tracked by git, remove it
                    rm -f "$txtfile"
                    echo "  Removed untracked: $txtfile"
                fi
            done

            echo -e "${GREEN}Temporary files cleaned.${NC}"
        else
            echo -e "${BLUE}Skipped cleaning temporary files.${NC}"
        fi

        # Check for merge conflicts
        if git diff --name-only --diff-filter=U | grep -q .; then
            echo
            echo -e "${YELLOW}=== Merge Conflicts Detected ===${NC}"
            echo -e "${YELLOW}The following files have conflicts:${NC}"
            git diff --name-only --diff-filter=U | while read -r file; do
                echo "  - $file"
            done
            echo

            echo -e "${BLUE}Conflict resolution options:${NC}"
            echo "1. Ignore (handle conflicts manually - default)"
            echo "2. Accept theirs (use incoming changes for all conflicts)"
            echo "3. Accept ours (keep current changes for all conflicts)"
            echo

            read -p "Select conflict resolution [1]: " conflict_choice

            # Default to option 1 if user just presses enter
            if [ -z "$conflict_choice" ]; then
                conflict_choice=1
            fi

            case "$conflict_choice" in
                2)
                    echo -e "${YELLOW}Resolving conflicts by accepting theirs...${NC}"
                    git diff --name-only --diff-filter=U | while read -r file; do
                        git checkout --theirs "$file"
                        git add "$file"
                        echo "  Resolved: $file (accepted theirs)"
                    done
                    echo -e "${GREEN}All conflicts resolved by accepting incoming changes.${NC}"
                    ;;
                3)
                    echo -e "${YELLOW}Resolving conflicts by accepting ours...${NC}"
                    git diff --name-only --diff-filter=U | while read -r file; do
                        git checkout --ours "$file"
                        git add "$file"
                        echo "  Resolved: $file (kept ours)"
                    done
                    echo -e "${GREEN}All conflicts resolved by keeping current changes.${NC}"
                    ;;
                *)
                    echo -e "${BLUE}Conflicts left for manual resolution.${NC}"
                    ;;
            esac
        fi
    else
        echo -e "${BLUE}Skipped merge. Branch $branch_name has been fetched and is available locally.${NC}"
    fi
}

# Main loop
main() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Interactive Branch Fetch & Merge${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo

    # Check for and handle any pending merges from previous sessions
    handle_pending_merges

    while true; do
        # Get unfetched branches
        mapfile -t unfetched_branches < <(get_unfetched_branches)

        # If no branches with updates, exit
        if [ "${#unfetched_branches[@]}" -eq 0 ]; then
            echo -e "${GREEN}All remote branches are up to date!${NC}"
            break
        fi

        # Display and select branch
        selected_branch=$(select_branch "${unfetched_branches[@]}")
        if [ $? -ne 0 ]; then
            break
        fi

        echo -e "${GREEN}Selected branch: $selected_branch${NC}"
        echo

        # Select merge type
        merge_type=$(select_merge_type)
        echo

        # Perform fetch and merge
        fetch_and_merge "$selected_branch" "$merge_type"
        echo

        # Check if this was the last branch
        mapfile -t remaining_branches < <(get_unfetched_branches)
        if [ "${#remaining_branches[@]}" -eq 0 ]; then
            echo -e "${GREEN}That was the last branch with updates!${NC}"
            break
        fi

        # Ask if user wants to continue
        echo -e "${BLUE}Remaining branches with updates: ${#remaining_branches[@]}${NC}"
        read -p "Continue with another branch? [Y/n]: " continue_choice

        if [[ "$continue_choice" =~ ^[Nn]$ ]]; then
            echo -e "${BLUE}Exiting. You can run this script again to update remaining branches.${NC}"
            break
        fi

        echo
        echo -e "${BLUE}========================================${NC}"
        echo
    done

    echo -e "${GREEN}Done!${NC}"
}

# Run main function
main
