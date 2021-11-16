require 'optparse'
require 'fileutils'
require 'open3'

WINDOWS = RUBY_PLATFORM.match(/cygwin|mswin|mingw|bccwin|wince|emx/)
TMP_FOLDER = "thrift-temp"
THRIFT_EXE_NAME_WIN = "thrift.exe"
THRIFT_EXE_NAME_LINUX = "thrift"
DEFINITIONS_FILENAME = "com.iar.services.ide-9.0.6-thrift.zip"
DEFINITIONS_URL = "http://seupp-s-ci02.ad.iar.com:8080/job/thrift-services/job/thrift-services-ide-9.0.x/lastSuccessfulBuild/artifact/Services/ThriftServiceDefinitions/com.iar.services.ide/target/" + DEFINITIONS_FILENAME

#----------------------------------------------------------------------

def error(str)
  for line in [str].flatten
    STDERR.puts "ERROR: " + line
  end
  exit(1)
end

def shell(cmd)
  puts ">>> #{cmd}"
  stdout, status = Open3.capture2(cmd)
  if ! $options[:quiet]
    puts stdout
  end
  if ! status.success?
    error "command failed: #{cmd}"
  end
end

#----------------------------------------------------------------------

$options = {}
OptionParser.new do |opts|
  opts.banner = "Usage: build.rb [iar-vsc-path] [options]\n"
  opts.banner.concat "iar-vsc-path should point to the 'Extension' folder of the iar-vsc project. "
  opts.banner.concat "You may also run this script in that folder directly."

  opts.on("-q", "--quiet", "Surpress output to stdout") do |q|
    $options[:quiet] = q
  end
  opts.on("--verbose", "Extra verbose, executing commands") do |q|
    $options[:verbose] = q
  end
  opts.on("-h", "--help", "Print this help") do
        puts opts
        exit
  end
  opts.on("-t", "--thrift-path THRIFT-PATH", "Specify the path to the thrift compiler to use") do |t|
    $options[:thrift] = t
  end
end.parse!

def logg(str)
  return if $options[:quiet]
  puts str
end

def valid_iar_vsc_path?(path)
  File.file? File.join(path, "package.json")
end

def valid_thrift_compiler?(path)
  return false unless File.file? path
  version_string = `#{path} -version`
  version_string.match(/^Thrift version [0-9\.]+$/)
end

#----------------------------------------------------------------------

def get_thrift_compiler
  path = $options[:thrift]
  return path if path

  name = WINDOWS ? THRIFT_EXE_NAME_WIN : THRIFT_EXE_NAME_LINUX

  thrift_for_ts = File.expand_path("../../thrift-for-ts", __dir__)
  path = File.join(thrift_for_ts, name)
  return path if File.file?(path)

  error [
    "couldn't find thrift compiler: #{thrift_for_ts}",
    "maybe use -t option",
  ]
end

#----------------------------------------------------------------------

def main
  # resolve path to extension
  case ARGV.size
  when 0
    iar_vsc_path = Dir.pwd
  when 1
    iar_vsc_path = File.expand_path(ARGV[0])
  else
    raise "too many arguments ...."
  end

  if !valid_iar_vsc_path?(iar_vsc_path)
    error("folder does not contain the 'iar-vsc' sources (no 'package.json'): #{iar_vsc_path}")
  end

  thrift_compiler_path = get_thrift_compiler()
  logg "Found thrift compiler: #{thrift_compiler_path}"
  raise "The thrift compiler does not seem to be valid." unless valid_thrift_compiler?(thrift_compiler_path)

  tmp_folder = File.join(iar_vsc_path, TMP_FOLDER)

  begin
    FileUtils.rm_rf(tmp_folder) if File.exist?(tmp_folder)
    FileUtils.mkdir_p(tmp_folder)
    Dir.chdir(tmp_folder)

    logg "Fetching Thrift definitions..."
    silent_opt = ($options[:verbose] ? "" : "-q")
    shell "wget #{silent_opt} #{DEFINITIONS_URL}"
    logg "Extracting and compiling Thrift definitions..."
    shell "unzip #{silent_opt} #{DEFINITIONS_FILENAME}"

    Dir.entries(Dir.pwd).select {|file| file.end_with?(".thrift")}.each do |file|
      command = "'#{thrift_compiler_path}' -gen js:ts,node -o #{Dir.pwd} #{File.join(Dir.pwd, file)}"
      logg command
      raise "Thrift definition failed to compile" unless system( command )
    end
    out_dir = File.join(Dir.pwd, "gen-nodejs")
    Dir.entries(out_dir).select {|file| not file.start_with?(".")}.each do |file|
      FileUtils.cp_r(File.join(out_dir, file), File.join(iar_vsc_path, "src/iar/project/thrift/bindings"))
    end

    Dir.chdir(iar_vsc_path)
    logg "Running 'npm install'..."
    shell "npm install"

    logg "Running TypeScript compiler..."
    shell "npm run compile"
  rescue StandardError => e
    FileUtils.rm_rf(tmp_folder)
    raise e
  else
    FileUtils.rm_rf(tmp_folder)
  end

  logg "Done building"
  logg "Generating .vsix file..."

  shell "npm install -g vsce"

  shell "vsce package --no-rewrite-relative-links"

  logg "Generating .vsix file..."
end

#----------------------------------------------------------------------
main()
#----------------------------------------------------------------------
