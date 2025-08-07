import sys
from pathlib import Path
import shlex

# Configuration for file discovery
SEARCH_CONFIG = [
    {
        'root_folder': 'frontend',
        'file_extensions': ['*.js'],
        'exclude_folders': ['libs']
    },
    {
        'root_folder': 'NewDocs', 
        'file_extensions': ['*.md', '*.txt'],
        'exclude_folders': ['old', 'scrap']
    },
    {
        'root_folder': 'docs/json', 
        'file_extensions': ['*.md', '*.txt'],
        'exclude_folders': []
    },
    {
        'root_folder': 'exporter',
        'file_extensions': ['*.py'],
        'exclude_folders': ['__pycache__']
    }
]

def extract_block_comments(content):
    """
    Extract content from /* */ style block comments and return both
    the content without block comments and the content from within block comments.
    Returns tuple: (content_without_comments, commented_content_lines)
    """
    result = []
    commented_lines = []
    i = 0
    while i < len(content):
        if i < len(content) - 1 and content[i:i+2] == '/*':
            # Found start of block comment, find the end
            end_pos = content.find('*/', i + 2)
            if end_pos != -1:
                # Extract the commented content
                comment_content = content[i+2:end_pos]
                commented_lines.extend(comment_content.splitlines())
                # Skip to after the closing */
                i = end_pos + 2
            else:
                # No closing */, extract rest as commented content
                comment_content = content[i+2:]
                commented_lines.extend(comment_content.splitlines())
                break
        else:
            result.append(content[i])
            i += 1
    return ''.join(result), commented_lines

def display_search_config():
    """
    Display the current search configuration for transparency.
    """
    print("Current search configuration:")
    for i, config in enumerate(SEARCH_CONFIG, 1):
        root_folder = config['root_folder']
        file_extensions = config['file_extensions']
        exclude_folders = config.get('exclude_folders', [])
        
        print(f"  {i}. Folder: '{root_folder}'")
        print(f"     Extensions: {', '.join(file_extensions)}")
        if exclude_folders:
            print(f"     Excluding: {', '.join(exclude_folders)}")
        else:
            print(f"     Excluding: (none)")
        print()

def process_settings_file(settings_path, output_path):
    """
    Read settings file and compile specified files into one output file.
    Each line in the settings file should be: "filename" [start_line end_line]
    If line numbers are provided, the heading for that file will be:
        "# File: filename (Lines X to Y of Z)"
    Lines in the settings file that begin with '#' are skipped.
    Block comments /* */ are also skipped.
    """
    with open(output_path, 'w', encoding='utf-8') as outfile:
        with open(settings_path, 'r', encoding='utf-8') as settings:
            content = settings.read()
            
            # Remove block comments /* */ (we don't need the commented content here)
            content, _ = extract_block_comments(content)
            
            for line in content.splitlines():
                # Skip empty lines initially (handled later for missing file check)
                if not line.strip():
                    continue
                    
                # Process actual file inclusion logic only for non-commented lines
                if not line.strip().startswith('#'):
                    try:
                        # Parse the settings line using shlex to handle quoted strings
                        parts = shlex.split(line.strip(), comments=True)
                        filename = parts[0]
                        start_line = int(parts[1]) if len(parts) > 1 else None
                        end_line = int(parts[2]) if len(parts) > 2 else None

                        with open(filename, 'r', encoding='utf-8') as infile:
                            # Read all lines to compute total_lines
                            lines = infile.readlines()
                            total_lines = len(lines)

                            # Determine effective start and end values
                            effective_start = start_line if start_line is not None else 1
                            effective_end = end_line if end_line is not None else total_lines

                            # Write header based on whether line numbers were provided
                            if start_line is not None or end_line is not None:
                                header = f"\n\n# File: {filename} (Lines {effective_start} to {effective_end} of {total_lines})\n\n"
                            else:
                                header = f"\n\n# File: {filename}\n\n"
                            outfile.write(header)

                            # Write the selected lines
                            # Adjust for 0-based indexing
                            selected_lines = lines[effective_start - 1: effective_end]
                            outfile.write("".join(selected_lines))
                    except FileNotFoundError:
                        outfile.write(f"\n\n======Error: Could not find file {filename}======\n")
                    except Exception as e:
                        outfile.write(f"\n\n======Error processing file {filename}: {str(e)}======\n")

def find_missing_files(context_list_path, output_missing_path='missingFiles.txt'):
    """
    Scans multiple directories for files of specified types, excluding specific subdirectories,
    and compares them against a list of files (including commented ones).
    Uses the SEARCH_CONFIG to determine what folders and file types to search.
    Writes any missing files to the specified output file.
    Returns the count of missing files.
    """
    listed_files = set()
    try:
        with open(context_list_path, 'r', encoding='utf-8') as context_file:
            content = context_file.read()
            
            # Extract block comments /* */ and process both regular and commented content
            content_without_blocks, block_commented_lines = extract_block_comments(content)
            
            # Process regular content (including # commented lines)
            for line in content_without_blocks.splitlines():
                cleaned_line = line.strip()
                filepath = None
                if cleaned_line and not cleaned_line.startswith('#'):
                    try:
                        parts = shlex.split(cleaned_line)
                        if parts:
                            filepath = parts[0].replace('\\', '/')
                    except ValueError: # Handle potential issues with shlex parsing
                        print(f"Warning: Could not parse line in {context_list_path}: {line.strip()}")
                        continue 
                elif cleaned_line.startswith('#'):
                    uncommented_line = cleaned_line[1:].strip()
                    if uncommented_line:
                        try:
                            parts = shlex.split(uncommented_line)
                            if parts:
                                filepath = parts[0].replace('\\', '/')
                        except ValueError:
                            print(f"Warning: Could not parse commented line in {context_list_path}: {line.strip()}")
                            continue
                
                if filepath:
                    listed_files.add(filepath)
            
            # Process block commented content (treat similar to # commented lines)
            for line in block_commented_lines:
                cleaned_line = line.strip()
                if cleaned_line and not cleaned_line.startswith('#'):
                    try:
                        parts = shlex.split(cleaned_line)
                        if parts:
                            filepath = parts[0].replace('\\', '/')
                            listed_files.add(filepath)
                    except ValueError:
                        print(f"Warning: Could not parse block commented line in {context_list_path}: {line.strip()}")
                        continue
                elif cleaned_line.startswith('#'):
                    # Handle # comments inside /* */ blocks
                    uncommented_line = cleaned_line[1:].strip()
                    if uncommented_line:
                        try:
                            parts = shlex.split(uncommented_line)
                            if parts:
                                filepath = parts[0].replace('\\', '/')
                                listed_files.add(filepath)
                        except ValueError:
                            print(f"Warning: Could not parse nested commented line in {context_list_path}: {line.strip()}")
                            continue

    except FileNotFoundError:
        print(f"======Error: Context list file {context_list_path} not found for missing file check======")
        return 0 # Cannot proceed without the context list

    found_files = []
    
    # Process each search configuration
    for config in SEARCH_CONFIG:
        root_folder = config['root_folder']
        file_extensions = config['file_extensions']
        exclude_folders = config.get('exclude_folders', [])
        
        root_path = Path(root_folder)
        if not root_path.is_dir():
            print(f"Warning: Directory {root_folder} not found, skipping...")
            continue

        # Build exclude paths for comparison
        exclude_paths = []
        for exclude_folder in exclude_folders:
            exclude_path = str(root_path / exclude_folder).replace('\\', '/') + '/'
            exclude_paths.append(exclude_path)

        # Search for files with each specified extension
        for extension in file_extensions:
            for file_path in root_path.rglob(extension):
                # Normalize found path for comparison
                relative_path_str = str(file_path).replace('\\', '/')
                
                # Check if the file is within any excluded subdirectory
                is_excluded = any(relative_path_str.startswith(exclude_path) for exclude_path in exclude_paths)
                
                if not is_excluded:
                    found_files.append(relative_path_str)

    # Sort files by directory first, then by filename within each directory
    missing_files_unsorted = [f for f in found_files if f not in listed_files]
    missing_files = sorted(missing_files_unsorted, key=lambda x: (str(Path(x).parent), Path(x).name))

    if missing_files:
        print(f"Found {len(missing_files)} files not listed in {context_list_path}:")
        for config in SEARCH_CONFIG:
            config_missing = [f for f in missing_files if f.startswith(config['root_folder'])]
            if config_missing:
                print(f"  - {len(config_missing)} files in '{config['root_folder']}' ({', '.join(config['file_extensions'])})")
        
        try:
            with open(output_missing_path, 'w', encoding='utf-8') as outfile:
                previous_directory = None
                for missing_file in missing_files:
                    current_directory = str(Path(missing_file).parent)
                    
                    # Add empty line if we're switching to a different directory
                    if previous_directory is not None and current_directory != previous_directory:
                        outfile.write("\n")
                    
                    outfile.write(f"{missing_file}\n")
                    previous_directory = current_directory
            print(f"List of missing files written to {output_missing_path}")
        except IOError as e:
            print(f"======Error: Could not write missing files to {output_missing_path}: {e}======")
    else:
        print(f"All files found in configured directories are listed in {context_list_path}.")
        # Optionally delete the missing files list if it exists and is empty
        missing_file_path_obj = Path(output_missing_path)
        if missing_file_path_obj.exists():
            try:
                missing_file_path_obj.unlink()
                print(f"Removed empty or outdated {output_missing_path}")
            except OSError as e:
                 print(f"======Error: Could not remove {output_missing_path}: {e}======")
    
    return len(missing_files)

def find_nonexistent_files(context_list_path, output_missing_path='missingFiles.txt'):
    """
    Checks which files listed in the context list don't actually exist in the filesystem.
    Appends these to a separate section in the missing files output.
    Returns the count of nonexistent files.
    """
    nonexistent_files = []
    
    try:
        with open(context_list_path, 'r', encoding='utf-8') as context_file:
            content = context_file.read()
            
            # Extract block comments /* */ and process both regular and commented content
            content_without_blocks, block_commented_lines = extract_block_comments(content)
            
            # Process regular content (including # commented lines)
            for line in content_without_blocks.splitlines():
                cleaned_line = line.strip()
                if cleaned_line and not cleaned_line.startswith('#'):
                    try:
                        parts = shlex.split(cleaned_line)
                        if parts:
                            filepath = parts[0]
                            if not Path(filepath).exists():
                                nonexistent_files.append(filepath)
                    except ValueError:
                        print(f"Warning: Could not parse line in {context_list_path}: {line.strip()}")
                        continue
            
            # Process block commented content (check existence like regular commented files would)
            for line in block_commented_lines:
                cleaned_line = line.strip()
                if cleaned_line and not cleaned_line.startswith('#'):
                    try:
                        parts = shlex.split(cleaned_line)
                        if parts:
                            filepath = parts[0]
                            if not Path(filepath).exists():
                                nonexistent_files.append(filepath)
                    except ValueError:
                        print(f"Warning: Could not parse block commented line in {context_list_path}: {line.strip()}")
                        continue
    except FileNotFoundError:
        print(f"======Error: Context list file {context_list_path} not found for nonexistent file check======")
        return 0
    
    if nonexistent_files:
        print(f"Found {len(nonexistent_files)} files listed in {context_list_path} that don't exist.")
        try:
            # Append to the file (or create if it doesn't exist)
            with open(output_missing_path, 'a', encoding='utf-8') as outfile:
                outfile.write("\n\n# Files listed in context but don't exist:\n")
                previous_directory = None
                for missing_file in nonexistent_files:
                    current_directory = str(Path(missing_file).parent)
                    
                    # Add empty line if we're switching to a different directory
                    if previous_directory is not None and current_directory != previous_directory:
                        outfile.write("\n")
                    
                    outfile.write(f"{missing_file}\n")
                    previous_directory = current_directory
        except IOError as e:
            print(f"======Error: Could not write nonexistent files to {output_missing_path}: {e}======")
    else:
        print(f"All files listed in {context_list_path} exist.")
    
    return len(nonexistent_files)

def main():
    if len(sys.argv) != 3:
        print("Usage: python Context.py ContextList.txt output.txt") # Updated usage message
        sys.exit(1)
    
    settings_path = Path(sys.argv[1]) # This is ContextList.txt
    output_path = Path(sys.argv[2])  # This is the combined output file
    missing_files_output_path = Path('missingFiles.txt') # Define path for missing files output
    
    if not settings_path.exists():
        print(f"======Error: Settings file {settings_path} not found======")
        sys.exit(1)
        
    print(f"Processing context list: {settings_path}")
    display_search_config()
    process_settings_file(settings_path, output_path)
    print(f"Combined file created at {output_path}")

    # Make sure the missing files output doesn't exist before checking
    if missing_files_output_path.exists():
        missing_files_output_path.unlink()

    print(f"\nChecking for missing files in configured directories...")
    missing_file_count = find_missing_files(
        context_list_path=settings_path, 
        output_missing_path=missing_files_output_path
    )
    
    print(f"\nChecking for files in {settings_path} that don't exist...")
    nonexistent_count = find_nonexistent_files(
        context_list_path=settings_path,
        output_missing_path=missing_files_output_path
    )
    
    # Add visual separators based on status
    print()  # Add blank line before separators
    if missing_file_count > 0 and nonexistent_count > 0:
        # Both missing and nonexistent files
        print("-" * 60)  # Missing files indicator
        print("+" * 60)  # Nonexistent files indicator
    elif missing_file_count > 0:
        # Only missing files
        print("-" * 60)
    elif nonexistent_count > 0:
        # Only nonexistent files
        print("+" * 60)
    else:
        # No issues
        print("=" * 60)
    
    print("\nScript finished.")

if __name__ == "__main__":
    main()
