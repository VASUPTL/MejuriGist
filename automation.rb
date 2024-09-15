require 'xcodeproj'
require 'json'
require 'optparse'

options = {}

OptionParser.new do |opts|
  opts.banner = "Usage: ruby script.rb [options]"

  opts.on("-s", "--source-directory DIRECTORY", "Source directory") do |directory|
    options[:source_directory] = directory
  end

  opts.on("-n", "--new-app-name NAME", "New app name") do |name|
    options[:new_app_name] = name
  end

  opts.on_tail("-h", "--help", "Show this message") do
    puts opts
    exit
  end
end.parse!

# Check if source directory and new app name are provided
unless options[:source_directory] && options[:new_app_name]
  puts "Error: Please provide both source directory and new app name."
  exit 1
end

source_directory = options[:source_directory]
new_target_name = options[:new_app_name]

puts "📱#{' ' * 10}iOS Section#{' ' * 10}📱"
puts "🔹#{'-' * 46}🔹"

project_path = './../apps/mobile/ios/springbigqa.xcodeproj'
target_name_to_duplicate = 'haven'

# Function to duplicate a target
def duplicate_target(project, original_target, new_target_name)
  # Create a new target with the same attributes as the original target
  duplicated_target = project.new_target(original_target.symbol_type, new_target_name, original_target.platform_name)

  # Set a unique product name for the duplicated target
  duplicated_target.product_name = new_target_name

  # Copy build configurations from original to duplicated target
  original_target.build_configurations.each do |config|
    new_config = duplicated_target.add_build_configuration(config.name, config.base_configuration_reference)
    config.build_settings.each { |key, value| new_config.build_settings[key] = value }
  end

  # Remove existing Compile Resources and Copy Bundle Resources build phases from duplicated target
  duplicated_target.build_phases.delete_if do |phase|
    phase.is_a?(Xcodeproj::Project::Object::PBXResourcesBuildPhase) || phase.is_a?(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase)
  end

  # Copy build phases from original to duplicated target
  original_target.build_phases.each do |phase|
    duplicated_target.build_phases << phase.dup
  end

  phases_to_remove = duplicated_target.build_phases.select do |phase|
    phase.is_a?(Xcodeproj::Project::Object::PBXResourcesBuildPhase) ||
    phase.is_a?(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase) ||
    phase.is_a?(Xcodeproj::Project::Object::PBXSourcesBuildPhase)
  end

  # Remove the identified build phases from the duplicated target
  phases_to_remove.each do |phase|
    duplicated_target.build_phases.delete(phase)
  end

  # Create a new Bundle Resources (PBXResourcesBuildPhase) build phase
  new_resources_phase = project.new(Xcodeproj::Project::Object::PBXResourcesBuildPhase)


  # Define an array of UUIDs of resources to add (ensure these UUIDs are correct)
  bundle_resources_uuids = [
    'THIS_IS_UUID_EXAMPLE',
    'THIS_IS_UUID_EXAMPLE',
    'THIS_IS_UUID_EXAMPLE',
    'THIS_IS_UUID_EXAMPLE',
    'THIS_IS_UUID_EXAMPLE',
    'THIS_IS_UUID_EXAMPLE',
    'THIS_IS_UUID_EXAMPLE'
  ]

  # Add each resource to the new Copy Bundle Resources phase
  bundle_resources_uuids.each do |uuid|
    # Find the file reference in the project by UUID
    file_ref = project.objects_by_uuid[uuid]

    # Add file reference to resources phase if it exists
    if file_ref
      new_resources_phase.add_file_reference(file_ref)
    else
      puts "File reference not found for UUID: #{uuid}"
    end
  end

  # Add the new phase to the duplicated target's build phases
  duplicated_target.build_phases << new_resources_phase

  # Create a new Compile Sources (PBXSourcesBuildPhase) build phase
  new_build_phase = project.new(Xcodeproj::Project::Object::PBXSourcesBuildPhase)
  build_resources = [ 
    'THIS_IS_UUID_EXAMPLE',
    'THIS_IS_UUID_EXAMPLE',
    'THIS_IS_UUID_EXAMPLE'
  ]

  # Add each source file to the Sources build phase
  build_resources.each do |uuid|
    # Find the file reference in the project by UUID
    file_ref = project.objects_by_uuid[uuid]

    # Add file reference to sources phase if it exists
    if file_ref
      new_build_phase.add_file_reference(file_ref)
    else
      puts "File reference not found for UUID: #{uuid}"
    end
  end
  
  duplicated_target.build_phases << new_build_phase

  # Create a new product reference for the duplicated target
  duplicated_target.product_reference = project.new_file("#{new_target_name}.app")
  duplicated_target.product_type = original_target.product_type


  duplicated_target
end

def add_target_to_podfile(podfile_path, new_target_name)
  # Read the contents of the Podfile
  podfile_content = File.read(podfile_path)

  # Add the new target to the Podfile content
  new_target_block = "\ntarget '#{new_target_name}' do\n  # Pods for #{new_target_name}\nend\n\n"
  updated_podfile_content = podfile_content + new_target_block

  # Write the updated content back to the Podfile
  File.write(podfile_path, updated_podfile_content)

  puts "➕ Added Pod in '#{new_target_name}' Podfile.\n"
end

# Open the Xcode project
project = Xcodeproj::Project.open(project_path)

# Find the target to duplicate
target_to_duplicate = project.targets.find { |target| target.name == target_name_to_duplicate }

# Check if target exists
if target_to_duplicate.nil?
  puts "❌ Target '#{target_name_to_duplicate}' not found in the project.\n"
  exit
end

# Duplicate the target
duplicated_target = duplicate_target(project, target_to_duplicate, new_target_name)

# Add the duplicated target to the project
project.targets << duplicated_target

# Create a group with the same name as the new target under 'Assets' directory
group_name = new_target_name
parent_group = project.main_group['Assets']
new_group = parent_group.new_group(group_name)

# Ensure the group directory exists
group_path = File.join('./../apps/mobile/ios', 'Assets', group_name)
puts "📁 Creating directory for group '#{group_name}'...\n"
Dir.mkdir(group_path) unless Dir.exist?(group_path)

# Add a file under the new group
file_name = 'config.json'
file_content = { "client_name" => new_target_name }
file_path = File.join(group_path, file_name)
puts "📄 Creating file '#{file_name}' under the group '#{group_name}'...\n"
File.write(file_path, JSON.generate(file_content))

# Add the file to the Xcode project
new_file = new_group.new_file(file_path)

# Add files from the folder to the group
folder_path = './../apps/mobile/base_files/'  # Update with the path to your folder
puts "📁 Copying files from '#{folder_path}' to the '#{group_name}' group...\n"
Dir.glob(File.join(folder_path, '*')).each do |file|
  file_name = File.basename(file)
  # Construct the correct path relative to the group
  new_file_path = File.join(group_path, file_name)
  FileUtils.cp(file, new_file_path)
  new_file = new_group.new_file(new_file_path)
end

# New filenames
new_app_icon_name = "#{new_target_name.capitalize}AppIcon"
new_plist_name = "#{new_target_name}-Info.plist"

# Find the newly created target
new_target = project.targets.last

# Update build settings for the new target
new_target.build_configurations.each do |config|
  config.build_settings['ASSETCATALOG_COMPILER_APPICON_NAME'] = new_app_icon_name
  config.build_settings['INFOPLIST_FILE'] = new_plist_name
end

# Save changes to the Xcode project
puts "💾 Saving changes to the Xcode project...\n"
project.save

# Copy specific files from the iOS source directory to the iOS group
ios_files_to_copy = ['app_icon.png', 'GoogleService-Info.plist']

ios_files_to_copy.each do |ios_file_name|
  ios_source_file_path = File.join(source_directory, ios_file_name)
  ios_destination_file_path = File.join(group_path, ios_file_name)

  FileUtils.cp(ios_source_file_path, ios_destination_file_path)
  ios_new_file = new_group.new_file(ios_destination_file_path)
end

# Copy the haven-Info.plist file and rename it
source_plist_path = './../apps/mobile/ios/haven-Info.plist'
destination_plist_path = "./../apps/mobile/ios/#{new_target_name}-Info.plist"

FileUtils.cp(source_plist_path, destination_plist_path)

puts "✅ Copied 'haven-Info.plist' to '#{new_target_name}-Info.plist' successfully.\n"

# Path to your Podfile
podfile_path = './../apps/mobile/ios/Podfile'

# Call the method to add the new target to the Podfile
add_target_to_podfile(podfile_path, new_target_name)

puts "🎉 Group '#{group_name}' created with file '#{file_name}' and other files in it.\n"
