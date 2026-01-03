#!/bin/bash

# Interactive Branch Fetch and Merge Script
# This script helps you fetch and merge remote branches interactively

# Color codes for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Pagination settings
PAGE_SIZE=40

# Function to get unfetched branches (remote branches without local counterpart or with updates)
# Args: $1 = limit_date (YYYY-MM-DD format, empty for no limit)
get_unfetched_branches() {
    local limit_date="$1"
    local unfetched=()

    # Get all remote branches directly from the remote server (without fetching)
    echo -e "${BLUE}Contacting remote...${NC}" >&2
    local remote_refs=$(git ls-remote --heads origin)

    local branch_count=$(echo "$remote_refs" | wc -l)

    # Batch: Load all local branch info in one command
    echo -e "${BLUE}Loading local branch data...${NC}" >&2
    declare -A local_hashes
    declare -A local_dates
    while IFS='|' read -r branch hash date; do
        local_hashes["$branch"]="$hash"
        local_dates["$branch"]="$date"
    done < <(git for-each-ref --format='%(refname:short)|%(objectname)|%(committerdate:short)' refs/heads/)

    if [ -n "$limit_date" ]; then
        echo -e "${BLUE}Comparing $branch_count remote branches (limiting to commits after $limit_date)...${NC}" >&2
    else
        echo -e "${BLUE}Comparing $branch_count remote branches...${NC}" >&2
    fi

    while IFS=$'\t' read -r remote_hash ref; do
        # Extract branch name from refs/heads/branch_name
        local branch_name="${ref#refs/heads/}"

        # Check if local branch exists (using associative array lookup - no subprocess)
        if [ -z "${local_hashes[$branch_name]+isset}" ]; then
            # Branch doesn't exist locally at all
            # For new branches, check if we can get the commit date (if commit exists locally from other branches)
            if [ -n "$limit_date" ]; then
                local commit_date=$(git show -s --format=%cs "$remote_hash" 2>/dev/null)
                if [ -n "$commit_date" ] && [[ "$commit_date" < "$limit_date" ]]; then
                    continue
                fi
                # If commit doesn't exist locally, include it (we can't know its date)
            fi
            unfetched+=("$branch_name [new]")
        else
            # Branch exists locally
            local branch_date="${local_dates[$branch_name]}"

            # Apply date filter based on local branch date
            if [ -n "$limit_date" ] && [ -n "$branch_date" ] && [[ "$branch_date" < "$limit_date" ]]; then
                continue
            fi

            local local_hash="${local_hashes[$branch_name]}"
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
    done <<< "$remote_refs"

    printf '%s\n' "${unfetched[@]}"
}

# Function to get local branches from origin (except current), sorted by most recent commit
# Output format: branch_name|date_short|date_relative
# Args: $1 = limit_date (YYYY-MM-DD format, empty for no limit)
get_local_origin_branches() {
    local limit_date="$1"
    local current_branch=$(git branch --show-current)

    if [ -n "$limit_date" ]; then
        echo -e "${BLUE}Loading local branches (limiting to commits after $limit_date)...${NC}" >&2
    else
        echo -e "${BLUE}Loading local branches...${NC}" >&2
    fi

    # Batch: Load all origin remote branch names in one command
    declare -A origin_branches
    while read -r ref; do
        local branch="${ref#refs/remotes/origin/}"
        origin_branches["$branch"]=1
    done < <(git for-each-ref --format='%(refname)' refs/remotes/origin/)

    # Get all local branches sorted by committer date (most recent first)
    # Only include branches that have a corresponding remote on origin
    git for-each-ref --sort=-committerdate --format='%(refname:short)|%(committerdate:short)|%(committerdate:relative)' refs/heads/ | while read -r line; do
        local branch="${line%%|*}"
        local rest="${line#*|}"
        local date_short="${rest%%|*}"

        # Skip current branch
        if [ "$branch" = "$current_branch" ]; then
            continue
        fi

        # Apply date filter
        if [ -n "$limit_date" ] && [[ "$date_short" < "$limit_date" ]]; then
            continue
        fi

        # Check if this branch has a corresponding remote on origin (using associative array - no subprocess)
        if [ -n "${origin_branches[$branch]+isset}" ]; then
            echo "$line"
        fi
    done
}

# Function to display branches and get user selection (for unfetched branches)
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
        read -p "Select a branch to fetch [1-$count, q=quit, default: 1]: " selection >&2

        # Handle quit
        if [[ "$selection" =~ ^[Qq]$ ]]; then
            return 1
        fi

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

# Function to display existing branches with pagination
# Input format: branch_name|date_short|date_relative
select_existing_branch() {
    local branches=("$@")
    local count=${#branches[@]}
    local offset=0

    if [ "$count" -eq 0 ]; then
        echo -e "${GREEN}No local branches from origin available to merge.${NC}" >&2
        return 1
    fi

    while true; do
        local end=$((offset + PAGE_SIZE))
        if [ "$end" -gt "$count" ]; then
            end=$count
        fi

        echo -e "${BLUE}=== Local Branches (sorted by most recent commit) ===${NC}" >&2
        echo -e "${BLUE}Showing $((offset + 1))-$end of $count branches${NC}" >&2
        echo >&2

        for ((i=offset; i<end; i++)); do
            local line="${branches[$i]}"
            local branch_name="${line%%|*}"
            local rest="${line#*|}"
            local date_short="${rest%%|*}"
            local date_relative="${rest#*|}"
            echo "$((i - offset + 1)). $branch_name - $date_short ($date_relative)" >&2
        done
        echo >&2

        # Build prompt with navigation options
        local nav_options=""
        if [ "$offset" -gt 0 ]; then
            nav_options="${nav_options}p=previous, "
        fi
        if [ "$end" -lt "$count" ]; then
            nav_options="${nav_options}n=next, "
        fi

        local page_count=$((end - offset))
        read -p "Select branch [1-$page_count, ${nav_options}q=quit]: " selection >&2

        case "$selection" in
            p|P)
                if [ "$offset" -gt 0 ]; then
                    offset=$((offset - PAGE_SIZE))
                    if [ "$offset" -lt 0 ]; then
                        offset=0
                    fi
                fi
                echo >&2
                ;;
            n|N)
                if [ "$end" -lt "$count" ]; then
                    offset=$((offset + PAGE_SIZE))
                fi
                echo >&2
                ;;
            q|Q|"")
                return 1
                ;;
            *)
                if [[ "$selection" =~ ^[0-9]+$ ]] && [ "$selection" -ge 1 ] && [ "$selection" -le "$page_count" ]; then
                    # Return just the branch name, not the full line with dates
                    local selected_line="${branches[$((offset + selection - 1))]}"
                    echo "${selected_line%%|*}"
                    return 0
                else
                    echo -e "${RED}Invalid selection. Please enter a number between 1 and $page_count.${NC}" >&2
                fi
                ;;
        esac
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

# Function to perform the merge (shared between both modes)
perform_merge() {
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

        echo

        # Ask if user wants to clean temporary files
        read -p "Do you want to clean temporary files? [y/N]: " clean_confirm

        # Default to N if user just presses enter
        if [ -z "$clean_confirm" ]; then
            clean_confirm="N"
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

            # Unstage and discard changes in docs/json/developer/test-results/
            if [ -d "docs/json/developer/test-results" ]; then
                # First, resolve any merge conflicts in this directory by removing the files
                git diff --name-only --diff-filter=U | grep "^docs/json/developer/test-results/" | while read -r file; do
                    rm -f "$file"
                    git add "$file" 2>/dev/null || true
                done
                git reset -- docs/json/developer/test-results/ 2>/dev/null || true
                git checkout -- docs/json/developer/test-results/ 2>/dev/null || true
                git clean -fd docs/json/developer/test-results/ 2>/dev/null || true
            fi

            # Remove text and log files in project root directory
            shopt -s nullglob
            for txtfile in *.txt *.log; do
                # First, check if file has merge conflicts and resolve by removing
                if git diff --name-only --diff-filter=U | grep -q "^${txtfile}$"; then
                    rm -f "$txtfile"
                    git add "$txtfile" 2>/dev/null || true
                    echo "  Removed conflicted: $txtfile"
                # Check if file is NOT tracked in the repository (using ls-tree on HEAD)
                elif [ -z "$(git ls-tree HEAD "$txtfile" 2>/dev/null)" ]; then
                    # File is not in the repository, safe to remove
                    git reset -- "$txtfile" 2>/dev/null || true
                    rm -f "$txtfile"
                    echo "  Removed: $txtfile"
                fi
            done
            shopt -u nullglob

            # Unstage and discard changes in scripts/data/world-mapping.json
            if [ -f "scripts/data/world-mapping.json" ]; then
                # First, resolve any merge conflicts by checking out ours
                if git diff --name-only --diff-filter=U | grep -q "^scripts/data/world-mapping.json$"; then
                    git checkout --ours "scripts/data/world-mapping.json"
                    git add "scripts/data/world-mapping.json" 2>/dev/null || true
                    echo "  Resolved conflict: scripts/data/world-mapping.json (kept ours)"
                else
                    git reset -- scripts/data/world-mapping.json 2>/dev/null || true
                    git checkout -- scripts/data/world-mapping.json 2>/dev/null || true
                fi
            fi

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
                    # Collect conflict files first to avoid subshell/pipe issues with git index.lock
                    mapfile -t conflict_files < <(git diff --name-only --diff-filter=U)
                    for file in "${conflict_files[@]}"; do
                        git checkout --theirs "$file"
                        git add "$file"
                        echo "  Resolved: $file (accepted theirs)"
                    done
                    echo -e "${GREEN}All conflicts resolved by accepting incoming changes.${NC}"
                    ;;
                3)
                    echo -e "${YELLOW}Resolving conflicts by accepting ours...${NC}"
                    # Collect conflict files first to avoid subshell/pipe issues with git index.lock
                    mapfile -t conflict_files < <(git diff --name-only --diff-filter=U)
                    for file in "${conflict_files[@]}"; do
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

        return 0
    else
        echo -e "${BLUE}Skipped merge.${NC}"
        return 1
    fi
}

# Function to perform fetch and merge
fetch_and_merge() {
    local branch_with_status="$1"
    local merge_type="$2"

    # Extract branch name by removing status suffix
    local branch_name="${branch_with_status%% \[*\]}"

    echo -e "${YELLOW}Fetching branch: $branch_name${NC}"

    # Fetch the specific branch
    git fetch origin "$branch_name:$branch_name"

    echo -e "${GREEN}Successfully fetched $branch_name${NC}"
    echo

    # Perform merge
    perform_merge "$branch_name" "$merge_type"
}

# Function to select mode
# Returns: mode|limit_date (e.g., "fetch|2025-01-01" or "merge|")
select_mode() {
    local one_week_ago=$(date -d "1 week ago" +%Y-%m-%d)

    echo -e "${BLUE}=== Select Mode ===${NC}" >&2
    echo "1. Fetch and merge unfetched branches - last week (default)" >&2
    echo "2. Fetch and merge unfetched branches - all" >&2
    echo "3. Merge existing local branches - last week" >&2
    echo "4. Merge existing local branches - all" >&2
    echo >&2

    read -p "Select mode [1]: " mode_choice >&2

    if [ -z "$mode_choice" ]; then
        mode_choice=1
    fi

    case "$mode_choice" in
        1)
            echo "fetch|$one_week_ago"
            ;;
        2)
            echo "fetch|"
            ;;
        3)
            echo "merge|$one_week_ago"
            ;;
        4)
            echo "merge|"
            ;;
        *)
            # Default to option 1
            echo "fetch|$one_week_ago"
            ;;
    esac
}

# Main loop
main() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Interactive Branch Fetch & Merge${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo

    # Select mode (returns "mode_type|limit_date")
    local mode_result=$(select_mode)
    local mode_type="${mode_result%%|*}"
    local limit_date="${mode_result#*|}"
    echo

    if [ "$mode_type" = "fetch" ]; then
        # Fetch and merge unfetched branches
        while true; do
            # Get unfetched branches (refresh list)
            mapfile -t unfetched_branches < <(get_unfetched_branches "$limit_date")

            # If no branches with updates, switch to merge mode
            if [ "${#unfetched_branches[@]}" -eq 0 ]; then
                echo -e "${GREEN}All remote branches are up to date!${NC}"
                echo -e "${YELLOW}Switching to merge existing branches mode.${NC}"
                echo
                mode_type="merge"
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

            # Ask if user wants to continue
            read -p "Continue with another branch? [Y/n]: " continue_choice

            if [[ "$continue_choice" =~ ^[Nn]$ ]]; then
                echo -e "${BLUE}Exiting fetch mode.${NC}"
                break
            fi

            echo
            echo -e "${BLUE}========================================${NC}"
            echo
        done
    fi

    if [ "$mode_type" = "merge" ]; then
        # Merge existing local branches
        echo -e "${BLUE}=== Merge Existing Branches Mode ===${NC}"
        echo

        while true; do
            # Get local branches from origin
            mapfile -t local_branches < <(get_local_origin_branches "$limit_date")

            if [ "${#local_branches[@]}" -eq 0 ]; then
                echo -e "${GREEN}No local branches from origin available to merge.${NC}"
                break
            fi

            # Select branch with pagination
            selected_branch=$(select_existing_branch "${local_branches[@]}")
            if [ $? -ne 0 ]; then
                break
            fi

            echo -e "${GREEN}Selected branch: $selected_branch${NC}"
            echo

            # Select merge type
            merge_type=$(select_merge_type)
            echo

            # Perform merge (no fetch needed)
            perform_merge "$selected_branch" "$merge_type"
            echo

            # Ask if user wants to continue
            read -p "Continue with another branch? [Y/n]: " continue_choice

            if [[ "$continue_choice" =~ ^[Nn]$ ]]; then
                break
            fi

            echo
            echo -e "${BLUE}========================================${NC}"
            echo
        done
    fi

    echo -e "${GREEN}Done!${NC}"
}

# Run main function
main
