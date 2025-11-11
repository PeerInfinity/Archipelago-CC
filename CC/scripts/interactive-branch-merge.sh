#!/bin/bash

# Interactive Branch Fetch and Merge Script
# This script helps you fetch and merge remote branches interactively

# Color codes for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to get unfetched branches (remote branches without local counterpart)
get_unfetched_branches() {
    local unfetched=()

    # Get all remote branches directly from the remote server (without fetching)
    while IFS=$'\t' read -r hash ref; do
        # Extract branch name from refs/heads/branch_name
        local branch_name="${ref#refs/heads/}"

        # Check if local branch exists
        if ! git show-ref --verify --quiet "refs/heads/$branch_name"; then
            unfetched+=("$branch_name")
        fi
    done < <(git ls-remote --heads origin)

    printf '%s\n' "${unfetched[@]}"
}

# Function to display branches and get user selection
select_branch() {
    local branches=("$@")
    local count=${#branches[@]}

    if [ "$count" -eq 0 ]; then
        echo -e "${GREEN}All remote branches have been fetched!${NC}" >&2
        return 1
    fi

    echo -e "${BLUE}=== Unfetched Branches ===${NC}" >&2
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

# Function to perform fetch and merge
fetch_and_merge() {
    local branch_name="$1"
    local merge_type="$2"

    echo -e "${YELLOW}Fetching branch: $branch_name${NC}"

    # Fetch the specific branch
    git fetch origin "$branch_name:$branch_name"

    echo -e "${GREEN}Successfully fetched $branch_name${NC}"
    echo

    # Ask if user wants to merge now
    read -p "Do you want to merge $branch_name into the current branch? [y/N]: " merge_confirm

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

    while true; do
        # Get unfetched branches
        mapfile -t unfetched_branches < <(get_unfetched_branches)

        # If no unfetched branches, exit
        if [ "${#unfetched_branches[@]}" -eq 0 ]; then
            echo -e "${GREEN}All remote branches have been fetched!${NC}"
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
            echo -e "${GREEN}That was the last unfetched branch!${NC}"
            break
        fi

        # Ask if user wants to continue
        echo -e "${BLUE}Remaining unfetched branches: ${#remaining_branches[@]}${NC}"
        read -p "Continue with another branch? [Y/n]: " continue_choice

        if [[ "$continue_choice" =~ ^[Nn]$ ]]; then
            echo -e "${BLUE}Exiting. You can run this script again to fetch remaining branches.${NC}"
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
